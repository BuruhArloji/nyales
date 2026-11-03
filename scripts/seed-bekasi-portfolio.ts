import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {buildBekasiPortfolio,createBekasiStartMarker,DATASET_ID,EXPECTED,PREFIX,toInsertStatements} from './bekasi-portfolio-data';

const ROOT=process.cwd();
const CONFIG=resolve(ROOT,'wrangler.staging.generated.json');
const APPLY=process.argv.includes('--apply');
const REMOTE=process.argv.includes('--remote');
const CHUNK_STATEMENTS=8;
const MAX_SQL_STATEMENT_BYTES=64*1024;
const MAX_SQL_FILE_BYTES=512*1024;

function assertStagingConfig(){
  if(!REMOTE)throw new Error('REMOTE_FLAG_REQUIRED');
  const config=JSON.parse(readFileSync(CONFIG,'utf8')) as {name?:string;vars?:Record<string,string>;d1_databases?:Array<{database_name?:string}>};
  if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||!config.d1_databases?.some(database=>database.database_name==='nyales-staging'))throw new Error('STAGING_CONFIG_REQUIRED');
  for(const key of ['CLOUDFLARE_API_TOKEN','CF_ACCOUNT_ID','CF_D1_DATABASE_ID'])if(!process.env[key])throw new Error(`MISSING_STAGING_ENV_${key}`);
}
function safeOutput(value:unknown){return String(value??'').replace(/(Bearer\s+)[^\s]+/gi,'$1[REDACTED]').replace(/(ghu_|gho_|[A-Za-z0-9_]{32,})[A-Za-z0-9_-]*/g,'[REDACTED]')}
function wrangler(args:string[]){
  try{return execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config',CONFIG,...args],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:process.env,maxBuffer:32*1024*1024})}
  catch(error){const e=error as {status?:number;stdout?:Buffer|string;stderr?:Buffer|string};throw new Error(`WRANGLER_D1_FAILED_${e.status??'UNKNOWN'}: ${safeOutput([e.stderr,e.stdout].map(x=>x?.toString?.()||'').join('\n').slice(-900))}`)}
}
function extractRows(value:unknown):Record<string,unknown>[]|null{
  if(Array.isArray(value)){
    for(const item of value){const found=extractRows(item);if(found)return found}
  }else if(value&&typeof value==='object'){
    const record=value as Record<string,unknown>;
    if(Array.isArray(record.results))return record.results as Record<string,unknown>[];
    for(const item of Object.values(record)){const found=extractRows(item);if(found)return found}
  }
  return null;
}
function query(sql:string){
  const stdout=wrangler(['--json','--command',sql]);
  let value:unknown;
  try{value=JSON.parse(stdout.trim())}catch{const first=Math.min(...['[','{'].map(char=>{const index=stdout.indexOf(char);return index<0?Number.MAX_SAFE_INTEGER:index}));if(first===Number.MAX_SAFE_INTEGER)throw new Error('WRANGLER_JSON_PARSE_FAILED');value=JSON.parse(stdout.slice(first).trim())}
  const rows=extractRows(value);
  if(!rows)throw new Error('WRANGLER_RESULT_SHAPE_INVALID');
  return rows;
}
function q(value:string){return `'${value.replaceAll("'","''")}'`}
function one(sql:string){const row=query(sql)[0];if(!row)throw new Error('D1_QUERY_RETURNED_NO_ROW');return row}
function countSql(orgId:string){
  const o=q(orgId),p=q(PREFIX+'%'),customer=q(PREFIX+'customer-%'),assignment=q(PREFIX+'assignment-%'),plan=q(PREFIX+'plan-%'),activity=q(PREFIX+'activity-%'),task=q(PREFIX+'task-%'),lead=q(PREFIX+'lead-%'),order=q(PREFIX+'order-%'),invoice=q(PREFIX+'invoice-%'),targetPlan=q(PREFIX+'target-plan-%'),targetVersion=q(PREFIX+'target-version-%'),targetItem=q(PREFIX+'target-item-%');
  return `SELECT
    (SELECT COUNT(*) FROM branch WHERE organization_id=${o} AND id LIKE ${p}) branches,
    (SELECT COUNT(*) FROM area WHERE organization_id=${o} AND id LIKE ${p}) areas,
    (SELECT COUNT(*) FROM work_calendar WHERE organization_id=${o} AND id LIKE ${p}) calendars,
    (SELECT COUNT(*) FROM app_user WHERE organization_id=${o} AND id LIKE ${p}) users,
    (SELECT COUNT(*) FROM auth_role_assignment WHERE organization_id=${o} AND id LIKE ${p}) role_assignments,
    (SELECT COUNT(*) FROM user_area_scope WHERE organization_id=${o} AND user_id LIKE ${p} AND area_id LIKE ${p}) area_scopes,
    (SELECT COUNT(*) FROM customer_outlet WHERE organization_id=${o} AND id LIKE ${customer}) customers,
    (SELECT COUNT(*) FROM customer_assignment WHERE organization_id=${o} AND id LIKE ${assignment}) customer_assignments,
    (SELECT COUNT(*) FROM reporting_assignment WHERE organization_id=${o} AND id LIKE ${p}) reporting_assignments,
    (SELECT COUNT(*) FROM product_group WHERE organization_id=${o} AND id LIKE ${p}) product_groups,
    (SELECT COUNT(*) FROM product WHERE organization_id=${o} AND id LIKE ${p}) products,
    (SELECT COUNT(*) FROM product_price WHERE organization_id=${o} AND id LIKE ${p}) product_prices,
    (SELECT COUNT(*) FROM target_plan WHERE organization_id=${o} AND id LIKE ${targetPlan}) target_plans,
    (SELECT COUNT(*) FROM target_version WHERE organization_id=${o} AND id LIKE ${targetVersion}) target_versions,
    (SELECT COUNT(*) FROM target_item WHERE organization_id=${o} AND id LIKE ${targetItem}) target_items,
    (SELECT COUNT(*) FROM work_plan WHERE organization_id=${o} AND id LIKE ${plan}) work_plans,
    (SELECT COUNT(*) FROM activity WHERE organization_id=${o} AND id LIKE ${activity}) activities,
    (SELECT COUNT(*) FROM sales_task WHERE organization_id=${o} AND id LIKE ${task}) tasks,
    (SELECT COUNT(*) FROM sales_lead WHERE organization_id=${o} AND id LIKE ${lead}) leads,
    (SELECT COUNT(*) FROM sales_order WHERE organization_id=${o} AND id LIKE ${order}) orders,
    (SELECT COUNT(*) FROM invoice_import_job WHERE organization_id=${o} AND id LIKE ${p}) import_jobs,
    (SELECT COUNT(*) FROM invoice WHERE organization_id=${o} AND id LIKE ${invoice}) invoices,
    (SELECT COUNT(*) FROM invoice_line WHERE organization_id=${o} AND id LIKE ${invoice}||'%line-%') invoice_lines,
    (SELECT COUNT(*) FROM invoice_source_event WHERE organization_id=${o} AND source_system='bekasi-demo-synthetic') source_events,
    (SELECT COUNT(*) FROM master_audit WHERE organization_id=${o} AND resource_type='training_dataset' AND resource_id=${q(DATASET_ID)} AND action='seed_applied') dataset_markers`;
}
function expectedCounts(dataset:ReturnType<typeof buildBekasiPortfolio>){
  return{
    branches:1,areas:2,calendars:1,users:5,role_assignments:5,area_scopes:6,customers:200,customer_assignments:200,reporting_assignments:4,
    product_groups:1,products:3,product_prices:3,target_plans:3,target_versions:3,target_items:12,
    work_plans:dataset.rows.work_plan.length,activities:dataset.rows.activity.length,tasks:dataset.rows.sales_task.length,leads:dataset.rows.sales_lead.length,
    orders:dataset.rows.sales_order.length,import_jobs:1,invoices:dataset.rows.invoice.length,invoice_lines:dataset.rows.invoice_line.length,
    source_events:dataset.rows.invoice_source_event.length,dataset_markers:1,
  };
}
function assertCounts(actual:Record<string,unknown>,expected:Record<string,number>){
  const mismatches=Object.entries(expected).filter(([key,value])=>Number(actual[key])!==value).map(([key,value])=>`${key}:${actual[key]??'null'}!=${value}`);
  if(mismatches.length)throw new Error(`BEKASI_POSTFLIGHT_COUNT_MISMATCH ${mismatches.join(',')}`);
}
function preservedCounts(orgId:string){
  const o=q(orgId);
  return one(`SELECT
    (SELECT COUNT(*) FROM customer_outlet WHERE organization_id=${o} AND directory_dataset_id IS NOT NULL) directory_customers,
    (SELECT COUNT(*) FROM invoice WHERE organization_id=${o} AND source_system<>'bekasi-demo-synthetic') existing_invoices,
    (SELECT COUNT(*) FROM target_version WHERE organization_id=${o} AND status='approved') approved_target_versions`);
}
function assertPreserved(before:Record<string,unknown>,after:Record<string,unknown>){
  for(const key of ['directory_customers','existing_invoices','approved_target_versions'])if(Number(before[key])!==Number(after[key]))throw new Error(`EXISTING_STAGING_DATA_CHANGED_${key}`);
}

async function main(){
  if(!APPLY){
    console.log('Bekasi portfolio fixture is deterministic and dry-run only. Use --apply --remote in the staging workflow to write.');
    return;
  }
  assertStagingConfig();
  const context=one(`SELECT
    (SELECT COUNT(*) FROM organization) AS organization_count,
    (SELECT id FROM organization ORDER BY id LIMIT 1) AS organization_id,
    (SELECT COUNT(*) FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE r.role_code='MANAGEMENT' AND r.effective_from_date<='2026-11-03' AND (r.effective_to_date IS NULL OR r.effective_to_date>'2026-11-03')) AS management_count,
    (SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE r.role_code='MANAGEMENT' AND r.effective_from_date<='2026-11-03' AND (r.effective_to_date IS NULL OR r.effective_to_date>'2026-11-03') ORDER BY u.id LIMIT 1) AS management_id,
    (SELECT COALESCE(epoch,0) FROM finance_epoch WHERE organization_id=(SELECT id FROM organization ORDER BY id LIMIT 1)) AS finance_epoch`);
  if(Number(context.organization_count)!==1||Number(context.management_count)<1||typeof context.organization_id!=='string'||typeof context.management_id!=='string')throw new Error('STAGING_TENANT_OR_MANAGEMENT_PRECONDITION_FAILED');
  const orgId=context.organization_id,managementId=context.management_id;
  const dataset=buildBekasiPortfolio({organizationId:orgId,managementId,createdAt:new Date().toISOString(),financeEpoch:Number(context.finance_epoch||0)});
  const expected=expectedCounts(dataset);
  const existingMarker=query(`SELECT after_json FROM master_audit WHERE organization_id=${q(orgId)} AND resource_type='training_dataset' AND resource_id=${q(DATASET_ID)} AND action='seed_applied'`)[0];
  const baseline=preservedCounts(orgId);
  if(existingMarker){
    const current=one(countSql(orgId));
    assertCounts(current,expected);
    console.log(JSON.stringify({status:'already_applied',dataset_id:DATASET_ID,counts:expected,protected_data_unchanged:true}));
    return;
  }
  const sqlStatements=toInsertStatements(dataset);
  if(sqlStatements.some(sql=>Buffer.byteLength(sql)>MAX_SQL_STATEMENT_BYTES))throw new Error('BEKASI_SQL_STATEMENT_TOO_LARGE');
  const groups:Array<string[]> = [];
  for(let index=0;index<sqlStatements.length;index+=CHUNK_STATEMENTS)groups.push(sqlStatements.slice(index,index+CHUNK_STATEMENTS));
  const contents=groups.map(group=>group.join('\n\n')+'\n');
  if(contents.some(content=>Buffer.byteLength(content)>MAX_SQL_FILE_BYTES))throw new Error('BEKASI_SQL_FILE_TOO_LARGE');
  const startMarker=createBekasiStartMarker(dataset);
  const startSql=toInsertStatements({...dataset,rows:{master_audit:[startMarker]}},1)[0];
  wrangler(['--command',startSql]);
  console.log('Bekasi DEMO in-progress disclosure marker applied.');
  const dir=mkdtempSync(join(tmpdir(),'nyales-bekasi-demo-'));
  try{
    for(let index=0;index<contents.length;index++){
      const file=join(dir,`chunk-${String(index+1).padStart(3,'0')}.sql`);
      writeFileSync(file,contents[index],{encoding:'utf8',mode:0o600});
      wrangler(['--file',file]);
      console.log(`Bekasi DEMO data chunk ${index+1}/${contents.length} applied.`);
    }
  }finally{rmSync(dir,{recursive:true,force:true})}
  const actual=one(countSql(orgId));
  assertCounts(actual,expected);
  assertPreserved(baseline,preservedCounts(orgId));
  const manifestRow=query(`SELECT after_json FROM master_audit WHERE organization_id=${q(orgId)} AND resource_type='training_dataset' AND resource_id=${q(DATASET_ID)} AND action='seed_applied'`)[0];
  if(!manifestRow)throw new Error('BEKASI_MANIFEST_NOT_WRITTEN');
  const stored=JSON.parse(String(manifestRow.after_json)) as {synthetic?:number;demo?:boolean;counts?:Record<string,number>};
  if(stored.synthetic!==1||stored.demo!==true||stored.counts?.visit_attempts!==EXPECTED.visits||stored.counts?.orders!==EXPECTED.orders||stored.counts?.invoices!==EXPECTED.invoices)throw new Error('BEKASI_MANIFEST_INVALID');
  console.log(JSON.stringify({status:'applied',dataset_id:DATASET_ID,counts:expected,manifest:dataset.manifest,protected_data_unchanged:true}));
}

main().catch(error=>{console.error(safeOutput(error instanceof Error?error.message:error));process.exitCode=1});
