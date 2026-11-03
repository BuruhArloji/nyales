import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {buildBekasiPortfolio,toInsertStatements} from '../scripts/bekasi-portfolio-data';
import {buildRealPointMappings,DEMO_PREFIX,digest,DIRECTORY_DATASET_ID,LOCATION_GROUPS,LOCATION_MAPPING_ID,mappingSql,type CustomerRow} from '../scripts/bekasi-real-point-mapping';
import {applyBekasiOverlay,loadBekasiPointOverlay} from '../src/server/bekasi-point-overlay';

test('staging overlay reads complete SQL fixture metrics on existing IDs with bounded parameters and no customer writes',async()=>{
 const {sqlite,adapter}=database(),org='overlay-integration',actor='overlay-manager';
 try{
  sqlite.exec(`PRAGMA foreign_keys=ON;INSERT INTO organization(id,name) VALUES('${org}','Overlay fixture');INSERT INTO app_user(id,organization_id,name,status,created_at) VALUES('${actor}','${org}','Fixture manager','active','2026-01-01');`);
  const portfolio=buildBekasiPortfolio({organizationId:org,managementId:actor,createdAt:'2026-11-03T01:00:00Z'});
  for(const sql of toInsertStatements(portfolio))sqlite.exec(sql);
  for(const group of LOCATION_GROUPS)sqlite.prepare('INSERT INTO area(id,organization_id,name) VALUES(?,?,?)').run(group.sourceArea,org,'Source fixture area');
  sqlite.prepare('INSERT INTO point_directory_dataset(id,organization_id,name,source_reference,source_sha256,storage_key,storage_sha256,byte_count,reference_count,customer_expected_count,held_count,created_by,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(DIRECTORY_DATASET_ID,org,'Source fixture','Unit test only','a'.repeat(64),'fixture','b'.repeat(64),1,0,240,0,actor,'2026-01-01','ready');
  const insert=sqlite.prepare('INSERT INTO customer_outlet(id,organization_id,area_id,external_code,name,address,latitude_e7,longitude_e7,coordinate_status,directory_dataset_id) VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(const [g,group] of LOCATION_GROUPS.entries())for(let x=0;x<12;x++)for(let y=0;y<10;y++)insert.run(`source-${g}-${x}-${y}`,org,group.sourceArea,`SRC-${g}-${x}-${y}`,`Source fixture ${g}-${x}-${y}`,'Unit fixture address',-62_000_000-y*100_000-g*1_000_000,1_069_200_000+x*50_000+g*2_000_000,'unverified',DIRECTORY_DATASET_ID);
  const all=()=>sqlite.prepare('SELECT * FROM customer_outlet ORDER BY id').all() as CustomerRow[];
  const before=all(),hash=digest(before),mappings=buildRealPointMappings(org,before.filter(r=>r.id.startsWith(DEMO_PREFIX)),before.filter(r=>r.directory_dataset_id===DIRECTORY_DATASET_ID));
  const scoped=before.map(row=>({...row,lat:row.latitude_e7===null?null:row.latitude_e7/1e7,lng:row.longitude_e7===null?null:row.longitude_e7/1e7,field_rep_id:portfolio.rows.customer_assignment.find((a:any)=>a.outlet_id===row.id)?.rep_id as string|undefined,owner:'Synthetic fixture rep',status:'Unknown'}));
  const filters={channel:'field' as const};
  const bounded={prepare:(sql:string)=>{const statement=adapter.prepare(sql);return {bind:(...args:any[])=>{assert.ok(args.length<=10,'Overlay queries must not expand 200 IDs into bound parameters');return statement.bind(...args)}}}} as unknown as D1Database;
  assert.equal((await loadBekasiPointOverlay(bounded,org,scoped,filters,'production')).enabled,false);
  for(const mapping of mappings)sqlite.exec(mappingSql(mapping,org,actor,'2026-11-03T06:00:00Z'));
  assert.equal((await loadBekasiPointOverlay(bounded,org,scoped,filters,'staging')).enabled,false,'Unfinished sidecar must remain invisible');
  sqlite.prepare('INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) VALUES(?,?,?,?,?,?,?,?,?)').run(LOCATION_MAPPING_ID+':applied',org,actor,'training_dataset','bekasi-field-sales-2026-08-10','operation_point_overlay_applied','2026-11-03T06:00:00Z','{}',JSON.stringify({mapping_id:LOCATION_MAPPING_ID,synthetic:1,demo:true,linked_customer_count:200,source_point_count:200,additional_map_points:0}));
  const loaded=await loadBekasiPointOverlay(bounded,org,scoped,filters,'staging');assert.equal(loaded.enabled,true);assert.equal(loaded.links.length,200);
  const sum=(key:string)=>[...loaded.metrics.values()].reduce((total,row)=>total+Number(row[key]||0),0);
  assert.equal(sum('activity_count'),5200);assert.equal(sum('productive_count'),3640);assert.equal(sum('follow_up_count'),780);assert.equal(sum('no_show_count'),780);
  assert.equal(sum('order_count'),1274);assert.equal(sum('invoice_count'),1147);assert.equal(sum('actual_minor'),519250000);
  const overlaid=applyBekasiOverlay(scoped,loaded.links,loaded.metrics,filters);
  assert.equal(overlaid.allCustomers.filter(r=>r.demo_operation_overlay).length,200);
  assert.equal(overlaid.allCustomers.filter(r=>r.lat!==null&&r.lng!==null).length,240,'No synthetic customer may become a new point');
  assert.ok(overlaid.allCustomers.filter(r=>r.demo_operation_overlay).every(r=>r.id.startsWith('source-')));
  assert.equal((await loadBekasiPointOverlay(bounded,org,scoped.filter(r=>r.id.startsWith(DEMO_PREFIX)),filters,'staging')).enabled,false,'A user cannot see an out-of-scope directory source through DEMO operations');
  assert.equal(digest(all()),hash);assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{sqlite.close()}
});
