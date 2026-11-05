import {Hono} from 'hono';
import {dailyPolicy,dailyRequest,defaultDailyPolicy} from '../shared/daily-visit';
import {canonicalJson} from '../shared/boundaries';
import {digest,fail,guard,operation,type OperationEnv} from './operations';
import {dailyRep,dailySnapshot} from './daily-visit-source';
import {optimizeOrs} from './ors-provider';
import {planningRevision} from './visit-planning-source';
import {businessClock} from './calendar';
import {planningInstant} from './planning-time';
type Env=OperationEnv&{Bindings:OperationEnv['Bindings']&{ORS_API_KEY?:string;APP_ENV?:string}};
export const dailyVisit=new Hono<Env>();
const now=()=>new Date().toISOString(),org=(c:any)=>c.get('scope').identity.organization_id;
async function readPolicy(c:any){const row=await c.env.DB.prepare('SELECT version,config_json,updated_at FROM daily_visit_policy WHERE organization_id=?').bind(org(c)).first();return row?{version:row.version,config:dailyPolicy.parse(JSON.parse(row.config_json)),updated_at:row.updated_at}:null;}
async function sourceCurrent(c:any,snapshot:any,policyVersion:number){const revision=await planningRevision(c.env.DB,org(c)),geo=await c.env.DB.prepare('SELECT epoch FROM geo_distribution_epoch WHERE organization_id=?').bind(org(c)).first();const policy=await readPolicy(c);return policy?.version===policyVersion&&revision.source_epoch===snapshot.revision.source_epoch&&revision.agenda_epoch===snapshot.revision.agenda_epoch&&(geo?.epoch??0)===snapshot.revision.geo_epoch;}
async function runRow(c:any,id:string){const row=await c.env.DB.prepare('SELECT * FROM daily_visit_run WHERE organization_id=? AND id=?').bind(org(c),id).first();if(!row)fail(404,'NOT_FOUND');await dailyRep(c.env.DB,c.get('scope'),row.rep_id);return row;}
async function runResult(c:any,row:any){
 if(row.status==='pending')fail(409,'DAILY_BUSY');if(row.status==='failed')fail(503,row.error_code||'ORS_PROVIDER_UNAVAILABLE');
 const object=await c.env.IMPORT_FILES?.get(row.storage_key);if(!object||object.size>2_000_000)fail(503,'ORS_STORAGE_UNAVAILABLE');const bytes=await object.arrayBuffer();if(await digest(bytes)!==row.result_sha256)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const result=JSON.parse(new TextDecoder().decode(bytes));if(result.id!==row.id||result.organization_id!==org(c)||result.environment!==c.env.APP_ENV)fail(503,'DAILY_RESULT_INVALID');
 const snapshot=JSON.parse(row.snapshot_json),current=row.status==='complete'&&row.expires_at>now()&&await sourceCurrent(c,snapshot,row.policy_version);
 return {...result,status:row.status,current,expires_at:row.expires_at};
}
dailyVisit.use('/api/visit-generator/daily/*',async(c,next)=>{const scope=c.get('scope');if(scope.channel==='telesales'||scope.identity.role==='TELESALES')fail(403,'DAILY_OR_FIELD_SCOPE');c.header('Cache-Control','private, no-store');await next();});
dailyVisit.get('/api/visit-generator/daily/setup',async c=>{
 const scope=c.get('scope'),policy=await readPolicy(c),db=c.env.DB;
 const calendars=scope.orgWide?(await db.prepare("SELECT w.id,w.name,b.timezone,w.start_time,w.end_time FROM work_calendar w JOIN branch b ON b.organization_id=w.organization_id AND b.id=w.branch_id WHERE w.organization_id=? AND w.status='active' AND b.status='active' ORDER BY w.name LIMIT 101").bind(org(c)).all()).results:[];
 const calendar=policy?await db.prepare("SELECT w.id,w.name,b.timezone,w.start_time,w.end_time FROM work_calendar w JOIN branch b ON b.organization_id=w.organization_id AND b.id=w.branch_id WHERE w.organization_id=? AND w.id=? AND w.status='active' AND b.status='active'").bind(org(c),policy.config.calendar_id).first<any>():null;
 const date=calendar?businessClock(new Date(),calendar.timezone).date:scope.date;
 return c.json({data:{configured:Boolean(c.env.ORS_API_KEY),policy,defaults:defaultDailyPolicy,calendars,calendar,work_window:calendar?{start_at:planningInstant(date,calendar.start_time,calendar.timezone),end_at:planningInstant(date,calendar.end_time,calendar.timezone)}:null,manage:scope.orgWide,custom_work_hours_allowed:(c as any).get('portfolioOwner')===true,today:date,max_candidates:40,max_visits:20,daily_budget:60}});
});
dailyVisit.put('/api/visit-generator/daily/policy',async c=>{
 const parsed=dailyPolicy.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({code:'INVALID_DAILY_POLICY',detail:parsed.error.issues.map(i=>i.message).join('; ')},422);
 return operation(c,parsed.data,async()=>{const db=c.env.DB,prior=await readPolicy(c);if(prior&&c.req.header('If-Match')!==`"${prior.version}"`)fail(412,'VERSION_CONFLICT');if(!prior&&c.req.header('If-Match')!=='"0"')fail(412,'VERSION_CONFLICT');
  if(!await db.prepare("SELECT id FROM work_calendar WHERE organization_id=? AND id=? AND status='active'").bind(org(c),parsed.data.calendar_id).first())fail(422,'DAILY_CALENDAR_REQUIRED');
  const version=(prior?.version??0)+1,statement=prior?db.prepare('UPDATE daily_visit_policy SET version=?,config_json=?,updated_by=?,updated_at=? WHERE organization_id=? AND version=?').bind(version,canonicalJson(parsed.data),c.get('scope').identity.id,now(),org(c),prior.version):db.prepare('INSERT INTO daily_visit_policy(organization_id,version,config_json,updated_by,updated_at) VALUES(?,?,?,?,?)').bind(org(c),version,canonicalJson(parsed.data),c.get('scope').identity.id,now());
  return{resource:'daily-visit-policy',data:{id:org(c),version,config:parsed.data},before:prior,statements:guard(db,statement)};
 });
});
dailyVisit.get('/api/visit-generator/daily/runs',async c=>{
 const repId=c.req.query('rep_id')||c.get('scope').identity.id;await dailyRep(c.env.DB,c.get('scope'),repId);
 const rows=(await c.env.DB.prepare('SELECT id,service_date,status,created_at,expires_at,error_code FROM daily_visit_run WHERE organization_id=? AND rep_id=? AND service_date=? ORDER BY created_at DESC,id DESC LIMIT 11').bind(org(c),repId,c.get('scope').date).all()).results;
 return c.json({data:{runs:rows.slice(0,10),has_more:rows.length>10}});
});
dailyVisit.get('/api/visit-generator/daily/runs/:id',async c=>c.json({data:await runResult(c,await runRow(c,c.req.param('id')))}));
dailyVisit.post('/api/visit-generator/daily/runs',async c=>{
 const parsed=dailyRequest.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({code:'INVALID_DAILY_REQUEST'},422);
 if(parsed.data.custom_work_hours&&(c as any).get('portfolioOwner')!==true)fail(403,'DAILY_CUSTOM_HOURS_OWNER_ONLY');
 const key=c.req.header('Idempotency-Key');if(!key||key.length<8||key.length>128)fail(400,'IDEMPOTENCY_KEY_REQUIRED');
 if(!c.env.ORS_API_KEY)fail(503,'ORS_NOT_CONFIGURED');if(!c.env.IMPORT_FILES)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const db=c.env.DB,scope=c.get('scope'),input=parsed.data,sha=await digest(canonicalJson(input));await dailyRep(db,scope,input.rep_id);
 const previous=await db.prepare('SELECT * FROM daily_visit_run WHERE organization_id=? AND actor_id=? AND idempotency_key=?').bind(org(c),scope.identity.id,key).first<any>();if(previous){if(previous.input_sha256!==sha)fail(409,'IDEMPOTENCY_CONFLICT');return c.json({data:await runResult(c,previous)});}
 const policy=await readPolicy(c);if(!policy)fail(422,'DAILY_POLICY_REQUIRED');
 const snapshot=await dailySnapshot(db,scope,input,policy.config,(c as any).get('portfolioOwner')===true),id=crypto.randomUUID(),stamp=now(),expires=new Date(Date.now()+20*60000).toISOString(),day=stamp.slice(0,10)+'T00:00:00.000Z',lease=new Date(Date.now()-3*60000).toISOString();
 const claim=await db.prepare("INSERT INTO daily_visit_run(id,organization_id,actor_id,rep_id,service_date,status,idempotency_key,input_sha256,policy_version,snapshot_json,created_at,expires_at) SELECT ?,?,?,?,?,'pending',?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM daily_visit_run WHERE organization_id=? AND created_at>=?)<60 AND NOT EXISTS(SELECT 1 FROM daily_visit_run WHERE organization_id=? AND rep_id=? AND status='pending' AND created_at>=?)").bind(id,org(c),scope.identity.id,input.rep_id,snapshot.date,key,sha,policy.version,canonicalJson(snapshot),stamp,expires,org(c),day,org(c),input.rep_id,lease).run();
 if(!(claim.meta?.changes??(claim as any).changes))fail(503,'DAILY_BUSY');
 try{
  const optimized=await optimizeOrs(c.env.ORS_API_KEY,snapshot.vehicles,snapshot.jobs,snapshot.locations);if(!await sourceCurrent(c,snapshot,policy.version))fail(409,'DAILY_STALE');
  const route=optimized.result.routes[0],steps=route?.steps||[],scheduled=steps.filter((s:any)=>s.type==='job');
  if(optimized.result.routes.length>1||scheduled.length>snapshot.remaining_target||snapshot.customers.filter(c=>c.fixed_plan).some(customer=>!scheduled.some((s:any)=>snapshot.customers[s.id-1]?.id===customer.id)))fail(422,'DAILY_LOCKED_UNASSIGNED');
  const detail=(step:any)=>{const customer=snapshot.customers[step.id-1];if(!customer)fail(503,'DAILY_RESULT_INVALID');return{...step,customer_id:customer.id,customer_name:customer.name,score:customer.score,reasons:customer.reasons,location:[customer.longitude_e7/1e7,customer.latitude_e7/1e7],fixed_plan_id:customer.fixed_plan?.id??null};};
  const result={id,organization_id:org(c),environment:c.env.APP_ENV,rep:snapshot.rep,date:snapshot.date,timezone:snapshot.timezone,provider:'HeiGIT / ORS',traffic:'none',target:snapshot.remaining_target,daily_target:policy.config.target_visits,planned:scheduled.length,shortfall:Math.max(0,snapshot.remaining_target-scheduled.length),assigned_count:snapshot.assigned_count,eligible_count:snapshot.eligible_count,not_shortlisted_count:snapshot.eligible_count-snapshot.customers.length,completed_today:snapshot.completed_today,preserved_agenda_count:snapshot.preserved_agenda_count,replaces_run_id:snapshot.replacement?.id??null,policy:policy.config,calendar_name:snapshot.calendar.name,route:route?{...route,steps:steps.map((s:any)=>s.type==='job'?detail(s):s)}:null,geometry:optimized.geometry,geometry_available:optimized.geometry.features.length>0,unassigned:optimized.result.unassigned.map((s:any)=>({...detail(s),reason:'Tidak muat dalam batas waktu/rute'})),skipped:snapshot.skipped,notice:'Urutan dan estimasi ORS tanpa traffic langsung. Kedekatan koordinat dipakai untuk shortlist; slot agenda minimum 30 menit. Tidak ada agenda berubah sebelum Gunakan rencana.'};
  const text=canonicalJson(result);if(new TextEncoder().encode(text).length>2_000_000)fail(503,'DAILY_RESULT_INVALID');const storage=org(c)+'/daily-visit/'+id+'.json';await c.env.IMPORT_FILES.put(storage,text,{httpMetadata:{contentType:'application/json'}});
  try{await db.batch([db.prepare('INSERT INTO master_mutation_guard(ok) SELECT COUNT(*) FROM visit_planning_revision v JOIN geo_distribution_epoch g ON g.organization_id=v.organization_id JOIN daily_visit_policy p ON p.organization_id=v.organization_id WHERE v.organization_id=? AND v.source_epoch=? AND v.agenda_epoch=? AND g.epoch=? AND p.version=?').bind(org(c),snapshot.revision.source_epoch,snapshot.revision.agenda_epoch,(snapshot.revision as any).geo_epoch,policy.version),db.prepare('DELETE FROM master_mutation_guard'),...guard(db,db.prepare("UPDATE daily_visit_run SET status='complete',storage_key=?,result_sha256=? WHERE organization_id=? AND id=? AND status='pending'").bind(storage,await digest(text),org(c),id)),db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),org(c),scope.identity.id,'daily_visit_run',id,'preview',now(),null,canonicalJson({id,rep_id:input.rep_id,date:snapshot.date,policy_version:policy.version,confirmed_external_processing:true,planned:scheduled.length}))]);}catch{await c.env.IMPORT_FILES.delete(storage);fail(409,'DAILY_STALE');}
  return c.json({data:{...result,current:true,status:'complete',expires_at:expires}},201);
 }catch(error){const match=/^(400|403|404|409|412|422|428|503):([A-Z0-9_]+)$/.exec((error as Error).message),code=match?.[2]||'ORS_PROVIDER_UNAVAILABLE';await db.prepare("UPDATE daily_visit_run SET status='failed',error_code=? WHERE organization_id=? AND id=? AND status='pending'").bind(code,org(c),id).run();fail(match?Number(match[1]):503,code);}
});
dailyVisit.post('/api/visit-generator/daily/runs/:id/apply',async c=>{
 const body=await c.req.json().catch(()=>null);if(!body||body.confirmed!==true||Object.keys(body).length!==1)return c.json({code:'CONFIRMATION_REQUIRED'},422);
 return operation(c,body,async()=>{
  const db=c.env.DB,row=await runRow(c,c.req.param('id'));if(row.status==='applied')return{resource:'daily-visit-run',data:{id:row.id,status:'applied'},statements:[]};
  const result=await runResult(c,row),snapshot=JSON.parse(row.snapshot_json),policy=await readPolicy(c),scope=c.get('scope');
  if(snapshot.input.custom_work_hours&&(c as any).get('portfolioOwner')!==true)fail(403,'DAILY_CUSTOM_HOURS_OWNER_ONLY');
  if(!scope.orgWide&&!policy?.config.allow_rep_publish)fail(403,'SCOPE_DENIED');if(!result.current||!result.route||!result.planned)fail(409,'DAILY_STALE');
  const jobs=result.route.steps.filter((s:any)=>s.type==='job'),newJobs=jobs.filter((s:any)=>!s.fixed_plan_id);
  if(jobs.some((s:any)=>(s.arrival+s.waiting_time)*1000<Date.now()+5000))fail(409,'DAILY_PLAN_TIME_PAST');
  const statements:D1PreparedStatement[]=[db.prepare('INSERT INTO master_mutation_guard(ok) SELECT COUNT(*) FROM visit_planning_revision v JOIN geo_distribution_epoch g ON g.organization_id=v.organization_id JOIN daily_visit_policy p ON p.organization_id=v.organization_id WHERE v.organization_id=? AND v.source_epoch=? AND v.agenda_epoch=? AND g.epoch=? AND p.version=?').bind(org(c),snapshot.revision.source_epoch,snapshot.revision.agenda_epoch,snapshot.revision.geo_epoch,row.policy_version),db.prepare('DELETE FROM master_mutation_guard')];
  for(const old of snapshot.replacePlans){const after={...old,status:'cancelled',version:old.version+1};statements.push(...guard(db,db.prepare("UPDATE work_plan SET status='cancelled',version=version+1 WHERE organization_id=? AND id=? AND version=? AND status IN('planned','proposed')").bind(org(c),old.id,old.version)),db.prepare('INSERT INTO work_plan_revision(id,organization_id,plan_id,actor_id,occurred_at,before_json,after_json,reason) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),org(c),old.id,scope.identity.id,now(),canonicalJson(old),canonicalJson(after),'Digantikan oleh rute harian '+row.id));}
  const planIds:string[]=[];
  for(const [sequence,job] of newJobs.entries()){
   const id=crypto.randomUUID(),scheduled=new Date((job.arrival+job.waiting_time)*1000).toISOString();planIds.push(id);
   statements.push(db.prepare("INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES(?,?,?,?,?,?,'visit','planned',?,?,?,?)").bind(id,org(c),job.customer_id,row.rep_id,scheduled,scheduled,'Rute harian ORS '+row.id,scope.identity.id,now(),canonicalJson({calendar:snapshot.calendar,slot_minutes:job.service/60,daily_visit_run_id:row.id,opening_source:snapshot.customers.find((x:any)=>x.id===job.customer_id)?.opening_source})),db.prepare('INSERT INTO daily_visit_plan_link(organization_id,run_id,work_plan_id,sequence,service_seconds) VALUES(?,?,?,?,?)').bind(org(c),row.id,id,sequence+1,job.service));
  }
  if(snapshot.replacement)statements.push(...guard(db,db.prepare("UPDATE daily_visit_run SET status='superseded' WHERE organization_id=? AND id=? AND status='applied'").bind(org(c),snapshot.replacement.id)));
  statements.push(...guard(db,db.prepare("UPDATE daily_visit_run SET status='applied',applied_at=? WHERE organization_id=? AND id=? AND status='complete'").bind(now(),org(c),row.id)));
  return{resource:'daily-visit-run',data:{id:row.id,status:'applied',created:planIds.length,plan_ids:planIds,preserved_existing:jobs.length-newJobs.length},statements};
 },false);
});
dailyVisit.onError((error,c)=>{const match=/^(400|403|404|409|412|422|428|503):([A-Z0-9_]+)$/.exec(error.message);return c.json({code:match?.[2]||'DAILY_OPERATION_FAILED'},(match?Number(match[1]):500)as any);});
