import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {buildBeverageDemo,BEVERAGE_DEMO,BEVERAGE_PREFIX} from './beverage-demo-data';
import {buildBekasiPortfolio,toInsertStatements,type SeedRow} from './bekasi-portfolio-data';

const q=(v:unknown)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function statements(data:ReturnType<typeof buildBeverageDemo>){
 const sql:string[]=[];
 for(const [table,rows] of Object.entries(data.rows)){
  const groupSize=table==='calculation_run'?1:12;
  for(let start=0;start<rows.length;start+=groupSize){const batch=rows.slice(start,start+groupSize),cols=Object.keys(batch[0]);const st=`INSERT OR IGNORE INTO ${table}(${cols.join(',')}) VALUES ${batch.map(r=>'('+cols.map(k=>q(r[k])).join(',')+')').join(',')};`;if(Buffer.byteLength(st)>64000)throw Error('STATEMENT_LIMIT_'+table);sql.push(st)}
  if(table==='target_item')for(const version of data.rows.target_version)sql.push(`UPDATE target_version SET status='approved' WHERE organization_id=${q(version.organization_id)} AND id=${q(version.id)} AND status='draft';`);
 }
 return sql;
}
/** Package integrity, checked before a remote write; no remote UI tests or simulated approvals of real data. */
export function reconcileBeveragePackage(data:ReturnType<typeof buildBeverageDemo>,org:string,actor:string,points:any[]){
 const db=new DatabaseSync(':memory:');try{
  for(const name of readdirSync('migrations').sort())db.exec(readFileSync('migrations/'+name,'utf8'));
  db.exec('PRAGMA foreign_keys=ON');db.exec(`INSERT INTO organization(id,name) VALUES(${q(org)},'Package reconciliation');INSERT INTO app_user(id,organization_id,name) VALUES(${q(actor)},${q(org)},'Actor');`);
  const base=buildBekasiPortfolio({organizationId:org,managementId:actor,createdAt:'2026-11-03T12:00:00Z',financeEpoch:0});for(const sql of toInsertStatements(base))db.exec(sql);
  db.exec('BEGIN');for(const sql of statements(data))db.exec(sql);db.exec('COMMIT');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('PACKAGE_FOREIGN_KEY_FAILED');
  const scalar=(sql:string)=>Number((db.prepare(sql).get() as any).n);
  if(scalar(`SELECT COUNT(*) n FROM invoice i WHERE i.source_system='nyales-beverage-demo' AND i.net_minor<>(SELECT SUM(l.net_minor) FROM invoice_line l WHERE l.invoice_id=i.id)`)!==0)throw Error('LINE_RECONCILIATION_FAILED');
  if(scalar(`SELECT COUNT(*) n FROM sales_order o JOIN invoice i ON i.external_invoice_id=o.external_reference AND i.organization_id=o.organization_id WHERE i.source_system='nyales-beverage-demo' AND o.net_minor=i.net_minor`)!==400)throw Error('ORDER_INVOICE_LINK_FAILED');
  if(scalar(`SELECT COUNT(*) n FROM activity a JOIN work_plan p ON p.id=json_extract(a.metadata_json,'$.work_plan_id') AND p.customer_id=a.outlet_id AND p.user_id=a.user_id JOIN sales_order o ON o.id=json_extract(a.metadata_json,'$.order_id') AND o.customer_id=a.outlet_id AND o.user_id=a.user_id WHERE json_extract(a.metadata_json,'$.dataset')='${BEVERAGE_DEMO}'`)!==400)throw Error('VISIT_ORDER_LINK_FAILED');
  for(const product of data.rows.product)if(!/^\d{4}$/.test(String(product.sku))||!product.brand||!product.flavour||!product.size_ml||!product.packaging)throw Error('SKU_DIMENSIONS_INVALID');
  const lookup=new Map(points.map(p=>[p.id,p]));if(data.links.length!==800||new Set(data.links.map(l=>l.source_customer_id)).size!==800||data.links.some(l=>!lookup.has(l.source_customer_id)))throw Error('LOCATION_LINK_RECONCILIATION_FAILED');
  const invoiceTotal=scalar(`SELECT SUM(net_minor) n FROM invoice WHERE source_system='nyales-beverage-demo'`);if(invoiceTotal!==data.manifest.actual_minor)throw Error('TOTAL_RECONCILIATION_FAILED');
  for(const run of data.rows.calculation_run){const input=JSON.parse(String(run.inputs_json)),actual=input.sources.reduce((n:number,s:any)=>n+s.net_minor,0);if(actual!==input.actual_minor)throw Error('INCENTIVE_SOURCE_RECONCILIATION_FAILED')}
  if(scalar(`SELECT COUNT(*) n FROM visit_event WHERE organization_id=${q(org)} AND id LIKE 'beverage-demo-v1-%'`)!==800)throw Error('CHECK_IN_OUT_RECONCILIATION_FAILED');
  return {status:'reconciled',...data.manifest,visit_events:800,work_sessions:20,foreign_key_errors:0,line_mismatches:0,order_invoice_matches:400,visit_order_matches:400,source_point_coordinates_copied:false};
 }finally{db.close()}
}
async function main(){
 if(!process.argv.includes('--apply')||!process.argv.includes('--remote')){console.log('Prepared workflow only: 6 new reps, 800 synthetic customer links, 34 beverage SKUs, 400 connected visits/orders/invoices, November targets and incentive previews. No remote writes.');return}
 const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));if(config.name!=='nyales-staging'||config.vars?.APP_ENV!=='staging'||config.d1_databases?.[0]?.database_name!=='nyales-staging')throw Error('STAGING_ONLY');
 for(const key of ['CF_ACCOUNT_ID','CF_D1_DATABASE_ID','CLOUDFLARE_API_TOKEN'])if(!process.env[key])throw Error('MISSING_'+key);
 const run=(args:string[])=>execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json',...args],{encoding:'utf8',maxBuffer:40*1024*1024,stdio:['ignore','pipe','pipe']});
 const query=(sql:string)=>JSON.parse(run(['--json','--command',sql])).flatMap((r:any)=>r.results||[]);
 const orgs=query('SELECT id FROM organization');if(orgs.length!==1)throw Error('SINGLE_TENANT_REQUIRED');const org=orgs[0].id,o=q(org);
 const actors=query(`SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=${o} AND r.role_code='MANAGEMENT' AND u.status='active' ORDER BY u.id LIMIT 1`);if(!actors.length)throw Error('MANAGEMENT_REQUIRED');const actor=actors[0].id;
 if(!query(`SELECT id FROM master_audit WHERE organization_id=${o} AND id='bekasi-analysis-v1' AND action='analysis_demo_applied'`).length)throw Error('BASE_ANALYSIS_REQUIRED');
 const marker=query(`SELECT occurred_at,after_json FROM master_audit WHERE organization_id=${o} AND id=${q(BEVERAGE_DEMO)}`)[0];
 if(marker){console.log(JSON.stringify({status:'already_applied',...JSON.parse(marker.after_json)}));return}
 if(query(`SELECT v.id FROM target_version v JOIN target_plan p ON p.id=v.target_plan_id WHERE v.organization_id=${o} AND v.status='approved' AND p.channel='field' AND p.period_start<='2026-11-30' AND p.period_end>='2026-11-01' LIMIT 1`).length)throw Error('NOVEMBER_TARGET_ALREADY_EXISTS_REVIEW_REQUIRED');
 if(query(`SELECT id FROM incentive_enrollment WHERE organization_id=${o} AND status='active' AND (user_id LIKE 'bekasi-demo-sales-%' OR user_id LIKE 'beverage-demo-v1-sales-%') AND period_start<='2026-11-30' AND period_end>='2026-11-01' LIMIT 1`).length)throw Error('INCENTIVE_OVERLAP_REVIEW_REQUIRED');
 const points=query(`SELECT * FROM customer_outlet WHERE organization_id=${o} AND directory_dataset_id='maps-warung-20261028' ORDER BY id`),oldLinks=query(`SELECT after_json FROM master_audit WHERE organization_id=${o} AND resource_type='demo_operation_point_link' AND id LIKE 'bekasi-demo-existing-point-overlay-v1:%' ORDER BY id`).map((r:any)=>JSON.parse(r.after_json));if(oldLinks.length!==200)throw Error('BASE_200_LOCATION_LINKS_REQUIRED');
 const data=buildBeverageDemo(org,actor,'2026-11-03T12:00:00Z',points,oldLinks),proof=reconcileBeveragePackage(data,org,actor,points);
 const skuConflict=query(`SELECT sku FROM product WHERE organization_id=${o} AND sku IN(${data.rows.product.map(p=>q(p.sku)).join(',')}) LIMIT 1`);if(skuConflict.length)throw Error('SKU_CODE_CONFLICT');
 for(const table of ['customer_outlet','invoice','app_user','master_audit'])if(query(`SELECT id FROM ${table} WHERE organization_id=${o} AND id LIKE ${q(BEVERAGE_PREFIX+'%')} LIMIT 1`).length)throw Error('PARTIAL_PACKAGE_REQUIRES_REVIEW');
 if(query(`SELECT id FROM customer_outlet WHERE organization_id=${o} AND external_code_key IN(${data.rows.customer_outlet.map(r=>q(r.external_code_key)).join(',')}) LIMIT 1`).length)throw Error('CUSTOMER_CODE_CONFLICT');
 const protectedQuery={customers:`SELECT * FROM customer_outlet WHERE organization_id=${o} AND id NOT LIKE ${q(BEVERAGE_PREFIX+'%')} ORDER BY id`,invoices:`SELECT * FROM invoice WHERE organization_id=${o} AND source_system<>'nyales-beverage-demo' ORDER BY id`,activities:`SELECT * FROM activity WHERE organization_id=${o} AND id NOT LIKE ${q(BEVERAGE_PREFIX+'%')} ORDER BY id`,targets:`SELECT * FROM target_version WHERE organization_id=${o} AND id NOT LIKE ${q(BEVERAGE_PREFIX+'%')} ORDER BY id`};
 const before=Object.fromEntries(Object.entries(protectedQuery).map(([k,sql])=>[k,hash(query(sql))]));
 console.log(JSON.stringify({phase:'preflight',...proof}));
 const sql=statements(data).join('\n');if(Buffer.byteLength(sql)>8*1024*1024)throw Error('PACKAGE_TOO_LARGE');
 const directory=mkdtempSync(join(tmpdir(),'nyales-beverage-'));
 try{const path=join(directory,'package.sql');writeFileSync(path,sql,{encoding:'utf8',mode:0o600});run(['--file',path])}finally{rmSync(directory,{recursive:true,force:true})}
 for(const [key,sql] of Object.entries(protectedQuery))if(hash(query(sql))!==before[key])throw Error('PROTECTED_DATA_CHANGED_'+key);
 for(const [table,rows] of Object.entries(data.rows)){if(table==='user_area_scope'||table==='invoice_source_event')continue;const n=query(`SELECT COUNT(*) n FROM ${table} WHERE organization_id=${o} AND id ${table==='master_audit'?"LIKE 'beverage-demo-v1%'":'LIKE '+q(BEVERAGE_PREFIX+'%')}`)[0].n;if(Number(n)!==rows.length)throw Error('COUNT_MISMATCH_'+table)}
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/beverage-demo-reconciliation.json',JSON.stringify({status:'applied',...proof,protected_data_unchanged:true},null,2));
 console.log(JSON.stringify({status:'applied',...proof,protected_data_unchanged:true}));
}
main().catch(e=>{console.error(String(e?.message||'BEVERAGE_APPLY_FAILED').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]'));process.exitCode=1});
