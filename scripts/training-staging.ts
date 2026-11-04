import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildTrainingPackage,type TrainingPoint} from './training-data-package';

type Row=Record<string,string|number|null>;
export type StagingTrainingPoint=TrainingPoint & {organization_id:string;area_id:string;record_status:string;merged_into_id:string|null;external_code?:string|null;external_code_key?:string|null};
export type StagingInventory={organizationId:string;managementId:string;month:string;asOf:string;points:StagingTrainingPoint[];areas:Row[];products:Row[];approvedTargets:Array<{id:string;channel:string;period_start:string;period_end:string}>;capturedAt:string;unusedConfirmed:true};
const j=JSON.stringify,q=(v:string|number|null)=>v===null?'NULL':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'",sha=(v:unknown)=>createHash('sha256').update(j(v)).digest('hex');
const JSON_COLUMNS=new Set(['metadata_json','payload_json','before_json','after_json','lines_json','submit_snapshot_json','approval_review_json','assignment_snapshot_json','hierarchy_snapshot_json','target_items_json','area_ids_json','inputs_json','result_json','preview_json','review_flags_json','baseline_json']);

/** Package-only: never contacts Cloudflare and never inserts or updates imported customers. */
export function buildStagingTrainingPackage(input:StagingInventory){
 if(!input.organizationId||input.organizationId==='demo-org'||!input.managementId||input.unusedConfirmed!==true)throw Error('VERIFIED_PILOT_INVENTORY_REQUIRED');
 if(input.points.length<10||input.points.length>1000)throw Error('POINT_COUNT_OUT_OF_RANGE');
 const areaById=new Map(input.areas.map(a=>[a.id,a])),points=input.points.slice().sort((a,b)=>a.id.localeCompare(b.id));
 for(const point of points){const a=areaById.get(point.area_id);if(point.organization_id!==input.organizationId||point.record_status!=='active'||point.merged_into_id||!point.directory_dataset_id||!a||a.organization_id!==input.organizationId||a.status!=='active')throw Error('POINT_NOT_ACTIVE_IMPORTED_PILOT_CUSTOMER');if(!Number.isInteger(point.latitude_e7)||!Number.isInteger(point.longitude_e7))throw Error('SOURCE_COORDINATES_REQUIRED');}
 const areaName=(a:Row)=>String(a.name).startsWith('Kabupaten Bekasi')?'Kabupaten Bekasi':String(a.name).startsWith('Kota Bekasi')?'Kota Bekasi':null;
 if(input.areas.some(a=>!areaName(a)))throw Error('ONLY_BEKASI_AREAS_SUPPORTED');
 const local=buildTrainingPackage({month:input.month,asOf:input.asOf,customerCount:points.length,points:points.map(p=>({...p,area_name:areaName(areaById.get(p.area_id)!)!}))}),old=local.manifest.dataset;
 const dataset='training-staging-v1-'+sha({org:input.organizationId,month:input.month,asOf:input.asOf,ids:points.map(p=>p.id)}).slice(0,12),map=new Map<string,string>([['demo-org',input.organizationId],['demo-management',input.managementId],[old,dataset]]);
 for(const [table,records] of Object.entries(local.rows))for(const row of records)if(typeof row.id==='string')map.set(row.id,row.id.replace(old,dataset));
 for(const link of local.links as Array<{customer_id:string;source_customer_id:string}>)map.set(link.customer_id,link.source_customer_id);
 for(const area of local.rows.area){const target=input.areas.find(a=>areaName(a)===area.name);if(!target)throw Error('MISSING_EXISTING_BEKASI_AREA');map.set(String(area.id),String(target.id));}
 map.set('demo-management',input.managementId);
 map.set('demo-org',input.organizationId);
 const reusedProductIds=new Set<string>();
 const skuMap=new Map<string,string>(),reservedSkus=new Set(input.products.map(p=>String(p.sku)));let nextSku=2001;
 for(const product of local.rows.product){const candidates=input.products.filter(p=>p.organization_id===input.organizationId&&p.brand===product.brand&&p.flavour===product.flavour&&Number(p.size_ml)===product.size_ml&&p.packaging===product.packaging&&p.base_unit===product.base_unit&&Number(p.quantity_scale)===1&&p.status==='active');if(candidates.length>1)throw Error('AMBIGUOUS_PRODUCT_DIMENSIONS');const existing=candidates[0];if(existing){map.set(String(product.id),String(existing.id));skuMap.set(String(product.sku),String(existing.sku));reusedProductIds.add(String(existing.id));}else{while(reservedSkus.has(String(nextSku)))nextSku++;if(nextSku>9999)throw Error('NO_SHORT_SKU_AVAILABLE');skuMap.set(String(product.sku),String(nextSku));reservedSkus.add(String(nextSku++));}}
 const replace=(v:unknown):unknown=>{
  if(typeof v==='string'){if(map.has(v))return map.get(v)!;return v.replaceAll(old,dataset).replaceAll('demo-org',input.organizationId).replaceAll('demo-management',input.managementId).replaceAll('latihan lokal','latihan staging');}
  if(Array.isArray(v))return v.map(replace);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,(k==='sku'||k==='sku_snapshot')&&typeof x==='string'?(skuMap.get(x)??x):replace(x)]));return v;
 };
 const rows:Record<string,Row[]>={};
 const omit=new Set(['organization','customer_outlet','area','branch','work_calendar','customer_source_coverage','customer_tier_rule']);
 for(const [table,records] of Object.entries(local.rows)){
  if(omit.has(table))continue;
  rows[table]=records.map(record=>Object.fromEntries(Object.entries(record).map(([k,v])=>[k,(k==='sku'||k==='sku_snapshot')&&typeof v==='string'?(skuMap.get(v)??v):JSON_COLUMNS.has(k)&&typeof v==='string'?j(replace(JSON.parse(v))):replace(v)])) as Row).filter(r=>!(table==='app_user'&&r.id===input.managementId)&&!(table==='auth_role_assignment'&&r.user_id===input.managementId)&&!(table==='user_area_scope'&&r.user_id===input.managementId)&&!(table==='product'&&reusedProductIds.has(String(r.id)))&&!(table==='product_price'&&reusedProductIds.has(String(r.product_id))));
 }
 // Reused products retain their group and price masters; invoice snapshots must reflect that group.
 for(const line of rows.invoice_line)if(reusedProductIds.has(String(line.product_id))){const existing=input.products.find(p=>p.id===line.product_id)!;line.product_group_id_snapshot=existing.product_group_id??null;line.group_code_snapshot=existing.group_code??null;}
 const deferred=new Set<string>();
 for(const version of rows.target_version){const plan=rows.target_plan.find(p=>p.id===version.target_plan_id)!;if(version.status==='draft'&&!String(plan.name).startsWith('Rencana target')&&input.approvedTargets.some(p=>p.channel===plan.channel&&p.period_start<=String(plan.period_end)&&p.period_end>=String(plan.period_start)))deferred.add(String(version.id));}
 for(const plan of rows.target_plan)if(rows.target_version.some(v=>v.target_plan_id===plan.id&&deferred.has(String(v.id))))plan.status='draft';
 for(const item of rows.target_item)if(deferred.has(String(item.target_version_id)))item.status='draft';
 const deferredPlans=new Set(rows.incentive_plan_version.filter(v=>deferred.has(String(v.target_version_id))).map(v=>String(v.id)));
 for(const version of rows.incentive_plan_version)if(deferredPlans.has(String(version.id)))version.status='draft';
 for(const plan of rows.incentive_plan)if(rows.incentive_plan_version.some(v=>v.plan_id===plan.id&&deferredPlans.has(String(v.id))))plan.status='draft';
 for(const enrollment of rows.incentive_enrollment)if(deferredPlans.has(String(enrollment.plan_version_id))){enrollment.status='draft';enrollment.target_items_json=j(JSON.parse(String(enrollment.target_items_json)).map((r:Row)=>({...r,status:'draft'})));}
 for(const run of rows.calculation_run){const inputs=JSON.parse(String(run.inputs_json));if(deferredPlans.has(String(run.plan_version_id))){inputs.review_flags=[...inputs.review_flags,'TARGET_NOT_APPROVED'];inputs.target_items=inputs.target_items.map((r:Row)=>({...r,status:'draft'}));}inputs.dataset=dataset;run.inputs_json=j(inputs);run.source_hash=sha(inputs);}
 for(const statement of rows.incentive_statement){statement.status='prepared';statement.finalized_by=null;statement.finalized_at=null;if(deferredPlans.has(String(statement.plan_version_id)))statement.review_flags_json=j([...JSON.parse(String(statement.review_flags_json)),'TARGET_NOT_APPROVED']);}
 // Uniqueness must also hold against the legacy organization invoice/source keys.
 const tag=dataset.slice(-6).toUpperCase();
 for(const table of ['invoice','credit_note','sales_order'])for(const row of rows[table])for(const key of ['source_invoice_id','external_invoice_id','source_credit_id','client_order_id','external_reference'])if(typeof row[key]==='string'&&/^(INV|SO|CN)\//.test(String(row[key])))row[key]=String(row[key]).replace(/\/(D?P?\d+)$/,'/'+tag+'-$1');
 // JSON source references must use the same display invoice numbers after namespacing.
 for(const records of Object.values(rows))for(const row of records)for(const key of JSON_COLUMNS)if(typeof row[key]==='string')row[key]=String(row[key]).replace(/((?:INV|SO|CN)\/\d{6}\/)\b(D?P?\d+)\b/g,'$1'+tag+'-$2');
 for(const run of rows.calculation_run)run.source_hash=sha(JSON.parse(String(run.inputs_json)));
 const customerHash=sha(points),manifest={dataset,classification:'synthetic',environment:'staging',organization_id:input.organizationId,actor_id:input.managementId,as_of:input.asOf,periods:local.manifest.periods,customer_count:points.length,customer_master_inserts:0,customer_master_updates:0,source_customer_sha256:customerHash,source_preserved:true,existing_products_reused:reusedProductIds.size,deferred_target_versions:[...deferred],all_statements:'prepared',gps:'not_collected',provider_verified:false,payment_executed:false,captured_at:input.capturedAt,counts:Object.fromEntries(Object.entries(rows).map(([t,r])=>[t,r.length]))};
 rows.master_audit=[{id:dataset+'-manifest',organization_id:input.organizationId,actor_id:input.managementId,resource_type:'training_dataset',resource_id:dataset,action:'staging_training_package',occurred_at:input.asOf+'T01:00:00.000Z',before_json:null,after_json:j(manifest)}];
 const statements:string[]=[];
 for(const [table,records] of Object.entries(rows)){
  for(const row of records){const keys=Object.keys(row),identity='id'in row?['id']:table==='user_area_scope'?['organization_id','user_id','area_id','effective_from_date']:['invoice_id','credit_id'];const sql=`INSERT INTO ${table}(${keys.join(',')}) SELECT ${keys.map(k=>q(row[k])).join(',')} WHERE NOT EXISTS(SELECT 1 FROM ${table} WHERE ${identity.map(k=>k+'='+q(row[k])).join(' AND ')})`+(table==='target_item'?` AND EXISTS(SELECT 1 FROM target_version WHERE id=${q(row.target_version_id)} AND status='draft')`:'')+';';if(Buffer.byteLength(sql)>95000)throw Error('D1_STATEMENT_TOO_LARGE');statements.push(sql);}
  if(table==='target_item')for(const version of rows.target_version){const plan=rows.target_plan.find(p=>p.id===version.target_plan_id)!;if(plan.status==='approved'&&!deferred.has(String(version.id)))statements.push(`UPDATE target_version SET status='approved' WHERE organization_id=${q(input.organizationId)} AND id=${q(version.id)} AND status='draft';`);}
 }
 return{rows,manifest,sql:statements.join('\n')+'\n',points};
}

/** Read-only snapshot preparation; remote inventory must be refreshed before applying elsewhere. */
export function stagingInventoryFromSnapshot(path:string,month:string,asOf:string,count=200):StagingInventory{
 const db=new DatabaseSync(resolve(path),{readOnly:true});try{
  const orgs=db.prepare('SELECT id FROM organization').all() as Row[];if(orgs.length!==1)throw Error('SINGLE_ORGANIZATION_REQUIRED');const organizationId=String(orgs[0].id),manager=db.prepare("SELECT u.id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=? AND u.status='active' AND r.role_code='MANAGEMENT' ORDER BY u.id LIMIT 1").get(organizationId) as Row;if(!manager)throw Error('MANAGEMENT_REQUIRED');
  const areas=db.prepare("SELECT * FROM area WHERE organization_id=? AND id IN('maps-area-bekasi-kota','maps-area-bekasi-kab') AND status='active' ORDER BY id").all(organizationId) as Row[];
  const points=areas.flatMap((a,n)=>db.prepare(`SELECT c.*,a.name area_name FROM customer_outlet c JOIN area a ON a.id=c.area_id AND a.organization_id=c.organization_id WHERE c.organization_id=? AND c.area_id=? AND c.directory_dataset_id IS NOT NULL AND c.record_status='active' AND c.merged_into_id IS NULL AND c.latitude_e7 IS NOT NULL AND c.longitude_e7 IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=c.organization_id AND ca.outlet_id=c.id) AND NOT EXISTS(SELECT 1 FROM invoice i WHERE i.organization_id=c.organization_id AND i.outlet_id=c.id) AND NOT EXISTS(SELECT 1 FROM activity ac WHERE ac.organization_id=c.organization_id AND ac.outlet_id=c.id) AND NOT EXISTS(SELECT 1 FROM master_audit m WHERE m.organization_id=c.organization_id AND m.resource_type='demo_operation_point_link' AND json_extract(m.after_json,'$.source_customer_id')=c.id) ORDER BY c.id LIMIT ?`).all(organizationId,a.id,n===0?Math.ceil(count/2):Math.floor(count/2)) as StagingTrainingPoint[]);if(points.length!==count)throw Error('NOT_ENOUGH_UNUSED_IMPORTED_POINTS');
  const products=db.prepare('SELECT p.*,g.code group_code FROM product p LEFT JOIN product_group g ON g.id=p.product_group_id AND g.organization_id=p.organization_id WHERE p.organization_id=?').all(organizationId) as Row[];
  const approvedTargets=db.prepare("SELECT v.id,p.channel,p.period_start,p.period_end FROM target_version v JOIN target_plan p ON p.id=v.target_plan_id AND p.organization_id=v.organization_id WHERE v.organization_id=? AND v.status='approved'").all(organizationId) as StagingInventory['approvedTargets'];
  return{organizationId,managementId:String(manager.id),month,asOf,points,areas,products,approvedTargets,capturedAt:new Date().toISOString(),unusedConfirmed:true};
 }finally{db.close()}
}

export function validateStagingTrainingPackage(inventory:StagingInventory,bundle:ReturnType<typeof buildStagingTrainingPackage>){
 const db=new DatabaseSync(':memory:');try{
  for(const name of readdirSync('migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+name,'utf8'));db.exec('PRAGMA foreign_keys=ON');
  const add=(table:string,row:Row)=>{const allowed=new Set((db.prepare('PRAGMA table_info('+table+')').all() as Row[]).map(r=>r.name)),keys=Object.keys(row).filter(k=>allowed.has(k));db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));};
  add('organization',{id:inventory.organizationId,name:'Existing pilot'});add('app_user',{id:inventory.managementId,organization_id:inventory.organizationId,name:'Existing Management'});for(const area of inventory.areas)add('area',{...area,branch_id:null});for(const dataset of new Set(inventory.points.map(p=>p.directory_dataset_id!)))add('point_directory_dataset',{id:dataset,organization_id:inventory.organizationId,name:'Existing source',source_reference:'Existing source',source_sha256:'0'.repeat(64),storage_key:'existing',storage_sha256:'0'.repeat(64),byte_count:1,reference_count:0,customer_expected_count:inventory.points.length,held_count:0,created_by:inventory.managementId,created_at:inventory.asOf,status:'ready'});for(const point of inventory.points)add('customer_outlet',point);
  for(const product of inventory.products){if(product.product_group_id&&!db.prepare('SELECT id FROM product_group WHERE id=?').get(product.product_group_id))add('product_group',{id:product.product_group_id,organization_id:inventory.organizationId,code:product.group_code??'Existing group',name:'Existing group'});add('product',product);}
  for(const [n,p] of inventory.approvedTargets.entries()){const pid='protected-plan-'+n;add('target_plan',{id:pid,organization_id:inventory.organizationId,name:'Existing target',method:'bottom_up',channel:p.channel,period_start:p.period_start,period_end:p.period_end});add('target_version',{id:p.id,organization_id:inventory.organizationId,target_plan_id:pid,revision_no:1,status:'approved',parent_minor:100,created_by:inventory.managementId,created_at:inventory.asOf,reason:'Existing data'});}
  const protectedBefore=j(db.prepare('SELECT * FROM customer_outlet ORDER BY id').all());for(const statement of bundle.sql.trim().split('\n'))try{db.exec(statement)}catch(error){throw Error('PACKAGE_STATEMENT_FAILED '+statement.slice(0,110)+' '+String(error))};const totals=()=>j(db.prepare('SELECT COUNT(*) n,SUM(net_minor) total FROM invoice').get()),before=totals();db.exec(bundle.sql);if(totals()!==before)throw Error('NON_IDEMPOTENT');if(j(db.prepare('SELECT * FROM customer_outlet ORDER BY id').all())!==protectedBefore)throw Error('CUSTOMER_MASTER_CHANGED');if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('FK_FAILED');if(db.prepare('SELECT i.id FROM invoice i JOIN invoice_line l ON l.invoice_id=i.id GROUP BY i.id HAVING i.net_minor<>SUM(l.net_minor)').all().length)throw Error('INVOICE_LINES_MISMATCH');
  return{foreign_keys:'ok',idempotent:true,customer_masters:'unchanged',invoice_lines:'reconciled',totals:JSON.parse(totals())};
 }finally{db.close()}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),get=(flag:string)=>args[args.indexOf(flag)+1];if(args.includes('--remote')||args.includes('--apply'))throw Error('PACKAGE_ONLY_ROOT_APPLIES_REVIEWED_SQL');if(!args.includes('--inventory')||!args.includes('--out'))throw Error('USE --inventory FILE --out DIRECTORY');
 const inventory=JSON.parse(readFileSync(get('--inventory'),'utf8')) as StagingInventory,bundle=buildStagingTrainingPackage(inventory),validation=validateStagingTrainingPackage(inventory,bundle),out=resolve(get('--out'));mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'package.sql'),bundle.sql);writeFileSync(resolve(out,'manifest.json'),j({...bundle.manifest,validation,sql_sha256:createHash('sha256').update(bundle.sql).digest('hex')})+'\n');writeFileSync(resolve(out,'protected-customer-ids.json'),j(bundle.points.map(p=>p.id))+'\n');console.log(j({out,...bundle.manifest,validation}));
}
