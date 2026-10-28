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
 assert.equal((await referencePoints(c(org,{area_id:'a'}))).points.length,0);assert.equal(reads,2);assert.equal((await referencePoints(c({orgWide:true,identity:{organization_id:'x'}}))).points.length,0);
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
