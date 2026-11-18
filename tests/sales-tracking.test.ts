import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {Hono} from 'hono';
import app,{scopedRoutes} from '../src/server/index';
import {salesTrackingRetention} from '../src/server/sales-tracking';

test('tracking sessions require explicit consent and are isolated by user', async () => {
 const f = fixture();
 try {
  const req=(method:string,path:string,body?:unknown,actor='sr')=>{const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,role:actor==='sr'?'SALES_REP':'TELESALES',organization_id:'o'} as never);await next()});app.route('/',scopedRoutes);return app.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},...(body?{body:JSON.stringify(body)}:{})},{DB:f.adapter,TRACKING_POINTS:f.bucket})};
  assert.equal((await req('POST','/api/sales-tracking/session',{})).status,422);
  assert.equal((await req('POST','/api/sales-tracking/session',{consent:true},'tele')).status,403);
  const created=await f.data(await req('POST','/api/sales-tracking/session',{consent:true}));
  assert.equal(created.state,'active');
  assert.equal((await req('POST','/api/sales-tracking/session',{consent:true})).status,409);
  assert.equal((await f.data(await req('GET','/api/sales-tracking/session'))).id,created.id);
  assert.equal((await req('POST',`/api/sales-tracking/session/${created.id}/stop`,{stopped_at:new Date().toISOString()},'tele')).status,403);
  const stopped=await f.data(await req('POST',`/api/sales-tracking/session/${created.id}/stop`,{stopped_at:new Date().toISOString()}));
  assert.equal(stopped.state,'stopped');
  assert.equal(await f.data(await req('GET','/api/sales-tracking/session')),null);
 } finally { f.sqlite.close(); }
});

test('GPS batches retry safely, reject altered payload and remain scoped to their owner', async () => {
 const f=fixture();
 try {
  let writes=0; const objects=new Map<string,string>();
  const bucket={put:async(key:string,value:string)=>{writes++;objects.set(key,value);return {}},get:async(key:string)=>objects.has(key)?{text:async()=>objects.get(key)!}:null,delete:async(key:string)=>{objects.delete(key)}};
  const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:'sr',name:'sr',role:'SALES_REP',organization_id:'o'} as never);await next()});app.route('/',scopedRoutes);
  const created=await f.data(await app.request('/api/sales-tracking/session',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({consent:true})},{DB:f.adapter,TRACKING_POINTS:bucket}));
  const request=(session:string,body:unknown)=>app.request(`/api/sales-tracking/session/${session}/batches`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},{DB:f.adapter,TRACKING_POINTS:bucket});
  const payload={batch_id:crypto.randomUUID(),points:[{latitude:-6.2,longitude:106.8,accuracy_m:12,captured_at:new Date(Date.now()+1000).toISOString()}]};
  assert.equal((await request(created.id,payload)).status,200);
  const latest=await f.data(await app.request('/api/sales-tracking/latest',{method:'GET'},{DB:f.adapter,TRACKING_POINTS:bucket}));
  assert.equal(latest.length,1);assert.equal(latest[0].id,'sr');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date(payload.points[0].captured_at));
  const history=await f.data(await app.request(`/api/sales-tracking/history?user_id=sr&date=${date}`,{method:'GET'},{DB:f.adapter,TRACKING_POINTS:bucket}));
  assert.equal(history.length,1);
  const outsider=new Hono();outsider.use('*',async(c,next)=>{c.set('identity' as never,{id:'tele',name:'tele',role:'TELESALES',organization_id:'o'} as never);await next()});outsider.route('/',scopedRoutes);
  assert.equal((await outsider.request(`/api/sales-tracking/history?user_id=sr&date=${date}`,{method:'GET'},{DB:f.adapter,TRACKING_POINTS:bucket})).status,403);
  assert.equal((await request(created.id,payload)).status,200);
  assert.equal(writes,1);
  assert.equal((await request(created.id,{...payload,points:[{...payload.points[0],latitude:-6.3}]})).status,409);
  assert.equal((await request('someone-else',payload)).status,404);
  const stoppedAt=new Date(Date.parse(payload.points[0].captured_at)+1000).toISOString();
  const stop=await app.request(`/api/sales-tracking/session/${created.id}/stop`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({stopped_at:stoppedAt})},{DB:f.adapter,TRACKING_POINTS:bucket});
  assert.equal(stop.status,200);
  const after={batch_id:crypto.randomUUID(),points:[{...payload.points[0],captured_at:new Date(Date.parse(stoppedAt)+1000).toISOString()}]};
  assert.equal((await request(created.id,after)).status,422);
  f.sqlite.prepare('UPDATE sales_tracking_batch SET expires_at=?').run('2020-01-01T00:00:00.000Z');
  f.sqlite.prepare('UPDATE sales_tracking_daily_summary SET expires_at=?').run('2020-01-01T00:00:00.000Z');
  assert.equal((await salesTrackingRetention(f.adapter,bucket as unknown as R2Bucket)).deleted,1);
  assert.equal(objects.size,0);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM sales_tracking_daily_summary').get() as {n:number}).n,0);
 } finally {f.sqlite.close();}
});

test('retention removes old coordinates while keeping summaries within three months',async()=>{
 const f=fixture();
 try {
  f.sqlite.prepare('INSERT INTO sales_tracking_daily_summary(organization_id,user_id,local_date,last_latitude,last_longitude,last_accuracy_m,last_captured_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run('o','sr','2026-01-01',-6.2,106.8,10,'2026-01-01T00:00:00.000Z','2026-04-01T00:00:00.000Z');
  await salesTrackingRetention(f.adapter,f.bucket,'2026-02-15T00:00:00.000Z');
  const row=f.sqlite.prepare('SELECT last_latitude,last_longitude,last_accuracy_m FROM sales_tracking_daily_summary').get() as {last_latitude:number|null;last_longitude:number|null;last_accuracy_m:number|null};
  assert.deepEqual({...row},{last_latitude:null,last_longitude:null,last_accuracy_m:null});
 } finally {f.sqlite.close();}
});

test('retention preserves a retry marker if object storage is temporarily unavailable',async()=>{
 const f=fixture();
 try {
  f.sqlite.prepare("INSERT INTO sales_tracking_session(id,organization_id,user_id,started_at,state) VALUES('session','o','sr','2026-01-01T00:00:00.000Z','active')").run();
  f.sqlite.prepare("INSERT INTO sales_tracking_batch(organization_id,session_id,batch_id,payload_sha256,object_key,state,first_captured_at,last_captured_at,point_count,expires_at) VALUES('o','session','batch','hash','object','ready','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',1,'2026-02-01T00:00:00.000Z')").run();
  const failing={delete:async()=>{throw Error('unavailable')}} as unknown as R2Bucket;
  await assert.rejects(salesTrackingRetention(f.adapter,failing,'2026-03-01T00:00:00.000Z'));
  assert.equal((f.sqlite.prepare("SELECT state FROM sales_tracking_batch WHERE batch_id='batch'").get() as {state:string}).state,'deleting');
  await salesTrackingRetention(f.adapter,f.bucket,'2026-03-01T00:00:00.000Z');
  assert.equal(f.sqlite.prepare("SELECT state FROM sales_tracking_batch WHERE batch_id='batch'").get(),undefined);
 }finally{f.sqlite.close()}
});

test('dedicated tracking cron performs retention without enabling legacy jobs',async()=>{
 const f=fixture();
 try {
  let work:Promise<unknown>|undefined;
  await app.scheduled({cron:'*/5 * * * *'} as ScheduledController,{DB:f.adapter,TRACKING_POINTS:f.bucket} as any,{waitUntil:(p:Promise<unknown>)=>{work=p}} as ExecutionContext);
  assert.ok(work);await work;
  const metrics=f.sqlite.prepare('SELECT COUNT(*) n FROM ops_hourly').get() as {n:number};
  assert.equal(metrics.n,0);
 } finally {f.sqlite.close();}
});
