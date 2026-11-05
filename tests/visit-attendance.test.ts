import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {defaultDailyPolicy} from '../src/shared/daily-visit';
import {summarizeVisitDays} from '../src/shared/visit-attendance';
import {repVisitAvailableGuard} from '../src/server/visit-attendance';
const now=new Date('2026-11-05T05:00:00Z');
const off=(service_date='2026-11-05',reason_code='annual_leave')=>({user_id:'sr',service_date,reason_code,reason:'Catatan izin'});
const recap='/api/visit-attendance?period=2026-11&start_date=2026-11-01&end_date=2026-11-05';
function configure(f:ReturnType<typeof fixture>){f.sqlite.prepare('INSERT INTO daily_visit_policy VALUES(?,1,?,?,?)').run('o',JSON.stringify({...defaultDailyPolicy,calendar_id:'cal'}),'mg',now.toISOString());f.sqlite.exec("UPDATE work_calendar SET weekdays_json='[1,2,3,4,5]' WHERE id='cal'")}

test('visit compliance caps each day, excuses approved leave only, never infers alpha, and keeps unknown target unknown',()=>{
 const days=[{date:'1',working:true,visits:30},{date:'2',working:true,visits:0},{date:'3',working:true,visits:0,off:{status:'approved',reason_code:'sick'}},{date:'4',working:true,visits:0,off:{status:'approved',reason_code:'alpha'}}];
 const result=summarizeVisitDays(days,15);assert.equal(result.target_visit,45);assert.equal(result.visit_count,30);assert.equal(result.compliant_visit_count,15);assert.equal(result.visit_compliance_percent,100/3);assert.equal(result.off_alpha_days,1);
 assert.equal(summarizeVisitDays(days,null).target_visit,null);assert.equal(summarizeVisitDays(days,null).visit_compliance_percent,null);
 assert.equal(summarizeVisitDays([days[2]],15).visit_compliance_percent,null);
});
test('off visits are scoped, pending for self, reviewed by manager, unique per date, versioned and auditable',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{
  const p=await f.data(await f.req('POST','/api/visit-off-days',off()));assert.equal(p.status,'pending');
  assert.equal((await f.req('POST','/api/visit-off-days',off())).status,409);
  assert.equal((await f.req('POST',`/api/visit-off-days/${p.id}/review`,{status:'approved',reason:'Confirmed'},1)).status,403);
  assert.equal((await f.req('POST',`/api/visit-off-days/${p.id}/review`,{status:'approved',reason:'Confirmed'},2,'mg')).status,412);
  const ok=await f.data(await f.req('POST',`/api/visit-off-days/${p.id}/review`,{status:'approved',reason:'Confirmed'},1,'mg'));assert.equal(ok.version,2);
  await f.session();assert.equal((await f.req('POST','/api/activities',{customer_id:'c',kind:'visit',notes:''})).status,409);
  const cancelled=await f.data(await f.req('POST',`/api/visit-off-days/${p.id}/review`,{status:'cancelled',reason:'Changed'},2,'mg'));assert.equal(cancelled.status,'cancelled');
  assert.equal((await f.req('POST','/api/activities',{customer_id:'c',kind:'visit',notes:''})).status,201);
  assert.ok((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type IN('visit-off-day','visit-off-review')").get()as any).n>=3);
 }finally{f.sqlite.close()}
});
test('recap groups customers per local date, preserves alpha target, applies role/calendar and date filters, excludes telesales',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{configure(f);await f.data(await f.req('POST','/api/visit-off-days',off('2026-11-02'),undefined,'mg'));await f.data(await f.req('POST','/api/visit-off-days',off('2026-11-03','alpha'),undefined,'mg'));
  f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('c2','o','a','Second');INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at) VALUES('v1','o','c','sr','field','visit','done','2026-11-03T18:00:00.000Z'),('v2','o','c','sr','field','visit','done','2026-11-04T02:00:00.000Z'),('v3','o','c2','sr','field','visit','done','2026-11-04T03:00:00.000Z'),('v4','o','c','sr','field','visit','done','2026-11-05T02:00:00.000Z'),('v5','o','c2','sr','field','visit','needs_review','2026-11-05T02:00:00.000Z'),('call','o','c','tele','telesales','call','done','2026-11-05T02:00:00.000Z')");
  const rows=await f.data(await f.req('GET',recap,undefined,undefined,'mg'));assert.equal(rows.length,1);assert.equal(rows[0].off_permitted_days,1);assert.equal(rows[0].off_alpha_days,1);assert.equal(rows[0].target_visit,45);assert.equal(rows[0].visit_count,3);assert.equal(rows[0].visit_compliance_percent,100*3/45);
  const day=await f.data(await f.req('GET',recap.replace('start_date=2026-11-01','start_date=2026-11-05')));assert.equal(day[0].visit_count,1);assert.equal(day[0].target_visit,15);
  assert.equal((await f.data(await f.req('GET',recap+'&channel=telesales',undefined,undefined,'mg'))).length,0);
  assert.equal((await f.data(await f.req('GET',recap,undefined,undefined,'tele'))).length,0);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM invoice').get()as any).n,0);
 }finally{f.sqlite.close()}
});
test('off review cannot contradict completed visits, and alpha is manager-only and never future',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{
  assert.equal((await f.req('POST','/api/visit-off-days',off('2026-11-05','alpha'))).status,403);
  assert.equal((await f.req('POST','/api/visit-off-days',off('2026-11-06','alpha'),undefined,'mg')).status,422);
  f.sqlite.exec("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at) VALUES('done','o','c','sr','field','visit','done','2026-11-05T01:00:00.000Z')");
  assert.equal((await f.req('POST','/api/visit-off-days',off(),undefined,'mg')).status,409);
  const pending=await f.data(await f.req('POST','/api/visit-off-days',off()));assert.equal((await f.req('POST',`/api/visit-off-days/${pending.id}/review`,{status:'approved',reason:'Check'},1,'mg')).status,409);
 }finally{f.sqlite.close()}
});
test('area managers cannot read or approve off days for sales outside their area; foreign and malformed input fails closed',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{f.sqlite.exec("INSERT INTO area(id,organization_id,name,branch_id) VALUES('b','o','Other','br');INSERT INTO app_user(id,organization_id,name) VALUES('am','o','Area Manager'),('sr2','o','Other rep');INSERT INTO user_area_scope VALUES('o','am','a','2020-01-01',NULL),('o','sr2','b','2020-01-01',NULL);INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('sr2','o','sr2','SALES_REP','field','2020-01-01')");
  const row=await f.data(await f.req('POST','/api/visit-off-days',{...off(),user_id:'sr2'},undefined,'mg'));
  const list=await f.data(await f.req('GET','/api/visit-off-days',undefined,undefined,'am','AREA_MANAGER'));assert.equal(list.length,0);
  assert.equal((await f.req('POST',`/api/visit-off-days/${row.id}/review`,{status:'cancelled',reason:'No'},1,'am','AREA_MANAGER')).status,404);
  assert.equal((await f.req('POST','/api/visit-off-days',{...off(),user_id:'other'},undefined,'mg')).status,404);
  assert.equal((await f.req('GET',recap+'&limit=1000')).status,422);
  assert.equal((await f.req('GET',recap.replace('2026-11-01','2026-01-01'))).status,422);
  assert.equal((await f.req('GET',recap.replace('end_date=2026-11-05','end_date=2026-11-06'))).status,422);
 }finally{f.sqlite.close()}
});
test('off status invalidates generator snapshots, blocks manual agenda and atomic activity guard, without deleting prior agenda',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{const before=(f.sqlite.prepare("SELECT source_epoch FROM visit_planning_revision WHERE organization_id='o'").get()as any).source_epoch;
  await f.data(await f.req('POST','/api/visit-off-days',off(),undefined,'mg'));
  assert.ok((f.sqlite.prepare("SELECT source_epoch FROM visit_planning_revision WHERE organization_id='o'").get()as any).source_epoch>before);
  assert.equal((await f.req('POST','/api/work-plans',{customer_id:'c',user_id:'sr',kind:'visit',scheduled_at:'2026-11-05T06:00:00Z',reason:'Manual'},undefined,'mg')).status,409);
  await assert.rejects(f.adapter.batch(repVisitAvailableGuard(f.adapter,'o','sr','2026-11-05')));
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,0);
 }finally{f.sqlite.close()}
});


test('an old visit draft cannot check in after customer assignment is removed',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=fixture();
 try{await f.session();const activity=await f.activity();f.sqlite.exec("UPDATE customer_assignment SET effective_to_date='2026-11-05' WHERE channel='field'");
  const r=await f.req('POST',`/api/visits/${activity.id}/check-in`,f.event(),1);assert.equal(r.status,422);assert.equal((await r.json()as any).code,'CUSTOMER_ASSIGNMENT_REQUIRED');
 }finally{f.sqlite.close()}
});
