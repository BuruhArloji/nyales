import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ANALYSIS_DEMO_ID,analysisSql,buildBekasiAnalysis} from './bekasi-analysis-data';

function main(){
 if(!process.argv.includes('--apply')||!process.argv.includes('--remote')){console.log('Dry run: synthetic monthly targets, schemes and prepared statements only. Use the explicit staging workflow input to apply.');return}
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));
 if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.d1_databases?.[0]?.database_name!=='nyales-staging')throw Error('STAGING_ONLY');
 for(const name of ['CLOUDFLARE_API_TOKEN','CF_ACCOUNT_ID','CF_D1_DATABASE_ID'])if(!process.env[name])throw Error('MISSING_'+name);
 const run=(args:string[])=>execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json',...args],{encoding:'utf8',maxBuffer:20*1024*1024,stdio:['ignore','pipe','pipe']});
 const query=(sql:string)=>{const data=JSON.parse(run(['--json','--command',sql]));return data.flatMap((r:any)=>r.results||[])};
 const q=(s:string)=>"'"+s.replaceAll("'","''")+"'",hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const organizations=query('SELECT id FROM organization');if(organizations.length!==1)throw Error('SINGLE_PILOT_ORG_REQUIRED');
 const org=organizations[0].id,o=q(org);
 const actors=query(`SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=${o} AND r.role_code='MANAGEMENT' AND u.status='active' ORDER BY u.id LIMIT 1`);if(!actors.length)throw Error('MANAGEMENT_REQUIRED');
 const actor=actors[0].id;
 if(!query(`SELECT id FROM master_audit WHERE organization_id=${o} AND resource_id='bekasi-field-sales-2026-08-10' AND action='seed_applied' AND json_extract(after_json,'$.synthetic')=1`).length)throw Error('COMPLETE_SYNTHETIC_BEKASI_DATASET_REQUIRED');
 const marker=query(`SELECT occurred_at,after_json FROM master_audit WHERE organization_id=${o} AND id=${q(ANALYSIS_DEMO_ID)} AND action='analysis_demo_applied'`)[0];
 const previousId=marker?JSON.parse(marker.after_json).previous_target_version:null;
 const overlapping=query(`SELECT v.*,p.name plan_name,p.period_start,p.period_end,p.channel FROM target_version v JOIN target_plan p ON p.organization_id=v.organization_id AND p.id=v.target_plan_id WHERE v.organization_id=${o} AND ${previousId?'v.id='+q(previousId):"v.status='approved'"} AND p.channel='field' AND p.period_start<='2026-10-31' AND p.period_end>='2026-08-01'`);
 let existing:any;
 if(overlapping.length){
  if(overlapping.length!==1)throw Error('MULTIPLE_EXISTING_TARGET_PERIODS_REQUIRE_REVIEW');const v=overlapping[0];
  if(v.plan_name!=='Target latihan field'||v.period_start!=='2026-10-01'||v.period_end!=='2026-10-31'||!query(`SELECT id FROM master_audit WHERE organization_id=${o} AND resource_type='training_dataset' AND resource_id='staging-pilot-10-sales' AND json_extract(after_json,'$.synthetic')=1 LIMIT 1`).length)throw Error('ONLY_VERIFIED_SYNTHETIC_PILOT_TARGET_CAN_BE_EXTENDED');
  const plan=query(`SELECT * FROM target_plan WHERE organization_id=${o} AND id=${q(v.target_plan_id)}`)[0],version=query(`SELECT * FROM target_version WHERE organization_id=${o} AND id=${q(v.id)}`)[0],items=query(`SELECT * FROM target_item WHERE organization_id=${o} AND target_version_id=${q(v.id)} ORDER BY id`);
  if(!items.length||items.reduce((n:number,i:any)=>n+i.target_minor,Number(version.reserve_minor))!==version.parent_minor)throw Error('EXISTING_TARGET_NOT_RECONCILED');
  if(!marker&&query(`SELECT id FROM target_version WHERE organization_id=${o} AND target_plan_id=${q(plan.id)} AND status IN('draft','submitted') LIMIT 1`).length)throw Error('EXISTING_TARGET_REVISION_OPEN');
  existing={plan,version,items};
 }
 const dataset=buildBekasiAnalysis(org,actor,marker?.occurred_at||new Date().toISOString(),existing);
 const signature=()=>query(`SELECT id,rep_id,outlet_id,invoice_date,net_minor,is_current,status FROM invoice WHERE organization_id=${o} ORDER BY id`);
 const before=signature(),demo=before.filter((i:any)=>i.id.startsWith('bekasi-demo-invoice-'));
 if(demo.length!==dataset.base.rows.invoice.length||demo.some((i:any)=>{const expected=dataset.base.rows.invoice.find(r=>r.id===i.id);return !expected||['rep_id','outlet_id','invoice_date','net_minor','is_current','status'].some(k=>expected[k]!==i[k])}))throw Error('DEMO_INVOICES_CHANGED_REVIEW_REQUIRED');
 const originalTargetItems=existing?query(`SELECT * FROM target_item WHERE organization_id=${o} AND target_version_id=${q(existing.version.id)} ORDER BY id`):[];
 const originalTargets=query(`SELECT * FROM target_version WHERE organization_id=${o} AND id NOT LIKE '${ANALYSIS_DEMO_ID}-%' ORDER BY id`);
 const visits=query(`SELECT COUNT(*) n,SUM(version) v FROM activity WHERE organization_id=${o}`);
 const verify=()=>{for(const [table,rows] of Object.entries(dataset.rows)){const count=query(`SELECT COUNT(*) n FROM ${table} WHERE organization_id=${o} AND id ${table==='master_audit'?'=':'LIKE'} ${q(table==='master_audit'?ANALYSIS_DEMO_ID:ANALYSIS_DEMO_ID+'-%')}`)[0].n;if(Number(count)!==rows.length)throw Error('ANALYSIS_COUNT_MISMATCH_'+table)}};
 if(marker){verify();console.log(JSON.stringify({status:'already_applied',dataset:ANALYSIS_DEMO_ID}));return}
 if(query(`SELECT e.id FROM incentive_enrollment e WHERE e.organization_id=${o} AND e.user_id LIKE 'bekasi-demo-sales-%' AND e.status='active' AND e.period_start<='2026-10-31' AND e.period_end>='2026-08-01' LIMIT 1`).length)throw Error('EXISTING_INCENTIVE_OVERLAP_REVIEW_REQUIRED');
 if(query(`SELECT ti.id FROM target_item ti JOIN target_version v ON v.organization_id=ti.organization_id AND v.id=ti.target_version_id JOIN target_plan p ON p.organization_id=v.organization_id AND p.id=v.target_plan_id WHERE ti.organization_id=${o} AND ti.rep_id_snapshot LIKE 'bekasi-demo-sales-%' AND v.status='approved' AND p.period_start<='2026-10-31' AND p.period_end>='2026-08-01' LIMIT 1`).length)throw Error('EXISTING_APPROVED_TARGET_OVERLAP_REVIEW_REQUIRED');
 for(const table of Object.keys(dataset.rows))if(query(`SELECT id FROM ${table} WHERE organization_id=${o} AND id LIKE ${q(ANALYSIS_DEMO_ID+'%')} LIMIT 1`).length)throw Error('PARTIAL_ANALYSIS_DATASET_REQUIRES_REVIEW');
 const statements=analysisSql(dataset);if(statements.some(s=>Buffer.byteLength(s)>64000))throw Error('ANALYSIS_STATEMENT_TOO_LARGE');const sql=statements.join('\n');if(Buffer.byteLength(sql)>950000)throw Error('ANALYSIS_SQL_TOO_LARGE');
 const directory=mkdtempSync(join(tmpdir(),'nyales-analysis-'));
 try{const file=join(directory,'analysis.sql');writeFileSync(file,sql,{encoding:'utf8',mode:0o600});run(['--file',file])}finally{rmSync(directory,{recursive:true,force:true})}
 const expectedTargets=originalTargets.map((v:any)=>existing&&v.id===existing.version.id?{...v,status:'superseded',version:v.version+1}:v);
 verify();if(hash(signature())!==hash(before)||hash(query(`SELECT * FROM target_version WHERE organization_id=${o} AND id NOT LIKE '${ANALYSIS_DEMO_ID}-%' ORDER BY id`))!==hash(expectedTargets)||(existing&&hash(query(`SELECT * FROM target_item WHERE organization_id=${o} AND target_version_id=${q(existing.version.id)} ORDER BY id`))!==hash(originalTargetItems))||hash(query(`SELECT COUNT(*) n,SUM(version) v FROM activity WHERE organization_id=${o}`))!==hash(visits))throw Error('PROTECTED_DATA_CHANGED');
 console.log(JSON.stringify({status:'applied',dataset:ANALYSIS_DEMO_ID,months:3,targets:12,schemes:3,statements:12,statement_status:'prepared',original_invoices_unchanged:true,existing_target_values_preserved:true,existing_target_revised:Boolean(existing),existing_target_history_preserved:true,activities_unchanged:true,payment_executed:false}));
}
try{main()}catch(error){console.error(error instanceof Error?error.message:'ANALYSIS_APPLY_FAILED');process.exitCode=1}
