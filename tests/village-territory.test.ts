import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './geography-fixture';
import {applyDueTerritories} from '../src/server/territories';
async function setup(){
 const f=harness(),dataset=await f.release();f.point();await f.data(await f.review(await f.preview()));
 const boundary=(f.sqlite.prepare('SELECT * FROM admin_boundary WHERE dataset_id=?').get(dataset.id)as any),date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
 f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('sup','o','Supervisor'),('new','o','New sales'),('newb','o','Area B sales'); INSERT INTO area(id,organization_id,name,branch_id) VALUES('b','o','New area','br'); INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('sup','o','sup','SUPERVISOR','field','2020-01-01'),('new','o','new','SALES_REP','field','2020-01-01'),('newb','o','newb','SALES_REP','field','2020-01-01'); INSERT INTO user_area_scope VALUES('o','new','a','2020-01-01',NULL),('o','newb','b','2020-01-01',NULL),('o','sup','a','2020-01-01',NULL),('o','sup','b','2020-01-01',NULL); INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date) VALUES('new-a','o','new','sup','a','field','2020-01-01'),('new-b','o','newb','sup','b','field','2020-01-01');");
 const input=(extra:any={})=>({dataset_id:dataset.id,boundary_ids:[boundary.id],area_id:'a',rep_id:'new',effective_from_date:date,reason:'Whole village reassignment reviewed',agenda_action:'block',...extra});
 const preview=async(body=input())=>f.data(await f.req('POST','/api/geo/village-territories/preview',body));
 const commit=(body:any,p:any,key=crypto.randomUUID())=>f.req('POST','/api/geo/village-territories/commit',{...body,preview_hash:p.preview_hash,confirmed:true},undefined,key);
 return{...f,boundary,date,input,previewVillage:preview,commitVillage:commit};
}
test('whole village preview is read-only, commit is idempotent, and individual edits cannot split ownership',async()=>{
 const f=await setup();try{
  const b=f.input(),p=await f.previewVillage(b);assert.equal(p.can_commit,true);assert.equal(p.summary.customers,1);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM village_sales_owner').get()!.n,0);
  const tele=f.sqlite.prepare("SELECT * FROM customer_assignment WHERE channel='telesales'").all(),key=crypto.randomUUID();
  const saved=await f.data(await f.commitVillage(b,p,key));assert.equal(saved.status,'effective');assert.equal((await f.data(await f.commitVillage(b,p,key))).id,saved.id);
  assert.equal(f.sqlite.prepare("SELECT rep_id FROM customer_assignment WHERE channel='field' AND effective_to_date IS NULL").get()!.rep_id,'new');assert.deepEqual(f.sqlite.prepare("SELECT * FROM customer_assignment WHERE channel='telesales'").all(),tele);
  const current=f.sqlite.prepare("SELECT version FROM customer_outlet WHERE id='c'").get()as any;
  const denied=await f.req('POST','/api/customers/c/assignments',{area_id:'a',rep_id:null,channel:'field',effective_from_date:new Date(Date.parse(f.date)+86400000).toISOString().slice(0,10),reason:'Attempt per-customer removal'},current.version);assert.equal(denied.status,409);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM customer_assignment WHERE channel='field' AND rep_id='new' AND effective_to_date IS NULL").get()!.n,1);
  const list=await f.data(await f.req('GET','/api/geo/village-territories'));assert.equal(list.owners.length,1);assert.equal(list.owners[0].rep_name,'New sales');
  assert.equal((await f.commitVillage(b,p)).status,412);
 }finally{f.sqlite.close()}
});
test('future area transfer preserves invoices and telesales; agenda cancellation requires explicit reviewed action',async()=>{
 const f=await setup();try{
  const future=new Date(Date.parse(f.date)+86400000).toISOString().slice(0,10);
  f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('inv','o','INV-1','1','c','sr','a','field',?,1000,'validated','validated')").run(f.date);
  f.sqlite.prepare("INSERT INTO work_plan VALUES('agenda','o','c','sr',?,?,'visit','planned','Existing appointment',1,'mg',?,'{}')").run(future+'T03:00:00Z',future+'T03:00:00Z',new Date().toISOString());
  const b=f.input({area_id:'b',rep_id:'newb',effective_from_date:future}),p=await f.previewVillage(b);assert.ok(p.blockers.some((x:any)=>x.code==='FUTURE_VISITS_REQUIRE_REVIEW'));assert.equal((await f.commitVillage(b,p)).status,409);
  const approved={...b,agenda_action:'cancel'},review=await f.previewVillage(approved);assert.equal(review.can_commit,true);const before=f.sqlite.prepare('SELECT * FROM invoice').all();await f.data(await f.commitVillage(approved,review));
  assert.equal(f.sqlite.prepare("SELECT area_id FROM customer_outlet WHERE id='c'").get()!.area_id,'a');await applyDueTerritories(f.adapter,'o',future);assert.equal(f.sqlite.prepare("SELECT area_id FROM customer_outlet WHERE id='c'").get()!.area_id,'b');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM invoice').all(),before);assert.equal(f.sqlite.prepare("SELECT status FROM work_plan WHERE id='agenda'").get()!.status,'cancelled');assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM work_plan_revision').get()!.n,1);assert.equal(f.sqlite.prepare("SELECT rep_id FROM customer_assignment WHERE channel='telesales' AND effective_to_date IS NULL").get()!.rep_id,'tele');
 }finally{f.sqlite.close()}
});
test('stale mapping, hierarchy changes, and foreign/nonmanagement requests fail before mutation',async()=>{
 const f=await setup();try{
  const b=f.input(),p=await f.previewVillage(b);f.point(106.06,-5.95);const stale=await f.previewVillage(b);assert.ok(stale.blockers.some((x:any)=>x.code==='STALE_CUSTOMER_MAPPING'));assert.equal((await f.commitVillage(b,p)).status,412);
  assert.equal((await f.req('POST','/api/geo/village-territories/preview',b,undefined,crypto.randomUUID(),'sr')).status,403);
  assert.equal((await f.req('POST','/api/geo/village-territories/preview',{...b,boundary_ids:['foreign']})).status,404);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM village_sales_owner').get()!.n,0);
 }finally{f.sqlite.close()}
});
test('large directories do not impose the old 2000-customer global cap; every mapped village customer is assigned',async()=>{
 const f=await setup();try{
  const original=f.sqlite.prepare("SELECT * FROM customer_admin_location WHERE outlet_id='c' AND superseded_at IS NULL").get()as any;
  const keys=Object.keys(original),insert=f.sqlite.prepare(`INSERT INTO customer_admin_location(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`),customer=f.sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,latitude_e7,longitude_e7,coordinate_status) VALUES(?,'o','a',?,? ,?,'verified')");
  f.sqlite.exec('BEGIN');for(let i=0;i<2100;i++){const id='extra-'+i;customer.run(id,'Warung '+i,-59500000,1060500000);const row={...original,id:'map-'+i,outlet_id:id};insert.run(...keys.map(k=>row[k]))}f.sqlite.exec('COMMIT');
  const b=f.input(),p=await f.previewVillage(b);assert.equal(p.summary.customers,2101);assert.equal(p.sample.length,50);assert.equal(p.can_commit,true);await f.data(await f.commitVillage(b,p));
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM customer_assignment WHERE channel='field' AND rep_id='new' AND effective_to_date IS NULL").get()!.n,2101);
 }finally{f.sqlite.close()}
});


test('canonical and merged aliases retain identical overlap protection after index optimization',async()=>{
 const f=await setup();try{
  f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name,merged_into_id,record_status) VALUES('alias','o','a','Old warung alias','c','inactive');");
  const insert=f.sqlite.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES(?,'o',?,'new','field','a',?)");
  assert.throws(()=>insert.run('alias-overlap','alias',f.date),/CUSTOMER_OWNER_OVERLAP|CUSTOMER_MERGED/);
  f.sqlite.prepare("UPDATE customer_assignment SET effective_to_date=? WHERE channel='field'").run(f.date);
  f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('old','o','a','Old customer');");
  insert.run('alias-owner','old',f.date);
  f.sqlite.exec("UPDATE customer_outlet SET merged_into_id='c',record_status='inactive' WHERE id='old';");
  assert.throws(()=>insert.run('canonical-overlap','c',f.date),/CUSTOMER_OWNER_OVERLAP/);
  assert.throws(()=>insert.run('alias-self-overlap','alias',f.date),/CUSTOMER_OWNER_OVERLAP|CUSTOMER_MERGED/);
  const p=await f.previewVillage();assert.equal(p.summary.customer_changes,0);assert.equal(p.can_commit,true);
 }finally{f.sqlite.close()}
});

test('scheduled ownership cannot be overwritten and ownership intervals cannot overlap',async()=>{
 const f=await setup();try{
  const tomorrow=new Date(Date.parse(f.date)+86400000).toISOString().slice(0,10),b=f.input({effective_from_date:tomorrow});
  await f.data(await f.commitVillage(b,await f.previewVillage(b)));
  const earlier=await f.previewVillage();assert.ok(earlier.blockers.some((x:any)=>x.code==='VILLAGE_DATE_CONFLICT'));
  const same=await f.previewVillage(f.input({rep_id:'sr',effective_from_date:tomorrow}));assert.ok(same.blockers.some((x:any)=>x.code==='VILLAGE_DATE_CONFLICT'));
  assert.throws(()=>f.sqlite.prepare("INSERT INTO village_sales_owner VALUES('overlap','o',?,'a','sr',?,NULL,'Conflict fixture','mg',?)").run(f.boundary.admin_unit_id,tomorrow,new Date().toISOString()),/VILLAGE_OWNER_OVERLAP/);
 }finally{f.sqlite.close()}
});


test('mapping a new customer into an owned village requires the matching field owner first',async()=>{
 const f=await setup();try{
  const b=f.input();await f.data(await f.commitVillage(b,await f.previewVillage(b)));
  f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('arrival','o','a','New arrival');");
  const old=f.sqlite.prepare("SELECT * FROM customer_admin_location WHERE outlet_id='c' AND superseded_at IS NULL").get()as any,keys=Object.keys(old),row={...old,id:'arrival-map',outlet_id:'arrival'};
  const insert=f.sqlite.prepare(`INSERT INTO customer_admin_location(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`);
  assert.throws(()=>insert.run(...keys.map(k=>row[k])),/VILLAGE_OWNER_REQUIRED/);
  f.sqlite.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES('arrival-owner','o','arrival','new','field','a',?)").run(f.date);
  insert.run(...keys.map(k=>row[k]));assert.equal((await f.previewVillage()).summary.customers,2);
 }finally{f.sqlite.close()}
});
