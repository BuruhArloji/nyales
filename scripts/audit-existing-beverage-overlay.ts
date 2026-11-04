import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertRoleReadOnlySql,assertRoleStaging} from './audit-outlet-role-candidates';
import {digest} from './outlet-role-candidate-data';
import {loadBekasiPointOverlay,applyBekasiOverlay} from '../src/server/bekasi-point-overlay';

export const BEVERAGE_AUDIT_SNAPSHOT='0cced8d51f2aba8d976609b238fa77481850f878cadb527e97aeecdb9b34548e';
export const BEVERAGE_DATASET='maps-warung-20261028';
export const BEVERAGE_PREFIX='beverage-demo-v1-';
const REPORT='test-results/beverage-overlay-audit.json',AUDIT_DATE='2026-11-04';
const q=(v:unknown)=>v===null?'NULL':typeof v==='number'?String(v):`'${String(v).replaceAll("'","''")}'`;
const parse=(v:any)=>{try{return typeof v==='string'?JSON.parse(v):v}catch{return null}};
const stable=(r:Record<string,unknown>)=>Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b)));
const binaryIdCompare=(a:unknown,b:unknown)=>Buffer.from(String(a)).compare(Buffer.from(String(b)));
export function sourceRowsDigest(rows:Record<string,unknown>[]){return digest([...rows].sort((a,b)=>binaryIdCompare(a.id,b.id)).map(stable));}

export function validateBeverageLinks(rows:any[],audits:any[],org:string){
 const demos=new Map(rows.filter(r=>String(r.id).startsWith(BEVERAGE_PREFIX+'customer-')).map(r=>[r.id,r]));
 const sources=new Map(rows.filter(r=>!String(r.id).startsWith(BEVERAGE_PREFIX+'customer-')).map(r=>[r.id,r]));
 if(audits.length!==800)return [];
 const links:any[]=[],ids=new Set<string>(),sourceIds=new Set<string>();
 for(const audit of audits){
  const p=parse(audit.after_json),before=parse(audit.before_json),d=p&&demos.get(p.demo_customer_id),s=p&&sources.get(p.source_customer_id);
  if(audit.organization_id!==org||audit.resource_id!==p?.demo_customer_id||before?.id!==p?.demo_customer_id||audit.resource_type!=='demo_operation_point_link'||audit.action!=='operation_point_link_selected'||!p||p.mapping_id!=='beverage-demo-v1'||p.synthetic_activity!==true||p.existing_point_overlay!==true||!d||!s||ids.has(d.id)||sourceIds.has(s.id))continue;
  if(d.organization_id!==org||d.outlet_type!=='retail_demo'||d.directory_dataset_id!==null||d.latitude_e7!==null||d.longitude_e7!==null||d.coordinate_status!=='missing'||d.record_status!=='active'||d.merged_into_id!=null)continue;
  if(s.organization_id!==org||s.directory_dataset_id!==BEVERAGE_DATASET||s.record_status!=='active'||s.merged_into_id!=null||!Number.isInteger(s.latitude_e7)||!Number.isInteger(s.longitude_e7))continue;
  if(p.source_customer_id!==s.id||p.source_external_code!==s.external_code||p.source_dataset_id!==s.directory_dataset_id||p.source_area_id!==s.area_id||p.source_version!==s.version||p.source_latitude_e7!==s.latitude_e7||p.source_longitude_e7!==s.longitude_e7||p.source_name!==s.name||p.source_address!==s.address||p.source_coordinate_status!==s.coordinate_status)continue;
  links.push(p);ids.add(d.id);sourceIds.add(s.id);
 }
 if(links.length!==800||ids.size!==800||sourceIds.size!==800)return [];
 return links;
}

export function validateDemoRows(rows:any[],links:any[],org:string){
 const demos=rows.filter(r=>String(r.id).startsWith(BEVERAGE_PREFIX+'customer-'));if(demos.length!==800)return false;
 const ids=new Set(demos.map(r=>r.id)),expected=new Set(Array.from({length:800},(_,i)=>BEVERAGE_PREFIX+'customer-'+(i+1)));
 const allowed=new Set(['bekasi-demo-sales-kota-01','bekasi-demo-sales-kota-02','bekasi-demo-sales-kab-01','bekasi-demo-sales-kab-02',...Array.from({length:6},(_,i)=>BEVERAGE_PREFIX+'sales-'+(i+1))]);
 return ids.size===800&&[...expected].every(id=>ids.has(id))&&demos.every(r=>r.organization_id===org&&r.outlet_type==='retail_demo'&&r.directory_dataset_id===null&&r.latitude_e7===null&&r.longitude_e7===null&&r.record_status==='active'&&r.merged_into_id==null&&(!r.field_rep_id||allowed.has(r.field_rep_id)))&&new Set(links.map(x=>x.source_customer_id)).size===800;
}

export function fixtureRows(){
 const rows:any[]=[];
 for(let i=1;i<=1000;i++){
  const demo=i>200,n=String(i-(demo?200:0)).padStart(3,'0');
  rows.push({id:demo?`${BEVERAGE_PREFIX}customer-${i-200}`:`bekasi-demo-customer-${n}`,organization_id:'org',outlet_type:'retail_demo',directory_dataset_id:null,latitude_e7:null,longitude_e7:null,coordinate_status:'missing',record_status:'active',merged_into_id:null,area_id:demo?'bekasi-demo-area-kota':i<=100?'bekasi-demo-area-kota':'bekasi-demo-area-kabupaten'});
  if(demo)rows.push({id:`source-${i}`,external_code:String(700000+i),organization_id:'org',outlet_type:'retail',directory_dataset_id:BEVERAGE_DATASET,latitude_e7:-62000000-i,longitude_e7:1069000000+i,coordinate_status:'unverified',record_status:'active',merged_into_id:null,area_id:i<=600?'maps-area-bekasi-kota':'maps-area-bekasi-kab',name:`Source ${i}`,address:`Address ${i}`,version:1});
 }
 return rows;
}

export function linkedActivitiesSql(org:string){return `SELECT COUNT(*) n FROM invoice i JOIN sales_order o ON o.organization_id=i.organization_id AND o.external_reference=i.external_invoice_id AND o.customer_id=i.outlet_id AND o.user_id=i.rep_id JOIN activity a ON a.organization_id=i.organization_id AND a.outlet_id=i.outlet_id AND a.user_id=i.rep_id AND json_extract(a.metadata_json,'$.order_id')=o.id JOIN work_plan p ON p.organization_id=i.organization_id AND p.customer_id=i.outlet_id AND p.user_id=i.rep_id AND json_extract(a.metadata_json,'$.work_plan_id')=p.id WHERE i.organization_id=${q(org)} AND i.source_system='nyales-beverage-demo' AND i.invoice_date>='2026-11-01' AND i.invoice_date<'2026-12-01' AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated'`}
export function currentAssignmentSql(org:string,ids:string[]){return `SELECT ca.outlet_id,ca.rep_id,ca.area_id,ca.channel,u.name rep_name FROM customer_assignment ca JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id WHERE ca.organization_id=${q(org)} AND ca.channel='field' AND ca.outlet_id IN (${ids.map(q).join(',')}) AND ca.effective_from_date<='${AUDIT_DATE}' AND (ca.effective_to_date IS NULL OR ca.effective_to_date>'${AUDIT_DATE}')`}
export function validateCurrentAssignments(rows:any[],ids:string[],reps:string[]){const by=new Map<string,any[]>();for(const r of rows)by.set(r.outlet_id,[...(by.get(r.outlet_id)||[]),r]);return ids.length===1000&&ids.every(id=>by.get(id)?.length===1&&reps.includes(by.get(id)![0].rep_id));}
export function validateCoordinateInvariant(before:any[],after:any[]){const b=new Map(before.map(r=>[r.id,`${r.latitude_e7},${r.longitude_e7}`])),a=new Map(after.map(r=>[r.id,`${r.latitude_e7},${r.longitude_e7}`]));return b.size===before.length&&a.size===after.length&&b.size===a.size&&[...b].every(([id,c])=>a.get(id)===c);}

class AuditQueryError extends Error{constructor(public providerError:string,public limitEvidence:string[]){super('STAGING_AUDIT_QUERY_FAILED');}}
function auditQuery(sql:string){
 assertRoleReadOnlySql(sql);let text:string;
 try{text=execFileSync('npx',['wrangler','d1','execute','nyales-staging','--remote','--yes','--config','wrangler.staging.generated.json','--json','--command',sql],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024})}
 catch(error){const e=error as any,raw=String(e.stderr||'')+'\n'+String(e.stdout||''),code=(raw.match(/(?:code|status)\s*[:=]?\s*(\d{3,})/i)||[])[1]||String(e.status??'UNKNOWN'),evidence=raw.split(/\r?\n/).filter(x=>/(quota|limit|exceed|provider|error)/i.test(x)).slice(0,5).map(x=>x.replace(/CLOUDFLARE_API_TOKEN[^\s]*/gi,'[redacted]').replace(/[A-Za-z0-9_-]{20,}/g,'[redacted]').slice(0,240));throw new AuditQueryError(code,evidence)}
 const parsed=JSON.parse(text.trim());if(!Array.isArray(parsed))throw Error('STAGING_AUDIT_RESULTS_INVALID');return parsed.flatMap((x:any)=>x.results||[]);
}
function adapter(){return {prepare(sql:string){assertRoleReadOnlySql(sql);return {bind:(...args:any[])=>{let i=0;const rendered=sql.replaceAll('?',()=>q(args[i++]));assertRoleReadOnlySql(rendered);return {all:async()=>({results:auditQuery(rendered)}),first:async()=>auditQuery(rendered)[0]||null};}}}} as unknown as D1Database;}
function loadRows(org:string){const out:any[]=[];let last='';while(true){const tail=last?` AND id>${q(last)}`:'';const batch=auditQuery(`SELECT * FROM customer_outlet WHERE organization_id=${q(org)}${tail} ORDER BY id LIMIT 1000`) as any[];if(!batch.length)break;out.push(...batch);last=String(batch.at(-1).id);if(batch.length<1000)break;}return out;}
function enrich(rows:any[],org:string){const ids=rows.filter(r=>r.outlet_type==='retail_demo').map(r=>r.id),assignments=auditQuery(currentAssignmentSql(org,ids)) as any[],by=new Map(assignments.map(a=>[a.outlet_id,a]));return rows.map(r=>{const a=by.get(r.id);return {...r,lat:r.latitude_e7===null?null:r.latitude_e7/1e7,lng:r.longitude_e7===null?null:r.longitude_e7/1e7,field_rep_id:a?.rep_id||null,owner:a?.rep_name||null,status:r.status||null,area:r.area_id};});}
function summaryBase(org:string){return {phase:'beverage_overlay_audit',target:'nyales-staging',organization_id:org,status:'blocked',already_linked:null,read_only:true,business_writes:0,production_touched:false};}

export async function auditExistingBeverageOverlay(){
 let report:any=summaryBase('unknown');try{
  if(process.argv.includes('--apply'))throw Error('APPLY_FORBIDDEN_READ_ONLY_AUDIT');
  const config=JSON.parse(readFileSync('wrangler.staging.generated.json','utf8'));assertRoleStaging(config,process.env,process.argv.includes('--remote'));
  const orgs=auditQuery('SELECT id FROM organization ORDER BY id');if(orgs.length!==1)throw Error('SINGLE_STAGING_TENANT_REQUIRED');const org=String(orgs[0].id);report=summaryBase(org);
  const customers=loadRows(org),hash=sourceRowsDigest(customers);report.customer_rows=customers.length;report.source_snapshot_sha256=hash;if(hash!==BEVERAGE_AUDIT_SNAPSHOT)throw Error('SOURCE_SNAPSHOT_DRIFT');
  const audits=auditQuery(`SELECT organization_id,resource_id,resource_type,action,before_json,after_json FROM master_audit WHERE organization_id=${q(org)} AND id LIKE '${BEVERAGE_PREFIX}link-%' AND action='operation_point_link_selected' ORDER BY id`) as any[],links=validateBeverageLinks(customers,audits,org);if(!validateDemoRows(customers,links,org)||links.length!==800)throw Error('BEVERAGE_LINKS_INCOMPLETE');
  const enriched=enrich(customers,org),loaded=await loadBekasiPointOverlay(adapter(),org,enriched,{channel:'field',period:'2026-11'},'staging');if(!loaded.enabled||loaded.links.length!==1000)throw Error('OVERLAY_LOADER_LINK_COUNT_MISMATCH');
  const reps=['bekasi-demo-sales-kota-01','bekasi-demo-sales-kota-02','bekasi-demo-sales-kab-01','bekasi-demo-sales-kab-02',...Array.from({length:6},(_,i)=>BEVERAGE_PREFIX+'sales-'+(i+1))],users=auditQuery(`SELECT id,auth_subject,status FROM app_user WHERE organization_id=${q(org)} AND id IN (${reps.map(q).join(',')})`) as any[];if(users.length!==10||users.some(u=>u.auth_subject!==null||u.status!=='active'))throw Error('DUMMY_ROSTER_AUTH_OR_STATUS_INVALID');
  const linkedIds=loaded.links.map((x:any)=>x.demo_customer_id),assignments=auditQuery(currentAssignmentSql(org,linkedIds)) as any[];if(!validateCurrentAssignments(assignments,linkedIds,reps))throw Error('CURRENT_ASSIGNMENT_SCOPE_INVALID');
  const applied=applyBekasiOverlay(enriched,loaded.links,loaded.metrics,{channel:'field',period:'2026-11'});if(!validateCoordinateInvariant(enriched,applied.allCustomers))throw Error('OVERLAY_COORDINATES_CHANGED');
  const sum=(k:string)=>[...loaded.metrics.values()].reduce((n:any,r:any)=>n+Number(r[k]||0),0),metrics={invoices:sum('invoice_count'),activities:sum('activity_count'),orders:sum('order_count'),actual_minor:sum('actual_minor')};if(JSON.stringify(metrics)!==JSON.stringify({invoices:400,activities:400,orders:400,actual_minor:370524000}))throw Error('NOVEMBER_METRICS_MISMATCH');
  const repCounts=auditQuery(`SELECT rep_id user_id,COUNT(*) n FROM invoice WHERE organization_id=${q(org)} AND rep_id IN (${reps.map(q).join(',')}) AND source_system='nyales-beverage-demo' AND invoice_date>='2026-11-01' AND invoice_date<'2026-12-01' AND is_current=1 AND status='validated' AND validation_state='validated' GROUP BY rep_id ORDER BY rep_id`) as any[];if(repCounts.length!==10||repCounts.some(r=>!reps.includes(r.user_id)||Number(r.n)!==40))throw Error('PER_REP_INVOICE_COUNT_MISMATCH');
  const linkedOrders=auditQuery(`SELECT COUNT(*) n FROM invoice i JOIN sales_order o ON o.organization_id=i.organization_id AND o.external_reference=i.external_invoice_id AND o.customer_id=i.outlet_id AND o.user_id=i.rep_id WHERE i.organization_id=${q(org)} AND i.source_system='nyales-beverage-demo' AND i.invoice_date>='2026-11-01' AND i.invoice_date<'2026-12-01' AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated'`) as any[],linkedActivities=auditQuery(linkedActivitiesSql(org)) as any[],lineTotals=auditQuery(`SELECT COUNT(*) n,SUM(l.net_minor) total FROM invoice_line l JOIN invoice i ON i.id=l.invoice_id WHERE i.organization_id=${q(org)} AND i.source_system='nyales-beverage-demo' AND i.invoice_date>='2026-11-01' AND i.invoice_date<'2026-12-01' AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated'`) as any[];if(Number(linkedOrders[0]?.n)!==400||Number(linkedActivities[0]?.n)!==400||Number(lineTotals[0]?.n)!==1200||Number(lineTotals[0]?.total)!==370524000)throw Error('BEVERAGE_RECORD_RECONCILIATION_FAILED');
  const baseLinks=loaded.links.filter((x:any)=>String(x.demo_customer_id).startsWith('bekasi-demo-customer-')).length;report={...report,status:'complete',already_linked:true,source_points:800,total_linked:1000,base_links:baseLinks,beverage_links:links.length,coordinate_bearing_rows:enriched.filter(r=>r.latitude_e7!==null&&r.longitude_e7!==null).length,additional_map_points:0,metrics,per_rep_records:40};
 }catch(e){report={...report,status:'blocked',already_linked:null,business_writes:0,error_code:String(e instanceof AuditQueryError?'STAGING_AUDIT_QUERY_FAILED':e instanceof Error?e.message:'BEVERAGE_AUDIT_FAILED').replace(/\s+/g,'_').slice(0,80),provider_error:e instanceof AuditQueryError?e.providerError:undefined,limit_evidence:e instanceof AuditQueryError?e.limitEvidence:undefined};}
 mkdirSync('test-results',{recursive:true});writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status!=='complete')throw Error(report.error_code);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){auditExistingBeverageOverlay().catch(()=>{process.exitCode=1});}
