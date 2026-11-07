import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {workLocalInstant} from '../src/shared/work-local-time';
const now=new Date('2026-11-07T04:00:00Z');
function seed(){
 const f=fixture(),db=f.sqlite;
 const plan=db.prepare("INSERT INTO work_plan(id,organization_id,customer_id,user_id,scheduled_at,original_scheduled_at,kind,status,reason,created_by,created_at,calendar_snapshot_json) VALUES(?,'o','c','sr',?,?,'visit',?,'Routine','mg','2026-11-01T00:00:00Z','{}')");
 for(let i=1;i<=6;i++)plan.run('p'+i,'2026-11-07T0'+i+':00:00Z','2026-11-07T0'+i+':00:00Z',i===5?'cancelled':i===6?'done':'planned');
 const activity=db.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,notes,metadata_json) VALUES(?,'o','c','sr','field','visit',?,'2026-11-07T01:00:00Z','Notes',?)");
 activity.run('a1','done',JSON.stringify({plan_id:'p1',outcome:'productive'}));activity.run('a2','in_progress',JSON.stringify({plan_id:'p2'}));activity.run('a3','draft',JSON.stringify({plan_id:'p3'}));activity.run('unplanned','done',JSON.stringify({outcome:'closed'}));
 db.exec("INSERT INTO visit_event VALUES('in','o','a1','sr','check-in','2026-11-07T01:02:00Z','2026-11-07T01:02:00Z',NULL,NULL,NULL,'unavailable','needs_review','{}'),('out','o','a1','sr','check-out','2026-11-07T01:19:00Z','2026-11-07T01:19:00Z',NULL,NULL,NULL,'unavailable','needs_review','{}');");
 return f;
}
test('field day reconciles plans versus actuals independently of paging and opening either view never writes facts',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=seed();try{
 const before=f.sqlite.prepare('SELECT * FROM activity ORDER BY id').all();
 const get=async(path:string)=>{const r=await f.req('GET',path);assert.equal(r.status,200,await r.clone().text());return r.json()as any};
 const p=await get('/api/work-plans?limit=2&date=2026-11-07&channel=field');assert.equal(p.data.length,2);assert.equal(p.meta.pagination.has_more,true);assert.equal(p.meta.summary.total,6);assert.equal(p.meta.summary.completed,1);assert.equal(p.meta.summary.running,1);assert.equal(p.meta.summary.remaining,2);assert.equal(p.meta.summary.cancelled,1);assert.equal(p.data[0].activity_id,'a1');
 const a=await get('/api/activities?limit=50&date=2026-11-07&activity_kind=visit');assert.equal(a.meta.summary.completed,2);assert.equal(a.meta.summary.running,1);assert.equal(a.meta.summary.productive,1);assert.ok(Math.abs(a.meta.summary.average_minutes-17)<.0001);assert.equal(a.data[0].id,'a2');assert.equal(a.data.find((x:any)=>x.id==='a1').linked_plan_id,'p1');assert.equal(a.data.find((x:any)=>x.id==='unplanned').linked_plan_id,null);
 const focused=await get('/api/work-plans?limit=50&date=2026-11-07&id=p1');assert.equal(focused.data.length,1);assert.equal(focused.meta.summary.total,6);
 assert.deepEqual(f.sqlite.prepare('SELECT * FROM activity ORDER BY id').all(),before);
 f.sqlite.exec("INSERT INTO visit_event VALUES('unplanned-in','o','unplanned','sr','check-in','2026-11-07T02:00:00Z','2026-11-07T02:00:00Z',NULL,NULL,NULL,'unavailable','needs_review','{}'),('unplanned-out','o','unplanned','sr','check-out','2026-11-07T02:06:00Z','2026-11-07T02:06:00Z',NULL,NULL,NULL,'unavailable','needs_review','{}');");
 const measured=await get('/api/activities?limit=50&date=2026-11-07');assert.equal(measured.meta.summary.average_minutes,11.5);
 }finally{f.sqlite.close()}
});
test('visit detail exposes ready evidence metadata only and carries an unfinished visit into today',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=seed();try{
 f.sqlite.exec("INSERT INTO evidence_attachment(id,organization_id,activity_id,user_id,storage_key,size,mime,sha256,status,expires_at,created_at) VALUES('proof','o','a1','sr','private-key',20,'image/png','hash','ready','2026-11-08','2026-11-07'),('pending','o','a1','sr','never-published',20,'image/png','hash','pending','2026-11-08','2026-11-07');UPDATE activity SET occurred_at='2026-11-06T01:00:00Z' WHERE id='a2';");
 const r=await f.req('GET','/api/activities?limit=50&date=2026-11-07');assert.equal(r.status,200);const b=await r.json()as any;assert.equal(b.data[0].id,'a2');const detail=b.data.find((x:any)=>x.id==='a1'),proof=JSON.parse(detail.evidence_json);assert.equal(proof.length,1);assert.equal(proof[0].id,'proof');assert.ok(!JSON.stringify(b).includes('private-key'));assert.ok(!JSON.stringify(b).includes('never-published'));assert.equal(JSON.parse(detail.check_in_location_json).lat,null);
 }finally{f.sqlite.close()}
});
test('editing a visit schedule interprets the displayed timezone independently of the device',()=>{
 assert.equal(workLocalInstant('2026-11-07T08:00','Asia/Jakarta'),'2026-11-07T01:00:00.000Z');
 assert.equal(workLocalInstant('2026-11-07T08:00','Asia/Makassar'),'2026-11-07T00:00:00.000Z');
 assert.equal(workLocalInstant('2026-11-07T08:00','Asia/Jayapura'),'2026-11-06T23:00:00.000Z');
 assert.throws(()=>workLocalInstant('2026-02-30T08:00','Asia/Jakarta'));
});
test('field day enforces owner/channel scope, local midnight and guarded plan linkage',async t=>{
 t.mock.timers.enable({apis:['Date'],now});const f=seed();try{
 f.sqlite.exec("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES('midnight','o','c','sr','field','visit','done','2026-11-06T17:01:00Z','{}'),('previous','o','c','sr','field','visit','done','2026-11-06T16:59:00Z','{}'),('foreign-owner','o','c','tele','field','visit','done','2026-11-07T01:00:00Z','{\"plan_id\":\"p4\"}'),('call','o','c','tele','telesales','call','done','2026-11-07T01:00:00Z','{}');");
 const r=await f.req('GET','/api/activities?limit=50&date=2026-11-07');assert.equal(r.status,200);const b=await r.json()as any;assert.equal(b.meta.timezone,'Asia/Jakarta');assert.ok(b.data.some((x:any)=>x.id==='midnight'));assert.ok(!b.data.some((x:any)=>['previous','call','foreign-owner'].includes(x.id)));
 const p=await(await f.req('GET','/api/work-plans?limit=50&date=2026-11-07')).json()as any;assert.equal(p.data.find((x:any)=>x.id==='p4').activity_id,null);
 assert.equal((await f.data(await f.req('GET','/api/activities?limit=50&date=2026-11-07&user_id=tele'))).length,0);
 assert.equal((await f.data(await f.req('GET','/api/work-plans?limit=50&date=2026-11-07',undefined,undefined,'tele'))).length,0);
 for(const path of ['/api/tasks?limit=50&date=2026-11-07','/api/activities?limit=50&date=2026-02-30','/api/activities?limit=50&user_id=sr'])assert.equal((await f.req('GET',path)).status,422);
 }finally{f.sqlite.close()}
});
