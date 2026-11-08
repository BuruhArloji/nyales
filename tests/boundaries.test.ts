import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {digest} from '../src/server/operations';
import {boundaryLimits,canonicalJson,manifestJson,type BoundaryCollection} from '../src/shared/boundaries';
import {validateBoundaryCollection} from '../src/server/boundary-geometry';

const ring=[[106,-6],[106.1,-6],[106.1,-5.9],[106,-5.9],[106,-6]];

test('village picker filters by dated area membership before pagination and rejects foreign areas',async()=>{
 const f=harness();try{
  const a=collection(),b=collection('31.71.02.1001','31.71.02','Kelurahan Lain');
  let row=await f.create([a,b]);row=await f.upload(row,a);row=await f.upload(row,b,1);await f.activate(row);
  f.sqlite.exec("INSERT INTO area(id,organization_id,name) VALUES('empty','o','Empty area');");
  const village=f.sqlite.prepare('SELECT id,admin_unit_id FROM admin_boundary WHERE dataset_id=? ORDER BY name_snapshot').all(row.id) as any[];
  const chosen=village.find(v=>(f.sqlite.prepare('SELECT name_snapshot FROM admin_boundary WHERE id=?').get(v.id) as any).name_snapshot==='Kelurahan Contoh');
  f.sqlite.prepare('INSERT INTO area_admin_membership VALUES(?,?,?,?,?,?,?,?)').run('member','o','a',chosen.admin_unit_id,chosen.id,'2020-01-01','2030-01-01','Fixture membership');
  const query='datasets/'+row.id+'/boundaries?area_id=a&effective_from_date=';
  assert.deepEqual((await f.data(await f.req('GET',query+'2026-11-08'))).map((v:any)=>v.id),[chosen.id]);
  assert.equal((await f.data(await f.req('GET',query+'2030-01-01'))).length,0);
  assert.equal((await f.data(await f.req('GET','datasets/'+row.id+'/boundaries?area_id=empty'))).length,0);
  assert.equal((await f.req('GET','datasets/'+row.id+'/boundaries?area_id=foreign')).status,422);
  assert.equal((await f.req('GET',query+'invalid')).status,422);
  assert.equal((await f.data(await f.req('GET','datasets/'+row.id+'/boundaries'))).length,2);
 }finally{f.sqlite.close()}
});
function collection(code='31.71.01.1001',district='31.71.01',name='Kelurahan Contoh'):BoundaryCollection{return {type:'FeatureCollection',features:[{type:'Feature',properties:{source_id:code,province:{code:'31',name:'Provinsi Contoh'},regency:{code:'31.71',name:'Kota Contoh'},district:{code:district,name:'Kecamatan '+district},village:{code,name,type:'kelurahan'}},geometry:{type:'Polygon',coordinates:[structuredClone(ring)]}}]}}
async function source(chunks:BoundaryCollection[],release='Synthetic release',manifest?:string){return {provider:'Synthetic fixture, not a real boundary source',code_namespace:'fixture-pum',release_version:release,released_at:null,acquired_at:'2026-01-01T00:00:00Z',source_reference:'https://example.test/boundaries',source_checksum:await digest('synthetic source'),metadata:{reference_release:'Synthetic',origin:'Test only',code_mapping:'Explicit fixture namespace',usage_terms_status:'unverified',notes:'No real-world rights assertion'},coverage:{label:'Synthetic test scope',source_filter:'fixture-only',national_complete:false},manifest_sha256:manifest||await digest(manifestJson(await Promise.all(chunks.map(c=>digest(canonicalJson(c)))))),expected_features:chunks.reduce((n,c)=>n+c.features.length,0),expected_chunks:chunks.length}}
const review=(expected_active_id:string|null=null)=>({reason:'Synthetic release review',license_reference:'https://example.test/synthetic-fixture-terms',license_note:'Synthetic fixture authored for this test; no real provider assertion.',attribution:'NYALES synthetic fixture',confirm_usage_rights:true,expected_active_id});
function harness(){const f=fixture();const req=(method:string,path:string,body?:any,v?:number,key:string=crypto.randomUUID(),actor='mg',role=actor==='mg'?'MANAGEMENT':'SALES_REP',org='o')=>f.req(method,'/api/admin-boundaries/'+path,body,v,actor,role,org,key as ReturnType<typeof crypto.randomUUID>);return {...f,req,baseReq:f.req,
 create:async(chunks:BoundaryCollection[],release?:string,manifest?:string)=>f.data(await req('POST','datasets',await source(chunks,release,manifest))),
 upload:async(row:any,c:BoundaryCollection,index=0,key?:string)=>f.data(await req('POST','datasets/'+row.id+'/chunks',{index,collection:c},row.version,key)),
 activate:async(row:any,active:string|null=null)=>f.data(await req('POST','datasets/'+row.id+'/activate',review(active),row.version))};}

test('WEB-063 geometry validates complete Polygon/MultiPolygon topology, WGS84 and complexity without simplifying',()=>{
 const c=collection(),original=canonicalJson(c);const v=validateBoundaryCollection(c);assert.deepEqual(v.bboxes,[[1060000000,-60000000,1061000000,-59000000]]);assert.equal(canonicalJson(v.collection),original);
 const hole=collection();(hole.features[0].geometry.coordinates as number[][][]).push([[106.02,-5.98],[106.02,-5.96],[106.04,-5.96],[106.04,-5.98],[106.02,-5.98]]);assert.doesNotThrow(()=>validateBoundaryCollection(hole));
 const multi=collection();multi.features[0].geometry={type:'MultiPolygon',coordinates:[[structuredClone(ring)],[ring.map(([x,y])=>[x+1,y])]]};assert.doesNotThrow(()=>validateBoundaryCollection(multi));
 for(const geometry of [
  {type:'Polygon',coordinates:[[[106,-6],[106.1,-5.9],[106.1,-6],[106,-5.9],[106,-6]]]},
  {type:'Polygon',coordinates:[ring.slice(0,4)]},
  {type:'Polygon',coordinates:[ring,ring.map(([x,y])=>[x+1,y])]},
  {type:'MultiPolygon',coordinates:[[ring],[ring]]},
  {type:'Polygon',coordinates:[[[181,-6],...ring.slice(1)]]},
  {type:'Polygon',coordinates:[[[106,NaN],...ring.slice(1)]]}
 ]){const bad=collection();bad.features[0].geometry=geometry as any;assert.throws(()=>validateBoundaryCollection(bad))}
 const tooMany=collection();tooMany.features[0].geometry.coordinates=[Array.from({length:boundaryLimits.maxFeaturePositions+1},()=>[106,-6])];assert.throws(()=>validateBoundaryCollection(tooMany),/GEOMETRY_TOO_COMPLEX/);
 const duplicate=collection();duplicate.features.push(duplicate.features[0]);assert.throws(()=>validateBoundaryCollection(duplicate),/DUPLICATE/);
 const badCrs={...collection(),crs:{name:'EPSG:3857'}};assert.throws(()=>validateBoundaryCollection(badCrs),/INVALID_FEATURE_COLLECTION/);
});

test('WEB-063 imports bounded chunks, maintains distinct same-name identities, source checksum and explicit review gate',async()=>{
 const f=harness(),a=collection(),b=collection('31.71.02.1001','31.71.02'),before=f.sqlite.prepare('SELECT * FROM customer_assignment ORDER BY id').all();
 const input=await source([a,b]),key=crypto.randomUUID(),first=await f.data(await f.req('POST','datasets',input,undefined,key));assert.equal(first.status,'draft');
 assert.equal((await f.data(await f.req('POST','datasets',input,undefined,key))).id,first.id);
 assert.equal((await f.req('POST','datasets',{...input,release_version:'changed'},undefined,key)).status,409);
 let row=await f.upload(first,a);assert.equal(row.version,2);
 // A new browser session/key can recover the same immutable partial draft.
 const resumed=await f.data(await f.req('POST','datasets',input));assert.equal(resumed.id,first.id);assert.equal(resumed.uploaded_chunks,1);
 assert.equal((await f.req('POST','datasets',{...input,provider:'Different provenance'})).status,409);
 assert.equal((await f.req('POST','datasets/'+row.id+'/activate',review(),2)).status,409);
 assert.equal((await f.req('POST','datasets/'+row.id+'/chunks',{index:1,collection:b},1)).status,412);
 row=await f.upload(row,b,1);assert.equal(row.version,3);
 assert.equal((await f.req('POST','datasets/'+row.id+'/activate',{...review(),confirm_usage_rights:false},3)).status,422);
 assert.equal((await f.req('POST','datasets/'+row.id+'/activate',{...review(),license_note:''},3)).status,422);
 const ready=await f.activate(row);assert.equal(ready.status,'active');
 const detail=await f.data(await f.req('GET','datasets/'+row.id));assert.equal(detail.uploaded_features,2);assert.equal(detail.chunks.length,2);assert.equal(detail.reviewed_by,'mg');assert.equal(detail.released_at,null);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM admin_unit WHERE level=\'village\'').get() as any).n,2);
 assert.equal((await f.data(await f.req('GET','datasets/'+row.id+'/boundaries'))).length,2);
 const bytes=await (await f.req('GET','datasets/'+row.id+'/chunks/0')).arrayBuffer();assert.equal(await digest(bytes),await digest(canonicalJson(a)));
 assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_assignment ORDER BY id').all(),before);
 assert.throws(()=>f.sqlite.prepare("UPDATE admin_boundary SET name_snapshot='rewrite' WHERE dataset_id=?").run(row.id),/IMMUTABLE/);
 assert.throws(()=>f.sqlite.prepare("DELETE FROM admin_unit WHERE level='village'").run(),/IMMUTABLE/);
 assert.equal((await f.req('POST','datasets/'+row.id+'/chunks',{index:1,collection:b},4)).status,409);
 f.sqlite.close();
});

test('WEB-063 replacement is atomic, stale active versions fail, old geometry/history stays readable',async()=>{
 const f=harness(),c=collection();let old=await f.create([c],'Old');old=await f.upload(old,c);old=await f.activate(old);
 let next=await f.create([c],'New');next=await f.upload(next,c);
 assert.equal((await f.req('POST','datasets/'+next.id+'/activate',review(),next.version)).status,412);
 const saved=f.objects.entries().next().value!;f.objects.delete(saved[0]);
 // New missing/corrupted storage must not retire the previously active release.
 const newKey=[...f.objects.keys()][0],newBytes=f.objects.get(newKey)!;f.objects.set(newKey,new TextEncoder().encode('corrupt').buffer);
 assert.equal((await f.req('POST','datasets/'+next.id+'/activate',review(old.id),next.version)).status,409);
 assert.equal((await f.data(await f.req('GET','datasets/'+old.id))).status,'active');
 f.objects.set(newKey,newBytes);f.objects.set(saved[0],saved[1]);await f.activate(next,old.id);
 assert.equal((await f.data(await f.req('GET','datasets/'+old.id))).status,'retired');
 assert.equal((await f.req('GET','datasets/'+old.id+'/chunks/0')).status,200);
 assert.throws(()=>f.sqlite.prepare("UPDATE admin_boundary_dataset SET status='active',version=version+1 WHERE id=?").run(old.id),/UNIQUE/);
 f.sqlite.close();
});

test('WEB-063 guards incomplete manifests, hierarchy conflicts, duplicate identities and storage failures without partial DB writes',async()=>{
 const f=harness(),c=collection();let row=await f.create([c],'Wrong manifest','f'.repeat(64));row=await f.upload(row,c);
 assert.equal((await f.req('POST','datasets/'+row.id+'/activate',review(),row.version)).status,409);
 const incomplete=await f.create([c],'Incomplete');assert.equal((await f.req('POST','datasets/'+incomplete.id+'/chunks',{index:5,collection:c},1)).status,422);
 const bad=collection();bad.features[0].properties.district.code='31';
 assert.equal((await f.req('POST','datasets/'+incomplete.id+'/chunks',{index:0,collection:bad},1)).status,422);
 assert.equal((await f.data(await f.req('GET','datasets/'+incomplete.id))).version,1);
 const changed=collection();changed.features[0].properties.village.code='31.71.01.1002';changed.features[0].properties.regency.code='31.72';
 assert.equal((await f.req('POST','datasets/'+incomplete.id+'/chunks',{index:0,collection:changed},1)).status,409);
 assert.equal((await f.data(await f.req('GET','datasets/'+incomplete.id))).uploaded_features,0);
 const originalPut=f.bucket.put;f.bucket.put=async()=>{throw Error('R2 offline')};
 assert.equal((await f.req('POST','datasets/'+incomplete.id+'/chunks',{index:0,collection:c},1)).status,503);f.bucket.put=originalPut;
 assert.equal((await f.data(await f.req('GET','datasets/'+incomplete.id))).version,1);
 f.sqlite.close();
});

test('WEB-063 management/NSM admin operations reject area/SR/tele reads and cross-tenant IDs',async()=>{
 const f=harness(),c=collection();let row=await f.create([c]);row=await f.upload(row,c);
 for(const role of ['AREA_MANAGER','SUPERVISOR','SALES_REP','TELESALES']){
  assert.equal((await f.req('GET','config',undefined,undefined,undefined,'sr',role)).status,403);
  assert.equal((await f.req('GET','datasets/'+row.id+'/chunks/0',undefined,undefined,undefined,'sr',role)).status,403);
  assert.equal((await f.req('POST','datasets',await source([c]),undefined,undefined,'sr',role)).status,403);
 }
 assert.equal((await f.req('GET','datasets',undefined,undefined,undefined,'mg','NSM')).status,200);
 assert.equal((await f.req('GET','datasets/'+row.id,undefined,undefined,undefined,'mg','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('GET','datasets/'+row.id+'/chunks/0',undefined,undefined,undefined,'mg','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('GET','datasets/'+row.id+'/boundaries',undefined,undefined,undefined,'mg','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('POST','datasets/'+row.id+'/activate',review(),row.version,undefined,'mg','MANAGEMENT','x')).status,404);
 assert.equal((await f.data(await f.req('GET','datasets',undefined,undefined,undefined,'mg','MANAGEMENT','x'))).length,0);
 f.sqlite.close();
});

test('WEB-063 chunk retries/lost DB acknowledgement retain the only source and never duplicate rows',async()=>{
 const f=harness(),c=collection(),row=await f.create([c]);const original=f.adapter.batch.bind(f.adapter);let lost=false;
 (f.adapter as any).batch=async(statements:D1PreparedStatement[])=>{const result=await original(statements);if(!lost){lost=true;throw Error('Response lost after commit')}return result};
 const key=crypto.randomUUID(),body={index:0,collection:c},saved=await f.data(await f.req('POST','datasets/'+row.id+'/chunks',body,1,key));
 assert.equal(saved.version,2);assert.equal(f.objects.size,1);assert.equal((await f.data(await f.req('POST','datasets/'+row.id+'/chunks',body,1,key))).version,2);
 assert.equal(f.objects.size,1);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM admin_boundary').get() as any).n,1);f.sqlite.close();
});

test('WEB-063 migration constrains tenant relationships, area interval overlap and confirmed customer mappings',async()=>{
 const f=harness(),c=collection();let row=await f.create([c]);row=await f.upload(row,c);await f.activate(row);
 f.sqlite.exec("INSERT INTO area(id,organization_id,name) VALUES('b','o','Area B')");
 const b=f.sqlite.prepare('SELECT id,admin_unit_id FROM admin_boundary').get() as any;
 const insert=f.sqlite.prepare('INSERT INTO area_admin_membership VALUES(?,?,?,?,?,?,?,?)');
 insert.run('m1','o','a',b.admin_unit_id,b.id,'2026-01-01','2026-02-01','first');
 assert.throws(()=>insert.run('m2','o','b',b.admin_unit_id,b.id,'2026-01-15',null,'overlap'),/OVERLAP/);
 insert.run('m2','o','b',b.admin_unit_id,b.id,'2026-02-01',null,'next interval');
 assert.throws(()=>f.sqlite.prepare("UPDATE area_admin_membership SET effective_to_date=NULL WHERE id='m1'").run(),/HISTORY/);
 assert.throws(()=>insert.run('m3','x','a',b.admin_unit_id,b.id,'2027-01-01',null,'foreign'),/BOUNDARY|FOREIGN|INACTIVE/);
 const mapping=f.sqlite.prepare('INSERT INTO customer_admin_location(id,organization_id,outlet_id,admin_unit_id,boundary_id,method,status,evidence_json,effective_from_date,reviewed_by,reviewed_at,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 mapping.run('l1','o','c',b.admin_unit_id,b.id,'manual','confirmed','{}','2026-01-01','mg','2026-01-01T00:00:00Z','Reviewed synthetic mapping');
 assert.throws(()=>mapping.run('l2','o','c',b.admin_unit_id,b.id,'manual','confirmed','{}','2026-02-01','mg','2026-02-01T00:00:00Z','Overlap'),/CONFLICT/);
 assert.throws(()=>mapping.run('l3','x','c',b.admin_unit_id,b.id,'manual','confirmed','{}','2026-01-01','mg','2026-01-01T00:00:00Z','Foreign'),/CONFLICT|FOREIGN|INVALID/);
 assert.equal((f.sqlite.prepare("SELECT area_id FROM customer_outlet WHERE id='c'").get() as any).area_id,'a');
 f.sqlite.close();
});

test('WEB-063 logical backup retains release hierarchy/geometry manifests and remains an explicitly bounded metadata backup',async()=>{
 const f=harness(),c=collection();let row=await f.create([c]);row=await f.upload(row,c);
 const backup=await f.data(await f.baseReq('POST','/api/recovery/backups',{kind:'logical',reason:'Boundary metadata backup'},undefined,'mg'));
 const manifest=f.sqlite.prepare('SELECT storage_key FROM recovery_manifest WHERE id=?').get(backup.id) as any;
 const raw=f.objects.get(manifest.storage_key)!;const payload=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw));
 assert.equal(payload.schema_version,'0045');assert.equal(payload.tables.admin_boundary_dataset[0].id,row.id);
 assert.equal(payload.tables.admin_boundary_chunk.length,1);assert.equal(payload.tables.admin_boundary.length,1);assert.equal(payload.tables.admin_unit.length,4);
 assert.equal(payload.tables.area_admin_membership.length,0);assert.equal(payload.tables.customer_admin_location.length,0);
 f.sqlite.close();
});
