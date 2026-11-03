import {createHash} from 'node:crypto';
import {BEKASI_POINT_OVERLAY_ID,BEKASI_DIRECTORY_DATASET_ID,BEKASI_POINT_OVERLAY_DISCLAIMER} from '../src/shared/bekasi-demo-overlay';

export const LOCATION_MAPPING_ID=BEKASI_POINT_OVERLAY_ID;
export const DIRECTORY_DATASET_ID=BEKASI_DIRECTORY_DATASET_ID;
export const DEMO_PREFIX='bekasi-demo-customer-';
export const MAPPING_DISCLAIMER=BEKASI_POINT_OVERLAY_DISCLAIMER;
export const LOCATION_GROUPS=[
 {demoArea:'bekasi-demo-area-kota',sourceArea:'maps-area-bekasi-kota',start:1},
 {demoArea:'bekasi-demo-area-kabupaten',sourceArea:'maps-area-bekasi-kab',start:101},
] as const;
export type CustomerRow={id:string;organization_id:string;area_id:string;external_code:string|null;name:string;address:string;latitude_e7:number|null;longitude_e7:number|null;coordinate_status:string;directory_dataset_id:string|null;record_status:string;merged_into_id:string|null;version:number;location_note:string;[key:string]:unknown};
export type LocationMapping={demo_customer_id:string;demo_area_id:string;source_customer_id:string;source_external_code:string|null;source_dataset_id:string;source_area_id:string;source_name:string;source_address:string;source_latitude_e7:number;source_longitude_e7:number;source_version:number;source_coordinate_status:string;before:CustomerRow};
export function digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex')}
export function sqlValue(value:unknown):string{if(value===null)return 'NULL';if(typeof value==='number'){if(!Number.isFinite(value))throw Error('INVALID_SQL_NUMBER');return String(value)}if(typeof value!=='string')throw Error('INVALID_SQL_VALUE');return `'${value.replaceAll("'","''")}'`}
function coordinateKey(row:CustomerRow){return `${row.latitude_e7},${row.longitude_e7}`}
function validSource(row:CustomerRow,organizationId:string,sourceArea:string){
 return row.organization_id===organizationId&&row.area_id===sourceArea&&row.directory_dataset_id===DIRECTORY_DATASET_ID&&row.record_status==='active'&&row.merged_into_id===null&&!row.id.startsWith(DEMO_PREFIX)&&Number.isInteger(row.version)&&row.version>0&&['unverified','verified'].includes(row.coordinate_status)&&Number.isInteger(row.latitude_e7)&&Number.isInteger(row.longitude_e7)&&Number(row.latitude_e7)>=-67_000_000&&Number(row.latitude_e7)<=-58_500_000&&Number(row.longitude_e7)>=1_068_500_000&&Number(row.longitude_e7)<=1_074_000_000;
}
// Select existing identities, never create points, geocode fictitious addresses, or copy coordinates into DEMO rows.
function spatialSample(rows:CustomerRow[],used:Set<string>){
 const unique=new Map<string,CustomerRow>();
 for(const row of [...rows].sort((a,b)=>a.id.localeCompare(b.id))){const key=coordinateKey(row);if(!used.has(key)&&!unique.has(key))unique.set(key,row)}
 const sorted=[...unique.values()].sort((a,b)=>Number(a.longitude_e7)-Number(b.longitude_e7)||Number(a.latitude_e7)-Number(b.latitude_e7)||a.id.localeCompare(b.id));
 if(sorted.length<100)throw Error('INSUFFICIENT_UNIQUE_REAL_DIRECTORY_POINTS');
 const selected:CustomerRow[]=[];
 for(let band=0;band<10;band++){
  const strip=sorted.slice(Math.floor(band*sorted.length/10),Math.floor((band+1)*sorted.length/10)).sort((a,b)=>Number(a.latitude_e7)-Number(b.latitude_e7)||a.id.localeCompare(b.id));
  if(strip.length<10)throw Error('INSUFFICIENT_SPATIAL_STRIP_POINTS');
  for(let quantile=0;quantile<10;quantile++){const point=strip[Math.floor((quantile+.5)*strip.length/10)];selected.push(point);used.add(coordinateKey(point))}
 }
 return selected;
}
export function buildRealPointMappings(organizationId:string,demos:CustomerRow[],sources:CustomerRow[]):LocationMapping[]{
 const expectedIds=LOCATION_GROUPS.flatMap(g=>Array.from({length:100},(_,i)=>DEMO_PREFIX+String(g.start+i).padStart(3,'0')));
 if(demos.length!==200||new Set(demos.map(d=>d.id)).size!==200||expectedIds.some(id=>!demos.some(d=>d.id===id)))throw Error('EXACT_200_DEMO_CUSTOMERS_REQUIRED');
 if(new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('DUPLICATE_SOURCE_IDS');
 const used=new Set<string>();const mappings:LocationMapping[]=[];
 for(const group of LOCATION_GROUPS){
  const selected=spatialSample(sources.filter(row=>validSource(row,organizationId,group.sourceArea)),used);
  for(let index=0;index<100;index++){
   const number=group.start+index,id=DEMO_PREFIX+String(number).padStart(3,'0'),demo=demos.find(row=>row.id===id)!,source=selected[index];
   if(demo.organization_id!==organizationId||demo.area_id!==group.demoArea||demo.directory_dataset_id!==null||demo.record_status!=='active'||demo.merged_into_id!==null||demo.latitude_e7!==null||demo.longitude_e7!==null||demo.coordinate_status!=='missing'||demo.version!==1||demo.external_code!==`BKS-DEMO-${String(number).padStart(4,'0')}`)throw Error('DEMO_BASELINE_CHANGED_'+id);
   mappings.push({demo_customer_id:id,demo_area_id:group.demoArea,source_customer_id:source.id,source_external_code:source.external_code,source_dataset_id:DIRECTORY_DATASET_ID,source_area_id:source.area_id,source_name:source.name,source_address:source.address,source_latitude_e7:source.latitude_e7!,source_longitude_e7:source.longitude_e7!,source_version:source.version,source_coordinate_status:source.coordinate_status,before:{...demo}});
  }
 }
 return mappings;
}
export function assertMappings(mappings:LocationMapping[],organizationId:string,demos:CustomerRow[],sources:CustomerRow[]){
 if(mappings.length!==200||new Set(mappings.map(m=>m.demo_customer_id)).size!==200||new Set(mappings.map(m=>m.source_customer_id)).size!==200||new Set(mappings.map(m=>`${m.source_latitude_e7},${m.source_longitude_e7}`)).size!==200)throw Error('INVALID_MAPPING_CARDINALITY');
 for(const group of LOCATION_GROUPS)if(mappings.filter(m=>m.demo_area_id===group.demoArea&&m.source_area_id===group.sourceArea).length!==100)throw Error('INVALID_MAPPING_AREA_COUNTS');
 for(const mapping of mappings){
  const source=sources.find(s=>s.id===mapping.source_customer_id),demo=demos.find(d=>d.id===mapping.demo_customer_id);
  const group=LOCATION_GROUPS.find(g=>Array.from({length:100},(_,i)=>DEMO_PREFIX+String(g.start+i).padStart(3,'0')).includes(mapping.demo_customer_id));
  if(!group||mapping.demo_area_id!==group.demoArea||mapping.source_area_id!==group.sourceArea||mapping.source_dataset_id!==DIRECTORY_DATASET_ID||mapping.before.id!==mapping.demo_customer_id||mapping.before.organization_id!==organizationId||mapping.before.area_id!==group.demoArea||mapping.before.directory_dataset_id!==null||mapping.before.version!==1||mapping.before.latitude_e7!==null||mapping.before.longitude_e7!==null||mapping.before.coordinate_status!=='missing')throw Error('INVALID_MAPPING_PROVENANCE');
  if(!source||!demo||!validSource(source,organizationId,mapping.source_area_id)||source.version!==mapping.source_version||source.latitude_e7!==mapping.source_latitude_e7||source.longitude_e7!==mapping.source_longitude_e7||source.name!==mapping.source_name||source.address!==mapping.source_address)throw Error('MAPPING_SOURCE_CHANGED_'+mapping.demo_customer_id);
  if(digest(demo)!==digest(mapping.before))throw Error('DEMO_CHANGED_SINCE_MAPPING_'+mapping.demo_customer_id);
 }
}
export function selectionPayload(mapping:LocationMapping){return {mapping_id:LOCATION_MAPPING_ID,synthetic_activity:true,existing_point_overlay:true,...mapping}}
export function mappingSql(mapping:LocationMapping,organizationId:string,actorId:string,occurredAt:string){
 const m=mapping,q=sqlValue,id=`${LOCATION_MAPPING_ID}:${m.demo_customer_id}`,payload=JSON.stringify(selectionPayload(m));
 const sourceGuard=`EXISTS(SELECT 1 FROM customer_outlet s JOIN point_directory_dataset d ON d.organization_id=s.organization_id AND d.id=s.directory_dataset_id AND d.status='ready' WHERE s.organization_id=${q(organizationId)} AND s.id=${q(m.source_customer_id)} AND s.directory_dataset_id=${q(DIRECTORY_DATASET_ID)} AND s.area_id=${q(m.source_area_id)} AND s.version=${q(m.source_version)} AND s.latitude_e7=${q(m.source_latitude_e7)} AND s.longitude_e7=${q(m.source_longitude_e7)} AND s.record_status='active' AND s.merged_into_id IS NULL)`;
 const demoGuard=`EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=${q(organizationId)} AND id=${q(m.demo_customer_id)} AND area_id=${q(m.demo_area_id)} AND external_code=${q(m.before.external_code)} AND directory_dataset_id IS NULL AND latitude_e7 IS NULL AND longitude_e7 IS NULL AND coordinate_status='missing' AND version=${q(m.before.version)} AND record_status='active' AND merged_into_id IS NULL)`;
 // Audit sidecar only. No customer coordinates, identities, addresses, assignments, or history are written.
 return `INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) SELECT ${[id,organizationId,actorId,'demo_operation_point_link',m.demo_customer_id,'operation_point_link_selected',occurredAt,JSON.stringify(m.before),payload].map(q).join(',')} WHERE NOT EXISTS(SELECT 1 FROM master_audit WHERE id=${q(id)}) AND ${sourceGuard} AND ${demoGuard};`;
}
