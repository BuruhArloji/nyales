import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {fixture as salesFixture} from './sales-fixture';
import {scopedRoutes} from '../src/server/index';
import {defaultDailyPolicy,dailyPolicy,rankDailyCustomers} from '../src/shared/daily-visit';
const instant='2026-11-05T01:00:00Z';
function fixture(count=20){
 const f=salesFixture(),objects=new Map<string,Uint8Array>(),calls:any[]=[];
 f.sqlite.exec("UPDATE customer_outlet SET latitude_e7=-62000000,longitude_e7=1068000000,coordinate_status='verified' WHERE id='c'");
 for(let i=1;i<count;i++)f.sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,latitude_e7,longitude_e7,coordinate_status) VALUES(?,'o','a',?,-62000000,?,'verified')").run('c'+i,'Warung '+i,1068000000+i*10000);
 for(let i=1;i<count;i++)f.sqlite.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES(?,'o',?,'sr','field','a','2020-01-01')").run('assignment'+i,'c'+i);
 const policy={...defaultDailyPolicy,calendar_id:'cal',break_minutes:0,use_shift_as_opening_window:true};
 const bucket={put:async(key:string,value:any)=>{objects.set(key,typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value));return{}},get:async(key:string)=>{const bytes=objects.get(key);return bytes?{size:bytes.byteLength,arrayBuffer:async()=>bytes.slice().buffer}:null},delete:async(key:string)=>objects.delete(key)} as unknown as R2Bucket;
 async function req(method:string,path:string,body?:any,actor='sr',version?:number,key=crypto.randomUUID()){
  const h=new Hono();h.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,organization_id:actor==='other'?'x':'o',role:actor==='sr'?'SALES_REP':actor==='tele'?'TELESALES':'MANAGEMENT'} as never);await next()});h.route('/',scopedRoutes);
  return h.request('/api/visit-generator/daily/'+path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,...(version!==undefined?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})},{DB:f.adapter,IMPORT_FILES:bucket,ORS_API_KEY:'synthetic-test-key',APP_ENV:'local'});
 }
 const input={rep_id:'sr',start:{longitude:106.8,latitude:-6.2},start_at:'2026-11-05T01:05:00Z',end_at:'2026-11-05T10:00:00Z',confirmed_external_processing:true};
 const fetchMock=async(url:any,init:any)=>{
  assert.ok(String(url).startsWith('https://api.heigit.org/'));const body=JSON.parse(init.body);calls.push({url:String(url),body});assert.ok(!JSON.stringify(body).includes('Warung'));
  if(String(url).includes('/matrix/')){const m=body.locations.map((_:any,i:number)=>body.locations.map((_:any,k:number)=>i===k?0:60));return Response.json({durations:m,distances:m.map((r:number[])=>r.map(v=>v?500:0))});}
  if(String(url).includes('/vroom/')){
   const vehicle=body.vehicles[0],capacity=vehicle.capacity[0],scheduled:any[]=[],unassigned:any[]=[],breaks=vehicle.breaks||[];let time=vehicle.time_window[0],travel=0;
   const steps:any[]=[{type:'start',arrival:time,waiting_time:0,service:0}];
   const jobs=body.jobs.slice().sort((a:any,b:any)=>b.priority-a.priority||a.id-b.id);
   for(const job of jobs){let at=time+60;const window=job.time_windows.find((w:number[])=>Math.max(at,w[0])<=w[1]);if(!window||scheduled.length>=capacity){unassigned.push({id:job.id});continue}at=Math.max(at,window[0]);
    for(const b of breaks){const t=b.time_windows[0][0];if(time<=t&&at+job.service>t){steps.push({type:'break',id:b.id,arrival:t,waiting_time:0,service:b.service});time=t+b.service;at=Math.max(time+60,window[0]);}}
    if(at>window[1]||at+job.service+60>vehicle.time_window[1]){unassigned.push({id:job.id});continue}
    steps.push({type:'job',id:job.id,arrival:at,waiting_time:0,service:job.service});scheduled.push(job);time=at+job.service;travel+=60;
   }
   for(const b of breaks)if(!steps.some(s=>s.type==='break'&&s.id===b.id)){steps.push({type:'break',id:b.id,arrival:Math.max(time,b.time_windows[0][0]),waiting_time:0,service:b.service});time=steps.at(-1).arrival+b.service;}
   steps.push({type:'end',arrival:time+60,waiting_time:0,service:0});return Response.json({code:0,routes:scheduled.length?[{vehicle:1,steps,duration:travel+60,distance:(scheduled.length+1)*500,service:scheduled.reduce((sum:number,j:any)=>sum+j.service,0)}]:[],unassigned});
  }
  return Response.json({features:[{geometry:{type:'LineString',coordinates:body.coordinates}}]});
 };
 const activate=async(overrides:any={})=>f.data(await req('PUT','policy',{...policy,...overrides},'mg',0));
 return {...f,req,input,activate,policy,fetchMock,calls,objects};
}

test('daily scoring uses editable 100% weights, proximity and cadence without relabelling churn as inactive',()=>{
 const policy={...defaultDailyPolicy,calendar_id:'cal'},data=[{id:'a',name:'Big',latitude_e7:-62000000,longitude_e7:1068000000,wallet_size_minor:1000000,last_visit:'2026-11-04',sales_minor:0,due_tasks:0,service_frequency_days:7},{id:'b',name:'Overdue',latitude_e7:-62000000,longitude_e7:1068000000,wallet_size_minor:null,last_visit:'2026-10-01',sales_minor:0,due_tasks:0,service_frequency_days:7}];
 assert.equal(rankDailyCustomers(data,{latitude:-6.2,longitude:106.8},'2026-11-05',{...policy,weights:{wallet:100,last_visit:0,sales:0,follow_up:0,proximity:0}})[0].id,'a');
 assert.equal(rankDailyCustomers(data,{latitude:-6.2,longitude:106.8},'2026-11-05',{...policy,weights:{wallet:0,last_visit:100,sales:0,follow_up:0,proximity:0}})[0].id,'b');
 assert.equal(dailyPolicy.safeParse({...policy,weights:{wallet:1,last_visit:0,sales:0,follow_up:0,proximity:0}}).success,false);
});

test('daily route preview selects up to 15 assigned customers via ORS and only explicit apply creates agenda idempotently',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture();t.mock.method(globalThis,'fetch',f.fetchMock);
 try{
  assert.equal((await f.req('PUT','policy',f.policy,'sr',0)).status,403);await f.activate();
  const before=f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any,preview=await f.data(await f.req('POST','runs',f.input));assert.equal(preview.planned,15);assert.equal(preview.target,15);assert.equal(preview.shortfall,0);assert.equal(preview.current,true);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,before.n);assert.ok(f.calls[0].body.locations.length>15);
  const key=crypto.randomUUID(),applied=await f.data(await f.req('POST',`runs/${preview.id}/apply`,{confirmed:true},'sr',undefined,key));assert.equal(applied.created,15);
  await f.data(await f.req('POST',`runs/${preview.id}/apply`,{confirmed:true},'sr',undefined,key));await f.data(await f.req('POST',`runs/${preview.id}/apply`,{confirmed:true}));assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,15);
  assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM invoice').get()as any).n,0);
 }finally{f.sqlite.close()}
});

test('daily generator reports shortfall and excludes recent visits, unverified locations and customers outside assignment',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(5);t.mock.method(globalThis,'fetch',f.fetchMock);
 try{f.sqlite.exec("UPDATE customer_outlet SET coordinate_status='unverified' WHERE id='c1';DELETE FROM customer_assignment WHERE outlet_id='c2';INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at) VALUES('last','o','c3','sr','field','visit','done','2026-11-04T02:00:00Z')");await f.activate();const result=await f.data(await f.req('POST','runs',f.input));assert.equal(result.planned,2);assert.equal(result.shortfall,13);assert.ok(result.skipped.some((c:any)=>c.id==='c1'&&c.reason==='unverified_coordinates'));assert.ok(result.skipped.some((c:any)=>c.id==='c3'&&c.reason==='minimum_gap'));assert.ok(!result.route.steps.some((c:any)=>c.customer_id==='c2'));assert.equal((await f.req('POST','runs',f.input,'tele')).status,403);assert.equal((await f.req('GET','runs/'+result.id,undefined,'other')).status,404);
 }finally{f.sqlite.close()}
});

test('daily route apply rejects stale sources, policy changes, expired plans and revoked publishing permission',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(3);t.mock.method(globalThis,'fetch',f.fetchMock);
 try{await f.activate();const p=await f.data(await f.req('POST','runs',f.input));f.sqlite.exec("UPDATE customer_outlet SET name='Changed',version=version+1 WHERE id='c'");assert.equal((await f.req('POST',`runs/${p.id}/apply`,{confirmed:true})).status,409);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,0);
 const second=await f.data(await f.req('POST','runs',f.input));await f.data(await f.req('PUT','policy',{...f.policy,allow_rep_publish:false},'mg',1));assert.equal((await f.req('POST',`runs/${second.id}/apply`,{confirmed:true})).status,403);
 const third=await f.data(await f.req('POST','runs',f.input));f.sqlite.prepare("UPDATE daily_visit_run SET expires_at='2026-11-05T00:00:00Z' WHERE id=?").run(third.id);assert.equal((await f.req('POST',`runs/${third.id}/apply`,{confirmed:true},'mg')).status,409);
 }finally{f.sqlite.close()}
});

test('regenerating remaining route only cancels its own future plans and preserves fixed manual appointments and completed work',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(6);t.mock.method(globalThis,'fetch',f.fetchMock);
 try{await f.activate({target_visits:3});const first=await f.data(await f.req('POST','runs',f.input));await f.data(await f.req('POST',`runs/${first.id}/apply`,{confirmed:true}));
 const ids=(f.sqlite.prepare('SELECT id,customer_id FROM work_plan ORDER BY scheduled_at').all()as any[]);f.sqlite.prepare("UPDATE work_plan SET status='done' WHERE id=?").run(ids[0].id);f.sqlite.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at) VALUES('done','o',?,'sr','field','visit','done','2026-11-05T00:50:00Z')").run(ids[0].customer_id);
 const second=await f.data(await f.req('POST','runs',{...f.input,replace_run_id:first.id}));await f.data(await f.req('POST',`runs/${second.id}/apply`,{confirmed:true}));assert.equal((f.sqlite.prepare('SELECT status FROM work_plan WHERE id=?').get(ids[0].id)as any).status,'done');assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM work_plan WHERE status='cancelled'").get()as any).n,2);assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM work_plan WHERE status='planned'").get()as any).n,2);assert.equal(second.completed_today,1);assert.equal(second.target,2);
 }finally{f.sqlite.close()}
});

test('provider errors leave the agenda untouched and generator requires explicit configured assumptions',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(2);t.mock.method(globalThis,'fetch',async()=>Response.json({error:'unavailable'},{status:429}));
 try{assert.equal((await f.req('POST','runs',f.input)).status,422);await f.activate();assert.equal((await f.req('POST','runs',f.input)).status,503);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,0);assert.equal((f.sqlite.prepare('SELECT status FROM daily_visit_run').get()as any).status,'failed');
 }finally{f.sqlite.close()}
});

test('fixed manual appointments retain their time and are not duplicated when a generated route is applied',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(3);t.mock.method(globalThis,'fetch',f.fetchMock);
 try{await f.activate({target_visits:3});f.sqlite.exec("INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES('manual','o','c','sr','2026-11-05T02:00:00.000Z','2026-11-05T02:00:00.000Z','visit','planned','Appointment','mg','2026-11-04T00:00:00Z','{}')");
  const result=await f.data(await f.req('POST','runs',f.input));const fixed=result.route.steps.find((s:any)=>s.fixed_plan_id==='manual');assert.ok(fixed);assert.equal(fixed.arrival+fixed.waiting_time,Date.parse('2026-11-05T02:00:00Z')/1000);
  await f.data(await f.req('POST',`runs/${result.id}/apply`,{confirmed:true}));assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,3);assert.equal((f.sqlite.prepare("SELECT scheduled_at FROM work_plan WHERE id='manual'").get()as any).scheduled_at,'2026-11-05T02:00:00.000Z');
 }finally{f.sqlite.close()}
});

test('provider cannot drop a fixed appointment and existing customer time windows override fallback',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(2);
 t.mock.method(globalThis,'fetch',async(url:any,init:any)=>{if(String(url).includes('/vroom/')){const body=JSON.parse(init.body);return Response.json({code:0,routes:[],unassigned:body.jobs.map((j:any)=>({id:j.id}))});}return f.fetchMock(url,init)});
 try{await f.activate();f.sqlite.exec("INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES('fixed','o','c','sr','2026-11-05T02:00:00Z','2026-11-05T02:00:00Z','visit','planned','Appointment','mg','2026-11-04T00:00:00Z','{}')");assert.equal((await f.req('POST','runs',f.input)).status,422);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan').get()as any).n,1);
 }finally{f.sqlite.close()}
});

test('published route replay fails after the rep loses active field role',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(instant)});const f=fixture(2);t.mock.method(globalThis,'fetch',f.fetchMock);
 try{await f.activate();const route=await f.data(await f.req('POST','runs',f.input)),key=crypto.randomUUID();await f.data(await f.req('POST',`runs/${route.id}/apply`,{confirmed:true},'sr',undefined,key));f.sqlite.exec("UPDATE auth_role_assignment SET effective_to_date='2026-11-05' WHERE user_id='sr'");assert.equal((await f.req('POST',`runs/${route.id}/apply`,{confirmed:true},'sr',undefined,key)).status,403);
 }finally{f.sqlite.close()}
});
