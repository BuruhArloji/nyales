import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {assertMappings,buildRealPointMappings,DEMO_PREFIX,digest,DIRECTORY_DATASET_ID,LOCATION_MAPPING_ID,mappingSql,selectionPayload,sqlValue,type CustomerRow,type LocationMapping} from './bekasi-real-point-mapping';

const ROOT=process.cwd(),CONFIG=resolve(ROOT,'wrangler.staging.generated.json');
const APPLY=process.argv.includes('--apply'),REMOTE=process.argv.includes('--remote');
const EXPECTED_ACCOUNT='54386b392928d9dcd226ad9e7fff5d79',EXPECTED_DB='6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe';
function assertStaging(){
 if(!REMOTE)throw Error('REMOTE_FLAG_REQUIRED');
 const c=JSON.parse(readFileSync(CONFIG,'utf8'));
 if(c.name!=='nyales-staging'||c.vars?.APP_ENV!=='staging'||c.account_id!==EXPECTED_ACCOUNT||!c.d1_databases?.some((d:any)=>d.database_name==='nyales-staging'&&d.database_id===EXPECTED_DB)||process.env.CF_ACCOUNT_ID!==EXPECTED_ACCOUNT||process.env.CF_D1_DATABASE_ID!==EXPECTED_DB)throw Error('EXACT_STAGING_TARGET_REQUIRED');
 if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('STAGING_CREDENTIAL_REQUIRED');
}
function wrangler(args:string[]){
 try{return execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config',CONFIG,...args],{cwd:ROOT,env:process.env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})}
 catch(error){throw Error('STAGING_D1_COMMAND_FAILED_EXIT_'+String((error as {status?:number}).status??'UNKNOWN'))}
}
function resultRows(value:any):any[]|null{
 if(Array.isArray(value)){for(const item of value){const result=resultRows(item);if(result)return result}}
 else if(value&&typeof value==='object'){if(Array.isArray(value.results))return value.results;for(const item of Object.values(value)){const result=resultRows(item);if(result)return result}}
 return null;
}
function query(sql:string){
 const text=wrangler(['--json','--command',sql]);let parsed:any;
 try{parsed=JSON.parse(text.trim())}catch{throw Error('STAGING_D1_JSON_INVALID')}
 const rows=resultRows(parsed);if(!rows)throw Error('STAGING_D1_RESULTS_INVALID');return rows;
}
function one(sql:string){const row=query(sql)[0];if(!row)throw Error('STAGING_D1_ROW_MISSING');return row}
function businessSignature(org:string){const q=sqlValue(org);return one(`SELECT
 (SELECT COUNT(*) FROM invoice WHERE organization_id=${q}) invoice_count,
 (SELECT COALESCE(SUM(net_minor),0) FROM invoice WHERE organization_id=${q}) invoice_total,
 (SELECT COALESCE(SUM(version),0) FROM invoice WHERE organization_id=${q}) invoice_versions,
 (SELECT COUNT(*) FROM customer_assignment WHERE organization_id=${q}) assignments,
 (SELECT COUNT(*) FROM target_version WHERE organization_id=${q}) target_versions,
 (SELECT COALESCE(SUM(version),0) FROM target_version WHERE organization_id=${q}) target_version_sum,
 (SELECT COUNT(*) FROM activity WHERE organization_id=${q}) activities,
 (SELECT COUNT(*) FROM visit_event WHERE organization_id=${q}) visit_events`)}
function customers(org:string){return query(`SELECT * FROM customer_outlet WHERE organization_id=${sqlValue(org)} ORDER BY id`) as CustomerRow[]}
function main(){
 if(!APPLY){console.log('Dry-run only. Embed DEMO operations on existing customer point IDs through an audit sidecar. No customer rows or coordinates are written. Use --apply --remote in staging workflow.');return}
 assertStaging();
 const context=one(`SELECT (SELECT COUNT(*) FROM organization) organizations,
 (SELECT id FROM organization ORDER BY id LIMIT 1) organization_id,
 (SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE r.role_code='MANAGEMENT' AND r.effective_from_date<=date('now') AND (r.effective_to_date IS NULL OR r.effective_to_date>date('now')) ORDER BY u.id LIMIT 1) management_id`);
 if(Number(context.organizations)!==1||typeof context.organization_id!=='string'||typeof context.management_id!=='string')throw Error('SINGLE_STAGING_TENANT_REQUIRED');
 const org=context.organization_id,actor=context.management_id,o=sqlValue(org);
 if(!query(`SELECT id FROM master_audit WHERE organization_id=${o} AND resource_type='training_dataset' AND resource_id='bekasi-field-sales-2026-08-10' AND action='seed_applied' AND json_extract(after_json,'$.synthetic')=1 LIMIT 1`).length)throw Error('COMPLETE_BEKASI_DEMO_REQUIRED');
 if(!query(`SELECT id FROM point_directory_dataset WHERE organization_id=${o} AND id=${sqlValue(DIRECTORY_DATASET_ID)} AND status='ready'`).length)throw Error('READY_REAL_DIRECTORY_REQUIRED');
 const before=customers(org),demos=before.filter(row=>row.id.startsWith(DEMO_PREFIX)),sourceRows=before.filter(row=>row.directory_dataset_id===DIRECTORY_DATASET_ID);
 const beforeHash=digest(before),businessBefore=businessSignature(org),mappings=buildRealPointMappings(org,demos,sourceRows);
 const receiptQuery=`SELECT resource_id,after_json FROM master_audit WHERE organization_id=${o} AND resource_type='demo_operation_point_link' AND action='operation_point_link_selected' AND id LIKE ${sqlValue(LOCATION_MAPPING_ID+':%')} ORDER BY resource_id`;
 const receipts=query(receiptQuery),stored=new Map<string,LocationMapping>();
 for(const receipt of receipts){const payload=JSON.parse(receipt.after_json);if(payload.mapping_id!==LOCATION_MAPPING_ID||payload.synthetic_activity!==true||payload.existing_point_overlay!==true||payload.demo_customer_id!==receipt.resource_id||stored.has(receipt.resource_id))throw Error('INVALID_EXISTING_LINK_RECEIPT');const {mapping_id,synthetic_activity,existing_point_overlay,...mapping}=payload;stored.set(receipt.resource_id,mapping as LocationMapping)}
 for(const mapping of mappings){const previous=stored.get(mapping.demo_customer_id);if(previous&&digest(previous)!==digest(mapping))throw Error('FROZEN_OPERATION_POINT_LINK_WOULD_CHANGE')}
 if(stored.size>200)throw Error('EXCESS_OPERATION_POINT_LINKS');
 assertMappings(mappings,org,demos,sourceRows);
 const pending=mappings.filter(mapping=>!stored.has(mapping.demo_customer_id));
 console.log(JSON.stringify({phase:'preflight',target:'nyales-staging',linked_demo_customers:200,existing_source_points:200,kota_links:100,kabupaten_links:100,source_directory_customers:sourceRows.length,customer_rows_preserved:before.length,pending_links:pending.length,additional_map_points:0,customer_updates:0,coordinate_copies:0}));
 const directory=mkdtempSync(join(tmpdir(),'nyales-existing-point-overlay-'));
 try{
  for(let index=0;index<pending.length;index+=10){
   const chunk=pending.slice(index,index+10),path=join(directory,`links-${String(index/10+1).padStart(3,'0')}.sql`),sql=chunk.map(mapping=>mappingSql(mapping,org,actor,new Date().toISOString())).join('\n\n')+'\n';
   const syntax=sql.replace(/'(?:''|[^'])*'/g,"''");
   if(Buffer.byteLength(sql)>128*1024||/\b(?:UPDATE|DELETE|DROP|ALTER)\b/i.test(syntax))throw Error('LINK_BATCH_MUST_BE_INSERT_ONLY');
   writeFileSync(path,sql,{encoding:'utf8',mode:0o600});wrangler(['--file',path]);
   console.log(`Staging existing-point operation links stored: ${Math.min(index+10,pending.length)}/${pending.length}.`);
  }
 }finally{rmSync(directory,{recursive:true,force:true})}
 const after=customers(org);
 if(digest(after)!==beforeHash)throw Error('CUSTOMER_CONTENT_CHANGED');
 if(digest(businessSignature(org))!==digest(businessBefore))throw Error('BUSINESS_SIGNATURE_CHANGED');
 assertMappings(mappings,org,after.filter(row=>row.id.startsWith(DEMO_PREFIX)),after.filter(row=>row.directory_dataset_id===DIRECTORY_DATASET_ID));
 const storedAfter=query(receiptQuery);
 if(storedAfter.length!==200||storedAfter.some(row=>{const mapping=mappings.find(m=>m.demo_customer_id===row.resource_id);return !mapping||digest(JSON.parse(row.after_json))!==digest(selectionPayload(mapping))}))throw Error('LINK_RECEIPT_RECONCILIATION_FAILED');
 const summary={mapping_id:LOCATION_MAPPING_ID,synthetic:1,demo:true,linked_customer_count:200,source_point_count:200,additional_map_points:0,customer_updates:0,coordinate_copies:0,source_point_identity_preserved:true,source_dataset_id:DIRECTORY_DATASET_ID,source_directory_customer_count:sourceRows.length,kota_count:100,kabupaten_count:100,source_coordinates_field_verified:false,demo_customer_coordinates:'unchanged_missing',existing_point_overlay:true,no_actual_visit_gps:true,mapping_sha256:digest(mappings),all_customers_sha256:beforeHash,customer_row_count:before.length,selection_method:'Existing point IDs: 10 longitude bands x 10 latitude quantiles per source area; no new coordinates or pins',business_unchanged:true};
 const id=LOCATION_MAPPING_ID+':applied';
 wrangler(['--command',`INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) SELECT ${[id,org,actor,'training_dataset','bekasi-field-sales-2026-08-10','operation_point_overlay_applied',new Date().toISOString(),JSON.stringify({customer_row_count:before.length,all_customers_sha256:beforeHash}),JSON.stringify(summary)].map(sqlValue).join(',')} WHERE NOT EXISTS(SELECT 1 FROM master_audit WHERE id=${sqlValue(id)});`]);
 const manifest=one(`SELECT after_json FROM master_audit WHERE organization_id=${o} AND id=${sqlValue(id)}`);
 if(digest(JSON.parse(manifest.after_json))!==digest(summary))throw Error('OVERLAY_MANIFEST_MISMATCH');
 console.log(JSON.stringify({status:pending.length?'applied':'already_applied',...summary,all_customer_rows_unchanged:true,production_touched:false}));
}
try{main()}catch(error){console.error(error instanceof Error?error.message:'OVERLAY_LINK_FAILED');process.exitCode=1}
