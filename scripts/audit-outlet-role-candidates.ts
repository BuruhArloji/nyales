import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const EXPECTED_ROLE_SCOPE={total:46970,external_directory:45950,synthetic_demo:1000,training_blank:20} as const;
export const ROLE_STAGING_ACCOUNT='54386b392928d9dcd226ad9e7fff5d79';
export const ROLE_STAGING_DATABASE='6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe';
export type OutletSourceGroup={cohort:string;outlet_type:string;row_count:number};
const q=(s:string)=>`'${s.replaceAll("'","''")}'`;
export function outletSourceAuditSql(org:string){return `SELECT CASE WHEN directory_dataset_id IS NOT NULL THEN 'external_directory' WHEN outlet_type='retail_demo' THEN 'synthetic_demo' WHEN TRIM(outlet_type)='' THEN 'training_blank' ELSE 'other' END cohort,outlet_type,COUNT(*) row_count FROM customer_outlet WHERE organization_id=${q(org)} GROUP BY cohort,outlet_type ORDER BY cohort,row_count DESC,outlet_type;`}
export function summarizeOutletSources(groups:OutletSourceGroup[]){
 const cohorts:Record<string,number>={};let total=0;
 for(const row of groups){if(!Number.isInteger(row.row_count)||row.row_count<1)throw Error('INVALID_SOURCE_GROUP_COUNT');cohorts[row.cohort]=(cohorts[row.cohort]||0)+row.row_count;total+=row.row_count}
 return{total,cohorts,source_labels:groups};
}
export function assertApprovedRoleScope(summary:ReturnType<typeof summarizeOutletSources>){
 if(summary.total!==EXPECTED_ROLE_SCOPE.total||Object.entries(EXPECTED_ROLE_SCOPE).some(([key,value])=>key!=='total'&&(summary.cohorts[key]||0)!==value)||Object.keys(summary.cohorts).some(key=>!['external_directory','synthetic_demo','training_blank'].includes(key)))throw Error('APPROVED_46970_POINT_SCOPE_MISMATCH');
}
export function assertRoleStaging(config:any,env:NodeJS.ProcessEnv,remote:boolean){
 if(!remote)throw Error('REMOTE_FLAG_REQUIRED');
 if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.account_id!==ROLE_STAGING_ACCOUNT||env.CF_ACCOUNT_ID!==ROLE_STAGING_ACCOUNT||env.CF_D1_DATABASE_ID!==ROLE_STAGING_DATABASE||!config.d1_databases?.some((d:any)=>d.database_name==='nyales-staging'&&d.database_id===ROLE_STAGING_DATABASE))throw Error('EXACT_STAGING_TARGET_REQUIRED');
 if(!env.CLOUDFLARE_API_TOKEN)throw Error('STAGING_CREDENTIAL_REQUIRED');
}
export function roleD1Query(sql:string){
 if(!/^\s*SELECT\b/i.test(sql))throw Error('READ_ONLY_AUDIT_QUERY_REQUIRED');
 let text:string;
 try{text=execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json','--json','--command',sql],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})}
 catch(error){const e=error as {status?:number;stdout?:string;stderr?:string};const detail=String(e.stdout||'')+'\n'+String(e.stderr||'');throw Error('STAGING_AUDIT_QUERY_FAILED_'+String(e.status??'UNKNOWN')+(/quota|limit has been reached/i.test(detail)?'_PROVIDER_LIMIT_REJECTION':''))}
 const parsed=JSON.parse(text.trim());if(!Array.isArray(parsed))throw Error('STAGING_AUDIT_RESULTS_INVALID');return parsed.flatMap((item:any)=>item.results||[]);
}
export function auditOutletRoleSources(){
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));assertRoleStaging(config,process.env,process.argv.includes('--remote'));
 const organizations=roleD1Query('SELECT id FROM organization ORDER BY id');if(organizations.length!==1||typeof organizations[0].id!=='string')throw Error('SINGLE_STAGING_TENANT_REQUIRED');
 const org=organizations[0].id,groups=roleD1Query(outletSourceAuditSql(org)) as OutletSourceGroup[];
 const summary=summarizeOutletSources(groups);assertApprovedRoleScope(summary);
 const datasets=roleD1Query(`SELECT COALESCE(directory_dataset_id,'<none>') dataset_id,COUNT(*) row_count FROM customer_outlet WHERE organization_id=${q(org)} GROUP BY directory_dataset_id ORDER BY directory_dataset_id;`);
 const keywordSignals=roleD1Query(`SELECT outlet_type,COUNT(*) row_count,SUM(CASE WHEN LOWER(name) LIKE '%grosir%' OR LOWER(name) LIKE '%wholesale%' THEN 1 ELSE 0 END) wholesale_name_signals,SUM(CASE WHEN LOWER(name) LIKE '%agen%' OR LOWER(name) LIKE '%distributor%' THEN 1 ELSE 0 END) agent_name_signals FROM customer_outlet WHERE organization_id=${q(org)} AND directory_dataset_id IS NOT NULL GROUP BY outlet_type ORDER BY row_count DESC,outlet_type;`);
 const report={phase:'outlet_role_source_audit',target:'nyales-staging',organization_id:org,read_only:true,customer_writes:0,production_touched:false,...summary,datasets,keyword_signals:keywordSignals};
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/outlet-role-source-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{auditOutletRoleSources()}catch(e){console.error(e instanceof Error?e.message:'OUTLET_ROLE_SOURCE_AUDIT_FAILED');process.exitCode=1}}
