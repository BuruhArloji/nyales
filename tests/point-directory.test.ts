import {test}from'node:test';
import assert from'node:assert/strict';
import {database}from'./sqlite-helper';
import {directoryDetails,referencePoints}from'../src/server/point-directory';
import {digest}from'../src/server/operations';
import {segmentationSnapshot}from'../src/server/segmentation';
import {Hono}from'hono';
import {scopedRoutes}from'../src/server/index';
function setup(){
 const f=database();f.sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org'),('x','Other');INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Management'),('sr','o','Sales');INSERT INTO branch(id,organization_id,name,timezone) VALUES('b','o','Branch','Asia/Jakarta');INSERT INTO area(id,organization_id,name,branch_id) VALUES('a','o','Area','b');");
 return f;
}
test('Reference layer verifies private bytes/tenant manifest and never leaks to scoped reps or filtered area views',async()=>{
 const f=setup(),key='o/point-directories/d/reference-points.json',bytes=new TextEncoder().encode(JSON.stringify({format:'nyales-reference-points-1',organization_id:'o',dataset_id:'d',points:[{id:'p',name:'Reference only',lat:-6.2,lng:107,category:'Restaurant',city:'Kota Bekasi'}],details:[{external_code:'p',name:'Reference only',category:'Restaurant',photo_url:'https://example.test/photo.jpg',maps_url:'https://maps.example.test/p'}]})),hash=await digest(bytes.buffer);
 f.sqlite.prepare("INSERT INTO point_directory_dataset VALUES('d','o','Directory','Drive',?,?,?,?,1,1,0,'mg','2026-10-28','ready')").run('a'.repeat(64),key,hash,bytes.length);
 let reads=0;const bucket={get:async()=>{reads++;return{size:bytes.length,arrayBuffer:async()=>bytes.buffer}}};
 const c=(scope:any,q:Record<string,string>={})=>({get:()=>scope,env:{DB:f.adapter,IMPORT_FILES:bucket},req:{query:(k:string)=>q[k]}});
 const org={orgWide:true,identity:{organization_id:'o'}};
 const result=await referencePoints(c(org));assert.equal(result.points.length,1);assert.equal(result.points[0].reference_only,true);assert.equal((await referencePoints(c({orgWide:false,identity:{organization_id:'o'}}))).points.length,0);
 const detail=await directoryDetails(c(org),'d','p');assert.equal(detail?.photo_url,'https://example.test/photo.jpg');assert.equal(detail?.maps_url,'https://maps.example.test/p');
 assert.equal((await referencePoints(c(org,{area_id:'a'}))).points.length,0);assert.equal(reads,1);assert.equal((await referencePoints(c({orgWide:true,identity:{organization_id:'x'}}))).points.length,0);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_outlet').get()as any).n,0);
 f.sqlite.exec("UPDATE point_directory_dataset SET storage_sha256='"+'b'.repeat(64)+"'");await assert.rejects(()=>referencePoints(c(org)),/REFERENCE_SOURCE_CHANGED/);
 f.sqlite.exec("UPDATE point_directory_dataset SET storage_key='x/point-directories/d/reference-points.json'");await assert.rejects(()=>referencePoints(c(org)),/REFERENCE_NAMESPACE_INVALID/);
});
test('Imported directory customers remain Unknown despite training history coverage; no per-directory-row daily snapshot writes',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-28T12:00:00Z')});const f=setup();
 f.sqlite.exec("INSERT INTO customer_source_coverage(organization_id,complete_from,complete_through,reason,updated_by,updated_at,history_complete) VALUES('o','2026-01-01','2026-10-28','Training fixture','mg','now',1);INSERT INTO customer_outlet(id,organization_id,area_id,name,transaction_history_unverified) VALUES('c','o','a','Directory warung',1),('training','o','a','Training customer',0);");
 const run=await segmentationSnapshot(f.adapter,'o','2026-10-28');const snapshots=f.sqlite.prepare('SELECT * FROM customer_status_snapshot WHERE run_id=?').all(run.id)as any[];
 assert.equal(snapshots.length,1);assert.equal(snapshots[0].customer_id,'training');assert.equal(snapshots[0].status,'New');
 const app=new Hono();app.use('*',async(c,next)=>{c.set('identity'as never,{id:'mg',name:'Management',organization_id:'o',role:'MANAGEMENT'}as never);await next()});app.route('/',scopedRoutes);
 const env={DB:f.adapter,APP_ENV:'staging',LOCAL_AUTH:'false',FIREBASE_PROJECT_ID:'fixture'};
 const response=await app.request('/api/customers',{},env);assert.equal(response.status,200);const data=(await response.json()as any).data;assert.equal(data.find((c:any)=>c.id==='c').status,'Unknown');assert.equal(data.find((c:any)=>c.id==='c').tier,'Belum tersedia');
 const segmented=await app.request('/api/customer-segmentation',{},env);assert.equal(segmented.status,200);assert.equal((await segmented.json()as any).data.find((c:any)=>c.customer_id==='c').transaction_history_unverified,true);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_assignment').get()as any).n,0);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM invoice').get()as any).n,0);
});
test('Directory relation cannot point to another tenant and non-directory legacy behavior remains compatible',()=>{
 const f=setup();assert.throws(()=>f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name,directory_dataset_id) VALUES('c','o','a','Warung','missing')"),/INVALID_POINT_DIRECTORY/);
 f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('existing','o','a','Existing');");assert.equal((f.sqlite.prepare("SELECT transaction_history_unverified FROM customer_outlet").get()as any).transaction_history_unverified,0);
});

test('Reference detail endpoint excludes held/master rows and rejects a warmed cache under another tenant namespace',async()=>{
 const f=setup(),bytes=new TextEncoder().encode(JSON.stringify({format:'nyales-reference-points-1',organization_id:'o',dataset_id:'membership',points:[{id:'ref',name:'Map reference',lat:-6,lng:107}],details:[{external_code:'ref',name:'Map reference'},{external_code:'held',name:'Held for review'},{external_code:'master',name:'Master customer'}]})),hash=await digest(bytes.buffer),key='o/point-directories/membership/reference-points.json';
 f.sqlite.prepare("INSERT INTO point_directory_dataset VALUES('membership','o','Directory','Drive',?,?,?,?,1,1,1,'mg','2026-10-28','ready')").run('a'.repeat(64),key,hash,bytes.length);
 let reads=0;const c={get:()=>({identity:{organization_id:'o'}}),env:{DB:f.adapter,IMPORT_FILES:{get:async()=>{reads++;return{size:bytes.length,arrayBuffer:async()=>bytes.buffer}}}}};
 assert.equal((await directoryDetails(c,'membership','REF',true))?.name,'Map reference');assert.equal(await directoryDetails(c,'membership','held',true),null);assert.equal(await directoryDetails(c,'membership','master',true),null);assert.equal(reads,1);
 const app=new Hono();app.use('*',async(ctx,next)=>{ctx.set('identity'as never,{id:'mg',name:'Management',organization_id:'o',role:'MANAGEMENT'}as never);await next()});app.route('/',scopedRoutes);
 assert.equal((await app.request('/api/point-directory/membership/details/held',{},c.env)).status,404);
 assert.equal((await app.request('/api/point-directory/membership/details/master',{},c.env)).status,404);
 assert.equal((await app.request('/api/point-directory/membership/details/ref',{},c.env)).status,200);
 f.sqlite.prepare("UPDATE point_directory_dataset SET storage_key=? WHERE id='membership'").run('x/point-directories/membership/reference-points.json');await assert.rejects(()=>directoryDetails(c,'membership','ref'),/REFERENCE_NAMESPACE_INVALID/);assert.equal(reads,1);
});
test('Directory cache retries storage failures, expires, and does not retain every dataset version',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-29T12:00:00Z')});const f=setup();
 const objects=new Map<string,Uint8Array>();for(const id of ['retry','next']){
  const key='o/point-directories/'+id+'/reference-points.json',bytes=new TextEncoder().encode(JSON.stringify({format:'nyales-reference-points-1',organization_id:'o',dataset_id:id,points:[],details:[{external_code:'c',name:'Customer'}]}));objects.set(key,bytes);
  f.sqlite.prepare('INSERT INTO point_directory_dataset(id,organization_id,name,source_reference,source_sha256,storage_key,storage_sha256,byte_count,customer_expected_count,reference_count,held_count,created_by,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'o','Directory','Drive','a'.repeat(64),key,await digest(bytes.buffer),bytes.length,1,0,0,'mg','2026-10-28','ready');
 }
 let reads=0,fail=true;const c={get:()=>({identity:{organization_id:'o'}}),env:{DB:f.adapter,IMPORT_FILES:{get:async(key:string)=>{reads++;if(fail)throw Error('TEMPORARY_STORAGE_ERROR');const b=objects.get(key)!;return{size:b.length,arrayBuffer:async()=>b.buffer}}}}};
 await assert.rejects(()=>directoryDetails(c,'retry','c'),/TEMPORARY_STORAGE_ERROR/);fail=false;
 const [one,two]=await Promise.all([directoryDetails(c,'retry','c'),directoryDetails(c,'retry','c')]);assert.equal(one?.name,two?.name);assert.equal(reads,2);
 t.mock.timers.tick(5*60*1000+1);await directoryDetails(c,'retry','c');assert.equal(reads,3);
 await directoryDetails(c,'next','c');await directoryDetails(c,'retry','c');assert.equal(reads,5);
 f.sqlite.exec("UPDATE point_directory_dataset SET status='retired' WHERE id='retry'");assert.equal(await directoryDetails(c,'retry','c'),null);
});

test('Map keeps customer pins available when optional reference storage is missing',async()=>{
 const f=setup(),key='o/point-directories/optional-map/reference-points.json',bytes=new TextEncoder().encode('missing reference object'),before={...f.sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,latitude_e7,longitude_e7,coordinate_status) VALUES('source','o','a','Source customer',-62000000,1068000000,'unverified') RETURNING id,latitude_e7,longitude_e7").get()as any};
 f.sqlite.prepare("INSERT INTO point_directory_dataset VALUES('optional-map','o','Optional directory','Drive',?,?,?,?,1,1,0,'mg','2026-10-28','ready')").run('a'.repeat(64),key,await digest(bytes.buffer),bytes.length);
 const app=new Hono();app.use('*',async(c,next)=>{c.set('identity'as never,{id:'mg',name:'Management',organization_id:'o',role:'MANAGEMENT'}as never);await next()});app.route('/',scopedRoutes);
 const response=await app.request('/api/map',{}, {DB:f.adapter,APP_ENV:'staging',LOCAL_AUTH:'false',FIREBASE_PROJECT_ID:'fixture',IMPORT_FILES:{get:async()=>null}});assert.equal(response.status,200,await response.clone().text());
 const data=(await response.json()as any).data;assert.equal(data.customers.length,1);assert.equal(data.customers[0].id,'source');assert.deepEqual(data.reference_points,[]);assert.equal(data.reference_points_warning,'Titik referensi tambahan belum tersedia. Titik pelanggan dan overlay DEMO tetap ditampilkan.');
 const after=f.sqlite.prepare("SELECT id,latitude_e7,longitude_e7 FROM customer_outlet WHERE id='source'").get()as any;assert.equal(after.id,before.id);assert.equal(after.latitude_e7,before.latitude_e7);assert.equal(after.longitude_e7,before.longitude_e7);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM invoice').get()as any).n,0);
});
