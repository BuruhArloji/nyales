import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {buildBekasiPortfolio,toInsertStatements} from '../scripts/bekasi-portfolio-data';
import {assertMappings,buildRealPointMappings,DEMO_PREFIX,digest,DIRECTORY_DATASET_ID,LOCATION_GROUPS,mappingSql,selectionPayload,type CustomerRow} from '../scripts/bekasi-real-point-mapping';

function fixture(){
 const {sqlite}=database();
 sqlite.exec("PRAGMA foreign_keys=ON;INSERT INTO organization(id,name) VALUES('org-real-map','Fixture organization');INSERT INTO app_user(id,organization_id,name,status,created_at) VALUES('mapping-manager','org-real-map','Fixture manager','active','2026-01-01T00:00:00Z');");
 for(const group of LOCATION_GROUPS){sqlite.prepare('INSERT INTO area(id,organization_id,name) VALUES(?,?,?)').run(group.demoArea,'org-real-map',group.demoArea);sqlite.prepare('INSERT INTO area(id,organization_id,name) VALUES(?,?,?)').run(group.sourceArea,'org-real-map',group.sourceArea)}
 sqlite.prepare('INSERT INTO point_directory_dataset(id,organization_id,name,source_reference,source_sha256,storage_key,storage_sha256,byte_count,reference_count,customer_expected_count,held_count,created_by,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(DIRECTORY_DATASET_ID,'org-real-map','Unit fixture only','Synthetic unit-test fixture, never a production location source','a'.repeat(64),'fixture/source','b'.repeat(64),1,0,240,0,'mapping-manager','2026-01-01T00:00:00Z','ready');
 const portfolio=buildBekasiPortfolio({organizationId:'org-real-map',managementId:'mapping-manager'});
 for(const sql of toInsertStatements({...portfolio,rows:{customer_outlet:portfolio.rows.customer_outlet}}))sqlite.exec(sql);
 const insert=sqlite.prepare('INSERT INTO customer_outlet(id,organization_id,area_id,external_code,name,address,latitude_e7,longitude_e7,coordinate_status,directory_dataset_id,transaction_history_unverified,location_note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const [groupIndex,group] of LOCATION_GROUPS.entries())for(let x=0;x<12;x++)for(let y=0;y<10;y++){
  const id=`fixture-source-${groupIndex}-${String(x).padStart(2,'0')}-${String(y).padStart(2,'0')}`;
  insert.run(id,'org-real-map',group.sourceArea,'FIXTURE-'+id,'Fixture source '+id,'Unit-test address '+id,-62_000_000-y*100_000-groupIndex*1_000_000,1_069_200_000+x*50_000+groupIndex*2_000_000,'unverified',DIRECTORY_DATASET_ID,1,'Fixture coordinates, never a real customer claim');
 }
 const all=()=>sqlite.prepare('SELECT * FROM customer_outlet ORDER BY id').all() as CustomerRow[];
 const demos=()=>all().filter(r=>r.id.startsWith(DEMO_PREFIX));
 const sources=()=>all().filter(r=>r.directory_dataset_id===DIRECTORY_DATASET_ID);
 return{sqlite,all,demos,sources};
}

test('Bekasi operations link to exactly 200 existing source point IDs without writing any customer row or coordinate',()=>{
 const f=fixture();
 try{
  const before=f.all(),allHash=digest(before),sourceBefore=f.sources(),demoBefore=f.demos();
  const mappings=buildRealPointMappings('org-real-map',demoBefore,sourceBefore);
  assert.equal(mappings.length,200);assert.equal(new Set(mappings.map(m=>m.source_customer_id)).size,200);
  assert.equal(new Set(mappings.map(m=>`${m.source_latitude_e7},${m.source_longitude_e7}`)).size,200);
  assert.equal(mappings.filter(m=>m.demo_area_id==='bekasi-demo-area-kota').length,100);
  assert.equal(mappings.filter(m=>m.demo_area_id==='bekasi-demo-area-kabupaten').length,100);
  assert.deepEqual(buildRealPointMappings('org-real-map',[...demoBefore].reverse(),[...sourceBefore].reverse()),mappings);
  assertMappings(mappings,'org-real-map',demoBefore,sourceBefore);
  for(const mapping of mappings){const sql=mappingSql(mapping,'org-real-map','mapping-manager','2026-11-03T06:00:00Z');assert.doesNotMatch(sql,/^\s*(?:UPDATE|DELETE|ALTER|DROP)\b/m);f.sqlite.exec(sql)}
  assert.equal(digest(f.all()),allHash);assert.deepEqual(f.all(),before);
  assert.ok(f.demos().every(d=>d.latitude_e7===null&&d.longitude_e7===null&&d.coordinate_status==='missing'&&d.version===1&&d.directory_dataset_id===null));
  const receipts=f.sqlite.prepare("SELECT resource_id,after_json FROM master_audit WHERE resource_type='demo_operation_point_link' ORDER BY resource_id").all() as Array<{resource_id:string;after_json:string}>;
  assert.equal(receipts.length,200);
  for(const receipt of receipts){const mapping=mappings.find(m=>m.demo_customer_id===receipt.resource_id)!;assert.deepEqual(JSON.parse(receipt.after_json),selectionPayload(mapping));assert.ok(sourceBefore.some(s=>s.id===mapping.source_customer_id))}
  for(const mapping of mappings)f.sqlite.exec(mappingSql(mapping,'org-real-map','mapping-manager','2026-11-03T06:01:00Z'));
  assert.equal(digest(f.all()),allHash);
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='demo_operation_point_link'").get() as {n:number}).n,200);
  assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{f.sqlite.close()}
});

test('existing-point links reject incomplete/duplicate/foreign inputs and changed source or DEMO records',()=>{
 const f=fixture();
 try{
  const demos=f.demos(),sources=f.sources();
  assert.throws(()=>buildRealPointMappings('org-real-map',demos.slice(1),sources),/EXACT_200/);
  assert.throws(()=>buildRealPointMappings('org-real-map',demos,[...sources,sources[0]]),/DUPLICATE_SOURCE_IDS/);
  assert.throws(()=>buildRealPointMappings('org-real-map',demos,sources.filter(s=>s.area_id!==LOCATION_GROUPS[0].sourceArea)),/INSUFFICIENT_UNIQUE/);
  assert.throws(()=>buildRealPointMappings('org-real-map',demos,sources.map(s=>({...s,organization_id:'foreign-org'}))),/INSUFFICIENT_UNIQUE/);
  assert.throws(()=>buildRealPointMappings('org-real-map',demos,sources.map(s=>({...s,latitude_e7:null}))),/INSUFFICIENT_UNIQUE/);
  assert.throws(()=>buildRealPointMappings('org-real-map',demos.map((d,i)=>i===0?{...d,version:2}:d),sources),/DEMO_BASELINE_CHANGED/);
  const mappings=buildRealPointMappings('org-real-map',demos,sources);
  assert.throws(()=>assertMappings(mappings.slice(1),'org-real-map',demos,sources),/INVALID_MAPPING_CARDINALITY/);
  assert.throws(()=>assertMappings(mappings,'org-real-map',demos,sources.map(s=>s.id===mappings[0].source_customer_id?{...s,version:s.version+1}:s)),/MAPPING_SOURCE_CHANGED/);
  assert.throws(()=>assertMappings(mappings,'org-real-map',demos.map(d=>d.id===mappings[0].demo_customer_id?{...d,name:'Modified by operator'}:d),sources),/DEMO_CHANGED_SINCE_MAPPING/);
 }finally{f.sqlite.close()}
});

test('audit-only operation links resume partial batches and refuse stale sources or another tenant without customer writes',()=>{
 const f=fixture();
 try{
  const mappings=buildRealPointMappings('org-real-map',f.demos(),f.sources()),beforeHash=digest(f.all());
  for(const m of mappings.slice(0,20))f.sqlite.exec(mappingSql(m,'org-real-map','mapping-manager','2026-11-03T06:00:00Z'));
  for(const m of mappings)f.sqlite.exec(mappingSql(m,'org-real-map','mapping-manager','2026-11-03T06:01:00Z'));
  assert.equal(digest(f.all()),beforeHash);
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='demo_operation_point_link'").get() as {n:number}).n,200);
 }finally{f.sqlite.close()}
 const staleFixture=fixture();
 try{
  const mappings=buildRealPointMappings('org-real-map',staleFixture.demos(),staleFixture.sources()),stale=mappings[0];
  staleFixture.sqlite.prepare('UPDATE customer_outlet SET version=version+1 WHERE id=?').run(stale.source_customer_id);
  const before=digest(staleFixture.all());
  staleFixture.sqlite.exec(mappingSql(stale,'org-real-map','mapping-manager','2026-11-03T06:01:00Z'));
  staleFixture.sqlite.exec(mappingSql(mappings[1],'foreign-org','mapping-manager','2026-11-03T06:01:00Z'));
  assert.equal(digest(staleFixture.all()),before);
  assert.equal((staleFixture.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='demo_operation_point_link'").get() as {n:number}).n,0);
 }finally{staleFixture.sqlite.close()}
});
