import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {harness,square} from './geography-fixture';
import type {Geometry} from '../src/shared/boundaries';
import {scopedRoutes} from '../src/server/index';
import {digest} from '../src/server/operations';

async function setup(geometry?:Geometry){
 const f=harness(),dataset=await f.release(geometry?[geometry]:undefined);
 const boundary=f.sqlite.prepare('SELECT * FROM admin_boundary WHERE dataset_id=?').get(dataset.id)as any;
 f.sqlite.prepare("INSERT INTO area_admin_membership(id,organization_id,area_id,admin_unit_id,boundary_id,effective_from_date,reason) VALUES('membership','o','a',?,?,'2020-01-01','Synthetic territory')").run(boundary.admin_unit_id,boundary.id);
 f.sqlite.prepare("INSERT INTO village_sales_owner(id,organization_id,admin_unit_id,area_id,rep_id,effective_from_date,reason,created_by,created_at) VALUES('owner','o',?,'a','sr','2020-01-01','Synthetic owner','mg','2020-01-01T00:00:00Z')").run(boundary.admin_unit_id);
 const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]).buffer;
 async function request(method:string,path:string,body?:any,actor='sr',role=actor==='sr'?'SALES_REP':actor==='tele'?'TELESALES':'MANAGEMENT',version?:number,idempotency=crypto.randomUUID(),headers:Record<string,string>={},performedBy?:string){
  const h=new Hono();h.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,role,organization_id:actor==='other'?'x':'o',...(performedBy?{performed_by:{id:performedBy,name:performedBy}}:{})}as never);await next()});h.route('/',scopedRoutes);
  return h.request('/api/customer-proposals'+path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':idempotency,...(version===undefined?{}:{'If-Match':`"${version}"`}),...headers},...(body===undefined?{}:{body:body instanceof ArrayBuffer?body:JSON.stringify(body)})},{DB:f.adapter,IMPORT_FILES:f.bucket});
 }
 const body=(overrides:any={})=>({kind:'new_customer',customer_id:null,name:'Warung Baru',address:'Jalan Sintetis 12',area_id:'a',latitude_e7:-59500000,longitude_e7:1060500000,accuracy_cm:500,captured_at:new Date().toISOString(),notes:'Toko terlihat dan diperiksa di lokasi.',...overrides});
 const propose=async(overrides:any={})=>f.data(await request('POST','',body(overrides)));
 const photo=async(proposal:any,extra:Record<string,string>={})=>request('PUT','/'+proposal.id+'/photo',png,'sr','SALES_REP',proposal.version,crypto.randomUUID(),{'Content-Type':'image/png','Content-Length':String(png.byteLength),'X-Content-SHA256':await digest(png),...extra});
 const upload=async(proposal:any)=>f.data(await photo(proposal));
 const review=(proposal:any,decision='approve',actor='mg',role=actor==='sr'?'SUPERVISOR':'MANAGEMENT',key=crypto.randomUUID())=>request('POST','/'+proposal.id+'/review',{decision,reason:'Bukti lokasi dan wilayah sudah diperiksa.'},actor,role,proposal.version,key);
 return {...f,dataset,boundary,request,body,propose,photo,upload,review,png};
}

test('field customer proposal becomes one verified master only after independent photo and territory approval',async()=>{
 const f=await setup();try{
  const originalCustomers=(f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n;
  const proposal=await f.propose();assert.equal(proposal.status,'pending');assert.equal(proposal.photo_ready,false);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,originalCustomers);
  assert.equal((await f.review(proposal)).status,422);
  const uploaded=await f.upload(proposal);assert.equal(uploaded.version,2);const detail=await f.data(await f.request('GET','/'+proposal.id));assert.equal(detail.territory.status,'ready');assert.equal(detail.territory.rep_id,'sr');assert.equal(detail.photo_ready,true);assert.ok(!('photo_key'in detail));
  assert.equal((await f.review(uploaded,'approve','sr','SUPERVISOR')).status,403);
  const key=crypto.randomUUID(),approved=await f.data(await f.review(uploaded,'approve','mg','MANAGEMENT',key));assert.equal(approved.status,'approved');assert.ok(approved.customer_id);
  const customer=f.sqlite.prepare('SELECT * FROM customer_outlet WHERE id=?').get(approved.customer_id)as any;assert.equal(customer.name,'Warung Baru');assert.equal(customer.coordinate_status,'verified');assert.equal(customer.latitude_e7,-59500000);
  const assignment=f.sqlite.prepare("SELECT * FROM customer_assignment WHERE outlet_id=? AND channel='field'").get(customer.id)as any;assert.equal(assignment.rep_id,'sr');assert.equal(assignment.area_id,'a');
  const mapping=f.sqlite.prepare('SELECT * FROM customer_admin_location WHERE outlet_id=?').get(customer.id)as any;assert.equal(mapping.status,'confirmed');assert.equal(mapping.boundary_id,f.boundary.id);assert.equal(JSON.parse(mapping.evidence_json).proposal_id,proposal.id);
  const replay=await f.data(await f.review(uploaded,'approve','mg','MANAGEMENT',key));assert.equal(replay.customer_id,customer.id);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,originalCustomers+1);assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  const photo=await f.request('GET','/'+proposal.id+'/photo');assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/png');assert.equal((await photo.arrayBuffer()).byteLength,f.png.byteLength);
  assert.equal((await f.request('GET','/'+proposal.id,undefined,'other')).status,404);
 }finally{f.sqlite.close()}
});

test('proposal submission refuses stale GPS, wrong ownership, invalid accuracy and foreign/telesales authors',async()=>{
 const f=await setup();try{
  const stale=await f.request('POST','',f.body({captured_at:new Date(Date.now()-700000).toISOString()}));assert.equal(stale.status,422);assert.equal((await stale.json()as any).code,'PROPOSAL_GPS_STALE');
  assert.equal((await f.request('POST','',f.body({accuracy_cm:10001}))).status,422);
  assert.equal((await f.request('POST','',f.body(),'tele')).status,403);
  assert.equal((await f.request('POST','',f.body(),'mg')).status,403);
  f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('second','o','Another field rep');INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('second-role','o','second','SALES_REP','field','2020-01-01');INSERT INTO user_area_scope VALUES('o','second','a','2020-01-01',NULL)");
  const wrong=await f.request('POST','',f.body(),'second','SALES_REP');assert.equal(wrong.status,422);assert.equal((await wrong.json()as any).code,'VILLAGE_OWNER_REQUIRED');
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_proposal').get()as any).n,0);
 }finally{f.sqlite.close()}
});

test('photo receipt enforces author, checksum, signature and optimistic version without exposing private object keys',async()=>{
 const f=await setup();try{
  const proposal=await f.propose();assert.equal((await f.photo(proposal,{'X-Content-SHA256':'0'.repeat(64)})).status,422);
  assert.equal((await f.photo(proposal,{'Content-Length':'2097153'})).status,422);
  const unauthorized=await f.request('PUT','/'+proposal.id+'/photo',f.png,'mg','MANAGEMENT',proposal.version,crypto.randomUUID(),{'Content-Type':'image/png','Content-Length':String(f.png.byteLength),'X-Content-SHA256':await digest(f.png)});assert.equal(unauthorized.status,403);
  const updated=await f.upload(proposal);assert.equal(updated.version,2);const stale=await f.photo(proposal);assert.equal(stale.status,412);
  const page=await f.request('GET','?status=pending&limit=1&offset=0',undefined,'mg');assert.equal(page.status,200);const envelope=await page.json()as any;assert.equal(envelope.data.length,1);assert.equal(envelope.meta.pagination.has_more,false);assert.ok(!('photo_key'in envelope.data[0]));assert.equal(envelope.data[0].photo_ready,true);
 }finally{f.sqlite.close()}
});

test('duplicates and out-of-boundary coordinates cannot silently create customers and rejection preserves masters',async()=>{
 const f=await setup();try{
  const duplicate=await f.propose({name:'Customer',address:'Jakarta'}),uploaded=await f.upload(duplicate);const count=(f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n;
  const detail=await f.data(await f.request('GET','/'+duplicate.id));assert.ok(detail.duplicate_candidates.some((x:any)=>x.id==='c'));
  const conflict=await f.review(uploaded);assert.equal(conflict.status,409);assert.equal((await conflict.json()as any).code,'DUPLICATE_CUSTOMER_REVIEW_REQUIRED');
  const rejected=await f.data(await f.review(uploaded,'reject'));assert.equal(rejected.status,'rejected');assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,count);
  const outside=await f.propose({longitude_e7:1080000000}),outPhoto=await f.upload(outside);const refusal=await f.review(outPhoto);assert.equal(refusal.status,422);assert.equal((await refusal.json()as any).code,'TERRITORY_ASSIGNMENT_REQUIRED');assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,count);
  assert.equal((await f.review(uploaded,'approve')).status,409);
 }finally{f.sqlite.close()}
});

test('location approval respects snapshot conflicts and active visits, then preserves invoices and assignment history',async()=>{
 const f=await setup();try{
  f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('historical','o','INV-001','1','c','sr','a','field','2026-10-01',123456,'validated','validated')").run();
  const invoiceBefore=JSON.stringify(f.sqlite.prepare('SELECT * FROM invoice').all()),assignmentsBefore=JSON.stringify(f.sqlite.prepare('SELECT * FROM customer_assignment ORDER BY id').all());
  const stale=await f.propose({kind:'location',customer_id:'c',name:'Customer',address:'Jakarta'}),stalePhoto=await f.upload(stale);f.sqlite.exec("UPDATE customer_outlet SET version=version+1 WHERE id='c'");const conflict=await f.review(stalePhoto);assert.equal(conflict.status,412);assert.equal((await conflict.json()as any).code,'CUSTOMER_CHANGED');
  const proposal=await f.propose({kind:'location',customer_id:'c',name:'Customer',address:'Jakarta'}),uploaded=await f.upload(proposal);
  f.sqlite.exec("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES('active','o','c','sr','field','visit','in_progress','2026-11-09T01:00:00Z','{}');INSERT INTO visit_active VALUES('o','sr','active','2026-11-09T01:00:00Z')");
  const running=await f.review(uploaded);assert.equal(running.status,409);assert.equal((await running.json()as any).code,'ACTIVE_VISIT_REQUIRES_CHECKOUT');f.sqlite.exec("DELETE FROM visit_active;UPDATE activity SET status='done' WHERE id='active'");
  const approved=await f.data(await f.review(uploaded));assert.equal(approved.customer_id,'c');assert.equal((f.sqlite.prepare("SELECT coordinate_status FROM customer_outlet WHERE id='c'").get()as any).coordinate_status,'verified');
  assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM invoice').all()),invoiceBefore);assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM customer_assignment ORDER BY id').all()),assignmentsBefore);
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM customer_outlet WHERE id='c'").get()as any).n,1);
 }finally{f.sqlite.close()}
});

test('proposal territory uses full polygon containment and rejects a point inside the bounding box but within a hole',async()=>{
 const outer=square()as {type:'Polygon';coordinates:number[][][]},geometry:Geometry={type:'Polygon',coordinates:[outer.coordinates[0],[[106.04,-5.96],[106.04,-5.94],[106.06,-5.94],[106.06,-5.96],[106.04,-5.96]]]};
 const f=await setup(geometry);try{
  const p=await f.propose(),uploaded=await f.upload(p),detail=await f.data(await f.request('GET','/'+p.id,undefined,'mg'));assert.equal(detail.territory.status,'outside_coverage');
  const response=await f.review(uploaded);assert.equal(response.status,422);assert.equal((await response.json()as any).code,'TERRITORY_ASSIGNMENT_REQUIRED');assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,1);
 }finally{f.sqlite.close()}
});

test('a Management owner acting as Sales cannot approve the same human submission after switching back to Management',async()=>{
 const f=await setup();try{
  const proposal=await f.data(await f.request('POST','',f.body(),'sr','SALES_REP',undefined,crypto.randomUUID(),{},'mg'));
  const stored=f.sqlite.prepare('SELECT proposed_by,submitted_by FROM customer_proposal WHERE id=?').get(proposal.id)as any;assert.equal(stored.proposed_by,'sr');assert.equal(stored.submitted_by,'mg');
  const uploaded=await f.upload(proposal),self=await f.review(uploaded);assert.equal(self.status,403);assert.equal((await self.json()as any).code,'SELF_REVIEW_FORBIDDEN');
  const approved=await f.data(await f.review(uploaded,'approve','nsm','NSM'));assert.equal(approved.status,'approved');
 }finally{f.sqlite.close()}
});

test('an active visit starting after approval reads but before commit prevents moving the customer reference point',async()=>{
 const f=await setup();try{
  const proposal=await f.propose({kind:'location',customer_id:'c',name:'Customer',address:'Jakarta'}),uploaded=await f.upload(proposal);
  const before=JSON.stringify(f.sqlite.prepare("SELECT latitude_e7,longitude_e7,coordinate_status,version FROM customer_outlet WHERE id='c'").get());
  f.sqlite.exec("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES('racing-active','o','c','sr','field','visit','draft','2026-11-09T01:00:00Z','{}')");
  const batch=f.adapter.batch.bind(f.adapter);let injected=false;
  (f.adapter as any).batch=async(statements:any[])=>{
   if(!injected){injected=true;f.sqlite.exec("UPDATE activity SET status='in_progress' WHERE id='racing-active';INSERT INTO visit_active VALUES('o','sr','racing-active','2026-11-09T01:00:00Z')")}
   return batch(statements);
  };
  const result=await f.review(uploaded);assert.equal(injected,true);assert.equal(result.status,409);
  assert.equal(JSON.stringify(f.sqlite.prepare("SELECT latitude_e7,longitude_e7,coordinate_status,version FROM customer_outlet WHERE id='c'").get()),before);
  assert.equal((f.sqlite.prepare('SELECT status FROM customer_proposal WHERE id=?').get(proposal.id)as any).status,'pending');
 }finally{f.sqlite.close()}
});
