import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {buildWalletDataStatements} from './customer-wallet-data';
export async function applyCustomerWallet(){
 if(!process.argv.includes('--remote')||!['true','false'].includes(process.env.WALLET_APPLY??''))throw Error('EXPLICIT_WALLET_APPLY_AND_REMOTE_REQUIRED');
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8')),account='54386b392928d9dcd226ad9e7fff5d79',database='6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe',org='3994b80a-d473-476e-97cb-f864f7708000';
 if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.account_id!==account||config.d1_databases?.[0]?.database_id!==database||process.env.CF_ACCOUNT_ID!==account||process.env.CF_D1_DATABASE_ID!==database)throw Error('EXACT_STAGING_TARGET_REQUIRED');
 const cli=resolve('node_modules/wrangler/bin/wrangler.js'),run=(args:string[])=>execFileSync(process.execPath,[cli,'d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json',...args],{encoding:'utf8',maxBuffer:5*1024*1024,windowsHide:true}),query=(sql:string)=>JSON.parse(run(['--json','--command',sql])).flatMap((r:any)=>r.results??[]),q=(v:string)=>"'"+v.replaceAll("'","''")+"'";
 const actor=query(`SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=${q(org)} AND u.status='active' AND r.role_code='MANAGEMENT' ORDER BY u.id LIMIT 1`)[0]?.id;if(!actor)throw Error('MANAGEMENT_REQUIRED');
 if(!query("SELECT name FROM sqlite_master WHERE type='table' AND name='customer_wallet_profile'").length)throw Error('APPLY_MIGRATION_0053_FIRST');
 let after='',seen=0,written=0;const directory=mkdtempSync(join(tmpdir(),'nyales-wallet-')),apply=process.env.WALLET_APPLY==='true',at=new Date().toISOString(),categories:Record<string,number>={};
 try{for(;;){const rows=query(`SELECT c.id,c.organization_id,c.outlet_type FROM customer_outlet c WHERE c.organization_id=${q(org)} AND c.id>${q(after)} AND c.record_status='active' AND c.merged_into_id IS NULL AND EXISTS(SELECT 1 FROM invoice i WHERE i.organization_id=c.organization_id AND i.outlet_id=c.id AND (i.source_system LIKE '%demo%' OR i.source_system LIKE 'training-staging-v1-%' OR i.source_system='showcase_synthetic')) AND NOT EXISTS(SELECT 1 FROM customer_wallet_profile w WHERE w.organization_id=c.organization_id AND w.customer_id=c.id) ORDER BY c.id LIMIT 250`);if(!rows.length)break;seen+=rows.length;after=rows.at(-1).id;const statements=buildWalletDataStatements(rows,org,actor,at);if(apply){const file=join(directory,'wallet.sql');writeFileSync(file,statements.join('\n'),{mode:0o600});run(['--file',file]);written+=rows.length;}if(seen>100000)throw Error('WALLET_SCOPE_REQUIRES_REVIEW');}
 const summary=query(`SELECT hierarchy1,source,COUNT(*) n FROM customer_wallet_profile WHERE organization_id=${q(org)} GROUP BY hierarchy1,source`);for(const r of summary)categories[r.hierarchy1+':'+r.source]=r.n;const receipt={status:apply?'applied':'dry_run',eligible_missing_profiles:seen,insert_attempts:written,customer_master_updates:0,invoice_writes:0,preserve_existing_profiles:true,categories};mkdirSync('test-results',{recursive:true});writeFileSync('test-results/customer-wallet-receipt.json',JSON.stringify(receipt)+'\n');console.log(JSON.stringify(receipt));
 }finally{rmSync(directory,{recursive:true,force:true})}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)applyCustomerWallet().catch(e=>{console.error(String(e.message??'WALLET_APPLY_FAILED'));process.exitCode=1});
