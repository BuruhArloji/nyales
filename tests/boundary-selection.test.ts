import {test} from 'node:test';import assert from 'node:assert/strict';
import {harness} from './geography-fixture';
test('boundary selection switches one active source, deactivates and reselects without inventing a manual review or changing ownership',async()=>{
 const f=harness();try{
  const a=await f.release(undefined,false),b=await f.release(undefined,false),before=f.sqlite.prepare('SELECT * FROM customer_assignment').all();
  const choose=async(row:any,enabled:boolean,active:string|null)=>{const r=await f.req('POST','/api/admin-boundaries/datasets/'+row.id+'/activate',{enabled,expected_active_id:active},row.version);assert.equal(r.status,200,await r.clone().text());return f.data(r)};
  const first=await choose(a,true,null);assert.equal(first.status,'active');assert.equal(f.sqlite.prepare('SELECT reviewed_by FROM admin_boundary_dataset WHERE id=?').get(a.id)?.reviewed_by,null);
  await choose(b,true,a.id);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM admin_boundary_dataset WHERE status='active'").get()?.n,1);
  const retired=f.sqlite.prepare('SELECT * FROM admin_boundary_dataset WHERE id=?').get(a.id)as any;
  const again=await choose(retired,true,b.id);await choose(again,false,a.id);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM admin_boundary_dataset WHERE status='active'").get()?.n,0);
  const stale=await f.req('POST','/api/admin-boundaries/datasets/'+b.id+'/activate',{enabled:true,expected_active_id:a.id},3);assert.equal(stale.status,412);
  const denied=await f.req('POST','/api/admin-boundaries/datasets/'+a.id+'/activate',{enabled:true,expected_active_id:null},again.version+1,undefined,'sr');assert.equal(denied.status,403);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_assignment').all(),before);
 }finally{f.sqlite.close()}
});
test('simplified activation still rejects incomplete or tampered boundary files',async()=>{
 const f=harness();try{const a=await f.release(undefined,false);const key=[...f.objects.keys()][0];f.objects.set(key,new TextEncoder().encode('tampered').buffer);const r=await f.req('POST','/api/admin-boundaries/datasets/'+a.id+'/activate',{enabled:true,expected_active_id:null},a.version);assert.equal(r.status,409);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM admin_boundary_dataset WHERE status='active'").get()?.n,0)}finally{f.sqlite.close()}
});
