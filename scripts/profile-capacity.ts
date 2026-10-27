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
const query="SELECT a.id FROM activity a WHERE a.organization_id='o' AND substr(a.occurred_at,1,10) BETWEEN '"+day+"' AND '"+day+"'";
const indexed=sqlite.prepare('EXPLAIN QUERY PLAN '+query).all();sqlite.exec('DROP INDEX ops_activity_period');const unindexed=sqlite.prepare('EXPLAIN QUERY PLAN '+query).all();sqlite.exec('CREATE INDEX ops_activity_period ON activity(organization_id,substr(occurred_at,1,10))');
async function request(path:string){const stats=counters(),app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:'mg',name:'Capacity fixture',role:'MANAGEMENT',organization_id:'o'}as never);await next()});app.route('/',scopedRoutes);const started=performance.now(),response=await app.request(path,{}, {DB:measuredDB(adapter,stats)});const body=await response.json()as any;return{path,status:response.status,wall_ms:performance.now()-started,db_statements:stats.db_statements,provider_meta_known:stats.db_meta_samples===stats.db_statements,code:body.code||null,customer_count:body.data?.customer_count??null}}
const results=[];
for(const path of ['/api/dashboard','/api/map','/api/dashboard/summary?period='+month,'/api/dashboard/summary?period='+month+'&rep_id=capacity-sr-0']){
 const samples=[];for(let i=0;i<5;i++)samples.push(await request(path));const times=samples.map(r=>r.wall_ms).sort((a,b)=>a-b);results.push({...samples[0],mean_ms:times.reduce((a,b)=>a+b,0)/times.length,p95_sample_ms:times.at(-1),iterations:5});
}
const concurrencyStart=performance.now(),parallel=await Promise.all(Array.from({length:5},()=>request('/api/dashboard/summary?period='+month+'&rep_id=capacity-sr-0')));
const report={generated_at:new Date().toISOString(),environment:'Node SQLite in-memory; not Workers CPU, production latency, D1 billing, or deployment capacity',profile:{sales_reps:25,customers:1000,invoices_month:10000,concurrent_requests:5},results,concurrent:{count:5,total_wall_ms:performance.now()-concurrencyStart,statuses:parallel.map(r=>r.status)},database_bytes_local:Number((sqlite.prepare('PRAGMA page_count').get() as any).page_count)*Number((sqlite.prepare('PRAGMA page_size').get() as any).page_size),query_plan:{indexed,unindexed},free_tier_gates:{workers_cpu_ms:null,d1_provider_rows:null,actual_shared_quota:null,monitoring_org_report:results.find(r=>r.code==='REPORT_SCOPE_LIMIT_NARROW_FILTERS')?'blocked_above_2000_source_records':'passed_fixture',max_d1_statements_observed:Math.max(...results.map(r=>r.db_statements))},recommendation:'Do not accept a 10k-invoice organization-wide monitoring pilot until bounded aggregation/drill pagination is implemented. Rep-filtered fixture stays bounded. Measure deployed CPU and shared account quotas before rollout.'};
writeFileSync('test-results/web056-capacity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
