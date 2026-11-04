import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentAssignmentSql,fixtureRows,linkedActivitiesSql,sourceRowsDigest,validateBeverageLinks,validateCurrentAssignments,validateDemoRows} from '../scripts/audit-existing-beverage-overlay';

const org='org';
function fixture(){
 const rows:any[]=[];const audits:any[]=[];
 for(let i=1;i<=200;i++)rows.push({id:`bekasi-demo-customer-${String(i).padStart(3,'0')}`,organization_id:org,outlet_type:'retail_demo',directory_dataset_id:null,latitude_e7:null,longitude_e7:null,coordinate_status:'missing',record_status:'active',merged_into_id:null,area_id:i<=100?'bekasi-demo-area-kota':'bekasi-demo-area-kabupaten'});
 for(let i=1;i<=800;i++){
  const src={id:`source-${i}`,external_code:String(700000+i),organization_id:org,outlet_type:'retail',directory_dataset_id:'maps-warung-20261028',latitude_e7:-62000000-i,longitude_e7:1069000000+i,coordinate_status:'unverified',record_status:'active',merged_into_id:null,area_id:i<=400?'maps-area-bekasi-kota':'maps-area-bekasi-kab',name:`Source ${i}`,address:`Address ${i}`,version:3};
  const demo={id:`beverage-demo-v1-customer-${i}`,organization_id:org,outlet_type:'retail_demo',directory_dataset_id:null,latitude_e7:null,longitude_e7:null,coordinate_status:'missing',record_status:'active',merged_into_id:null,area_id:i<=400?'bekasi-demo-area-kota':'bekasi-demo-area-kabupaten'};
  rows.push(src,demo);audits.push({organization_id:org,resource_id:demo.id,resource_type:'demo_operation_point_link',action:'operation_point_link_selected',before_json:JSON.stringify({id:demo.id}),after_json:JSON.stringify({mapping_id:'beverage-demo-v1',synthetic_activity:true,existing_point_overlay:true,demo_customer_id:demo.id,demo_area_id:demo.area_id,source_customer_id:src.id,source_external_code:String(700000+i),source_dataset_id:src.directory_dataset_id,source_area_id:src.area_id,source_name:src.name,source_address:src.address,source_latitude_e7:src.latitude_e7,source_longitude_e7:src.longitude_e7,source_version:src.version,source_coordinate_status:src.coordinate_status})});
 }
 return {rows,audits};
}

test('validates exactly 800 beverage links alongside 200 existing overlay rows',()=>{
 const f=fixture(),links=validateBeverageLinks(f.rows,f.audits,org);assert.equal(links.length,800);assert.equal(validateDemoRows(f.rows,links,org),true);assert.equal(new Set(links.map(x=>x.source_customer_id)).size,800);
});

test('fixtureRows is an available 800-plus-200 synthetic fixture and digest is order-independent',()=>{
 const rows=fixtureRows();assert.ok(rows.length>=1800);const a=sourceRowsDigest(rows),b=sourceRowsDigest([...rows].reverse());assert.equal(a,b);
});

test('digest uses SQLite BINARY id order rather than localeCompare order',()=>{
 const rows=[{id:'a10',value:1},{id:'a2',value:2},{id:'A1',value:3}];
 assert.equal(sourceRowsDigest(rows),sourceRowsDigest([rows[1],rows[2],rows[0]]));
});

test('activity relationship joins order id and work plan through sales_order',()=>{
 const sql=linkedActivitiesSql(org);
 assert.match(sql,/external_reference=i\.external_invoice_id/);
 assert.match(sql,/json_extract\(a\.metadata_json,'\$\.order_id'\)=o\.id/);
 assert.match(sql,/json_extract\(a\.metadata_json,'\$\.work_plan_id'\)=p\.id/);
 assert.match(sql,/p\.customer_id=i\.outlet_id.*p\.user_id=i\.rep_id/);
 assert.doesNotMatch(sql,/json_extract\(a\.metadata_json,'\$\.order_id'\)=i\.external_invoice_id/);
});

test('rejects source external-code, coordinate-status, resource, and before-id mismatches',()=>{
 for(const mutate of [
  (f:any)=>f.audits[0].after_json=JSON.stringify({...JSON.parse(f.audits[0].after_json),source_external_code:'wrong'}),
  (f:any)=>f.audits[0].after_json=JSON.stringify({...JSON.parse(f.audits[0].after_json),source_coordinate_status:'verified'}),
  (f:any)=>f.audits[0].resource_id='wrong-resource',
  (f:any)=>f.audits[0].before_json=JSON.stringify({id:'wrong-before'})
 ]) { const f=fixture();mutate(f);assert.equal(validateBeverageLinks(f.rows,f.audits,org).length,0); }
});

test('current assignment helper requires one field assignment at audit date',()=>{
 const ids=Array.from({length:1000},(_,i)=>`demo-${i}`),reps=['rep-1','rep-2'];
 const rows=ids.map((outlet_id,i)=>({outlet_id,rep_id:reps[i%2]}));
 assert.equal(validateCurrentAssignments(rows,ids,reps),true);
 assert.equal(validateCurrentAssignments([...rows,{outlet_id:ids[0],rep_id:'rep-1'}],ids,reps),false);
 assert.match(currentAssignmentSql(org,ids),/ca\.channel='field'/);
 assert.match(currentAssignmentSql(org,ids),/2026-11-04/);
});

test('rejects source drift, duplicate source/demo, missing link, wrong outlet type, and real rep',()=>{
 const base=fixture();
 const drift=fixture();const src=drift.rows.find(r=>r.id==='source-1');src.address='changed';assert.equal(validateBeverageLinks(drift.rows,drift.audits,org).length,0);
 const duplicate=fixture();duplicate.audits[1].after_json=duplicate.audits[0].after_json;assert.equal(validateBeverageLinks(duplicate.rows,duplicate.audits,org).length,0);
 const missing=fixture();missing.audits.pop();assert.equal(validateBeverageLinks(missing.rows,missing.audits,org).length,0);
 const wrongType=fixture();wrongType.rows.find(r=>r.id==='beverage-demo-v1-customer-1').outlet_type='retail';assert.equal(validateBeverageLinks(wrongType.rows,wrongType.audits,org).length,0);
 const realRep=fixture();realRep.rows.find(r=>r.id==='beverage-demo-v1-customer-1').field_rep_id='real-sales-rep';const links=validateBeverageLinks(realRep.rows,realRep.audits,org);assert.equal(validateDemoRows(realRep.rows,links,org),false);assert.equal(base.rows.length,1800);
});
