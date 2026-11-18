import {matchedRoutes} from 'hono/route';
import type{MiddlewareHandler}from'hono';

export type Counters={db_statements:number;db_meta_samples:number;rows_read:number;rows_written:number;r2_a:number;r2_b:number;r2_deletes:number;sync_accepted:number;sync_review:number;sync_rejected:number};
export const counters=():Counters=>({db_statements:0,db_meta_samples:0,rows_read:0,rows_written:0,r2_a:0,r2_b:0,r2_deletes:0,sync_accepted:0,sync_review:0,sync_rejected:0});
export function measuredDB(db:D1Database,stats:Counters):D1Database{
 const originals=new WeakMap<object,D1PreparedStatement>();
 function capture(result:any){if(result?.meta&&typeof result.meta.rows_read==='number'&&typeof result.meta.rows_written==='number'){stats.db_meta_samples++;stats.rows_read+=result.meta.rows_read;stats.rows_written+=result.meta.rows_written}return result}
 function wrap(statement:D1PreparedStatement):any{
  const proxy={bind:(...args:any[])=>wrap(statement.bind(...args)),
   all:async()=>{stats.db_statements++;return capture(await statement.all())},
   run:async()=>{stats.db_statements++;return capture(await statement.run())},
   first:async(column?:string)=>{stats.db_statements++;const result=capture(await statement.all());const row=result.results?.[0];return row?(column?row[column]??null:row):null},
   raw:async(...args:any[])=>{stats.db_statements++;return (statement.raw as any)(...args)}};
  originals.set(proxy,statement);return proxy;
 }
 return new Proxy(db,{get(target,property){
  if(property==='prepare')return(sql:string)=>wrap(target.prepare(sql));
  if(property==='batch')return async(statements:any[])=>{stats.db_statements+=statements.length;const results=await target.batch(statements.map(s=>originals.get(s)||s));return results.map(capture)};
  if(property==='exec')return async(sql:string)=>{stats.db_statements++;return target.exec(sql)};
  const value=(target as any)[property];return typeof value==='function'?value.bind(target):value;
 }}) as D1Database;
}
export function measuredR2(bucket:R2Bucket|undefined,stats:Counters):R2Bucket|undefined{
 if(!bucket)return;
 return new Proxy(bucket,{get(target,property){const value=(target as any)[property];if(typeof value!=='function')return value;
  return(...args:any[])=>{if(['put','list','createMultipartUpload'].includes(String(property)))stats.r2_a++;else if(['get','head'].includes(String(property)))stats.r2_b++;else if(property==='delete')stats.r2_deletes++;return value.apply(target,args)};
 }}) as R2Bucket;
}
export async function recordMetric(db:D1Database,org:string,kind:string,operation:string,outcome:string,wall:number,stats=counters(),now=new Date()){
 const columns=Object.keys(stats),values=Object.values(stats);
 await db.prepare(`INSERT INTO ops_hourly(organization_id,bucket,kind,operation,outcome,calls,wall_ms,max_wall_ms,${columns.join(',')}) VALUES(?,?,?,?,?,1,?,?,${columns.map(()=>'?').join(',')}) ON CONFLICT(organization_id,bucket,kind,operation,outcome) DO UPDATE SET calls=calls+1,wall_ms=wall_ms+excluded.wall_ms,max_wall_ms=MAX(max_wall_ms,excluded.max_wall_ms),${columns.map(k=>k+'='+k+'+excluded.'+k).join(',')}`).bind(org,now.toISOString().slice(0,13)+':00:00Z',kind,operation,outcome,wall,wall,...values).run();
}
function defer(c:any,promise:Promise<unknown>){try{c.executionCtx.waitUntil(promise)}catch{return promise}}
export const telemetry:MiddlewareHandler<any>=async(c,next)=>{
 const raw=c.env.DB as D1Database,stats=counters(),started=performance.now(),requestId=crypto.randomUUID();
 // Clone bindings per invocation; never replace the shared env.DB across concurrent requests.
 if(raw&&typeof raw.prepare==='function')c.env={...c.env,DB:measuredDB(raw,stats),IMPORT_FILES:measuredR2(c.env.IMPORT_FILES,stats),TRACKING_POINTS:measuredR2(c.env.TRACKING_POINTS,stats)};
 c.header('X-Request-ID',requestId);
 try{await next()}finally{
  const wall=Math.max(0,performance.now()-started),status=c.res?.status||500;
  const route=matchedRoutes(c).filter(r=>r.path.startsWith('/api/')&&!r.path.includes('*')&&(r.method===c.req.method||c.req.method==='HEAD'&&r.method==='GET')).at(-1)?.path||'/api/:unmatched';
  const operation=c.req.method+' '+route,identity=c.get('identity'),metricOrganization=identity?.organization_id||c.get('agentIdentity')?.record?.organization_id;
  // Never log raw paths, query strings, bodies, SQL, bindings, auth headers, or exception messages.
  console.log(JSON.stringify({event:'nyales_api',request_id:requestId,operation,status,wall_ms:Math.round(wall),...stats}));
  if(metricOrganization&&raw&&typeof raw.prepare==='function'){
   const persist=async()=>{
    if(c.req.path==='/api/sync/events'&&status<400){try{const json=await c.res.clone().json()as any;for(const e of json.data||[]){if(e.status==='accepted')stats.sync_accepted++;else if(e.status==='review')stats.sync_review++;else if(e.status==='rejected')stats.sync_rejected++}}catch{/* response body may be absent */}}
    await recordMetric(raw,metricOrganization,'api',operation,String(status),wall,stats);
   };
   await defer(c,persist().catch(()=>console.warn('NYALES_TELEMETRY_WRITE_FAILED')));
  }
 }
};

export async function measuredJob(name:string,env:any,work:(db:D1Database,bucket?:R2Bucket)=>Promise<unknown>){
 const stats=counters(),started=performance.now();let outcome='success';
 try{return await work(measuredDB(env.DB,stats),measuredR2(env.IMPORT_FILES,stats))}catch{outcome='failed';throw new Error('SCHEDULED_JOB_FAILED:'+name)}finally{
  const wall=performance.now()-started;
  console.log(JSON.stringify({event:'nyales_job',job:name,outcome,wall_ms:Math.round(wall),...stats}));
  // These jobs scan a shared deployment. Only the explicitly designated organization can view their aggregate.
  const owner=env.OBS_OWNER_ORGANIZATION_ID||(env.APP_ENV==='local'?'demo-org':null);
  if(owner){
   await recordMetric(env.DB,owner,'job',name,outcome,wall,stats).catch(()=>console.warn('NYALES_JOB_TELEMETRY_WRITE_FAILED'));
   if(outcome==='failed')try{await env.DB.prepare("INSERT OR IGNORE INTO in_app_notification(id,organization_id,user_id,kind,resource_id,trigger_id,rule_version,title,created_at) SELECT ?,p.organization_id,p.owner_user_id,'ops_job_failure',?,?,1,?,? FROM ops_policy p JOIN app_user u ON u.organization_id=p.organization_id AND u.id=p.owner_user_id LEFT JOIN notification_policy n ON n.organization_id=p.organization_id WHERE p.organization_id=? AND u.status='active' AND COALESCE(n.enabled,1)=1 AND(EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=u.organization_id AND r.user_id=u.id AND r.role_code IN('MANAGEMENT','NSM') AND r.effective_from_date<=date('now') AND(r.effective_to_date IS NULL OR r.effective_to_date>date('now'))) OR(?=1 AND u.id='demo-management'))").bind(crypto.randomUUID(),name,'ops-job:'+name+':'+new Date().toISOString().slice(0,13),'Checkpoint '+name+' gagal; periksa kesehatan sistem',new Date().toISOString(),owner,env.APP_ENV==='local'?1:0).run()}catch{console.warn('NYALES_JOB_ALERT_UNAVAILABLE')}
  }
 }
}
