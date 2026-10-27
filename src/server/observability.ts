import{Hono}from'hono';
import{z}from'zod';
import{operation,fail,guard}from'./operations';
import{recordMetric}from'./telemetry';

export const budgets={
 workers_requests:{label:'Worker requests',limit:100000,unit:'request/hari',period:'day',source:'https://developers.cloudflare.com/workers/platform/limits/'},
 d1_reads:{label:'D1 rows read',limit:5000000,unit:'row/hari',period:'day',source:'https://developers.cloudflare.com/d1/platform/pricing/'},
 d1_writes:{label:'D1 rows written',limit:100000,unit:'row/hari',period:'day',source:'https://developers.cloudflare.com/d1/platform/pricing/'},
 d1_database_bytes:{label:'D1 storage / database',limit:500000000,unit:'byte',period:'current',source:'https://developers.cloudflare.com/d1/platform/limits/'},
 d1_account_bytes:{label:'D1 storage / account',limit:5000000000,unit:'byte',period:'current',source:'https://developers.cloudflare.com/d1/platform/limits/'},
 workers_cpu_ms:{label:'Worker CPU / invocation',limit:10,unit:'ms CPU/pemanggilan',period:'day',source:'https://developers.cloudflare.com/workers/platform/limits/'},
 r2_storage:{label:'R2 Standard average storage',limit:10,unit:'GB-month',period:'month',source:'https://developers.cloudflare.com/r2/pricing/'},
 r2_a:{label:'R2 Class A',limit:1000000,unit:'operasi/bulan',period:'month',source:'https://developers.cloudflare.com/r2/pricing/'},
 r2_b:{label:'R2 Class B',limit:10000000,unit:'operasi/bulan',period:'month',source:'https://developers.cloudflare.com/r2/pricing/'}
}as const;
export type BudgetKey=keyof typeof budgets;
export const budgetKeys=Object.keys(budgets)as BudgetKey[];
export function budgetWindow(metric:BudgetKey,date=new Date()){const period=budgets[metric].period;return period==='day'?date.toISOString().slice(0,10):period==='month'?date.toISOString().slice(0,7):'current'}
export function crossedThresholds(value:number,limit:number){return[70,85,95].filter(t=>value/limit*100>=t)}
const etag=(c:any,r:any)=>{if(c.req.header('If-Match')!==`"${r.version}"`)fail(412,'VERSION_CONFLICT')};
const org=(c:any)=>c.get('identity').organization_id;
const providerOwner=(c:any)=>c.env.APP_ENV==='local'||c.env.OBS_OWNER_ORGANIZATION_ID===org(c);
const reason=z.string().trim().min(3).max(500);
async function activeOwner(c:any,userId:string){const db=c.env.DB as D1Database;return await db.prepare("SELECT u.id FROM app_user u WHERE u.organization_id=? AND u.id=? AND u.status='active' AND(EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=u.organization_id AND r.user_id=u.id AND r.role_code IN('MANAGEMENT','NSM') AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?)) OR (?=1 AND u.id=?))").bind(org(c),userId,c.get('scope').date,c.get('scope').date,c.env.APP_ENV==='local'?1:0,c.get('identity').id).first();}
const profile=z.object({owner_user_id:z.string().min(1).max(128),pilot_reps:z.number().int().min(1).max(10000),pilot_customers:z.number().int().min(1).max(10000000),pilot_invoices_month:z.number().int().min(1).max(10000000),concurrent_users:z.number().int().min(1).max(10000),api_requests_day:z.number().int().min(1).max(10000000),reason}).strict();
const snapshot=z.object({metric:z.enum(budgetKeys as [BudgetKey,...BudgetKey[]]),value:z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER),sampled_at:z.iso.datetime({offset:true}),reason}).strict();
export const observability=new Hono<any>();
observability.use('/api/observability/*',async(c,next)=>{if(c.req.path==='/api/observability/events'&&c.req.method==='POST'){await next();return}if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next()});
observability.post('/api/observability/events',async c=>{
 const parsed=z.object({event:z.enum(['map_2d','map_3d','street_view_open'])}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!parsed.success)return c.json({code:'INVALID_OBSERVABILITY_EVENT'},422);
 // Only counts. No coordinates, names, URLs, tokens, or API keys are accepted.
 await recordMetric(c.env.DB,org(c),'client',parsed.data.event,'declared',0);
 return c.json({data:{recorded:true}});
});
observability.post('/api/observability/policy',async c=>{
 const b=profile.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({code:'INVALID_CAPACITY_PROFILE'},422);
 return operation(c,b.data,async()=>{
  const db=c.env.DB as D1Database,before=await db.prepare('SELECT * FROM ops_policy WHERE organization_id=?').bind(org(c)).first<any>();if(before)etag(c,before);
  const owner=await activeOwner(c,b.data.owner_user_id);
  if(!owner)fail(422,'ALERT_OWNER_MUST_BE_ACTIVE_MANAGEMENT_OR_NSM');
  const version=(before?.version||0)+1,x=b.data;
  return{resource:'ops-policy',before,data:{id:org(c),version},statements:guard(db,db.prepare('INSERT INTO ops_policy VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,pilot_reps=excluded.pilot_reps,pilot_customers=excluded.pilot_customers,pilot_invoices_month=excluded.pilot_invoices_month,concurrent_users=excluded.concurrent_users,api_requests_day=excluded.api_requests_day,version=excluded.version,updated_at=excluded.updated_at,updated_by=excluded.updated_by,reason=excluded.reason WHERE ops_policy.version=excluded.version-1').bind(org(c),x.owner_user_id,x.pilot_reps,x.pilot_customers,x.pilot_invoices_month,x.concurrent_users,x.api_requests_day,version,new Date().toISOString(),c.get('identity').id,x.reason))};
 });
});
observability.post('/api/observability/usage',async c=>{
 if(!providerOwner(c))return c.json({code:'PROVIDER_ACCOUNT_OWNER_REQUIRED'},403);
 const b=snapshot.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({code:'INVALID_PROVIDER_SNAPSHOT'},422);
 const sample=new Date(b.data.sampled_at),now=new Date();if(sample.getTime()>now.getTime()+60000||now.getTime()-sample.getTime()>6*3600000)return c.json({code:'PROVIDER_SNAPSHOT_MUST_BE_WITHIN_SIX_HOURS'},422);
 return operation(c,b.data,async()=>{
  const db=c.env.DB as D1Database,p=await db.prepare('SELECT * FROM ops_policy WHERE organization_id=?').bind(org(c)).first<any>();if(!p)fail(422,'CAPACITY_PROFILE_AND_ALERT_OWNER_REQUIRED');if(!await activeOwner(c,p.owner_user_id))fail(422,'ALERT_OWNER_MUST_BE_ACTIVE_MANAGEMENT_OR_NSM');
  const x=b.data,window=budgetWindow(x.metric,sample),rid=crypto.randomUUID(),created=now.toISOString(),statements=[db.prepare('INSERT INTO ops_usage_snapshot VALUES(?,?,?,?,?,?,?,?,?,?)').bind(rid,org(c),x.metric,window,x.value,sample.toISOString(),created,c.get('identity').id,'manual_provider_dashboard',x.reason)];
  for(const threshold of crossedThresholds(x.value,budgets[x.metric].limit)){
   statements.push(db.prepare('INSERT OR IGNORE INTO ops_budget_alert VALUES(?,?,?,?,?,?,?)').bind(org(c),x.metric,window,threshold,rid,p.owner_user_id,created));
   // changes() refers to the preceding INSERT, so retries/competing snapshots never send duplicate threshold alerts.
   statements.push(db.prepare("INSERT OR IGNORE INTO in_app_notification(id,organization_id,user_id,kind,resource_id,trigger_id,rule_version,title,created_at) SELECT ?,?,?,'capacity_budget',?,?,1,?,? WHERE changes()=1").bind(crypto.randomUUID(),org(c),p.owner_user_id,rid,'budget:'+x.metric+':'+window+':'+threshold,'Kuota '+budgets[x.metric].label+' mencapai ambang '+threshold+'%',created));
  }
  return{resource:'ops-usage',status:201,data:{id:rid,window_key:window,thresholds:crossedThresholds(x.value,budgets[x.metric].limit),payment_or_upgrade:false},statements};
 });
});
observability.get('/api/observability/summary',async c=>{
 const db=c.env.DB as D1Database,organization=org(c),now=new Date(),since=new Date(now.getTime()-86400000).toISOString().slice(0,13)+':00:00Z';
 const[policy,metrics,usage,alerts,queue,owners]=await Promise.all([
  db.prepare('SELECT * FROM ops_policy WHERE organization_id=?').bind(organization).first(),
  db.prepare('SELECT kind,operation,outcome,SUM(calls) calls,SUM(wall_ms) wall_ms,MAX(max_wall_ms) max_wall_ms,SUM(db_statements) db_statements,SUM(db_meta_samples) db_meta_samples,SUM(rows_read) rows_read,SUM(rows_written) rows_written,SUM(r2_a) r2_a,SUM(r2_b) r2_b,SUM(r2_deletes) r2_deletes,SUM(sync_accepted) sync_accepted,SUM(sync_review) sync_review,SUM(sync_rejected) sync_rejected FROM ops_hourly WHERE organization_id=? AND bucket>=? GROUP BY kind,operation,outcome ORDER BY max_wall_ms DESC').bind(organization,since).all<any>(),
  db.prepare('SELECT metric,window_key,value,sampled_at,source,ROW_NUMBER() OVER(PARTITION BY metric,window_key ORDER BY sampled_at DESC,created_at DESC,id DESC) rank FROM ops_usage_snapshot WHERE organization_id=? AND sampled_at>=?').bind(organization,new Date(now.getTime()-6*3600000).toISOString()).all<any>(),
  db.prepare('SELECT metric,window_key,threshold,created_at,owner_user_id FROM ops_budget_alert WHERE organization_id=? ORDER BY created_at DESC LIMIT 50').bind(organization).all(),
  db.prepare("SELECT (SELECT COUNT(*) FROM invoice_import_job WHERE organization_id=? AND status='needs_review') import_review,(SELECT COUNT(*) FROM activity WHERE organization_id=? AND status IN('needs_review','pending_checkin')) activity_review,(SELECT COUNT(*) FROM evidence_attachment WHERE organization_id=? AND status='pending') attachments_pending").bind(organization,organization,organization).first(),
  db.prepare("SELECT u.id,u.name FROM app_user u WHERE u.organization_id=? AND u.status='active' AND(EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=u.organization_id AND r.user_id=u.id AND r.role_code IN('MANAGEMENT','NSM') AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?)) OR(?=1 AND u.id=?)) ORDER BY u.name").bind(organization,c.get('scope').date,c.get('scope').date,c.env.APP_ENV==='local'?1:0,c.get('identity').id).all()
 ]);
 return c.json({data:{environment:c.env.APP_ENV||'unknown',as_of:now.toISOString(),since,profile:policy,owners:owners.results,provider_account_access:providerOwner(c),metrics:metrics.results,
  budgets:budgetKeys.map(metric=>{const reading=usage.results.find(r=>r.metric===metric&&r.window_key===budgetWindow(metric,now)&&r.rank===1),definition=budgets[metric];return{metric,...definition,window_key:budgetWindow(metric,now),value:reading?.value??null,percent:reading?reading.value/definition.limit*100:null,sampled_at:reading?.sampled_at??null,source:reading?.source??null,status:reading?(crossedThresholds(reading.value,definition.limit).at(-1)||'normal'):'unknown'}}),alerts:alerts.results,queue:{...queue as any,device_outbox_pending:null},
  limitations:['Metrik API hanya request yang melewati Worker ini; bukan total tagihan akun.','Wall time bukan CPU time. CPU harus dibaca dari Cloudflare.','D1 rows memakai meta provider; bila sampel tidak lengkap, subtotal bukan total.','Satu upsert observability per request authenticated berada di luar subtotal query bisnis.','R2 adalah jumlah percobaan operasi binding; bukan tagihan atau total storage.','Outbox pending berada di perangkat; antrean seluruh perangkat belum diketahui.','Map/Street View adalah deklarasi tampilan client, bukan jumlah tile atau biaya Google.','Kuota provider adalah snapshot manual akun yang baru dan belum tersambung API Cloudflare.','Alert adalah peringatan, bukan pemutus biaya provider. Allowance R2 yang terlampaui tetap mengikuti billing akun.'],quota_reference_date:'2026-10-19',automatic_upgrade:false,business_auto_delete:false}});
});
