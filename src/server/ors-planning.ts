import {Hono} from 'hono';
import {orsLimits,orsPreviewInput} from '../shared/ors-planning';
import {canonicalJson} from '../shared/boundaries';
import type {AgentEnv} from './visit-agent-registry';
import {digest,fail} from './operations';
import {readVisitPreflight} from './visit-planning';
import {planningRevision} from './visit-planning-source';
import {optimizeOrs} from './ors-provider';

type OrsEnv=AgentEnv&{Bindings:AgentEnv['Bindings']&{ORS_API_KEY?:string}};
export const orsPlanning=new Hono<OrsEnv>();
const org=(c:any)=>c.get('identity').organization_id;
const epoch=(v:string)=>Math.floor(Date.parse(v)/1000);
function buildInputs(snapshot:any,date:string,ids:string[]){
 if(date<snapshot.request.period.start||date>snapshot.request.period.end)fail(422,'ORS_INVALID_INPUT');
 const customers=ids.map(id=>snapshot.customers.find((r:any)=>r.customer_id===id));
 if(customers.some(r=>!r))fail(422,'ORS_INVALID_INPUT');
 const reps=new Set<string>(),locations:number[][]=[];
 const location=(p:any)=>{const value=[p.longitude_e7/1e7,p.latitude_e7/1e7];let i=locations.findIndex(v=>v[0]===value[0]&&v[1]===value[1]);if(i<0){i=locations.length;locations.push(value)}return{value,index:i}};
 for(const customer of customers){const eligible=customer.eligible_dates.filter((d:any)=>d.date===date);if(eligible.length!==1)fail(422,'ORS_ASSIGNMENT_CHANGED');reps.add(eligible[0].rep_id);if(!customer.point)fail(422,'ORS_CUSTOMER_COORDINATES_REQUIRED')}
 if(reps.size>orsLimits.reps)fail(422,'ORS_REP_LIMIT');
 // Until reserved-interval handling is integrated, fail closed on existing agenda.
 const repRows=[...reps].map(id=>snapshot.reps.find((r:any)=>r.id===id));
 const vehicles=repRows.map((rep:any,index)=>{
  const d=rep?.operational_days?.find((d:any)=>d.date===date&&d.state==='available');
  if(!d)fail(422,'ORS_REVIEWED_PROFILES_REQUIRED');
  if(epoch(d.shift.from)<=Date.now()/1000)fail(422,'ORS_FUTURE_SHIFT_REQUIRED');
  if(snapshot.source.agenda.some((a:any)=>a.user_id===rep.id&&new Intl.DateTimeFormat('sv-SE',{timeZone:d.timezone}).format(new Date(a.scheduled_at))===date))fail(422,'ORS_EXISTING_AGENDA');
  const start=location(d.start),end=location(d.end);
  return{id:index+1,profile:'driving-car',start:start.value,end:end.value,start_index:start.index,end_index:end.index,skills:[index+1],time_window:[epoch(d.shift.from),epoch(d.shift.until)],breaks:d.breaks.map((b:any,i:number)=>({id:i+1,service:epoch(b.until)-epoch(b.from),time_windows:[[epoch(b.from),epoch(b.from)]]}))};
 });
 const jobs=customers.map((customer:any,index)=>{
  const d=customer.operational_dates.find((d:any)=>d.date===date),owner=customer.eligible_dates.find((d:any)=>d.date===date)?.rep_id,vehicle=repRows.findIndex((r:any)=>r.id===owner)+1;
  if(!d||d.rep_id!==owner||!Number.isInteger(d.service_seconds)||d.service_seconds<60||!d.windows?.length)fail(422,'ORS_REVIEWED_PROFILES_REQUIRED');
  const windows=d.windows.map((w:any)=>[epoch(w.from),epoch(w.until)-d.service_seconds]).filter((w:number[])=>w[1]>=w[0]);if(!windows.length)fail(422,'ORS_REVIEWED_PROFILES_REQUIRED');
  const point=location(customer.point);return{id:index+1,location:point.value,location_index:point.index,service:d.service_seconds,time_windows:windows,skills:[vehicle]};
 });
 if(locations.length>orsLimits.matrix_nodes)fail(422,'ORS_MATRIX_NODE_LIMIT');
 return{vehicles,jobs,locations,customers,repRows};
}

async function resultFor(c:any,row:any){
 if(row.status==='pending')fail(409,'ORS_PREVIEW_IN_PROGRESS');if(row.status==='failed')fail(503,row.error_code||'ORS_PROVIDER_UNAVAILABLE');
 const object=await c.env.IMPORT_FILES?.get(row.storage_key);if(!object||object.size>2_000_000)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const bytes=await object.arrayBuffer();if(bytes.byteLength>2_000_000||await digest(bytes)!==row.result_sha256)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const result=JSON.parse(new TextDecoder().decode(bytes));if(result.organization_id!==org(c)||result.environment!==c.env.APP_ENV||result.id!==row.id)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const revision=await planningRevision(c.env.DB,org(c));return{...result,current:revision.source_epoch===result.basis.source_epoch&&revision.agenda_epoch===result.basis.agenda_epoch&&result.date>=c.get('scope').date};
}

orsPlanning.use('/api/visit-generator/ors/*',async(c,next)=>{if(!c.get('scope').orgWide)fail(403,'SCOPE_DENIED');c.header('Cache-Control','private, no-store');await next()});
orsPlanning.get('/api/visit-generator/ors/status',async c=>c.json({data:{configured:Boolean(c.env.ORS_API_KEY),provider:'HeiGIT / ORS',limits:orsLimits,profile:'driving-car',traffic:'none',mode:'daily_preview',publishable:false}}));
orsPlanning.get('/api/visit-generator/ors/previews',async c=>{const rows=(await c.env.DB.prepare('SELECT id,preflight_id,created_at,status,error_code FROM visit_ors_preview WHERE organization_id=? ORDER BY created_at DESC,id DESC LIMIT 21').bind(org(c)).all()).results;return c.json({data:{previews:rows.slice(0,20),has_more:rows.length>20}})});
orsPlanning.get('/api/visit-generator/ors/previews/:id',async c=>{const row=await c.env.DB.prepare('SELECT * FROM visit_ors_preview WHERE organization_id=? AND id=?').bind(org(c),c.req.param('id')).first();if(!row)fail(404,'ORS_PREVIEW_NOT_FOUND');return c.json({data:await resultFor(c,row)})});
orsPlanning.post('/api/visit-generator/ors/previews',async c=>{
 const parsed=orsPreviewInput.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)fail(422,'ORS_INVALID_INPUT');
 const key=c.req.header('Idempotency-Key');if(!key||key.length<8||key.length>128)fail(400,'IDEMPOTENCY_KEY_REQUIRED');
 if(!c.env.ORS_API_KEY)fail(503,'ORS_NOT_CONFIGURED');if(!c.env.IMPORT_FILES)fail(503,'ORS_STORAGE_UNAVAILABLE');
 const body=parsed.data,sha=await digest(canonicalJson(body)),db=c.env.DB,actor=c.get('identity').id;
 const previous=await db.prepare('SELECT * FROM visit_ors_preview WHERE organization_id=? AND actor_id=? AND idempotency_key=?').bind(org(c),actor,key).first<any>();
 if(previous){if(previous.input_sha256!==sha)fail(409,'ORS_IDEMPOTENCY_CONFLICT');return c.json({data:await resultFor(c,previous)})}
 const preflight=await readVisitPreflight(c,body.preflight_id);if(!preflight.current)fail(409,'ORS_PREFLIGHT_STALE');
 const snapshot=preflight.snapshot,input=buildInputs(snapshot,body.date,body.customer_ids),id=crypto.randomUUID(),stamp=new Date().toISOString(),day=stamp.slice(0,10)+'T00:00:00.000Z',lease=new Date(Date.now()-180000).toISOString();
 const claim=await db.prepare("INSERT INTO visit_ors_preview(id,organization_id,actor_id,preflight_id,idempotency_key,input_sha256,created_at,status) SELECT ?,?,?,?,?,?,?,'pending' WHERE (SELECT count(*) FROM visit_ors_preview WHERE created_at>=?)<? AND NOT EXISTS(SELECT 1 FROM visit_ors_preview WHERE status='pending' AND created_at>=?)").bind(id,org(c),actor,body.preflight_id,key,sha,stamp,day,orsLimits.previews_per_utc_day,lease).run();
 if(!claim.meta.changes){const n=await db.prepare('SELECT count(*) n FROM visit_ors_preview WHERE created_at>=?').bind(day).first<any>();fail(503,n.n>=orsLimits.previews_per_utc_day?'ORS_DAILY_BUDGET':'ORS_BUSY')}
 const storage=org(c)+'/ors-previews/'+id+'.json';
 try{
  const optimized=await optimizeOrs(c.env.ORS_API_KEY,input.vehicles,input.jobs,input.locations),revision=await planningRevision(db,org(c));
  if(revision.source_epoch!==snapshot.basis.source_epoch||revision.agenda_epoch!==snapshot.basis.agenda_epoch)fail(409,'ORS_SOURCE_CHANGED');
  const routes=optimized.result.routes.map((route:any)=>({...route,rep_id:input.repRows[route.vehicle-1].id,rep_name:input.repRows[route.vehicle-1].name,timezone:input.repRows[route.vehicle-1].operational_days.find((d:any)=>d.date===body.date).timezone,steps:route.steps.map((step:any)=>({...step,...(step.type==='job'?{customer_id:input.customers[step.id-1].customer_id,customer_name:input.customers[step.id-1].name}:{})}))}));
  const result={format:'nyales-ors-preview-1',id,organization_id:org(c),environment:c.env.APP_ENV,date:body.date,created_at:stamp,preflight_id:body.preflight_id,basis:revision,provider:'HeiGIT / ORS',profile:'driving-car',traffic:'none',publishable:false,preview_only:true,routes,unassigned:optimized.result.unassigned.map((job:any)=>({customer_id:input.customers[job.id-1].customer_id,name:input.customers[job.id-1].name})),geometry:optimized.geometry,matrix_nodes:optimized.matrix_nodes,geometry_available:optimized.geometry.features.length===routes.length,notice:'Pilihan satu hari; belum menjamin frekuensi/gap PJP bulanan. Tidak mengubah agenda atau assignment. Jarak dan waktu merupakan estimasi jaringan jalan, tanpa lalu lintas langsung.'};
  const text=canonicalJson(result),bytes=new TextEncoder().encode(text);if(bytes.byteLength>2_000_000)fail(503,'ORS_INVALID_RESULT');
  await c.env.IMPORT_FILES.put(storage,bytes,{httpMetadata:{contentType:'application/json'}});
  await db.batch([db.prepare('INSERT INTO master_mutation_guard(ok) SELECT count(*) FROM visit_planning_revision WHERE organization_id=? AND source_epoch=? AND agenda_epoch=?').bind(org(c),revision.source_epoch,revision.agenda_epoch),db.prepare('DELETE FROM master_mutation_guard'),db.prepare("UPDATE visit_ors_preview SET status='complete',storage_key=?,result_sha256=? WHERE id=? AND organization_id=? AND status='pending'").bind(storage,await digest(bytes.buffer),id,org(c)),db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),org(c),actor,'visit_ors_preview',id,'preview',stamp,null,canonicalJson({id,preflight_id:body.preflight_id,date:body.date,customer_count:body.customer_ids.length,provider:'HeiGIT / ORS',external_processing_confirmed:true,publishable:false}))]);
  return c.json({data:{...result,current:true}},201);
 }catch(e){const match=/^(400|403|404|409|412|422|428|503):(ORS_[A-Z0-9_]+)$/.exec((e as Error).message),code=match?.[2]||'ORS_PROVIDER_UNAVAILABLE';await db.prepare("UPDATE visit_ors_preview SET status='failed',error_code=? WHERE id=? AND organization_id=? AND status='pending'").bind(code,id,org(c)).run();await c.env.IMPORT_FILES.delete(storage).catch(()=>{});fail(match?Number(match[1]):503,code)}
});
orsPlanning.onError((e,c)=>{const m=/^(400|403|404|409|412|422|428|503):([A-Z0-9_]+)$/.exec(e.message);return c.json({code:m?.[2]||'ORS_PROVIDER_UNAVAILABLE'},(m?Number(m[1]):503)as any)});
