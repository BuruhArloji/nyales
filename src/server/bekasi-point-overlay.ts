import {mapPeriod} from './map-metrics';
import {BEKASI_DIRECTORY_DATASET_ID,BEKASI_POINT_OVERLAY_DISCLAIMER,BEKASI_POINT_OVERLAY_ID,type BekasiOperationOverlay} from '../shared/bekasi-demo-overlay';

export const BEKASI_DEMO_PREFIX='bekasi-demo-customer-';
const DATASET='bekasi-field-sales-2026-08-10';
const GROUPS=[
 {demoArea:'bekasi-demo-area-kota',sourceArea:'maps-area-bekasi-kota',start:1},
 {demoArea:'bekasi-demo-area-kabupaten',sourceArea:'maps-area-bekasi-kab',start:101},
] as const;

type Customer=Record<string,any>&{id:string;organization_id?:string;area_id:string;name:string;address:string|null;latitude_e7:number|null;longitude_e7:number|null;coordinate_status:string;directory_dataset_id:string|null;version:number;record_status:string;merged_into_id?:string|null;field_rep_id?:string|null;telesales_rep_id?:string|null;owner?:string;status?:string;lat:number|null;lng:number|null};
type Link= {mapping_id:string;synthetic_activity:true;existing_point_overlay:true;demo_customer_id:string;demo_area_id:string;source_customer_id:string;source_external_code:string|null;source_dataset_id:string;source_area_id:string;source_name:string;source_address:string|null;source_latitude_e7:number;source_longitude_e7:number;source_version:number;source_coordinate_status:string;before:Customer};
type Filters={areaId?:string|null;repId?:string|null;channel:'field'|'telesales';status?:string|null;period?:string|null};

function demoNumber(id:string){const n=Number(id.slice(BEKASI_DEMO_PREFIX.length));return Number.isInteger(n)&&n>=1&&n<=200?n:null}
function expectedGroup(id:string){const n=demoNumber(id);return n===null?null:n<=100?GROUPS[0]:GROUPS[1]}
function coordKey(r:{latitude_e7:number;longitude_e7:number}){return `${r.latitude_e7},${r.longitude_e7}`}
function parse(value:any){try{return typeof value==='string'?JSON.parse(value):value}catch{return null}}
function isCustomer(row:any):row is Customer{return Boolean(row&&typeof row.id==='string'&&typeof row.area_id==='string')}

/** Pure validation of the immutable audit sidecar against the already scoped raw rows. */
export function validBekasiOverlayLinks(rows:Customer[],auditRows:any[],organizationId:string):Link[]{
 const demos=new Map(rows.filter(r=>r.id.startsWith(BEKASI_DEMO_PREFIX)).map(r=>[r.id,r]));
 const sources=new Map(rows.filter(r=>!r.id.startsWith(BEKASI_DEMO_PREFIX)).map(r=>[r.id,r]));
 const links:Link[]=[];const sourceIds=new Set<string>();const coords=new Set<string>();
 for(const audit of auditRows){
  const p=parse(audit.after_json);const before=parse(audit.before_json);const demo=demos.get(audit.resource_id);const source= p&&sources.get(p.source_customer_id);const group=expectedGroup(audit.resource_id);
  if(audit.organization_id!==organizationId||audit.resource_type!=='demo_operation_point_link'||audit.action!=='operation_point_link_selected'||audit.resource_id!==p?.demo_customer_id||p?.mapping_id!==BEKASI_POINT_OVERLAY_ID||p?.synthetic_activity!==true||p?.existing_point_overlay!==true||!group||!isCustomer(demo)||!isCustomer(source)||sourceIds.has(source.id)||coords.has(`${p.source_latitude_e7},${p.source_longitude_e7}`))continue;
  if(demo.organization_id!==organizationId||demo.area_id!==group.demoArea||demo.directory_dataset_id!==null||demo.latitude_e7!==null||demo.longitude_e7!==null||demo.coordinate_status!=='missing'||demo.record_status!=='active'||demo.version!==1||demo.merged_into_id!=null||before?.id!==demo.id)continue;
  if(source.organization_id!==organizationId||source.area_id!==group.sourceArea||source.directory_dataset_id!==BEKASI_DIRECTORY_DATASET_ID||source.record_status!=='active'||source.merged_into_id!=null||!Number.isInteger(source.latitude_e7)||!Number.isInteger(source.longitude_e7)||p.source_dataset_id!==BEKASI_DIRECTORY_DATASET_ID||p.source_area_id!==source.area_id||p.source_version!==source.version||p.source_latitude_e7!==source.latitude_e7||p.source_longitude_e7!==source.longitude_e7||p.source_name!==source.name||p.source_address!==source.address)continue;
  links.push(p as Link);sourceIds.add(source.id);coords.add(coordKey({latitude_e7:p.source_latitude_e7,longitude_e7:p.source_longitude_e7}));
 }
 return links.length===200&&new Set(links.map(x=>x.demo_customer_id)).size===200&&links.filter(x=>x.demo_area_id===GROUPS[0].demoArea&&x.source_area_id===GROUPS[0].sourceArea).length===100&&links.filter(x=>x.demo_area_id===GROUPS[1].demoArea&&x.source_area_id===GROUPS[1].sourceArea).length===100?links:[];
}

function matches(link:Link,demo:Customer,source:Customer,filters:Filters){
 if(filters.channel==='telesales')return false;
 if(filters.areaId&&source.area_id!==filters.areaId&&demo.area_id!==filters.areaId)return false;
 if(filters.repId&&source.field_rep_id!==filters.repId&&demo.field_rep_id!==filters.repId)return false;
 if(filters.status&&source.status!==filters.status&&demo.status!==filters.status)return false;
 return true;
}

export function applyBekasiOverlay(rows:Customer[],links:Link[],metrics:Map<string,Pick<BekasiOperationOverlay,'activity_count'|'productive_count'|'follow_up_count'|'no_show_count'|'order_count'|'invoice_count'|'actual_minor'>> ,filters:Filters){
 const byId=new Map(rows.map(r=>[r.id,r]));const out=rows.map(r=>({...r}));const outById=new Map(out.map(r=>[r.id,r]));let linked=0;
 for(const link of links){const demo=byId.get(link.demo_customer_id),source=byId.get(link.source_customer_id);if(!demo||!source||!matches(link,demo,source,filters))continue;linked++;
  const m=metrics.get(demo.id)||{activity_count:0,productive_count:0,follow_up_count:0,no_show_count:0,order_count:0,invoice_count:0,actual_minor:0};
  const overlay:BekasiOperationOverlay={mapping_id:BEKASI_POINT_OVERLAY_ID,demo_customer_id:demo.id,demo_customer_name:demo.name,demo_area_id:demo.area_id,demo_area_name:demo.area||demo.area_id,demo_rep_id:demo.field_rep_id||null,demo_rep_name:demo.owner||'Belum assigned',period_start:filters.period?mapPeriod(filters.period).start:'2026-08-01',period_end:filters.period?new Date(Date.parse(mapPeriod(filters.period).end)-86400000).toISOString().slice(0,10):'2026-10-31',...m,disclaimer:BEKASI_POINT_OVERLAY_DISCLAIMER,source_customer_id:source.id,source_dataset_id:BEKASI_DIRECTORY_DATASET_ID,coordinate_status:'unverified'};
  outById.get(source.id)!.demo_operation_overlay=overlay;
  outById.get(demo.id)!.demo_point_link={source_customer_id:source.id,source_customer_name:source.name,lat:source.lat,lng:source.lng};
 }
 return {allCustomers:out,linkedDemoCustomerCount:linked};
}

async function metricMap(db:D1Database,organizationId:string,ids:string[],period?:string|null){
 const range=period?mapPeriod(period):{start:'2026-08-01',end:'2026-11-01'};
 const map=new Map<string,any>();if(!ids.length)return map;const jsonIds=JSON.stringify(ids),q='SELECT value FROM json_each(?)';
 const base={activity_count:0,productive_count:0,follow_up_count:0,no_show_count:0,order_count:0,invoice_count:0,actual_minor:0};
 const acts=await db.prepare(`SELECT outlet_id,COUNT(*) activity_count,SUM(CASE WHEN json_extract(metadata_json,'$.outcome')='productive' THEN 1 ELSE 0 END) productive_count,SUM(CASE WHEN json_extract(metadata_json,'$.outcome')='follow_up' THEN 1 ELSE 0 END) follow_up_count,SUM(CASE WHEN json_extract(metadata_json,'$.outcome')='no_show' THEN 1 ELSE 0 END) no_show_count FROM activity WHERE organization_id=? AND outlet_id IN (${q}) AND occurred_at>=? AND occurred_at<? GROUP BY outlet_id`).bind(organizationId,jsonIds,range.start,range.end).all<any>();
 const orders=await db.prepare(`SELECT customer_id,COUNT(*) order_count FROM sales_order WHERE organization_id=? AND customer_id IN (${q}) AND created_at>=? AND created_at<? GROUP BY customer_id`).bind(organizationId,jsonIds,range.start,range.end).all<any>();
 const invoices=await db.prepare(`SELECT outlet_id,COUNT(*) invoice_count,COALESCE(SUM(net_minor),0) actual_minor FROM invoice WHERE organization_id=? AND outlet_id IN (${q}) AND is_current=1 AND source_system='bekasi-demo-synthetic' AND status='validated' AND validation_state='validated' AND invoice_date>=? AND invoice_date<? GROUP BY outlet_id`).bind(organizationId,jsonIds,range.start,range.end).all<any>();
 for(const id of ids)map.set(id,{...base,...acts.results.find(x=>x.outlet_id===id),...orders.results.find(x=>x.customer_id===id),...invoices.results.find(x=>x.outlet_id===id)});return map;
}

export async function loadBekasiPointOverlay(db:D1Database,organizationId:string,rows:Customer[],filters:Filters,appEnv:string){
 if(appEnv!=='staging')return {links:[] as Link[],metrics:new Map(),enabled:false,reason:'staging-only'};
 const receipt=await db.prepare("SELECT id FROM master_audit WHERE organization_id=? AND id=? AND resource_type='training_dataset' AND resource_id=? AND action='operation_point_overlay_applied' AND json_extract(after_json,'$.mapping_id')=? AND json_extract(after_json,'$.synthetic')=1 AND json_extract(after_json,'$.demo')=1 AND json_extract(after_json,'$.linked_customer_count')=200 AND json_extract(after_json,'$.source_point_count')=200 AND json_extract(after_json,'$.additional_map_points')=0 LIMIT 1").bind(organizationId,`${BEKASI_POINT_OVERLAY_ID}:applied`,DATASET,BEKASI_POINT_OVERLAY_ID).first();
 if(!receipt)return {links:[] as Link[],metrics:new Map(),enabled:false,reason:'receipt-incomplete'};
 const audits=(await db.prepare("SELECT organization_id,resource_id,resource_type,action,before_json,after_json FROM master_audit WHERE organization_id=? AND resource_type='demo_operation_point_link' AND action='operation_point_link_selected' AND id LIKE ? ORDER BY id").bind(organizationId,`${BEKASI_POINT_OVERLAY_ID}:%`).all()).results;
 const links=validBekasiOverlayLinks(rows,audits,organizationId);if(links.length!==200)return {links:[] as Link[],metrics:new Map(),enabled:false,reason:'links-incomplete'};
 return {links,metrics:await metricMap(db,organizationId,links.map(x=>x.demo_customer_id),filters.period),enabled:true,reason:null};
}
