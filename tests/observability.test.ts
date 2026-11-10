import{test}from'node:test';
import assert from'node:assert/strict';
import{Hono}from'hono';
import{fixture}from'./sales-fixture';
import{scopedRoutes,runScheduled}from'../src/server/index';
import{budgets,budgetWindow,crossedThresholds}from'../src/server/observability';
import{counters,measuredDB,measuredR2,measuredJob,telemetry,recordMetric}from'../src/server/telemetry';

function setup(){const f=fixture();f.sqlite.exec("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('mgr','o','mg','MANAGEMENT','2020-01-01'),('nsm','o','nsm','NSM','2020-01-01');");
 async function req(path:string,body?:any,actor='mg',version?:number,key=crypto.randomUUID(),organization='o',environment='local'){
  const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,role:actor==='sr'?'SALES_REP':'MANAGEMENT',organization_id:organization}as never);await next()});app.route('/',scopedRoutes);
  return app.request('/api/observability/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})},{DB:f.adapter,APP_ENV:environment,OBS_OWNER_ORGANIZATION_ID:environment==='local'?'o':'different-org'});
 }
 const policy={owner_user_id:'mg',pilot_reps:25,pilot_customers:1000,pilot_invoices_month:10000,concurrent_users:5,api_requests_day:10000,reason:'Pilot capacity simulation'};
 return{...f,req,policy};
}
test('budget windows are UTC and thresholds include boundaries; zero is known, missing is not',()=>{
 assert.deepEqual(crossedThresholds(69.99,100),[]);assert.deepEqual(crossedThresholds(70,100),[70]);assert.deepEqual(crossedThresholds(85,100),[70,85]);assert.deepEqual(crossedThresholds(95,100),[70,85,95]);assert.deepEqual(crossedThresholds(0,100),[]);
 const now=new Date('2026-10-31T23:59:59Z');assert.equal(budgetWindow('d1_reads',now),'2026-10-31');assert.equal(budgetWindow('r2_a',now),'2026-10');assert.equal(budgetWindow('d1_database_bytes',now),'current');assert.equal(budgets.d1_database_bytes.limit,500000000);
});
test('capacity policy enforces owner role, ETag, tenant scope; provider alerts deduplicate atomically',async()=>{
 const{req,data,sqlite,policy}=setup();
 assert.equal((await req('summary',undefined,'sr')).status,403);assert.equal((await req('policy',policy,'sr')).status,403);
 assert.equal((await req('policy',{...policy,owner_user_id:'sr'})).status,422);
 await data(await req('policy',policy));assert.equal((await req('policy',policy)).status,412);await data(await req('policy',{...policy,reason:'Updated capacity profile'},'mg',1));
 const body={metric:'d1_writes',value:95000,sampled_at:new Date().toISOString(),reason:'Cloudflare dashboard test snapshot'},key=crypto.randomUUID();
 await data(await req('usage',body,'mg',undefined,key));await data(await req('usage',body,'mg',undefined,key));await data(await req('usage',body));
 assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM ops_budget_alert').get()as any).n,3);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM in_app_notification WHERE kind='capacity_budget'").get()as any).n,3);
 let summary=await data(await req('summary'));assert.equal(summary.budgets.find((b:any)=>b.metric==='d1_writes').status,95);assert.equal(summary.budgets.find((b:any)=>b.metric==='workers_cpu_ms').value,null);
 await data(await req('usage',{...body,value:0,sampled_at:new Date(Date.now()+1000).toISOString()}));summary=await data(await req('summary'));assert.equal(summary.budgets.find((b:any)=>b.metric==='d1_writes').percent,0);
 const foreign=await data(await req('summary',undefined,'other',undefined,undefined,'x'));assert.equal(foreign.profile,null);assert.equal(foreign.alerts.length,0);assert.equal(foreign.metrics.length,0);
 assert.equal((await req('usage',body,'mg',undefined,undefined,'o','production')).status,403);
 assert.equal((await req('usage',{...body,sampled_at:new Date(Date.now()+120000).toISOString()})).status,422);
 assert.equal((await req('usage',{...body,sampled_at:new Date(Date.now()-7*3600000).toISOString()})).status,422);
 assert.equal((await req('events',{event:'map_3d',key:'forbidden'},'sr')).status,422);await data(await req('events',{event:'map_3d'},'sr'));
 const old=new Date(Date.now()-7*3600000).toISOString();sqlite.prepare('UPDATE ops_usage_snapshot SET sampled_at=?').run(old);summary=await data(await req('summary'));assert.equal(summary.budgets.find((b:any)=>b.metric==='d1_writes').status,'unknown');
});
test('D1 and R2 wrappers preserve results and batches, count only available provider metadata',async()=>{
 const{adapter,sqlite}=fixture(),stats=counters(),db=measuredDB(adapter,stats);
 const r=await db.prepare('SELECT name FROM app_user WHERE id=?').bind('sr').first<{name:string}>();assert.equal(r?.name,'Field');
 await db.batch([db.prepare("UPDATE app_user SET name='Field updated' WHERE id=?").bind('sr'),db.prepare("UPDATE app_user SET name='Tele updated' WHERE id=?").bind('tele')]);assert.equal(stats.db_statements,3);assert.equal(stats.db_meta_samples,0);
 await assert.rejects(db.batch([db.prepare("UPDATE app_user SET name='must rollback' WHERE id='sr'"),db.prepare('INSERT INTO absent_table VALUES(1)')]));assert.equal((sqlite.prepare("SELECT name FROM app_user WHERE id='sr'").get()as any).name,'Field updated');
 const real={prepare:()=>({bind(){return this},all:async()=>({results:[{n:7}],meta:{rows_read:40,rows_written:0}})})}as unknown as D1Database;
 const measured=counters();assert.equal(await measuredDB(real,measured).prepare('SELECT').first('n'),7);assert.equal(measured.rows_read,40);assert.equal(measured.db_meta_samples,1);
 const bucket=measuredR2({get:async()=>({ok:true}),put:async()=>({etag:'a'}),delete:async()=>{}}as any,stats)!;assert.ok(await bucket.get('secret/path'));await bucket.put('secret/path','x');await bucket.delete('secret/path');assert.equal(stats.r2_a,1);assert.equal(stats.r2_b,1);assert.equal(stats.r2_deletes,1);
});
test('telemetry sanitizes paths and headers, survives missing metric storage and concurrent env bindings',async()=>{
 const{adapter,sqlite}=fixture(),logs:string[]=[],prior=console.log,warn=console.warn;console.log=(v:any)=>logs.push(String(v));console.warn=()=>{};
 try{
  const h=new Hono<any>();h.use('*',telemetry);h.use('*',async(c,next)=>{c.set('identity',{id:'sr',organization_id:'o'});await next()});h.get('/api/customers/:id',async c=>{await c.env.DB.prepare('SELECT name FROM app_user WHERE id=?').bind('sr').first();return c.json({ok:true})});
  const env={DB:adapter};const results=await Promise.all([h.request('/api/customers/SECRET-CUSTOMER?key=SECRET-KEY',{headers:{Authorization:'Bearer SECRET-TOKEN'}},env),h.request('/api/customers/SECOND',{},env)]);
  assert.ok(results.every(r=>r.status===200&&r.headers.get('X-Request-ID')));assert.equal(env.DB,adapter);assert.ok(!logs.join('').includes('SECRET'));assert.ok(logs.join('').includes('/api/customers/:id'));
  assert.equal((sqlite.prepare("SELECT SUM(calls) n FROM ops_hourly WHERE kind='api'").get()as any).n,2);
  assert.deepEqual(sqlite.prepare("SELECT DISTINCT operation FROM ops_hourly WHERE kind='api'").all().map((r:any)=>r.operation),['GET /api/customers/:id']);
  sqlite.exec('DROP TABLE ops_hourly');assert.equal((await h.request('/api/customers/secret',{},env)).status,200);
 }finally{console.log=prior;console.warn=warn}
});
test('job failures are recorded under designated owner only and never swallow business failure',async()=>{
 const{adapter,sqlite}=fixture();await assert.rejects(measuredJob('test-checkpoint',{DB:adapter,OBS_OWNER_ORGANIZATION_ID:'o'},async()=>{throw Error('SECRET-FAILURE')}),/SCHEDULED_JOB_FAILED:test-checkpoint/);
 assert.equal((sqlite.prepare("SELECT outcome FROM ops_hourly WHERE kind='job'").get()as any).outcome,'failed');
 await measuredJob('other-checkpoint',{DB:adapter,APP_ENV:'production'},async()=>{});assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM ops_hourly').get()as any).n,1);
 await recordMetric(adapter,'x','api','GET /api/dashboard','200',10);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM ops_hourly WHERE organization_id='x'").get()as any).n,1);
});

test('all scheduled checkpoints produce separate job outcomes on isolated data',async()=>{
 const{adapter,sqlite}=fixture();await runScheduled({DB:adapter,APP_ENV:'local',LOCAL_AUTH:'true',FIREBASE_PROJECT_ID:'',OBS_OWNER_ORGANIZATION_ID:'o'});
 const jobs=sqlite.prepare("SELECT operation,outcome FROM ops_hourly WHERE organization_id='o' AND kind='job' ORDER BY operation").all()as any[];
 assert.equal(jobs.length,6);assert.ok(jobs.some(j=>j.operation==='visit-agent-ephemeral'));assert.ok(jobs.every(j=>j.outcome==='success'));
});

test('failed job alerts reach configured active owner once per hourly checkpoint',async()=>{
 const{req,data,policy,adapter,sqlite}=setup();await data(await req('policy',policy));
 for(let i=0;i<2;i++)await assert.rejects(measuredJob('failure-alert',{DB:adapter,OBS_OWNER_ORGANIZATION_ID:'o'},async()=>{throw Error('not logged')}));
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM in_app_notification WHERE kind='ops_job_failure' AND user_id='mg'").get()as any).n,1);
});

test('provider snapshots refuse a deactivated alert owner instead of silently losing alerts',async()=>{
 const{req,data,policy,sqlite}=setup();await data(await req('policy',{...policy,owner_user_id:'nsm'}));sqlite.exec("UPDATE app_user SET status='inactive' WHERE id='nsm'");
 const response=await req('usage',{metric:'d1_reads',value:5000000,sampled_at:new Date().toISOString(),reason:'Current dashboard sample'});assert.equal(response.status,422);assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM ops_usage_snapshot').get()as any).n,0);
});
