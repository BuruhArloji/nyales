import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Hono} from 'hono';
import {database} from '../tests/sqlite-helper';
import {scopedRoutes} from '../src/server/index';
import {pilotSnapshot,type PilotManifest} from '../src/shared/pilot';
import {runPilot} from './pilot-reconcile';
import {csvFile} from '../src/shared/csv';
import {invoiceCsvFields} from '../src/shared/invoice-fields';
import type {DatabaseSync} from 'node:sqlite';

/** Synthetic rehearsal only. SQLite in memory; no Wrangler state, remote API,
 * Firebase accounts, provider credentials or existing preview writes.
 * Auth is injected by the harness; this is a domain/API rehearsal, not login UAT.
 */
export async function runDemo(output:string,input='pilot/demo-10-sales/source-data.json',onReady?:(sqlite:DatabaseSync)=>void){
 const raw=readFileSync(input),d=JSON.parse(raw.toString('utf8'));
 if(d.data_classification!=='synthetic'||d.scope.organization_id!=='nyales-training-only')throw Error('Only the synthetic training fixture is allowed');
 const dir=resolve(output);mkdirSync(dirname(dir),{recursive:true});mkdirSync(dir,{recursive:false});
 const save=(name:string,value:unknown)=>writeFileSync(resolve(dir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 writeFileSync(resolve(dir,'source-data.json'),raw,{flag:'wx'});
 const {sqlite,adapter}=database(),org=d.scope.organization_id,events:any[]=[],targetMap=new Map<string,string>();
 const insert=(table:string,row:Record<string,unknown>)=>{const keys=Object.keys(row);sqlite.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row) as any)};
 try{
  // Explicit fixture initialization, separate from financial import/target API actions.
  insert('organization',{id:org,name:'NYALES Training Dummy',timezone:'Asia/Jakarta'});
  insert('branch',{id:'demo-branch',organization_id:org,name:'Cabang Dummy',timezone:'Asia/Jakarta'});
  insert('area',{id:'demo-area',organization_id:org,name:'Area Dummy',branch_id:'demo-branch'});
  const leaders=[{id:'demo-pic',name:'Rizky Aditya',role:'MANAGEMENT',channel:null},{id:'demo-reviewer',name:'Reviewer Dummy',role:'NSM',channel:null},...['field','telesales'].flatMap(channel=>[{id:'spv-'+channel,name:'Supervisor Dummy '+channel,role:'SUPERVISOR',channel},{id:'am-'+channel,name:'Area Manager Dummy '+channel,role:'AREA_MANAGER',channel}])];
  for(const u of [...leaders,...d.users]){
   insert('app_user',{id:u.id,organization_id:org,name:u.name});insert('auth_role_assignment',{id:'role-'+u.id,organization_id:org,user_id:u.id,role_code:u.role,channel:u.channel,effective_from_date:d.scope.history_start});
   if(u.channel)insert('user_area_scope',{organization_id:org,user_id:u.id,area_id:'demo-area',effective_from_date:d.scope.history_start,effective_to_date:null});
  }
  const reporting=[{subordinate_id:'demo-reviewer',manager_id:'demo-pic',channel:'field'},...['field','telesales'].flatMap(channel=>[{subordinate_id:'am-'+channel,manager_id:'demo-reviewer',channel},{subordinate_id:'spv-'+channel,manager_id:'am-'+channel,channel}]),...d.users.map((u:any)=>({subordinate_id:u.id,manager_id:'spv-'+u.channel,channel:u.channel}))];
  for(const [index,r] of reporting.entries())insert('reporting_assignment',{...r,id:'report-'+index,organization_id:org,area_id:'demo-area',effective_from_date:d.scope.history_start});
  for(const c of d.customers)insert('customer_outlet',{...c,organization_id:org});
  for(const [index,o] of d.owners.entries()){const {customer_id,...rest}=o;insert('customer_assignment',{...rest,id:'assign-'+index,organization_id:org,outlet_id:customer_id});}
  async function request(method:string,path:string,body?:unknown,version?:number,actor='demo-pic'){
   const h=new Hono();h.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,role:actor==='demo-reviewer'?'NSM':'MANAGEMENT',organization_id:org} as never);await next()});h.route('/',scopedRoutes);
   const r=await h.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})},{DB:adapter});
   const response=await r.json() as any;events.push({method,path,actor,status:r.status,data:response.data});if(!r.ok)throw Error(path+': '+JSON.stringify(response));return response.data;
  }
  const payload={source_system:d.source_system,source_cutoff:d.scope.cutoff,invoices:d.invoices,credit_notes:d.credits};
  const dry=await request('POST','/api/invoice-imports',{...payload,mode:'dry_run'});if(dry.status!=='validated')throw Error('Dry run rejected: '+JSON.stringify(dry.errors));
  const committed=await request('POST','/api/invoice-imports',{...payload,mode:'commit',validation_batch_id:dry.id},dry.version);
  const retry=await request('POST','/api/invoice-imports',{...payload,mode:'commit',validation_batch_id:dry.id},dry.version);
  if(committed.id!==retry.id)throw Error('Import replay did not return original job');
  for(const p of d.target_plans){
   const {plan_key,items,reserve_minor,...plan}=p;
   const created=await request('POST','/api/target-plans',{...plan,reason:'Latihan sintetis terisolasi'});targetMap.set(created.id,plan_key);
   const leaves=await request('POST',`/api/target-versions/${created.version_id}/items`,{items,reserve_minor},1);
   const submitted=await request('POST',`/api/target-versions/${created.version_id}/submit`,{reason:'Submit latihan'},leaves.version);
   await request('POST',`/api/target-versions/${created.version_id}/approve`,{reason:'Review dummy oleh aktor lain'},submitted.version,'demo-reviewer');
  }
  const now=new Date().toISOString(),expected={schema_version:1,origin:'source',data_classification:'synthetic',exported_at:now,scope:d.scope,current_only:true,complete:true,users:d.users,customers:d.customers.map(({address,...c}:any)=>c),owners:d.owners,
   invoices:d.invoices.map((i:any)=>({source_system:d.source_system,source_invoice_id:i.source_invoice_id,source_version:i.source_version,customer_id:i.customer_id,rep_id:i.source_rep_id,area_id:i.area_id,channel:i.channel,invoice_date:i.invoice_date,status:i.status,validation_state:'validated',source_net_minor:i.net_minor,net_minor:i.net_minor-(i.net_includes_credit?0:d.credits.filter((c:any)=>c.source_invoice_id===i.source_invoice_id&&c.status==='validated').reduce((n:number,c:any)=>n+c.amount_minor,0)),net_includes_credit:i.net_includes_credit})),
   credits:d.credits.map((c:any)=>({...c,source_system:d.source_system})),target_versions:d.target_plans.map((p:any)=>({plan_key:p.plan_key,version:'1',period_start:p.period_start,period_end:p.period_end,channel:p.channel,status:'approved',parent_minor:p.items.reduce((n:number,i:any)=>n+i.target_minor,0)+p.reserve_minor,reserve_minor:p.reserve_minor})),targets:d.target_plans.flatMap((p:any)=>p.items.map(({reason,...i}:any)=>({...i,plan_key:p.plan_key,version:'1'})))};
  const all=(sql:string)=>sqlite.prepare(sql).all(org) as any[];
  // Independent extraction from persisted facts; never copy the expected snapshot.
  const observed={schema_version:1,origin:'nyales',data_classification:'synthetic',exported_at:now,scope:d.scope,current_only:true,complete:true,
   users:all("SELECT u.id,u.name,r.role_code role,r.channel FROM app_user u JOIN auth_role_assignment r ON r.user_id=u.id AND r.organization_id=u.organization_id WHERE u.organization_id=? AND r.role_code IN('SALES_REP','TELESALES')").map(u=>({...u,area_ids:sqlite.prepare('SELECT area_id FROM user_area_scope WHERE organization_id=? AND user_id=?').all(org,u.id).map((a:any)=>a.area_id)})),
   customers:all('SELECT id,external_code,name,area_id,record_status,latitude_e7,longitude_e7 FROM customer_outlet WHERE organization_id=?'),
   owners:all('SELECT outlet_id customer_id,rep_id,area_id,channel,effective_from_date,effective_to_date FROM customer_assignment WHERE organization_id=?'),
   invoices:all('SELECT source_system,external_invoice_id source_invoice_id,origin_source_version source_version,outlet_id customer_id,rep_id,area_id,channel,invoice_date,status,validation_state,source_net_minor,net_minor,net_includes_credit FROM invoice WHERE organization_id=? AND is_current=1').map(i=>({...i,net_includes_credit:Boolean(i.net_includes_credit)})),
   credits:all('SELECT source_system,source_credit_id,source_invoice_id,source_version,credit_date,amount_minor,status FROM credit_note WHERE organization_id=? AND is_current=1'),
   target_versions:all("SELECT p.id plan_id,v.revision_no,p.period_start,p.period_end,p.channel,v.status,v.parent_minor,v.reserve_minor FROM target_plan p JOIN target_version v ON v.target_plan_id=p.id AND v.organization_id=p.organization_id WHERE p.organization_id=? AND v.status='approved'").map(({plan_id,revision_no,...v})=>({...v,plan_key:targetMap.get(plan_id),version:String(revision_no)})),
   targets:all("SELECT ti.target_plan_id plan_id,v.revision_no,ti.outlet_id customer_id,ti.user_id rep_id,ti.area_id_snapshot area_id,ti.product_id,ti.product_group_id,ti.target_minor FROM target_item ti JOIN target_version v ON v.id=ti.target_version_id AND v.organization_id=ti.organization_id WHERE ti.organization_id=? AND v.status='approved'").map(({plan_id,revision_no,...t})=>({...t,plan_key:targetMap.get(plan_id),version:String(revision_no)}))};
  pilotSnapshot.parse(expected);pilotSnapshot.parse(observed);
  const mappings={schema_version:1,mappings:[{entity:'area',source_system:d.source_system,source_id:'AREA-DUMMY',nyales_id:'demo-area',kind:'canonical',reason:'Mapping latihan'},...d.users.map((u:any)=>({entity:'user',source_system:d.source_system,source_id:'SRC-'+u.id,nyales_id:u.id,kind:'canonical',reason:'Mapping latihan'})),...d.customers.map((c:any)=>({entity:'customer',source_system:d.source_system,source_id:c.external_code,nyales_id:c.id,kind:'canonical',reason:'Mapping latihan'}))]};
  const manifest:PilotManifest={schema_version:1,pilot_id:'demo-10-sales',data_classification:'synthetic',timezone:'Asia/Jakarta',max_sales:10,pic:d.pic,participants:d.users.map(({id,channel,...u}:any)=>({...u,user_id:id})),scope:d.scope,source_review:{source_system:d.source_system,reviewer:'Reviewer Dummy (simulasi, bukan sign-off manusia)',reviewed_at:now,net_definition:'IDR rupiah penuh; net_includes_credit eksplisit per header.',id_mapping_reference:'id-mapping.json'},inputs:{source_snapshot:'source-snapshot.json',nyales_snapshot:'nyales-snapshot.json',source_files:[{path:'source-data.json',expected_sha256:createHash('sha256').update(raw).digest('hex')}]}};
  const masterFields=['external_code','name','area_id','address'];writeFileSync(resolve(dir,'customer-import.csv'),csvFile([masterFields,...d.customers.map((c:any)=>masterFields.map(k=>c[k]))]),{flag:'wx'});
  const financialRows=[...d.invoices.map((i:any)=>({...i,record_type:'invoice',customer_code:d.customers.find((c:any)=>c.id===i.customer_id).external_code,rep_id:i.source_rep_id})),...d.credits.map((c:any)=>({...c,record_type:'credit',credit_amount_minor:c.amount_minor}))];
  writeFileSync(resolve(dir,'invoice-import.csv'),csvFile([[...invoiceCsvFields],...financialRows.map(r=>invoiceCsvFields.map(k=>r[k]??''))]),{flag:'wx'});
  save('training-identities.json',{classification:'synthetic',not_login_accounts:true,leaders,reporting,users:d.users,warning:'Role/area hanya untuk latihan, bukan penetapan jabatan nyata. Tidak ada password/email/akun provider.'});
  save('manifest.json',manifest);save('source-snapshot.json',expected);save('nyales-snapshot.json',observed);save('id-mapping.json',mappings);save('api-rehearsal.json',{classification:'synthetic',harness:'scoped routes with injected identity; SQLite in memory; no login/provider validation',master_setup:'fixture initialization, not master import acceptance',events});
  const report=runPilot(resolve(dir,'manifest.json'),resolve(dir,'reconciliation'));
  if(report.status!=='ready_for_named_review')throw Error('Rehearsal discrepancies: '+JSON.stringify(report.issues));
  save('SUMMARY.json',{classification:'synthetic',status:'dummy_rehearsal_passed',max_sales:10,sales:observed.users.length,customers:observed.customers.length,invoices:observed.invoices.length,credits:observed.credits.length,approved_target_plans:observed.target_versions.length,api_steps:events.length,invoice_retry_same_job:true,totals:report.totals.nyales,production_accepted:false,human_training_completed:false});
  onReady?.(sqlite);
  return report;
 }finally{sqlite.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out'){console.error('Gunakan --out <folder-baru>');process.exitCode=1}else runDemo(args[1]).then(()=>console.log('Dummy rehearsal PASS; no preview/production writes.')).catch(e=>{console.error((e as Error).message);process.exitCode=1})}
