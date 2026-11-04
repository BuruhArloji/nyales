import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {buildCandidatePayload,candidateSql,sourceSnapshotDigest,type CandidateInput} from '../scripts/outlet-role-candidate-data';

function fixture(){
 const {sqlite}=database();
 sqlite.exec("INSERT INTO organization(id,name) VALUES('tenant-a','Fixture tenant')");
 sqlite.exec("INSERT INTO app_user(id,organization_id,name,status,created_at) VALUES('fixture-actor','tenant-a','Fixture actor','active','2026-01-01T00:00:00Z')");
 sqlite.exec("INSERT INTO area(id,organization_id,name) VALUES('area-1','tenant-a','Fixture area')");
 sqlite.exec("INSERT INTO point_directory_dataset(id,organization_id,name,source_reference,source_sha256,storage_key,storage_sha256,byte_count,reference_count,customer_expected_count,held_count,created_by,created_at,status) VALUES('dataset-α','tenant-a','Fixture directory','Unit fixture','"+'a'.repeat(64)+"','fixture/source','"+'b'.repeat(64)+"',1,1,1,0,'fixture-actor','2026-01-01T00:00:00Z','ready')");
 const insert=sqlite.prepare(`INSERT INTO customer_outlet
  (id,organization_id,area_id,external_code,name,address,latitude_e7,longitude_e7,
   coordinate_status,directory_dataset_id,transaction_history_unverified,location_note,outlet_type,version)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 const customer={id:'customer-1',organization_id:'tenant-a',area_id:'area-1',external_code:'EXT-1',name:"Toko O'Reilly 東京",address:'Jalan “Unicode”',latitude_e7:null,longitude_e7:null,coordinate_status:'unverified',directory_dataset_id:'dataset-α',transaction_history_unverified:1,location_note:'fixture',outlet_type:"label 'exact' / 測試",version:7};
 insert.run(customer.id,customer.organization_id,customer.area_id,customer.external_code,customer.name,customer.address,customer.latitude_e7,customer.longitude_e7,customer.coordinate_status,customer.directory_dataset_id,customer.transaction_history_unverified,customer.location_note,customer.outlet_type,customer.version);
 return {sqlite,customer,insert};
}
function input(customer:Record<string,unknown>,overrides:Partial<CandidateInput>={}):CandidateInput{return {customer:customer as CandidateInput['customer'],candidate_role:'wholesale',cohort:'external_directory',confidence:'low',confidence_basis:'qualitative source-label heuristic only',status:'pending_sales_confirmation',evidence_reason:'candidate only; requires sales confirmation',...overrides};}
function separateCohortCustomer(id:string,outlet_type:string){return{id,organization_id:'tenant-a',area_id:'area-1',external_code:id,name:id,address:'',latitude_e7:null,longitude_e7:null,coordinate_status:'missing',directory_dataset_id:null,transaction_history_unverified:0,location_note:'',outlet_type,version:1}}

test('candidate payload is unverified, minimizes copied data, and hashes the full source row',()=>{
 const f=fixture();try{
  const before=f.sqlite.prepare('SELECT * FROM customer_outlet ORDER BY id').all();
  const p=buildCandidatePayload(input(f.customer),'outlet-role-source-label-reproducible-v2','run-α');
  assert.equal(p.verified,false);assert.equal(p.needs_sales_confirmation,true);
  assert.equal(p.source_snapshot_sha256,sourceSnapshotDigest(f.customer));
  assert.equal(p.source_outlet_type,f.customer.outlet_type);assert.equal(p.source_customer_version,f.customer.version);assert.equal(p.source_dataset_id,f.customer.directory_dataset_id);
  assert.equal('source_customer' in p,false);assert.equal(JSON.stringify(p).includes(String(f.customer.name)),false);assert.equal(p.status,'pending_sales_confirmation');
  f.sqlite.exec(candidateSql(input(f.customer),'outlet-role-source-label-reproducible-v2','run-α','actor','2026-11-04T00:00:00Z'));
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_outlet ORDER BY id').all(),before);
  const row=f.sqlite.prepare("SELECT * FROM master_audit WHERE resource_type='outlet_role_candidate'").get() as {id:string;after_json:string};
  const payload=JSON.parse(row.after_json);assert.equal(payload.verified,false);assert.equal(payload.source_outlet_type,f.customer.outlet_type);assert.equal(payload.needs_sales_confirmation,true);
  assert.equal(row.id,'outlet-role-candidate:outlet-role-source-label-reproducible-v2:customer-1');
 }finally{f.sqlite.close()}
});

test('exact full-row source guards reject foreign, stale, or changed customer content',()=>{
 const f=fixture();try{
  const base=input(f.customer);f.sqlite.exec(candidateSql(base,'rule-v2','run-1','actor','now'));
  const before=f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='outlet_role_candidate'").get() as {n:number};
  for(const [customer,run] of [
   [{...f.customer,organization_id:'tenant-b'},'foreign'],
   [{...f.customer,version:8},'version'],
   [{...f.customer,outlet_type:'different'},'label'],
   [{...f.customer,directory_dataset_id:'other-dataset'},'dataset'],
   [{...f.customer,name:'Changed name without version bump'},'full-row-name'],
   [{...f.customer,address:'Changed address without version bump'},'full-row-address']
  ] as Array<[Record<string,unknown>,string]>)f.sqlite.exec(candidateSql(input(customer),'rule-v2','run-'+run,'actor','now'));
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='outlet_role_candidate'").get() as {n:number}).n,before.n);
 }finally{f.sqlite.close()}
});

test('same rule version replays idempotently across execution run IDs and non-real cohorts cannot claim roles',()=>{
 const f=fixture();try{
  const base=input(f.customer),version='rule-v2';
  f.sqlite.exec(candidateSql(base,version,'same-run','actor','now'));
  f.sqlite.exec(candidateSql(base,version,'different-run','actor','later'));
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='outlet_role_candidate'").get() as {n:number}).n,1);
  const syntheticRow=separateCohortCustomer('demo-1','retail_demo'),trainingRow=separateCohortCustomer('training-1','');
  for(const customer of [syntheticRow,trainingRow])f.insert.run(customer.id,customer.organization_id,customer.area_id,customer.external_code,customer.name,customer.address,customer.latitude_e7,customer.longitude_e7,customer.coordinate_status,customer.directory_dataset_id,customer.transaction_history_unverified,customer.location_note,customer.outlet_type,customer.version);
  const synthetic=input(syntheticRow,{cohort:'synthetic_demo',candidate_role:null,confidence:'not_applicable',status:'excluded_synthetic'});
  const training=input(trainingRow,{cohort:'training',candidate_role:null,confidence:'not_applicable',status:'training_unclassified'});
  for(const candidate of [synthetic,training]){const p=buildCandidatePayload(candidate,version,'safe-'+candidate.cohort);assert.equal(p.verified,false);assert.equal(p.needs_sales_confirmation,false);f.sqlite.exec(candidateSql(candidate,version,'safe-'+candidate.cohort,'actor','now'));}
  assert.throws(()=>buildCandidatePayload(input(syntheticRow,{cohort:'synthetic_demo',candidate_role:'retail'}),version,'bad'),/NON_EXTERNAL_ROLE_CLAIM_FORBIDDEN/);
  assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='outlet_role_candidate'").get() as {n:number}).n,3);
 }finally{f.sqlite.close()}
});

test('candidate SQL is append-only audit SQL with a complete source snapshot guard',()=>{
 const f=fixture();try{
  const sql=candidateSql(input(f.customer),'rule-v2','run-quoted');
  assert.match(sql,/INSERT INTO master_audit/);assert.match(sql,/NOT EXISTS/);assert.match(sql,/EXISTS\(SELECT 1 FROM customer_outlet/);
  assert.match(sql,/name='Toko O''Reilly 東京'/);assert.match(sql,/address='Jalan “Unicode”'/);
  assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|ALTER|DROP)\b/i);assert.doesNotMatch(sql,/\b(?:invoice|activity|customer_assignment|business_event)\b/i);
 }finally{f.sqlite.close()}
});
