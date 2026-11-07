import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {fixture} from './sales-fixture';
import {scopedRoutes} from '../src/server/index';
import {ownerSalesMode} from '../src/server/owner-sales-mode';

function setup(){
 const f=fixture();
 function request(path:string,{method='GET',body,version,owner=true,role='MANAGEMENT',sales='sr',environment='staging',key=crypto.randomUUID()}:{method?:string;body?:unknown;version?:number;owner?:boolean;role?:string;sales?:string;environment?:string;key?:string}={}){
  const h=new Hono<any>();h.use('*',async(c,next)=>{c.set('identity',{id:'mg',name:'Owner',organization_id:'o',role});c.set('portfolioOwner',owner);await next()});h.route('/',ownerSalesMode);h.route('/',scopedRoutes);
  return h.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,...(sales?{'X-NYALES-Sales':sales}:{}),...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})},{DB:f.adapter,APP_ENV:environment,IMPORT_FILES:f.bucket});
 }
 return {...f,request};
}

test('owner sales mode rejects forged headers, inactive, foreign, telesales and non-owner roles',async()=>{
 const f=setup();try{
  for(const options of [{owner:false},{role:'NSM'},{environment:'production'}]){
   assert.equal((await f.request('/api/owner-sales-mode',options)).status,403);
   assert.equal((await f.request('/api/customers',options)).status,403);
  }
  for(const sales of ['missing','other','tele','mg'])assert.equal((await f.request('/api/customers',{sales})).status,422);
  f.sqlite.exec("UPDATE app_user SET status='inactive' WHERE id='sr'");
  assert.equal((await f.request('/api/customers')).status,422);
  assert.equal((await f.request('/api/owner-sales-mode',{method:'POST',body:{sales_id:'sr'}})).status,422);
  assert.equal((await f.request('/api/owner-sales-mode',{method:'POST',body:{sales_id:null}})).status,200);
 }finally{f.sqlite.close()}
});

test('owner can run an assigned sales plan through real session, activity, check-in and checkout with owner audit',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-08T02:00:00Z')});const f=setup();try{
  const options=await f.data(await f.request('/api/owner-sales-mode'));assert.deepEqual(options,[{id:'sr',name:'Field'}]);
  await f.data(await f.request('/api/owner-sales-mode',{method:'POST',body:{sales_id:'sr'}}));
  const identity=await f.data(await f.request('/api/me'));assert.equal(identity.id,'sr');assert.equal(identity.role,'SALES_REP');assert.equal(identity.scope,'assigned');assert.equal(identity.performed_by.id,'mg');assert.equal(identity.portfolio_owner,true);
  assert.equal((await f.request('/api/users',{method:'POST',body:{name:'Cannot create'}})).status,403);
  const plan=await f.data(await f.req('POST','/api/work-plans',{customer_id:'c',user_id:'sr',kind:'visit',scheduled_at:'2026-11-08T03:00:00Z',reason:'Owner trial plan',repeat_weeks:1},undefined,'mg'));
  await f.data(await f.request('/api/work-sessions',{method:'POST',body:{kind:'work',reason:'Owner testing visit'}}));
  const activity=await f.data(await f.request('/api/activities',{method:'POST',body:{customer_id:'c',kind:'visit',notes:'Owner trial',plan_id:plan.id}}));assert.equal((f.sqlite.prepare('SELECT user_id FROM activity WHERE id=?').get(activity.id) as any).user_id,'sr');
  const checkin=await f.data(await f.request('/api/visits/'+activity.id+'/check-in',{method:'POST',body:f.event(),version:1}));assert.equal(checkin.status,'in_progress');
  await f.data(await f.request('/api/visits/'+activity.id+'/check-out',{method:'POST',body:f.event({outcome:'productive'}),version:2}));
  const audits=f.sqlite.prepare("SELECT actor_id,after_json FROM master_audit WHERE resource_id=?").all(activity.id) as any[];assert.ok(audits.length>=3);assert.ok(audits.every(a=>a.actor_id==='mg'&&JSON.parse(a.after_json).acting_sales_id==='sr'));
  assert.equal((f.sqlite.prepare('SELECT user_id FROM activity WHERE id=?').get(activity.id) as any).user_id,'sr');
  const back=await f.data(await f.request('/api/me',{sales:''}));assert.equal(back.id,'mg');assert.equal(back.performed_by,undefined);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM auth_role_assignment WHERE user_id=?').get('mg') as any).n,0);
 }finally{f.sqlite.close()}
});

test('delegated offline sync retains original owner actor and remains idempotent',async()=>{
 const f=setup();try{
  await f.data(await f.request('/api/work-sessions',{method:'POST',body:{kind:'work',reason:'Start'}}));
  const body={events:[{client_event_id:crypto.randomUUID(),type:'activity',payload:{customer_id:'c',kind:'visit',notes:'Queued in sales mode'}}]};
  const first=await f.request('/api/sync/events',{method:'POST',body});assert.equal(first.status,200,await first.clone().text());
  const second=await f.request('/api/sync/events',{method:'POST',body});assert.equal(second.status,200);
  const activities=f.sqlite.prepare('SELECT id,user_id FROM activity').all() as any[];assert.equal(activities.length,1);assert.equal(activities[0].user_id,'sr');
  const a=f.sqlite.prepare('SELECT actor_id,after_json FROM master_audit WHERE resource_id=?').get(activities[0].id) as any;assert.equal(a.actor_id,'mg');assert.equal(JSON.parse(a.after_json).acting_sales_id,'sr');
 }finally{f.sqlite.close()}
});
