import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildStagingTrainingPackage,validateStagingTrainingPackage,type StagingInventory,type StagingTrainingPoint} from './training-staging';

const ACCOUNT='54386b392928d9dcd226ad9e7fff5d79',DATABASE='6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe',ORG='3994b80a-d473-476e-97cb-f864f7708000';
type Row=Record<string,any>;
const j=JSON.stringify,sha=(v:unknown)=>createHash('sha256').update(j(v)).digest('hex'),q=(v:unknown)=>"'"+String(v).replaceAll("'","''")+"'";
export function validateTrainingApplyEnvironment(env:NodeJS.ProcessEnv,config:Row){
 if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.account_id!==ACCOUNT||config.d1_databases?.length!==1||config.d1_databases[0].database_id!==DATABASE||config.d1_databases[0].database_name!=='nyales-staging'||env.CF_ACCOUNT_ID!==ACCOUNT||env.CF_D1_DATABASE_ID!==DATABASE)throw Error('EXACT_STAGING_ACCOUNT_AND_DATABASE_REQUIRED');
 if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(env.TRAINING_MONTH??'')||!/^\d{4}-\d{2}-\d{2}$/.test(env.TRAINING_AS_OF??'')||!env.TRAINING_AS_OF?.startsWith(env.TRAINING_MONTH!))throw Error('TRAINING_PERIOD_REQUIRED');
 if(!['true','false'].includes(env.TRAINING_APPLY??''))throw Error('EXPLICIT_TRAINING_APPLY_REQUIRED');
 return{apply:env.TRAINING_APPLY==='true',month:env.TRAINING_MONTH!,asOf:env.TRAINING_AS_OF!};
}

export async function applyTrainingStaging(){
 if(!process.argv.includes('--remote')||process.argv.includes('--apply'))throw Error('WORKFLOW_REMOTE_MODE_AND_EXPLICIT_ENV_REQUIRED');
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8')),options=validateTrainingApplyEnvironment(process.env,config);
 const cli=resolve('node_modules/wrangler/bin/wrangler.js'),run=(args:string[])=>execFileSync(process.execPath,[cli,'d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json',...args],{encoding:'utf8',maxBuffer:15*1024*1024,windowsHide:true});
 const query=(sql:string):Row[]=>JSON.parse(run(['--json','--command',sql])).flatMap((r:Row)=>r.results??[]);
 const orgs=query(`SELECT id FROM organization LIMIT 2`);if(orgs.length!==1||orgs[0].id!==ORG)throw Error('EXPECTED_PILOT_ORGANIZATION_REQUIRED');
 const management=query(`SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=${q(ORG)} AND u.status='active' AND r.role_code='MANAGEMENT' AND r.effective_from_date<=${q(options.asOf)} AND(r.effective_to_date IS NULL OR r.effective_to_date>${q(options.asOf)}) ORDER BY u.id LIMIT 1`)[0];if(!management)throw Error('ACTIVE_MANAGEMENT_REQUIRED');
 const attemptId='training-staging-attempt-'+options.month+'-'+options.asOf,prior=query(`SELECT after_json FROM master_audit WHERE organization_id=${q(ORG)} AND id=${q(attemptId)}`)[0],checkpoint=prior?JSON.parse(prior.after_json):null;
 const areas=query(`SELECT * FROM area WHERE organization_id=${q(ORG)} AND id IN('maps-area-bekasi-kota','maps-area-bekasi-kab') AND status='active' ORDER BY id`);if(areas.length!==2)throw Error('EXISTING_BEKASI_AREAS_REQUIRED');
 const products=query(`SELECT p.*,g.code group_code FROM product p LEFT JOIN product_group g ON g.organization_id=p.organization_id AND g.id=p.product_group_id WHERE p.organization_id=${q(ORG)} ORDER BY p.id LIMIT 500`).filter(p=>!checkpoint||!p.id.startsWith(checkpoint.dataset+'-'));if(products.length===500)throw Error('CATALOG_REQUIRES_EXPLICIT_REVIEW');
 const approvedTargets=query(`SELECT v.id,p.channel,p.period_start,p.period_end FROM target_version v JOIN target_plan p ON p.organization_id=v.organization_id AND p.id=v.target_plan_id WHERE v.organization_id=${q(ORG)} AND v.status='approved' AND v.id NOT LIKE 'training-staging-v1-%' LIMIT 101`);if(approvedTargets.length>100)throw Error('TARGET_INVENTORY_REQUIRES_REVIEW');
 let points:StagingTrainingPoint[];
 const fetchPoints=(ids:string[])=>query(`SELECT c.*,a.name area_name FROM customer_outlet c JOIN area a ON a.organization_id=c.organization_id AND a.id=c.area_id WHERE c.organization_id=${q(ORG)} AND c.id IN(SELECT value FROM json_each(${q(j(ids))})) ORDER BY c.id`) as StagingTrainingPoint[];
 if(checkpoint){if(checkpoint.month!==options.month||checkpoint.as_of!==options.asOf||!Array.isArray(checkpoint.customer_ids)||checkpoint.customer_ids.length!==200)throw Error('INVALID_STAGING_CHECKPOINT');points=fetchPoints(checkpoint.customer_ids);if(sha(points)!==checkpoint.customer_sha256)throw Error('CHECKPOINT_CUSTOMER_MASTERS_CHANGED');}
 else{
  const linked=query(`SELECT json_extract(after_json,'$.source_customer_id') id FROM master_audit WHERE organization_id=${q(ORG)} AND resource_type='demo_operation_point_link' AND json_valid(after_json) LIMIT 5001`);if(linked.length>5000)throw Error('OVERLAY_INVENTORY_REQUIRES_REVIEW');
  points=areas.flatMap(a=>query(`SELECT c.*,a.name area_name FROM customer_outlet c JOIN area a ON a.organization_id=c.organization_id AND a.id=c.area_id WHERE c.organization_id=${q(ORG)} AND c.area_id=${q(a.id)} AND c.directory_dataset_id IS NOT NULL AND c.record_status='active' AND c.merged_into_id IS NULL AND c.latitude_e7 IS NOT NULL AND c.longitude_e7 IS NOT NULL AND c.id NOT IN(SELECT value FROM json_each(${q(j(linked.map(r=>r.id).filter(Boolean)))})) AND NOT EXISTS(SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=c.organization_id AND ca.outlet_id=c.id) AND NOT EXISTS(SELECT 1 FROM invoice i WHERE i.organization_id=c.organization_id AND i.outlet_id=c.id) AND NOT EXISTS(SELECT 1 FROM activity ac WHERE ac.organization_id=c.organization_id AND ac.outlet_id=c.id) ORDER BY c.id LIMIT 100`) as StagingTrainingPoint[]).sort((a,b)=>a.id.localeCompare(b.id));
  if(points.length!==200)throw Error('200_UNUSED_IMPORTED_POINTS_REQUIRED');
 }
 const inventory:StagingInventory={organizationId:ORG,managementId:management.id,month:options.month,asOf:options.asOf,points,areas,products,approvedTargets:approvedTargets as StagingInventory['approvedTargets'],capturedAt:checkpoint?.captured_at??new Date().toISOString(),unusedConfirmed:true},bundle=buildStagingTrainingPackage(inventory),validation=validateStagingTrainingPackage(inventory,bundle),dataset=bundle.manifest.dataset,ids=points.map(p=>p.id),idJson=q(j(ids)),org=q(ORG),datasetSql=q(dataset),prefix=q(dataset+'-%'),packageHash=createHash('sha256').update(bundle.sql).digest('hex');
 if(checkpoint&&checkpoint.dataset!==dataset)throw Error('CHECKPOINT_DATASET_DIFFERENT');
 if(checkpoint&&checkpoint.sql_sha256!==packageHash)throw Error('CHECKPOINT_PACKAGE_CHANGED_REVIEW_REQUIRED');
 const protectedState=()=>({customers:sha(fetchPoints(ids)),finance:query(`SELECT COUNT(*) n,COALESCE(SUM(net_minor),0) net,COALESCE(SUM(source_net_minor),0) gross FROM invoice WHERE organization_id=${org} AND source_system<>${datasetSql}`)[0],targets:sha(query(`SELECT v.* FROM target_version v WHERE v.organization_id=${org} AND v.id NOT LIKE ${prefix} ORDER BY v.id`))});
 const baseline=checkpoint?.baseline??protectedState();if(j(protectedState())!==j(baseline))throw Error('PROTECTED_BASELINE_CHANGED');
 const unsafe=query(`SELECT 'assignment' kind FROM customer_assignment WHERE organization_id=${org} AND outlet_id IN(SELECT value FROM json_each(${idJson})) AND id NOT LIKE ${prefix} UNION ALL SELECT 'invoice' kind FROM invoice WHERE organization_id=${org} AND outlet_id IN(SELECT value FROM json_each(${idJson})) AND source_system<>${datasetSql} UNION ALL SELECT 'activity' kind FROM activity WHERE organization_id=${org} AND outlet_id IN(SELECT value FROM json_each(${idJson})) AND id NOT LIKE ${prefix} LIMIT 1`);if(unsafe.length)throw Error('SELECTED_CUSTOMER_ALREADY_USED');
 const complete=query(`SELECT id FROM master_audit WHERE organization_id=${org} AND id=${q(dataset+'-manifest')}`)[0];
 const receiptPath='test-results/training-staging-receipt.json';mkdirSync('test-results',{recursive:true});
 const receipt=(status:string,extra:Row={})=>{const data={status,environment:'staging',dataset,as_of:options.asOf,periods:bundle.manifest.periods,customer_count:200,customer_master_inserts:0,customer_master_updates:0,existing_products_reused:bundle.manifest.existing_products_reused,deferred_target_versions:bundle.manifest.deferred_target_versions.length,statement_status:'prepared',counts:bundle.manifest.counts,validation,...extra};writeFileSync(receiptPath,j(data)+'\n');console.log(j(data));};
 if(!options.apply){receipt('dry_run_validated',{remote_writes:0});return;}
 const directory=mkdtempSync(join(tmpdir(),'nyales-staging-training-'));try{
  if(!complete){
   if(!checkpoint){const start={dataset,month:options.month,as_of:options.asOf,customer_ids:ids,customer_sha256:sha(points),baseline,captured_at:inventory.capturedAt,sql_sha256:packageHash},sql=`INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) VALUES(${q(attemptId)},${org},${q(management.id)},'training_dataset',${datasetSql},'staging_training_started',${q(new Date().toISOString())},NULL,${q(j(start))});`;run(['--command',sql]);}
   // SQL is idempotent; marker is last, so a failed attempt resumes its same 200 customer IDs.
   const path=join(directory,'package.sql');writeFileSync(path,bundle.sql,{encoding:'utf8',mode:0o600});run(['--file',path]);
  }
  if(j(protectedState())!==j(baseline))throw Error('PROTECTED_DATA_CHANGED_AFTER_APPLY');
  const mismatches=query(`SELECT i.id FROM invoice i LEFT JOIN invoice_line l ON l.invoice_id=i.id AND l.organization_id=i.organization_id WHERE i.organization_id=${org} AND i.source_system=${datasetSql} GROUP BY i.id HAVING i.net_minor<>SUM(l.net_minor) LIMIT 1`);if(mismatches.length)throw Error('REMOTE_LINE_RECONCILIATION_FAILED');
  const returnMismatch=query(`SELECT i.id FROM invoice i LEFT JOIN invoice_revision_credit c ON c.invoice_id=i.id WHERE i.organization_id=${org} AND i.source_system=${datasetSql} GROUP BY i.id HAVING i.source_net_minor-i.net_minor<>COALESCE(SUM(c.amount_minor),0) LIMIT 1`);if(returnMismatch.length)throw Error('REMOTE_RETURN_RECONCILIATION_FAILED');
  const countSql=Object.entries(bundle.rows).filter(([,r])=>r.length).map(([table])=>`SELECT ${q(table)} name,COUNT(*) n FROM ${table} WHERE ${table==='invoice_revision_credit'?`invoice_id LIKE ${prefix}`:`organization_id=${org} AND `+(table==='user_area_scope'?`user_id LIKE ${prefix}`:`id LIKE ${prefix}`)}`).join(' UNION ALL '),counts=Object.fromEntries(query(countSql).map(r=>[r.name,Number(r.n)]));for(const [table,rows] of Object.entries(bundle.rows))if(rows.length&&(counts[table]??0)!==rows.length)throw Error('REMOTE_COUNT_MISMATCH_'+table);
  receipt(complete?'already_applied':'applied',{protected_data_unchanged:true,remote_counts_verified:true,remote_lines:'reconciled',remote_returns:'reconciled'});
 }catch(error){receipt('requires_resume_review',{detail:'Partial package may exist. Rerun the same month/cutoff to reuse its checkpoint; do not change source points.'});throw error}finally{rmSync(directory,{recursive:true,force:true})}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)applyTrainingStaging().catch(error=>{console.error(String(error?.message??'TRAINING_STAGING_FAILED').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]'));process.exitCode=1});
