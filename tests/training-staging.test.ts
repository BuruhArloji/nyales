import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStagingTrainingPackage,validateStagingTrainingPackage,type StagingInventory} from '../scripts/training-staging';
import {buildTrainingPackage} from '../scripts/training-data-package';
import {validateTrainingApplyEnvironment} from '../scripts/apply-training-staging';
import {readFileSync} from 'node:fs';

function inventory():StagingInventory{return{organizationId:'pilot-org',managementId:'pilot-manager',month:'2026-11',asOf:'2026-11-04',capturedAt:'2026-11-04T00:00:00Z',unusedConfirmed:true,areas:[{id:'maps-area-bekasi-kota',organization_id:'pilot-org',name:'Kota Bekasi',status:'active'},{id:'maps-area-bekasi-kab',organization_id:'pilot-org',name:'Kabupaten Bekasi',status:'active'}],points:Array.from({length:20},(_,n)=>({id:'imported-'+String(n).padStart(3,'0'),organization_id:'pilot-org',area_id:n%2?'maps-area-bekasi-kab':'maps-area-bekasi-kota',name:'Warung Bu Sari '+n,address:'Alamat asli '+n,latitude_e7:-62000000+n,longitude_e7:1070000000+n,directory_dataset_id:'source-directory',coordinate_status:'unverified',record_status:'active',merged_into_id:null})),products:[],approvedTargets:[{id:'existing-target',channel:'field',period_start:'2026-11-01',period_end:'2026-11-30'}]};}

test('staging package references original imported masters and keeps conflicting targets unapproved',()=>{
 const input=inventory(),before=JSON.stringify(input),bundle=buildStagingTrainingPackage(input),check=validateStagingTrainingPackage(input,bundle);
 assert.equal(JSON.stringify(input),before);assert.equal(check.customer_masters,'unchanged');assert.equal(check.idempotent,true);assert.ok(bundle.manifest.deferred_target_versions.length>0);
 for(const table of ['organization','customer_outlet','area','branch','work_calendar','customer_source_coverage','customer_tier_rule'])assert.equal(bundle.rows[table],undefined,table);
 assert.ok(bundle.rows.invoice.every(i=>input.points.some(p=>p.id===i.outlet_id)));assert.ok(bundle.rows.customer_assignment.every(a=>input.points.find(p=>p.id===a.outlet_id)!.area_id===a.area_id));
 assert.ok(bundle.rows.incentive_statement.every(s=>s.status==='prepared'&&!s.finalized_by));assert.ok(bundle.rows.incentive_statement.some(s=>JSON.parse(String(s.review_flags_json)).includes('TARGET_NOT_APPROVED')));
 assert.ok(bundle.rows.visit_event.every(e=>e.latitude_e7===null&&e.longitude_e7===null));assert.ok(bundle.rows.call_result.every(r=>r.connection_evidence==='manual_unverified'));
 assert.ok(!bundle.sql.includes('INSERT INTO customer_outlet'));assert.ok(!bundle.sql.includes('DELETE '));assert.ok(!bundle.sql.includes('UPDATE customer'));
 assert.ok(bundle.rows.invoice.every(i=>!String(i.id).includes('demo-org')&&String(i.source_system)===bundle.manifest.dataset));
 for(const run of bundle.rows.calculation_run){const inputs=JSON.parse(String(run.inputs_json));assert.equal(inputs.sources.reduce((a:number,r:any)=>a+r.net_minor,0),inputs.actual_minor);assert.ok(inputs.sources.every((s:any)=>bundle.rows.invoice.some(i=>i.id===s.id&&i.source_invoice_id===s.source_invoice_id)));}
});

test('existing dimensional SKU is reused despite different codes; absent variant gets an unused short SKU',()=>{
 const input=inventory(),local=buildTrainingPackage({month:'2026-11',asOf:'2026-11-04',customerCount:20}),product=local.rows.product[0];input.products=[{...product,id:'existing-product',organization_id:input.organizationId,product_group_id:'existing-group',group_code:'EXISTING',status:'active'}];
 const bundle=buildStagingTrainingPackage(input);assert.equal(bundle.manifest.existing_products_reused,1);assert.ok(!bundle.rows.product.some(p=>p.sku===product.sku));assert.ok(!bundle.rows.product_price.some(p=>p.product_id==='existing-product'));assert.ok(bundle.rows.invoice_line.some(l=>l.product_id==='existing-product'&&l.product_group_id_snapshot==='existing-group'));validateStagingTrainingPackage(input,bundle);
 input.products[0].sku='1034';const reordered=buildStagingTrainingPackage(input);assert.ok(reordered.rows.invoice_line.some(l=>l.product_id==='existing-product'&&l.sku_snapshot==='1034'));assert.ok(reordered.rows.sales_order.some(o=>JSON.parse(String(o.lines_json)).some((l:any)=>l.product_id==='existing-product'&&l.sku_snapshot==='1034')));validateStagingTrainingPackage(input,reordered);
 input.products[0].flavour='Different';const variant=buildStagingTrainingPackage(input);assert.equal(variant.manifest.existing_products_reused,0);assert.ok(variant.rows.product.every(p=>/^\d{4}$/.test(String(p.sku))&&p.sku!=='1034'));validateStagingTrainingPackage(input,variant);
});

test('GitHub data workflow and runner require exact staging target and default to no writes',()=>{
 const env={CF_ACCOUNT_ID:'54386b392928d9dcd226ad9e7fff5d79',CF_D1_DATABASE_ID:'6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe',TRAINING_MONTH:'2026-11',TRAINING_AS_OF:'2026-11-04',TRAINING_APPLY:'false'},config={name:'nyales-staging',account_id:env.CF_ACCOUNT_ID,vars:{APP_ENV:'staging'},d1_databases:[{database_id:env.CF_D1_DATABASE_ID,database_name:'nyales-staging'}]};
 assert.equal(validateTrainingApplyEnvironment(env,config).apply,false);assert.equal(validateTrainingApplyEnvironment({...env,TRAINING_APPLY:'true'},config).apply,true);assert.throws(()=>validateTrainingApplyEnvironment({...env,TRAINING_APPLY:undefined},config),/EXPLICIT/);assert.throws(()=>validateTrainingApplyEnvironment(env,{...config,name:'nyales-production'}),/EXACT_STAGING/);
 const workflow=readFileSync('.github/workflows/training-staging.yml','utf8');assert.match(workflow,/default: false/);assert.match(workflow,/TRAINING_APPLY: \$\{\{ inputs.apply \}\}/);assert.match(workflow,/EXACT_STAGING_ACCOUNT_AND_DATABASE_REQUIRED/);assert.match(workflow,/scripts\/apply-training-staging.ts --remote/);assert.ok(!workflow.includes('wrangler deploy'));assert.ok(!workflow.includes('migrations apply'));assert.ok(!workflow.includes('r2 object put'));assert.match(workflow,/path: test-results\/training-staging-receipt.json/);
});

test('unverified tenant, source state and foreign geography are rejected before SQL generation',()=>{
 assert.throws(()=>buildStagingTrainingPackage({...inventory(),unusedConfirmed:false as true}),/VERIFIED/);
 const input=inventory();input.points[0].organization_id='other';assert.throws(()=>buildStagingTrainingPackage(input),/PILOT_CUSTOMER/);
 const other=inventory();other.areas[0].name='Kota Bogor';assert.throws(()=>buildStagingTrainingPackage(other),/ONLY_BEKASI/);
});

test('SKU remapping is simultaneous and cannot rewrite names or cascade chained code mappings',()=>{
 const input=inventory(),local=buildTrainingPackage({month:input.month,asOf:input.asOf,customerCount:20});input.points[0].name='Warung 1001 1002';input.products=local.rows.product.slice(0,3).map((p,n)=>({...p,id:'catalog-'+n,organization_id:input.organizationId,sku:String(1002+n),product_group_id:'existing-group',group_code:'EXISTING',status:'active'}));
 const bundle=buildStagingTrainingPackage(input);
 for(const line of bundle.rows.invoice_line){const product=input.products.find(p=>p.id===line.product_id)??bundle.rows.product.find(p=>p.id===line.product_id)!;assert.equal(line.sku_snapshot,product.sku);}
 for(const order of bundle.rows.sales_order)for(const line of JSON.parse(String(order.lines_json))){const product=input.products.find(p=>p.id===line.product_id)??bundle.rows.product.find(p=>p.id===line.product_id)!;assert.equal(line.sku_snapshot,product.sku);}
 assert.equal(input.points[0].name,'Warung 1001 1002');validateStagingTrainingPackage(input,bundle);
});
