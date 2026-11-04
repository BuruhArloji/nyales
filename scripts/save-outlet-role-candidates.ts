import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertRoleStaging,roleD1Query} from './audit-outlet-role-candidates';
import {buildCandidatePayload,candidateSql,digest,type CandidateInput,type CandidateRole,type CustomerCandidateRow} from './outlet-role-candidate-data';

export const OUTLET_ROLE_RULE_VERSION='outlet-role-source-label-reproducible-v2';
export const OUTLET_ROLE_EXPECTED={total:46970,external_directory:45950,synthetic_demo:1000,training:20,retail:40541,wholesale:1543,agent_distributor:32,mixed_unknown:3834} as const;
const AGENT_DISTRIBUTOR_ALLOWLIST=new Set(['agen gas elpiji','distributor minuman','distributor baja']);
const WHOLESALE_MARKER=/grosir|wholesale/i;
const RETAIL_MARKER=/toko|kios|minimarket|supermarket|toserba/i;
const PAGE_SIZE=1000;
const WRITE_BATCH_SIZE=200;
const REPORT_PATH='test-results/outlet-role-candidate-save-summary.json';

type SourceCohort='external_directory'|'synthetic_demo'|'training';
export type CandidateRow={customer:CustomerCandidateRow;input:CandidateInput};
type Summary={
 phase:'outlet_role_candidate_save';target:'nyales-staging';organization_id?:string;status:string;rule_version:string;
 rule_definition?:Record<string,unknown>;cohorts?:Record<string,number>;role_counts?:Record<string,number>;
 customer_rows_before?:number;customer_rows_after?:number;source_snapshot_sha256_before?:string;source_snapshot_sha256_after?:string;
 existing_candidate_rows_before?:number;candidate_rows_after?:number;candidate_rows_added?:number;
 write_scope:'master_audit outlet_role_candidate rows only';source_rows_unchanged?:boolean;production_touched:false;error_code?:string;
};

export function classifyExternalOutletLabel(label:string):{role:CandidateRole;confidence:'low'|'very_low';reason:string}{
 const normalized=label.trim().toLowerCase();
 if(WHOLESALE_MARKER.test(label))return{role:'wholesale',confidence:'low',reason:'outlet_type_matched_grosir_or_wholesale'};
 if(AGENT_DISTRIBUTOR_ALLOWLIST.has(normalized))return{role:'agent_distributor',confidence:'low',reason:'outlet_type_exact_agent_distributor_allowlist_match'};
 if(RETAIL_MARKER.test(label))return{role:'retail',confidence:'low',reason:'outlet_type_matched_retail_marker'};
 return{role:'mixed_unknown',confidence:'very_low',reason:'no_configured_role_marker_in_outlet_type'};
}

function canonicalRow(row:CustomerCandidateRow){return Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))}
function sourceRowsDigest(rows:CustomerCandidateRow[]){return digest(rows.map(canonicalRow))}
function cohortFor(customer:CustomerCandidateRow):SourceCohort{
 if(customer.directory_dataset_id!==null)return'external_directory';
 if(customer.outlet_type==='retail_demo')return'synthetic_demo';
 if(customer.outlet_type.trim()==='')return'training';
 throw Error('UNEXPECTED_NON_DIRECTORY_CUSTOMER_COHORT');
}
export function candidateForCustomer(customer:CustomerCandidateRow):CandidateInput{
 const cohort=cohortFor(customer);
 if(cohort==='external_directory'){
  const classification=classifyExternalOutletLabel(customer.outlet_type);
  return{customer,candidate_role:classification.role,cohort,confidence:classification.confidence,confidence_basis:'qualitative_low_confidence_source_label_heuristic_unverified',status:'pending_sales_confirmation',evidence_reason:classification.reason};
 }
 if(cohort==='synthetic_demo')return{customer,candidate_role:null,cohort,confidence:'not_applicable',confidence_basis:'role_classification_excluded_for_synthetic_demo_cohort',status:'excluded_synthetic',evidence_reason:'synthetic_demo_row_kept_separate_from_real_customer_analytics'};
 return{customer,candidate_role:null,cohort,confidence:'not_applicable',confidence_basis:'role_classification_not_inferred_for_training_rows',status:'training_unclassified',evidence_reason:'blank_outlet_type_training_row_kept_separate_from_real_customer_analytics'};
}
function roleCounts(rows:CandidateRow[]){
 const counts:Record<string,number>={retail:0,wholesale:0,agent_distributor:0,mixed_unknown:0};
 for(const row of rows)if(row.input.cohort==='external_directory'&&row.input.candidate_role)counts[row.input.candidate_role]++;
 return counts;
}
function cohortCounts(rows:CandidateRow[]){
 const counts:Record<string,number>={external_directory:0,synthetic_demo:0,training:0};
 for(const row of rows)counts[row.input.cohort]++;
 return counts;
}
export function assertReproducibleCandidateScope(rows:CandidateRow[],organizationId:string){
 if(rows.length!==OUTLET_ROLE_EXPECTED.total||new Set(rows.map(r=>r.customer.id)).size!==OUTLET_ROLE_EXPECTED.total)throw Error('APPROVED_46970_POINT_SCOPE_MISMATCH');
 if(rows.some(r=>r.customer.organization_id!==organizationId))throw Error('CROSS_TENANT_CUSTOMER_FOUND');
 const cohorts=cohortCounts(rows),roles=roleCounts(rows);
 for(const key of ['external_directory','synthetic_demo','training'] as const)if(cohorts[key]!==OUTLET_ROLE_EXPECTED[key])throw Error('APPROVED_COHORT_SCOPE_MISMATCH');
 for(const key of ['retail','wholesale','agent_distributor','mixed_unknown'] as const)if(roles[key]!==OUTLET_ROLE_EXPECTED[key])throw Error('REPRODUCIBLE_ROLE_COUNT_MISMATCH');
 if(Object.values(roles).reduce((a,b)=>a+b,0)!==OUTLET_ROLE_EXPECTED.external_directory)throw Error('ROLE_BUCKET_RECONCILIATION_FAILED');
 return{cohorts,roles};
}

function q(value:string){return `'${value.replaceAll("'","''")}'`}
function loadCustomerRows(organizationId:string){
 const all:CustomerCandidateRow[]=[];let lastId:string|null=null;
 while(true){
  const after=lastId===null?'':` AND id>${q(lastId)}`;
  const rows=roleD1Query(`SELECT * FROM customer_outlet WHERE organization_id=${q(organizationId)}${after} ORDER BY id LIMIT ${PAGE_SIZE}`) as CustomerCandidateRow[];
  if(!rows.length)break;
  all.push(...rows);lastId=String(rows[rows.length-1].id);
  if(rows.length<PAGE_SIZE)break;
 }
 return all;
}
function stableJson(value:unknown):string{
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return`[${value.map(stableJson).join(',')}]`;
 const record=value as Record<string,unknown>;
 return`{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}
function comparablePayload(value:Record<string,unknown>){const{run_id:_runId,...rest}=value;return rest}
function candidatePrefix(){return`outlet-role-candidate:${OUTLET_ROLE_RULE_VERSION}:`}
function readExistingCandidates(organizationId:string){
 const prefix=candidatePrefix(),rows:Array<{id:string;resource_id:string;after_json:string}>=[];let lastId:string|null=null;
 while(true){
  const after=lastId===null?'':` AND id>${q(lastId)}`;
  const batch=roleD1Query(`SELECT id,resource_id,after_json FROM master_audit WHERE organization_id=${q(organizationId)} AND resource_type='outlet_role_candidate' AND substr(id,1,${prefix.length})=${q(prefix)}${after} ORDER BY id LIMIT ${PAGE_SIZE}`) as Array<{id:string;resource_id:string;after_json:string}>;
  if(!batch.length)break;
  rows.push(...batch);lastId=batch[batch.length-1].id;
  if(batch.length<PAGE_SIZE)break;
 }
 return rows;
}
function validateExistingCandidates(rows:Array<{id:string;resource_id:string;after_json:string}>,expected:Map<string,CandidateRow>,runId:string){
 for(const row of rows){
  const expectedRow=expected.get(row.resource_id);
  if(!expectedRow||row.id!==`outlet-role-candidate:${OUTLET_ROLE_RULE_VERSION}:${row.resource_id}`)throw Error('UNEXPECTED_EXISTING_CANDIDATE_RECEIPT');
  let payload:Record<string,unknown>;
  try{payload=JSON.parse(row.after_json) as Record<string,unknown>}catch{throw Error('INVALID_EXISTING_CANDIDATE_RECEIPT_JSON')}
  const expectedPayload=buildCandidatePayload(expectedRow.input,OUTLET_ROLE_RULE_VERSION,runId);
  if(stableJson(comparablePayload(payload))!==stableJson(comparablePayload(expectedPayload)))throw Error('EXISTING_CANDIDATE_SOURCE_OR_RULE_MISMATCH');
 }
}
function d1WriteFile(file:string){
 try{execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json','--json','--file',file],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024,timeout:300_000})}
 catch(error){const e=error as{status?:number;stdout?:string;stderr?:string};const detail=String(e.stdout||'')+'\n'+String(e.stderr||'');throw Error('STAGING_CANDIDATE_BATCH_FAILED_'+String(e.status??'UNKNOWN')+(/quota|limit has been reached/i.test(detail)?'_PROVIDER_LIMIT_REJECTION':''))}
}
function reportWrite(summary:Summary){mkdirSync('test-results',{recursive:true});writeFileSync(REPORT_PATH,JSON.stringify(summary,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(summary))}

export function saveOutletRoleCandidates(){
 const args=process.argv.slice(2),remote=args.includes('--remote'),apply=args.includes('--apply'),plan=args.includes('--plan');
 if(!remote||apply===plan)throw Error('EXPLICIT_REMOTE_PLAN_OR_APPLY_REQUIRED');
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));
 assertRoleStaging(config,process.env,remote);
 const orgRows=roleD1Query('SELECT id FROM organization ORDER BY id') as Array<{id:string}>;
 if(orgRows.length!==1||typeof orgRows[0].id!=='string')throw Error('SINGLE_STAGING_TENANT_REQUIRED');
 const organizationId=orgRows[0].id,runId=`outlet-role-v2-${process.env.GITHUB_RUN_ID||Date.now()}`;
 const summary:Summary={phase:'outlet_role_candidate_save',target:'nyales-staging',organization_id:organizationId,status:'preflight',rule_version:OUTLET_ROLE_RULE_VERSION,rule_definition:{priority:['outlet_type contains grosir|wholesale → wholesale','exact outlet_type allowlist (Agen Gas Elpiji, Distributor minuman, Distributor Baja) → agent_distributor','outlet_type contains toko|kios|minimarket|supermarket|toserba → retail','otherwise → mixed_unknown'],source_fields_used:['outlet_type'],purchase_class_used:false,customer_name_used:false,confidence:'qualitative only; unverified; no probabilities',external_status:'pending_sales_confirmation'},write_scope:'master_audit outlet_role_candidate rows only',production_touched:false};
 let tempDir:string|undefined;
 try{
  const customers=loadCustomerRows(organizationId),candidates=customers.map(customer=>({customer,input:candidateForCustomer(customer)}));
  const checked=assertReproducibleCandidateScope(candidates,organizationId),beforeHash=sourceRowsDigest(customers);
  summary.customer_rows_before=customers.length;summary.source_snapshot_sha256_before=beforeHash;summary.cohorts=checked.cohorts;summary.role_counts=checked.roles;
  const expected=new Map(candidates.map(row=>[row.customer.id,row]));
  for(const row of candidates)buildCandidatePayload(row.input,OUTLET_ROLE_RULE_VERSION,runId);
  const existing=readExistingCandidates(organizationId);validateExistingCandidates(existing,expected,runId);
  summary.existing_candidate_rows_before=existing.length;summary.status=apply?'preflight_passed':'plan_only';reportWrite(summary);
  if(!apply)return summary;
  const existingIds=new Set(existing.map(row=>row.resource_id));
  const missing=candidates.filter(row=>!existingIds.has(row.customer.id));
  tempDir=mkdtempSync(resolve(tmpdir(),'nyales-outlet-role-v2-'));
  let batchCount=0;
  for(let i=0;i<missing.length;i+=WRITE_BATCH_SIZE){
   const batch=missing.slice(i,i+WRITE_BATCH_SIZE),file=resolve(tempDir,`batch-${String(batchCount+1).padStart(4,'0')}.sql`);
   writeFileSync(file,batch.map(row=>candidateSql(row.input,OUTLET_ROLE_RULE_VERSION,runId,'outlet-role-candidate-v2',new Date().toISOString())).join('\n')+'\n',{mode:0o600});
   d1WriteFile(file);batchCount++;
   if(batchCount%25===0)console.log(`append-only candidate batches committed: ${batchCount}`);
  }
  const customersAfter=loadCustomerRows(organizationId),afterHash=sourceRowsDigest(customersAfter);
  const receiptsAfter=readExistingCandidates(organizationId);validateExistingCandidates(receiptsAfter,expected,runId);
  if(customersAfter.length!==customers.length||afterHash!==beforeHash)throw Error('SOURCE_CUSTOMER_ROWS_CHANGED_DURING_CANDIDATE_SAVE');
  if(receiptsAfter.length!==OUTLET_ROLE_EXPECTED.total||new Set(receiptsAfter.map(row=>row.resource_id)).size!==OUTLET_ROLE_EXPECTED.total)throw Error('CANDIDATE_RECEIPT_CARDINALITY_MISMATCH');
  summary.status='complete';summary.customer_rows_after=customersAfter.length;summary.source_snapshot_sha256_after=afterHash;summary.source_rows_unchanged=true;summary.candidate_rows_after=receiptsAfter.length;summary.candidate_rows_added=receiptsAfter.length-existing.length;reportWrite(summary);return summary;
 }catch(error){
  summary.status='blocked_or_failed';summary.error_code=error instanceof Error?error.message:'OUTLET_ROLE_CANDIDATE_SAVE_FAILED';reportWrite(summary);throw error;
 }finally{if(tempDir)rmSync(tempDir,{recursive:true,force:true})}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{saveOutletRoleCandidates()}catch(error){console.error(error instanceof Error?error.message:'OUTLET_ROLE_CANDIDATE_SAVE_FAILED');process.exitCode=1}}
