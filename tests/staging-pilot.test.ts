import {test}from'node:test';
import assert from'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync}from'node:fs';
import {resolve}from'node:path';
import {database}from'./sqlite-helper';
import {trainingDerivative,prepareStagingTraining}from'../scripts/staging-pilot-prepare';
import {hasTrainingData}from'../src/server/training-marker';
import {Hono}from'hono';
import {scopedRoutes}from'../src/server/index';
const context={environment:'staging' as const,organization_id:'11111111-1111-4111-8111-111111111111',operator_id:'22222222-2222-4222-8222-222222222222',organization_name:'NYALES Pilot' as const,as_of:'2026-10-28'};
test('Staging training derivative preserves source and amounts, shifts dates and explicitly labels synthetic coordinates',()=>{
 const raw=JSON.parse(readFileSync('pilot/demo-10-sales/source-data.json','utf8')),before=JSON.stringify(raw),data=trainingDerivative(raw,context.as_of);
 assert.equal(JSON.stringify(raw),before);assert.equal(data.data_classification,'synthetic');assert.equal(data.scope.period_start,'2026-10-01');assert.equal(data.scope.period_end,'2026-10-31');assert.equal(data.users.length,10);assert.equal(data.users[0].name,'Novely');assert.equal(data.users[3].name,'Ayu Lestari');assert.equal(data.customers[0].name,'Warung Sumber Rezeki');assert.match(data.customers[0].address,/simulasi/);assert.ok(data.customers.every((c:any)=>c.latitude_e7&&c.longitude_e7));assert.deepEqual(data.invoices.map((i:any)=>i.net_minor),raw.invoices.map((i:any)=>i.net_minor));
 assert.throws(()=>trainingDerivative({...raw,data_classification:'real'},context.as_of));assert.throws(()=>trainingDerivative(raw,'2026-10-01'));assert.throws(()=>trainingDerivative(raw,'2026-11-28'));
});
test('Exact staging training SQL preserves existing Management identity, refuses duplicate and nonempty business data, and has no credential payload',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-28T12:00:00Z')});
 mkdirSync('test-results',{recursive:true});const dir=mkdtempSync(resolve('test-results/staging-training-'));
 const report=await prepareStagingTraining(resolve(dir,'prepared'),context);assert.equal(report.source_reconciliation,'passed');assert.equal(report.customers,20);assert.equal(report.sales_reps+report.telesales,10);assert.equal(report.duplicate_seed,'rejected');
 const seed=readFileSync(resolve(dir,'prepared/seed.sql'),'utf8');assert.ok(!seed.includes('existing-operator-fixture'));assert.ok(!seed.includes('nyales-local-demo'));assert.ok(!seed.includes('INSERT INTO "organization"'));assert.ok(!seed.includes('DROP TRIGGER'));assert.ok(!seed.includes('PRAGMA foreign_keys=OFF'));
 const f=database();f.sqlite.exec('PRAGMA foreign_keys=ON');f.sqlite.prepare('INSERT INTO organization(id,name) VALUES(?,?)').run(context.organization_id,context.organization_name);f.sqlite.prepare("INSERT INTO app_user(id,organization_id,name,auth_subject) VALUES(?,?,'Didik','firebase-owner')").run(context.operator_id,context.organization_id);f.sqlite.prepare("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('owner-role',?,?,'MANAGEMENT','2026-01-01')").run(context.organization_id,context.operator_id);
 f.sqlite.exec(seed);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,20);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM invoice').get()as any).n,80);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM app_user WHERE auth_subject IS NULL').get()as any).n,16);assert.equal((f.sqlite.prepare('SELECT auth_subject FROM app_user WHERE id=?').get(context.operator_id)as any).auth_subject,'firebase-owner');assert.equal((f.sqlite.prepare("SELECT SUM(target_minor) n FROM target_item").get()as any).n,80000000);assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.ok(await hasTrainingData(f.adapter,context.organization_id));assert.equal(await hasTrainingData(f.adapter,'other-org'),false);assert.throws(()=>f.sqlite.exec(seed),/CHECK/);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM app_user').get()as any).n,17);
 const harness=new Hono();harness.use('*',async(c,next)=>{c.set('identity' as never,{id:context.operator_id,name:'Didik',organization_id:context.organization_id,role:'MANAGEMENT'}as never);await next()});harness.route('/',scopedRoutes);
 const env={DB:f.adapter,APP_ENV:'staging',LOCAL_AUTH:'false',FIREBASE_PROJECT_ID:'fixture-project'};
 const me=await harness.request('/api/me',{},env);assert.equal(me.status,200);assert.equal((await me.json()as any).data.training_data,true);assert.equal((await harness.request('/api/me',{}, {...env,APP_ENV:'production'})).status,200);
 const dashboard=await harness.request('/api/dashboard',{},env);assert.equal(dashboard.status,200,await dashboard.clone().text());const summary=(await dashboard.json()as any).data;
 assert.equal(summary.actual_net_minor,36520000);assert.equal(summary.sales_rep_count,9);assert.equal(summary.target_net_minor,80200000);assert.equal(summary.active_customer_count,20);
 await assert.rejects(()=>prepareStagingTraining(resolve(dir,'prepared'),context),/exist/i);await assert.rejects(()=>prepareStagingTraining(resolve(dir,'invalid'),{...context,environment:'production' as any}));
});
