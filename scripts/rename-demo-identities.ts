import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const RECEIPT='real-names-v1';
const names:Record<string,string>={
 'bekasi-demo-sales-kota-01':'Raka Pratama','bekasi-demo-sales-kota-02':'Nadia Putri',
 'bekasi-demo-sales-kab-01':'Dimas Saputra','bekasi-demo-sales-kab-02':'Sari Wulandari',
 'beverage-demo-v1-sales-1':'Aulia Rahma','beverage-demo-v1-sales-2':'Bagas Setiawan',
 'beverage-demo-v1-sales-3':'Citra Lestari','beverage-demo-v1-sales-4':'Damar Prakoso',
 'beverage-demo-v1-sales-5':'Elsa Maharani','beverage-demo-v1-sales-6':'Fikri Ramadhan',
};
const q=(v:unknown)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function main(){
 if(!process.argv.includes('--apply')||!process.argv.includes('--remote')){console.log('Prepared only: use original names for 1000 linked customers and common names for 10 sales. No writes.');return}
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));
 if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.d1_databases?.[0]?.database_name!=='nyales-staging'||config.account_id!==process.env.CF_ACCOUNT_ID||config.d1_databases[0].database_id!==process.env.CF_D1_DATABASE_ID)throw Error('STAGING_ACCOUNT_REQUIRED');
 if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('STAGING_TOKEN_REQUIRED');
 const run=(args:string[])=>execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json',...args],{encoding:'utf8',maxBuffer:48*1024*1024,stdio:['ignore','pipe','pipe']});
 const query=(sql:string)=>JSON.parse(run(['--json','--command',sql])).flatMap((r:any)=>r.results||[]);
 const orgs=query('SELECT id FROM organization');if(orgs.length!==1)throw Error('ONE_ORGANIZATION_REQUIRED');const org=orgs[0].id,o=q(org);
 const existing=query(`SELECT after_json FROM master_audit WHERE organization_id=${o} AND id=${q(RECEIPT)}`)[0];
 if(existing){console.log(JSON.stringify({phase:'identity_cleanup',status:'already_applied',...JSON.parse(existing.after_json)}));return}
 const actors=query(`SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=${o} AND r.role_code='MANAGEMENT' AND u.status='active' ORDER BY u.id LIMIT 1`);if(!actors.length)throw Error('MANAGEMENT_REQUIRED');const actor=actors[0].id;
 if(query(`SELECT id FROM master_audit WHERE organization_id=${o} AND id='beverage-demo-v1' AND action='beverage_demo_applied'`).length!==1)throw Error('CONNECTED_PACKAGE_REQUIRED');
 const all=()=>query(`SELECT * FROM customer_outlet WHERE organization_id=${o} ORDER BY id`),before=all(),lookup=new Map(before.map((r:any)=>[r.id,r]));
 const links=query(`SELECT resource_id,after_json FROM master_audit WHERE organization_id=${o} AND resource_type='demo_operation_point_link' AND action='operation_point_link_selected' AND (id LIKE 'bekasi-demo-existing-point-overlay-v1:%' OR id LIKE 'beverage-demo-v1-link-%') ORDER BY id`).map((r:any)=>JSON.parse(r.after_json));
 if(links.length!==1000||new Set(links.map((l:any)=>l.demo_customer_id)).size!==1000||new Set(links.map((l:any)=>l.source_customer_id)).size!==1000)throw Error('EXACT_1000_UNIQUE_LINKS_REQUIRED');
 const changes=links.map((l:any)=>{const d=lookup.get(l.demo_customer_id),s=lookup.get(l.source_customer_id);if(!d||!s||!l.synthetic_activity||!l.existing_point_overlay||!/^((bekasi-demo|beverage-demo-v1)-customer-)/.test(d.id)||d.directory_dataset_id!==null||d.record_status!=='active'||d.merged_into_id||d.latitude_e7!==null||d.longitude_e7!==null||d.version!==1||s.directory_dataset_id!=='maps-warung-20261028'||s.record_status!=='active'||s.merged_into_id||s.version!==l.source_version||s.name!==l.source_name||s.latitude_e7!==l.source_latitude_e7||s.longitude_e7!==l.source_longitude_e7||!s.name.trim())throw Error('LOCATION_IDENTITY_DRIFT');return {id:d.id,old:d.name,name:s.name,version:d.version,source_customer_id:s.id}});
 const users=query(`SELECT * FROM app_user WHERE organization_id=${o} AND id IN(${Object.keys(names).map(q).join(',')}) ORDER BY id`);if(users.length!==10||users.some((u:any)=>u.status!=='active'))throw Error('EXACT_10_ACTIVE_SALES_REQUIRED');
 const protectedCustomer=(rs:any[])=>rs.map(r=>{if(!changes.some(c=>c.id===r.id))return r;const {name,version,...rest}=r;return rest});
 const businessSnapshot=()=>Object.fromEntries(Object.entries({
  invoices:`SELECT id,outlet_id,rep_id,net_minor,invoice_date,source_invoice_id,version FROM invoice WHERE organization_id=${o} ORDER BY id`,
  activities:`SELECT id,outlet_id,user_id,metadata_json FROM activity WHERE organization_id=${o} ORDER BY id`,
  targets:`SELECT id,target_minor,rep_id_snapshot,outlet_id FROM target_item WHERE organization_id=${o} ORDER BY id`,
  assignments:`SELECT id,outlet_id,rep_id,effective_from_date,effective_to_date FROM customer_assignment WHERE organization_id=${o} ORDER BY id`,
 }).map(([key,sql])=>[key,hash(query(sql))]));
 const businessBefore=hash(businessSnapshot()),customersBefore=hash(protectedCustomer(before)),now=new Date().toISOString(),sql:string[]=[];
 const audit=(id:string,type:string,rid:string,action:string,b:any,a:any)=>`INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) VALUES(${[id,org,actor,type,rid,action,now,JSON.stringify(b),JSON.stringify(a)].map(q).join(',')});`;
 for(const c of changes){sql.push(`INSERT INTO master_mutation_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=${o} AND id=${q(c.id)} AND version=${c.version} AND name=${q(c.old)}) THEN 1 ELSE 0 END;DELETE FROM master_mutation_guard;UPDATE customer_outlet SET name=${q(c.name)},version=version+1 WHERE organization_id=${o} AND id=${q(c.id)} AND version=${c.version};`);sql.push(audit(RECEIPT+':'+c.id,'demo_customer_name',c.id,'source_name_applied',{name:c.old,version:c.version},{name:c.name,version:c.version+1,source_customer_id:c.source_customer_id,synthetic_operations:true}))}
 for(const u of users){sql.push(`INSERT INTO master_mutation_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM app_user WHERE organization_id=${o} AND id=${q(u.id)} AND version=${u.version} AND name=${q(u.name)}) THEN 1 ELSE 0 END;DELETE FROM master_mutation_guard;UPDATE app_user SET name=${q(names[u.id])},version=version+1 WHERE organization_id=${o} AND id=${q(u.id)} AND version=${u.version};`);sql.push(audit(RECEIPT+':'+u.id,'demo_sales_name',u.id,'common_name_applied',{name:u.name,version:u.version},{name:names[u.id],version:u.version+1,synthetic_operations:true}))}
 const summary={customers_renamed:changes.length,sales_renamed:users.length,source_customer_names_preserved:true,customer_ids_preserved:true,synthetic_operations:true};sql.push(audit(RECEIPT,'training_dataset',RECEIPT,'identity_names_applied',null,summary));
 const dir=mkdtempSync(join(tmpdir(),'nyales-real-names-'));try{const path=join(dir,'names.sql');writeFileSync(path,sql.join('\n'),{encoding:'utf8',mode:0o600});run(['--file',path])}finally{rmSync(dir,{recursive:true,force:true})}
 const after=all();if(hash(protectedCustomer(after))!==customersBefore||hash(businessSnapshot())!==businessBefore)throw Error('PROTECTED_DATA_CHANGED');
 if(changes.some(c=>{const r=after.find((r:any)=>r.id===c.id);return !r||r.name!==c.name||r.version!==c.version+1}))throw Error('CUSTOMER_NAME_RECONCILIATION_FAILED');
 const afterUsers=query(`SELECT * FROM app_user WHERE organization_id=${o} AND id IN(${Object.keys(names).map(q).join(',')}) ORDER BY id`);
 if(afterUsers.length!==10||afterUsers.some((u:any)=>{const old=users.find((r:any)=>r.id===u.id);const {name,version,...rest}=u;return name!==names[u.id]||version!==old.version+1||hash(rest)!==hash(Object.fromEntries(Object.entries(old).filter(([k])=>!['name','version'].includes(k))))}))throw Error('SALES_NAME_RECONCILIATION_FAILED');
 const report={phase:'identity_cleanup',status:'applied',...summary,protected_business_data_unchanged:true};mkdirSync('test-results',{recursive:true});writeFileSync('test-results/identity-name-receipt.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
try{main()}catch(e){console.error(e instanceof Error?e.message:'IDENTITY_CLEANUP_FAILED');process.exitCode=1}
