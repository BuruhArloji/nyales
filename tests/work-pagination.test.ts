import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';

function seeded(){
 const f=fixture();
 f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('peer','o','Peer');INSERT INTO area(id,organization_id,name) VALUES('b','o','Other area');INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('d','o','b','Outside area');");
 const a=f.sqlite.prepare('INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,notes) VALUES(?,?,?,?,?,?,?,?,?)');
 const p=f.sqlite.prepare('INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 const t=f.sqlite.prepare('INSERT INTO sales_task(id,organization_id,customer_id,user_id,channel,title,due_at,original_due_at,created_by,reason) VALUES(?,?,?,?,?,?,?,?,?,?)');
 const h=f.sqlite.prepare('INSERT INTO sales_handoff(id,organization_id,customer_id,sender_id,receiver_id,channel,due_at,need) VALUES(?,?,?,?,?,?,?,?)');
 const e=f.sqlite.prepare('INSERT INTO sales_exception(id,organization_id,customer_id,user_id,resource_id,kind,reason,created_at) VALUES(?,?,?,?,?,?,?,?)');
 for(let n=0;n<231;n++){
  const id=String(n).padStart(3,'0'),date='2026-11-01T01:00:00.000Z';
  a.run('a'+id,'o','c','sr','field',n%2?'call':'visit',n%3?'done':'draft',date,'Activity');
  if(n<31){
   const planAt=new Date(Date.parse(date)+n*7200000).toISOString(),taskAt=new Date(Date.parse(date)+n*7200000+3600000).toISOString();
   p.run('p'+id,'o','c','sr',planAt,planAt,'visit','planned','Plan','mg',date,'{}');
   t.run('t'+id,'o','c','sr','field','Task',taskAt,taskAt,'mg','Task');
   h.run('h'+id,'o','c','sr','tele','telesales',date,'Handoff');
   e.run('e'+id,'o','c','sr','resource'+id,'operational','Exception',date);
   f.sqlite.prepare('INSERT INTO work_session(id,organization_id,user_id,kind,started_at,ended_at,reason) VALUES(?,?,?,?,?,?,?)').run('s'+id,'o','sr','work',date,date,'Session');
  }
 }
 a.run('outside-owner','o','c','peer','field','visit','done','2026-11-02T01:00:00Z','Peer');
 a.run('outside-area','o','d','peer','field','visit','done','2026-11-02T01:00:00Z','Other area');
 return f;
}

test('work pages are disjoint, deterministic and reach beyond the legacy activity cap',async()=>{
 const f=seeded();try{
  const legacy=await f.data(await f.req('GET','/api/activities'));assert.equal(legacy.length,200);
  const ids:string[]=[];
  for(let offset=0;;offset+=25){
   const response=await f.req('GET','/api/activities?limit=25&offset='+offset);assert.equal(response.status,200);
   const body=await response.json() as any;assert.ok(body.data.length<=25);ids.push(...body.data.map((r:any)=>r.id));
   assert.equal(body.meta.pagination.offset,offset);if(!body.meta.pagination.has_more)break;
  }
  assert.equal(ids.length,231);assert.equal(new Set(ids).size,231);assert.ok(!ids.includes('outside-owner'));assert.ok(!ids.includes('outside-area'));
  assert.deepEqual(ids,[...ids].sort().reverse());
 }finally{f.sqlite.close()}
});

test('agenda tasks handoffs exceptions and own sessions support bounded pages with preserved legacy scope',async()=>{
 const f=seeded();try{
  for(const path of ['work-plans','tasks','handoffs','exceptions','work-sessions']){
   const legacy=await f.data(await f.req('GET','/api/'+path));
   const first=await(await f.req('GET','/api/'+path+'?limit=20')).json() as any;
   const next=await(await f.req('GET','/api/'+path+'?limit=20&offset=20')).json() as any;
   assert.equal(first.data.length,20,path);assert.equal(next.data.length,11,path);
   assert.equal(first.meta.pagination.has_more,true,path);assert.equal(next.meta.pagination.has_more,false,path);
   assert.deepEqual([...first.data,...next.data].map((r:any)=>r.id).sort(),legacy.map((r:any)=>r.id).sort(),path);
  }
  f.sqlite.exec("INSERT INTO user_area_scope VALUES('o','mg','a','2020-01-01',NULL)");
  const manager=await f.req('GET','/api/handoffs?limit=25',undefined,undefined,'mg','AREA_MANAGER');assert.equal(manager.status,200);
  assert.equal((await manager.json() as any).data.length,25);
  const oldManager=await f.req('GET','/api/handoffs',undefined,undefined,'mg','AREA_MANAGER');assert.equal(oldManager.status,200);
  assert.equal((await oldManager.json() as any).data.length,31);
  assert.equal((await f.data(await f.req('GET','/api/work-sessions?limit=25',undefined,undefined,'mg'))).length,0);
 }finally{f.sqlite.close()}
});

test('work filters run before paging and malformed or mismatched filters fail closed',async()=>{
 const f=seeded();try{
  const r=await f.req('GET','/api/activities?limit=100&activity_kind=visit&status=done&channel=field');assert.equal(r.status,200);
  const body=await r.json() as any;assert.equal(body.data.length,77);assert.ok(body.data.every((r:any)=>r.activity_kind==='visit'&&r.status==='done'&&r.channel==='field'));
  for(const path of ['/api/activities?offset=10','/api/activities?limit=101','/api/tasks?limit=25&status=bogus','/api/tasks?limit=25&activity_kind=visit','/api/work-sessions?limit=25&channel=field','/api/activities?limit=25&unexpected=x'])assert.equal((await f.req('GET',path)).status,422,path);
  const tele=await f.req('GET','/api/activities?limit=25&channel=field',undefined,undefined,'tele','TELESALES');assert.equal(tele.status,200);assert.deepEqual((await tele.json() as any).data,[]);
 }finally{f.sqlite.close()}
});
