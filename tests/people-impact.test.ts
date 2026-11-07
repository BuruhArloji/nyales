import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {noOpenPeopleWorkGuard,requireNoOpenPeopleWork} from '../src/server/people-impact';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
function setup(){
 const f=fixture();
 f.sqlite.exec("INSERT INTO app_user(id,organization_id,name,status) VALUES('idle','o','Idle','active');INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('idle-role','o','idle','SUPERVISOR','field','2020-01-01');");
 return f;
}
const dependencies:Record<string,string>={
 visit:"INSERT INTO visit_active VALUES('o','idle','visit','2020-01-01T08:00:00Z')",
 session:"INSERT INTO work_session(id,organization_id,user_id,kind,started_at,reason) VALUES('s','o','idle','work','2020-01-01T08:00:00Z','Work')",
 activity:"INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,notes) VALUES('v','o','c','idle','field','visit','needs_review','2020-01-01T08:00:00Z','Review')",
 agenda:"INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES('p','o','c','idle','2020-01-01T08:00:00Z','2020-01-01T08:00:00Z','visit','planned','Plan','mg','2020-01-01T08:00:00Z','{}')",
 task:"INSERT INTO sales_task(id,organization_id,customer_id,user_id,channel,title,due_at,original_due_at,created_by,reason) VALUES('t','o','c','idle','field','Follow up','2020-01-01T08:00:00Z','2020-01-01T08:00:00Z','mg','Work')",
 handoff:"INSERT INTO sales_handoff(id,organization_id,customer_id,sender_id,receiver_id,channel,due_at,need) VALUES('h','o','c','sr','idle','field','2020-01-01T08:00:00Z','Follow up')",
 pipeline:"INSERT INTO sales_lead(id,organization_id,customer_id,user_id,source,need,stage,next_action,next_due_at,created_at,stage_changed_at) VALUES('l','o','c','idle','visit','Stock','qualified','Follow up','2020-01-01T08:00:00Z','2020-01-01T08:00:00Z','2020-01-01T08:00:00Z')",
 order:"INSERT INTO sales_order(id,organization_id,customer_id,user_id,channel,client_order_id,lines_json,net_minor,reason,created_at) VALUES('q','o','c','idle','field','order-1','[]',1000,'Stock','2020-01-01T08:00:00Z')",
 lease:"INSERT INTO telesales_lease(id,organization_id,customer_id,contact_id,user_id,campaign_id,script_id,expires_at,status) VALUES('lease','o','c','ct','idle','campaign','script','2999-01-01T00:00:00Z','active')",
 coaching:"INSERT INTO coaching_review(id,organization_id,user_id,area_id,summary,next_action,due_at,created_by,created_at) VALUES('coach','o','idle','a','Review','Follow up','2020-01-01T08:00:00Z','mg','2020-01-01T08:00:00Z')",
 off:"INSERT INTO visit_off_day(id,organization_id,user_id,service_date,reason_code,reason,status,created_by,created_at) VALUES('off','o','idle','2999-01-01','sick','Sick','pending','mg','2020-01-01T08:00:00Z')",
};
for(const [kind,sql] of Object.entries(dependencies))test(`user disable and role changes preserve unresolved ${kind}`,async()=>{
 const f=setup();try{
  f.sqlite.exec(sql);
  for(const [method,path,body] of [
   ['POST','/api/users/idle/deactivate',{reason:'Disable'}],
   ['PUT','/api/users/idle',{name:'Changed',auth_subject:null,status:'inactive'}],
   ['POST','/api/users/idle/roles',{role_code:'AREA_MANAGER',channel:'field',area_ids:['a'],effective_from_date:today()}],
  ] as const){
   const r=await f.req(method,path,body,1,'mg');assert.equal(r.status,409,await r.clone().text());
   assert.equal((await r.json() as any).code,'RESOLVE_OPEN_WORK_BEFORE_USER_CHANGE');
  }
  assert.deepEqual({...f.sqlite.prepare("SELECT name,status,version FROM app_user WHERE id='idle'").get()},{name:'Idle',status:'active',version:1});
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM master_audit').get()!.n,0);
 }finally{f.sqlite.close()}
});

test('mutation guard rejects dependencies created after preflight and rolls back',async()=>{
 const f=setup();try{
  await requireNoOpenPeopleWork(f.adapter,'o','idle',today());f.sqlite.exec(dependencies.task);
  await assert.rejects(f.adapter.batch([...noOpenPeopleWorkGuard(f.adapter,'o','idle',today()),f.adapter.prepare("UPDATE app_user SET status='inactive' WHERE id='idle'")]));
  assert.equal(f.sqlite.prepare("SELECT status FROM app_user WHERE id='idle'").get()!.status,'active');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM master_mutation_guard').get()!.n,0);
 }finally{f.sqlite.close()}
});

test('deactivation retains completed work, closes reporting history and revokes sessions atomically',async()=>{
 const f=setup();try{
  f.sqlite.exec(dependencies.task+";UPDATE sales_task SET status='done';INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('mg-role','o','mg','AREA_MANAGER','field','2020-01-01');INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,effective_from_date,channel) VALUES('edge','o','idle','mg','a','2020-01-01','field');INSERT INTO device_session(id,organization_id,user_id,auth_subject,device_id,device_label,token_hash,auth_time,created_at,last_seen_at,expires_at) VALUES('session','o','idle','uid','device','Browser','hash',1,'2020-01-01','2020-01-01','2999-01-01');");
  f.sqlite.exec("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('inv','o','INV','1','c','idle','a','field','2026-01-01',123400,'validated','validated');");
  const invoiceBefore=f.sqlite.prepare("SELECT * FROM invoice WHERE id='inv'").get();
  const key=crypto.randomUUID();const r=await f.req('POST','/api/users/idle/deactivate',{reason:'Disable'},1,'mg','MANAGEMENT','o',key);assert.equal(r.status,200,await r.clone().text());
  const repeat=await f.req('POST','/api/users/idle/deactivate',{reason:'Disable'},1,'mg','MANAGEMENT','o',key);assert.equal(repeat.status,200);
  assert.equal(f.sqlite.prepare("SELECT effective_to_date FROM reporting_assignment WHERE id='edge'").get()!.effective_to_date,today());
  assert.equal(f.sqlite.prepare("SELECT revoked_by FROM device_session WHERE id='session'").get()!.revoked_by,'mg');
  assert.deepEqual({...f.sqlite.prepare("SELECT user_id,status FROM sales_task WHERE id='t'").get()},{user_id:'idle',status:'done'});
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM invoice WHERE id='inv'").get(),invoiceBefore);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM master_audit').get()!.n,1);
  const active=await f.data(await f.req('GET','/api/users?status=active',undefined,undefined,'mg'));assert.ok(active.every((u:any)=>u.status==='active'));
  const all=await f.data(await f.req('GET','/api/users',undefined,undefined,'mg'));assert.ok(all.some((u:any)=>u.id==='idle'&&u.status==='inactive'));assert.ok(all.every((u:any)=>u.id!=='other'));
  assert.equal((await f.req('GET','/api/users/idle',undefined,undefined,'mg')).status,200);
  assert.equal((await f.req('GET','/api/users?status=invalid',undefined,undefined,'mg')).status,422);
 }finally{f.sqlite.close()}
});

test('authentication identity replacement revokes old device tokens without disabling profile',async()=>{
 const f=setup();try{
  f.sqlite.exec("INSERT INTO device_session(id,organization_id,user_id,auth_subject,device_id,device_label,token_hash,auth_time,created_at,last_seen_at,expires_at) VALUES('session','o','idle','uid-old','device','Browser','hash',1,'2020-01-01','2020-01-01','2999-01-01');");
  const r=await f.req('PUT','/api/users/idle',{name:'Idle renamed',auth_subject:'uid-new',status:'active'},1,'mg');assert.equal(r.status,200,await r.clone().text());
  assert.deepEqual({...f.sqlite.prepare("SELECT status,auth_subject FROM app_user WHERE id='idle'").get()},{status:'active',auth_subject:'uid-new'});
  assert.equal(f.sqlite.prepare("SELECT revoked_by FROM device_session WHERE id='session'").get()!.revoked_by,'mg');
 }finally{f.sqlite.close()}
});

test('scheduled incoming reporting prevents disabling; same-day current reporting closes without deleting history',async()=>{
 for(const future of [true,false]){
  const f=setup();try{
   const date=today(),tomorrow=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   f.sqlite.exec("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('mg-role','o','mg','AREA_MANAGER','field','2020-01-01');");
   f.sqlite.prepare("INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,effective_from_date,channel) VALUES('edge','o','idle','mg','a',?,'field')").run(future?tomorrow:date);
   const r=await f.req('POST','/api/users/idle/deactivate',{reason:'Disable'},1,'mg');assert.equal(r.status,future?409:200,await r.clone().text());
   assert.equal(f.sqlite.prepare("SELECT effective_to_date FROM reporting_assignment WHERE id='edge'").get()!.effective_to_date,future?null:tomorrow);
  }finally{f.sqlite.close()}
 }
});
