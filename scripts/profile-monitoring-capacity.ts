import{writeFileSync}from'node:fs';
import{Hono}from'hono';
import{fixture}from'../tests/sales-fixture';
import{scopedRoutes}from'../src/server/index';
import{counters,measuredDB}from'../src/server/telemetry';

// Isolated in-memory synthetic data only. Never points to local business D1 or a remote account.
const{sqlite,adapter}=fixture(),month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}).slice(0,7),day=month+'-01';
sqlite.exec('BEGIN');
const user=sqlite.prepare("INSERT INTO app_user(id,organization_id,name) VALUES(?,'o',?)"),role=sqlite.prepare("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES(?,'o',?,'SALES_REP','field','2020-01-01')"),area=sqlite.prepare("INSERT INTO user_area_scope VALUES('o',?,'a','2020-01-01',NULL)");
for(let i=0;i<25;i++){const id='capacity-sr-'+i;user.run(id,'Capacity SR '+i);role.run(id,id);area.run(id)}
const customer=sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,address,latitude_e7,longitude_e7) VALUES(?,'o','a',?,'Synthetic',-62000000,1068000000)"),assignment=sqlite.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES(?,'o',?,?,'field','a','2020-01-01')"),invoice=sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'o',?,?,'capacity_fixture','1',?,?,'a','field',?,100000,'validated','validated')"),activity=sqlite.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES(?,'o',?,?,'field','visit','done',?,'{\"meaningful\":true}')");
for(let i=0;i<999;i++){const co='capacity-c-'+i,rep='capacity-sr-'+i%25;customer.run(co,'Capacity customer '+i);assignment.run(co,co,rep);activity.run(co,co,rep,day+'T01:00:00Z')}
for(let i=0;i<10000;i++){const co='capacity-c-'+i%999,id='capacity-i-'+i;invoice.run(id,id,id,co,'capacity-sr-'+(i%999)%25,day)}
sqlite.exec('COMMIT');

// Also exceed the old activity guard. Keep business data completely isolated.
const extra=sqlite.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES(?,'o',?,?,'field','visit','done',?,'{\"meaningful\":true}')");
for(let i=0;i<4001;i++)extra.run('extra-'+i,'capacity-c-'+i%999,'capacity-sr-'+i%25,day+'T02:00:00Z');
async function request(path:string){const stats=counters(),app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:'mg',name:'Capacity fixture',role:'MANAGEMENT',organization_id:'o'} as never);await next()});app.route('/',scopedRoutes);const started=performance.now(),response=await app.request(path,{}, {DB:measuredDB(adapter,stats)});const body=await response.json() as any;return {path,status:response.status,wall_ms:performance.now()-started,db_statements:stats.db_statements,payload_bytes:new TextEncoder().encode(JSON.stringify(body)).byteLength,body};}
const results=[];
for(const path of ['/api/dashboard/summary?period='+month,'/api/dashboard/sources?period='+month+'&kind=invoices&limit=100','/api/dashboard/summary?period='+month+'&rep_id=capacity-sr-0']){
 const samples=[];for(let i=0;i<3;i++){const r=await request(path);if(r.status!==200)throw Error(JSON.stringify({path,status:r.status,body:r.body}));samples.push(r)}
 const times=samples.map(r=>r.wall_ms);const {body,...first}=samples[0];results.push({...first,mean_ms:times.reduce((a,b)=>a+b,0)/times.length,max_sample_ms:Math.max(...times),iterations:3,customer_count:body.data?.customer_count??null,invoice_count:body.data?.source_pages?.invoices.total??null,activity_count:body.data?.activity_count??null,observed_actual_net_minor:body.data?.observed_actual_net_minor??null,preview_rows:body.data?.sources?.invoices.length??body.data?.rows?.length});
}
if(results[0].invoice_count!==10000||results[0].observed_actual_net_minor!==1000000000||results[0].activity_count!==5000)throw Error('Fixture reconciliation failed');
const start=performance.now(),parallel=await Promise.all(Array.from({length:5},()=>request('/api/dashboard/summary?period='+month)));
if(parallel.some(r=>r.status!==200))throw Error('Concurrent fixture failed');
const report={generated_at:new Date().toISOString(),environment:'Node SQLite in-memory; no production CPU/billing guarantee',profile:{added_sales_reps:25,base_fixture_sales_reps:2,customers:1000,invoices:10000,activities:5000,concurrent_requests:5},results,concurrent:{count:5,total_wall_ms:performance.now()-start,statuses:parallel.map(r=>r.status)},gates:{organization_invoice_activity_guard:'resolved in this fixture',worker_cpu_ms:null,shared_quota:null,target_leaf_guard:2000,workforce_guard:2000,export_rows_limit:10000,export_bytes_limit:5242880}};
writeFileSync('test-results/monitoring-capacity-v4.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
