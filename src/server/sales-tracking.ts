import {Hono} from 'hono';
import {z} from 'zod';
import {digest, fail, guard, operation, type OperationEnv} from './operations';
import {assessTrackingPoint, TRACKING_POLICY} from '../shared/tracking-policy';
import {businessClock,businessDayStart,businessUtcBounds} from './calendar';
import type {Scope} from './scope';

/** Tracking consent is separate from attendance and must be initiated by the user. */
export const salesTracking = new Hono<OperationEnv>();

function summaryExpiry(date:string,timezone:string) {
 const [year,month,day]=date.split('-').map(Number),target=new Date(Date.UTC(year,month-1+TRACKING_POLICY.summaryRetentionMonths,1));
 const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(day,lastDay));
 return businessDayStart(target.toISOString().slice(0,10),timezone);
}

function requireSales(c: any) {
 const identity = c.get('scope').identity;
 if (identity.role !== 'SALES_REP' || identity.id.startsWith('portfolio-') || identity.performed_by) fail(403, 'TRACKING_SALES_REQUIRED');
 return identity;
}

salesTracking.get('/api/sales-tracking/session', async c => {
 const identity = requireSales(c);
 const row = await c.env.DB.prepare("SELECT id,started_at,state FROM sales_tracking_session WHERE organization_id=? AND user_id=? AND state='active'")
  .bind(identity.organization_id, identity.id).first();
 return c.json({data: row ?? null,meta:{server_time:new Date().toISOString()}});
});

salesTracking.post('/api/sales-tracking/session', async c => {
 const identity = requireSales(c);
 const input = z.object({consent: z.literal(true)}).strict().safeParse(await c.req.json().catch(() => null));
 if (!input.success) fail(422, 'TRACKING_CONSENT_REQUIRED');
 if (!(c.env as OperationEnv['Bindings'] & {TRACKING_POINTS?:R2Bucket}).TRACKING_POINTS) return c.json({code:'TRACKING_STORAGE_UNAVAILABLE'},503);
 return operation(c, input.data, async () => {
  const current = await c.env.DB.prepare("SELECT id FROM sales_tracking_session WHERE organization_id=? AND user_id=? AND state='active'").bind(identity.organization_id, identity.id).first();
  if (current) fail(409, 'TRACKING_SESSION_ALREADY_ACTIVE');
  const data = {id: crypto.randomUUID(), started_at: new Date().toISOString(), state: 'active' as const};
  return {resource: 'sales-tracking-session', status: 201, data, statements: [c.env.DB.prepare('INSERT INTO sales_tracking_session(id,organization_id,user_id,started_at,state) VALUES(?,?,?,?,?)').bind(data.id, identity.organization_id, identity.id, data.started_at, data.state)]};
 }, false);
});

salesTracking.post('/api/sales-tracking/session/:id/stop', async c => {
 const identity = requireSales(c);
 const input = z.object({stopped_at: z.iso.datetime()}).strict().safeParse(await c.req.json().catch(() => null));
 if (!input.success) fail(422, 'TRACKING_STOP_TIME_REQUIRED');
 return operation(c, input.data, async () => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT id,started_at,state FROM sales_tracking_session WHERE organization_id=? AND user_id=? AND id=?').bind(identity.organization_id, identity.id, id).first<{id:string;started_at:string;state:string}>();
  if (!row) fail(404, 'TRACKING_SESSION_NOT_FOUND');
  if (row.state !== 'active') fail(409, 'TRACKING_SESSION_STOPPED');
  const stopped = Date.parse(input.data.stopped_at);
  if (stopped < Date.parse(row.started_at) || stopped > Date.now() + 300_000) fail(422, 'TRACKING_STOP_TIME_INVALID');
  const data = {id, state: 'stopped' as const, stopped_at: new Date(stopped).toISOString()};
  const org=await c.env.DB.prepare('SELECT timezone FROM organization WHERE id=?').bind(identity.organization_id).first<{timezone:string}>();if(!org)fail(503,'TRACKING_ORGANIZATION_UNAVAILABLE');
  const expires=summaryExpiry(businessClock(new Date(stopped),org.timezone).date,org.timezone);
  return {resource:'sales-tracking-session', data, statements:guard(c.env.DB,c.env.DB.prepare("UPDATE sales_tracking_session SET state='stopped',stopped_at=?,expires_at=? WHERE id=? AND organization_id=? AND user_id=? AND state='active' AND NOT EXISTS(SELECT 1 FROM sales_tracking_batch b WHERE b.organization_id=? AND b.session_id=? AND b.last_captured_at>?)").bind(data.stopped_at,expires,id,identity.organization_id,identity.id,identity.organization_id,id,data.stopped_at))};
 }, false);
});

const fix = z.object({latitude:z.number().finite(),longitude:z.number().finite(),accuracy_m:z.number().finite(),captured_at:z.iso.datetime()}).strict();
const batch = z.object({batch_id:z.uuid(),points:z.array(fix).min(1).max(TRACKING_POLICY.maxBatchPoints)}).strict();

function trackingRepScope(s:Scope) {
 if (s.identity.id.startsWith('portfolio-') || s.identity.performed_by || s.channel==='telesales') fail(403,'TRACKING_SCOPE_DENIED');
 let sql='u.organization_id=?',params:string[]=[s.identity.organization_id];
 if(!s.orgWide) {
  if(!s.allRepsInArea) {sql+=' AND u.id IN(SELECT value FROM json_each(?))';params.push(JSON.stringify(s.repIds));}
  if(s.allRepsInArea||s.identity.role==='SUPERVISOR') {sql+=' AND EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=u.organization_id AND a.user_id=u.id AND a.area_id IN(SELECT value FROM json_each(?)) AND a.effective_from_date<=? AND(a.effective_to_date IS NULL OR a.effective_to_date>?))';params.push(JSON.stringify(s.areaIds),s.date,s.date);}
 }
 return {sql,params};
}

salesTracking.get('/api/sales-tracking/latest',async c=>{
 const scope=c.get('scope'),p=trackingRepScope(scope), now=new Date().toISOString();
 const query=z.object({offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(c.req.query());if(!query.success)fail(422,'TRACKING_FILTER_INVALID');
 const detailCutoff=new Date(Date.now()-TRACKING_POLICY.detailRetentionDays*86_400_000).toISOString();
 const rows=await c.env.DB.prepare(`SELECT u.id,u.name,d.last_latitude AS lat,d.last_longitude AS lng,d.last_accuracy_m AS accuracy_m,d.last_captured_at AS last_seen,EXISTS(SELECT 1 FROM sales_tracking_session s WHERE s.organization_id=u.organization_id AND s.user_id=u.id AND s.state='active') AS session_active FROM app_user u JOIN sales_tracking_daily_summary d ON d.organization_id=u.organization_id AND d.user_id=u.id WHERE ${p.sql} AND d.last_latitude IS NOT NULL AND d.last_captured_at>? AND d.last_captured_at=(SELECT MAX(d2.last_captured_at) FROM sales_tracking_daily_summary d2 WHERE d2.organization_id=u.organization_id AND d2.user_id=u.id AND d2.expires_at>?) AND d.expires_at>? ORDER BY u.name,u.id LIMIT 101 OFFSET ?`).bind(...p.params,detailCutoff,now,now,query.data.offset).all();
 return c.json({data:rows.results.slice(0,100),meta:{has_more:rows.results.length>100,next_offset:query.data.offset+100}});
});

salesTracking.get('/api/sales-tracking/history',async c=>{
 const p=trackingRepScope(c.get('scope'));
 const q=z.object({user_id:z.string().min(1).max(128),date:z.iso.date(),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(c.req.query());
 if(!q.success) fail(422,'TRACKING_FILTER_INVALID');
 const scope=c.get('scope'),org=scope.identity.organization_id;
 if(!await c.env.DB.prepare('SELECT u.id FROM app_user u WHERE u.id=? AND '+p.sql).bind(q.data.user_id,...p.params).first()) fail(404,'TRACKING_USER_NOT_FOUND');
 const bucket=(c.env as OperationEnv['Bindings']&{TRACKING_POINTS?:R2Bucket}).TRACKING_POINTS;
 if(!bucket) return c.json({code:'TRACKING_STORAGE_UNAVAILABLE'},503);
 const row=await c.env.DB.prepare('SELECT timezone FROM organization WHERE id=?').bind(org).first<{timezone:string}>();if(!row)fail(503,'TRACKING_ORGANIZATION_UNAVAILABLE');
 const bounds=businessUtcBounds(q.data.date,q.data.date,row.timezone),now=new Date().toISOString();
 const manifest=await c.env.DB.prepare("SELECT b.object_key FROM sales_tracking_batch b JOIN sales_tracking_session s ON s.id=b.session_id AND s.organization_id=b.organization_id WHERE b.organization_id=? AND s.user_id=? AND b.state='ready' AND b.expires_at>? AND b.last_captured_at>=? AND b.first_captured_at<? ORDER BY b.first_captured_at,b.batch_id LIMIT 51 OFFSET ?").bind(org,q.data.user_id,now,bounds.from,bounds.until,q.data.offset).all<{object_key:string}>();
 const points:Array<z.infer<typeof fix>>=[];
 for(const item of manifest.results.slice(0,50)) {
  const object=await bucket.get(item.object_key);if(!object)fail(503,'TRACKING_HISTORY_INCOMPLETE');
  const parsed=z.object({version:z.literal(1),points:z.array(fix).max(100)}).strict().safeParse(JSON.parse(await object.text()));
  if(!parsed.success)fail(503,'TRACKING_HISTORY_INCOMPLETE');
  points.push(...parsed.data.points.filter(x=>x.captured_at>=bounds.from&&x.captured_at<bounds.until));
 }
 points.sort((a,b)=>a.captured_at.localeCompare(b.captured_at));
 return c.json({data:points,meta:{has_more:manifest.results.length>50,next_offset:q.data.offset+50}});
});

// Immutable content-addressed R2 writes make retries safe even if D1 and R2 fail separately.
salesTracking.post('/api/sales-tracking/session/:id/batches', async c => {
 const identity = requireSales(c), db = c.env.DB, sessionId = c.req.param('id');
 const bucket = (c.env as OperationEnv['Bindings'] & {TRACKING_POINTS?:R2Bucket}).TRACKING_POINTS;
 if (!bucket) return c.json({code:'TRACKING_STORAGE_UNAVAILABLE'},503);
 const input = batch.safeParse(await c.req.json().catch(() => null));
 if (!input.success) fail(422,'TRACKING_BATCH_INVALID');
 const row = await db.prepare('SELECT id,started_at,stopped_at FROM sales_tracking_session WHERE organization_id=? AND user_id=? AND id=?').bind(identity.organization_id,identity.id,sessionId).first<{id:string;started_at:string;stopped_at:string|null}>();
 if (!row) fail(404,'TRACKING_SESSION_NOT_FOUND');
 const now=Date.now(), points=input.data.points;
 if (points.some((p,i)=>i>0 && Date.parse(points[i-1].captured_at)>=Date.parse(p.captured_at))) fail(422,'TRACKING_POINT_ORDER_INVALID');
 for (const p of points) {
  const capturedAtMs=Date.parse(p.captured_at);
  if (capturedAtMs < now-TRACKING_POLICY.detailRetentionDays*86_400_000) fail(422,'TRACKING_BATCH_EXPIRED');
  if (assessTrackingPoint({latitude:p.latitude,longitude:p.longitude,accuracyM:p.accuracy_m,capturedAtMs},{startedAtMs:Date.parse(row.started_at),...(row.stopped_at?{stoppedAtMs:Date.parse(row.stopped_at)}:{})},now)!=='valid') fail(422,'TRACKING_POINT_INVALID');
 }
 const payload=JSON.stringify({version:1,points}), hash=await digest(payload);
 const prior=await db.prepare('SELECT payload_sha256,state FROM sales_tracking_batch WHERE organization_id=? AND session_id=? AND batch_id=?').bind(identity.organization_id,sessionId,input.data.batch_id).first<{payload_sha256:string;state:string}>();
 if (prior && prior.payload_sha256!==hash) fail(409,'TRACKING_BATCH_CONFLICT');
 if (prior?.state==='ready') return c.json({data:{batch_id:input.data.batch_id,accepted:points.length}});
 if (prior?.state==='deleting') fail(409,'TRACKING_BATCH_EXPIRED');
 const orgKey=await digest(identity.organization_id), sessionKey=await digest(sessionId);
 const objectKey=`tracking/${orgKey}/${sessionKey}/${input.data.batch_id}-${hash}.json`;
 const expires=new Date(Date.parse(points[0].captured_at)+TRACKING_POLICY.detailRetentionDays*86_400_000).toISOString();
 await db.prepare("INSERT OR IGNORE INTO sales_tracking_batch(organization_id,session_id,batch_id,payload_sha256,object_key,state,first_captured_at,last_captured_at,point_count,expires_at) SELECT ?,?,?,?,?, 'pending',?,?,?,? WHERE EXISTS(SELECT 1 FROM sales_tracking_session s WHERE s.organization_id=? AND s.user_id=? AND s.id=? AND s.started_at<=? AND (s.stopped_at IS NULL OR s.stopped_at>=?))")
  .bind(identity.organization_id,sessionId,input.data.batch_id,hash,objectKey,points[0].captured_at,points.at(-1)!.captured_at,points.length,expires,identity.organization_id,identity.id,sessionId,points[0].captured_at,points.at(-1)!.captured_at).run();
 const saved=await db.prepare('SELECT payload_sha256,state FROM sales_tracking_batch WHERE organization_id=? AND session_id=? AND batch_id=?').bind(identity.organization_id,sessionId,input.data.batch_id).first<{payload_sha256:string;state:string}>();
 if (!saved) fail(409,'TRACKING_SESSION_CHANGED');
 if (saved.payload_sha256!==hash) fail(409,'TRACKING_BATCH_CONFLICT');
 if (saved.state==='deleting') fail(409,'TRACKING_BATCH_EXPIRED');
 const org=await db.prepare('SELECT timezone FROM organization WHERE id=?').bind(identity.organization_id).first<{timezone:string}>();
 if (!org) fail(503,'TRACKING_ORGANIZATION_UNAVAILABLE');
 const daily=new Map<string,typeof points[number]>();
 for(const p of points) daily.set(businessClock(new Date(p.captured_at),org.timezone).date,p);
 const summaries=[...daily].map(([date,p])=>{
  const expires=summaryExpiry(date,org.timezone);
  return db.prepare(`INSERT INTO sales_tracking_daily_summary(organization_id,user_id,local_date,last_latitude,last_longitude,last_accuracy_m,last_captured_at,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,user_id,local_date) DO UPDATE SET last_latitude=excluded.last_latitude,last_longitude=excluded.last_longitude,last_accuracy_m=excluded.last_accuracy_m,last_captured_at=excluded.last_captured_at WHERE sales_tracking_daily_summary.last_captured_at IS NULL OR sales_tracking_daily_summary.last_captured_at<excluded.last_captured_at`).bind(identity.organization_id,identity.id,date,p.latitude,p.longitude,p.accuracy_m,p.captured_at,expires);
 });
 await bucket.put(objectKey,payload,{httpMetadata:{contentType:'application/json'}});
 try {
  await db.batch([...guard(db,db.prepare("UPDATE sales_tracking_batch SET state='ready' WHERE organization_id=? AND session_id=? AND batch_id=? AND state='pending' AND payload_sha256=?").bind(identity.organization_id,sessionId,input.data.batch_id,hash)),...summaries]);
 } catch {
  const state=await db.prepare('SELECT state,payload_sha256 FROM sales_tracking_batch WHERE organization_id=? AND session_id=? AND batch_id=?').bind(identity.organization_id,sessionId,input.data.batch_id).first<{state:string;payload_sha256:string}>();
  if (state?.state==='ready'&&state.payload_sha256===hash) return c.json({data:{batch_id:input.data.batch_id,accepted:points.length}});
  if (!state||state.state==='deleting') await bucket.delete(objectKey);
  fail(503,'TRACKING_BATCH_RETRY');
 }
 return c.json({data:{batch_id:input.data.batch_id,accepted:points.length}});
});

/** Bounded and resumable: keep deletion markers until the object is gone. */
export async function salesTrackingRetention(db:D1Database,bucket:R2Bucket,now=new Date().toISOString(),limit=50) {
 if (!Number.isInteger(limit)||limit<1||limit>100) throw new Error('Invalid retention limit');
 const expired=await db.prepare('SELECT organization_id,session_id,batch_id,object_key FROM sales_tracking_batch WHERE expires_at<=? ORDER BY expires_at LIMIT ?').bind(now,limit).all<{organization_id:string;session_id:string;batch_id:string;object_key:string}>();
 let deleted=0;
 for (const row of expired.results) {
  await db.prepare("UPDATE sales_tracking_batch SET state='deleting' WHERE organization_id=? AND session_id=? AND batch_id=? AND expires_at<=?").bind(row.organization_id,row.session_id,row.batch_id,now).run();
  await bucket.delete(row.object_key);
  await db.prepare("DELETE FROM sales_tracking_batch WHERE organization_id=? AND session_id=? AND batch_id=? AND state='deleting'").bind(row.organization_id,row.session_id,row.batch_id).run();
  deleted++;
 }
 // Detailed coordinates expire after 30 days even while the summary remains.
 const cutoff=new Date(Date.parse(now)-TRACKING_POLICY.detailRetentionDays*86_400_000).toISOString();
 await db.prepare('UPDATE sales_tracking_daily_summary SET last_latitude=NULL,last_longitude=NULL,last_accuracy_m=NULL WHERE rowid IN (SELECT rowid FROM sales_tracking_daily_summary WHERE last_latitude IS NOT NULL AND last_captured_at<=? ORDER BY last_captured_at LIMIT ?)').bind(cutoff,limit).run();
 await db.prepare('DELETE FROM sales_tracking_daily_summary WHERE rowid IN (SELECT rowid FROM sales_tracking_daily_summary WHERE expires_at<=? ORDER BY expires_at LIMIT ?)').bind(now,limit).run();
 await db.prepare("DELETE FROM sales_tracking_session WHERE id IN (SELECT s.id FROM sales_tracking_session s WHERE s.state='stopped' AND s.expires_at<=? AND NOT EXISTS(SELECT 1 FROM sales_tracking_batch b WHERE b.session_id=s.id AND b.organization_id=s.organization_id) ORDER BY s.expires_at LIMIT ?)").bind(now,limit).run();
 return {deleted};
}

salesTracking.onError((e,c) => {
 const match = /^(403|404|409|422|503):(.+)$/.exec(e.message);
 return c.json({code: match?.[2] || 'TRACKING_UNAVAILABLE'}, (match ? Number(match[1]) : 503) as any);
});
