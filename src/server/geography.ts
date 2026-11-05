import {mapSummary} from '../shared/map-analysis';
import {cachedJson,scopeCacheKey,readModelRevision} from './cache';
import {chunkMapIds,readMapMetrics} from './map-metrics';
import {Hono} from 'hono';
import {z} from 'zod';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js';
import IndexedPointInAreaLocator from 'jsts/org/locationtech/jts/algorithm/locate/IndexedPointInAreaLocator.js';
import Coordinate from 'jsts/org/locationtech/jts/geom/Coordinate.js';
import {customerPredicate,type Scope} from './scope';
import {digest,fail,operation,type OperationEnv} from './operations';
import {canonicalJson,type Geometry} from '../shared/boundaries';
import {geoPreviewSchema,geoReviewSchema} from '../shared/geography';

type Env=OperationEnv;
export const geoRequestSchemas={preview:geoPreviewSchema,review:geoReviewSchema};
async function dataset(c:any,id?:string){const db=c.env.DB as D1Database,org=c.get('identity').organization_id;const row=await db.prepare("SELECT * FROM admin_boundary_dataset WHERE organization_id=? AND "+(id?'id=?':"status='active'")).bind(org,...(id?[id]:[])).first<any>();if(id&&!row)fail(404,'DATASET_NOT_FOUND');if(row?.status==='retired')fail(409,'BOUNDARY_DATASET_RETIRED');if(row&&row.status!=='active'&&!c.get('scope').orgWide)fail(403,'SCOPE_DENIED');return row}
async function scopedCustomer(c:any,id:string){const f=customerPredicate(c.get('scope'));const row=await(c.env.DB as D1Database).prepare('SELECT co.* FROM customer_outlet co WHERE co.id=? AND co.merged_into_id IS NULL AND '+f.sql).bind(id,...f.params).first<any>();if(!row)fail(404,'CUSTOMER_NOT_FOUND');return row}
async function revisions(db:D1Database,org:string,id:string,date:string){const rows=(await db.prepare('SELECT l.*,b.dataset_id,b.name_snapshot,b.hierarchy_json FROM customer_admin_location l LEFT JOIN admin_boundary b ON b.organization_id=l.organization_id AND b.id=l.boundary_id WHERE l.organization_id=? AND l.outlet_id=? ORDER BY l.revision DESC LIMIT 50').bind(org,id).all<any>()).results;return {revision:rows[0]?.revision||0,current:rows.find(r=>r.superseded_at===null&&r.effective_from_date<=date&&(r.effective_to_date===null||r.effective_to_date>date))||null,history:rows}}
export function mappingState(row:any,customer:any,active:any){if(!row)return 'unmapped';if(row.status!=='confirmed')return row.status;const e=JSON.parse(row.evidence_json);return !active||row.dataset_id!==active.id||e.latitude_e7!==customer.latitude_e7||e.longitude_e7!==customer.longitude_e7||e.coordinate_status!==customer.coordinate_status?'stale':'confirmed'}
async function boundaryRows(c:any,d:any){
 const db=c.env.DB as D1Database,s=c.get('scope') as Scope;if(!d)return [];
 let sql='b.organization_id=? AND b.dataset_id=?';const args:any[]=[s.identity.organization_id,d.id];
 if(!s.orgWide){const f=customerPredicate(s);sql+=` AND (EXISTS(SELECT 1 FROM area_admin_membership am WHERE am.organization_id=b.organization_id AND am.admin_unit_id=b.admin_unit_id AND am.area_id IN (${s.areaIds.map(()=>'?').join(',')||'NULL'}) AND am.effective_from_date<=? AND (am.effective_to_date IS NULL OR am.effective_to_date>?)) OR EXISTS(SELECT 1 FROM customer_admin_location l JOIN customer_outlet co ON co.organization_id=l.organization_id AND co.id=l.outlet_id WHERE l.organization_id=b.organization_id AND l.boundary_id=b.id AND l.status='confirmed' AND l.superseded_at IS NULL AND l.effective_from_date<=? AND (l.effective_to_date IS NULL OR l.effective_to_date>?) AND ${f.sql}))`;args.push(...(s.channel==='telesales'?s.areaIds.map(()=>'__no_area_scope__'):s.areaIds),s.date,s.date,s.date,s.date,...f.params)}
 const rows=(await db.prepare('SELECT b.* FROM admin_boundary b WHERE '+sql+' ORDER BY b.name_snapshot,b.id LIMIT 1001').bind(...args).all<any>()).results;if(rows.length>1000)fail(422,'BOUNDARY_SCOPE_TOO_LARGE');return rows;
}
async function geometries(c:any,d:any,rows:any[]){
 if(!rows.length)return new Map<string,Geometry>();const db=c.env.DB as D1Database,bucket=c.env.IMPORT_FILES as R2Bucket|undefined;if(!bucket)fail(503,'BOUNDARY_STORAGE_UNAVAILABLE');const cache=new Map<string,any>(),result=new Map<string,Geometry>();let bytesTotal=0;const manifests=(await db.prepare('SELECT storage_key,checksum,byte_count FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=? AND storage_key IN(SELECT value FROM json_each(?))').bind(d.organization_id,d.id,JSON.stringify([...new Set(rows.map(r=>r.geometry_object_key))])).all<any>()).results;
 for(const row of rows){
  let collection=cache.get(row.geometry_object_key);
  if(!collection){const manifest=manifests.find(m=>m.storage_key===row.geometry_object_key);if(!manifest)fail(503,'BOUNDARY_MANIFEST_UNAVAILABLE');const object=await bucket.get(row.geometry_object_key);if(!object)fail(503,'BOUNDARY_SOURCE_UNAVAILABLE');const bytes=await object.arrayBuffer();bytesTotal+=bytes.byteLength;if(bytesTotal>8*1024*1024)fail(422,'GEOMETRY_READ_LIMIT');if(bytes.byteLength!==manifest.byte_count||await digest(bytes)!==manifest.checksum)fail(409,'BOUNDARY_SOURCE_CHANGED');try{collection=JSON.parse(new TextDecoder().decode(bytes))}catch{fail(409,'BOUNDARY_SOURCE_CHANGED')}cache.set(row.geometry_object_key,collection)}
  const geometry=collection.features?.[row.geometry_feature_index]?.geometry;if(!geometry||await digest(canonicalJson(geometry))!==row.geometry_checksum)fail(409,'BOUNDARY_SOURCE_CHANGED');result.set(row.id,geometry);
 }
 return result;
}
export function locateGeometry(geometry:Geometry,longitude:number,latitude:number):'inside'|'boundary'|'outside'{const value=new IndexedPointInAreaLocator(new GeoJSONReader(new GeometryFactory()).read(geometry)).locate(new Coordinate(longitude,latitude));return value===0?'inside':value===1?'boundary':'outside'}
async function preview(c:any,customer:any,input:z.infer<typeof geoPreviewSchema>){
 const db=c.env.DB as D1Database,org=c.get('identity').organization_id,s=c.get('scope') as Scope,d=await dataset(c,input.dataset_id);if(!d)fail(409,'NO_ACTIVE_BOUNDARY_DATASET');
 const rev=await revisions(db,org,customer.id,s.date),hasPoint=customer.longitude_e7!==null&&customer.latitude_e7!==null;
 const all=(await db.prepare('SELECT * FROM admin_boundary WHERE organization_id=? AND dataset_id=? ORDER BY id').bind(org,d.id).all<any>()).results;
 const candidates=all.filter(b=>hasPoint&&b.min_longitude_e7<=customer.longitude_e7&&b.max_longitude_e7>=customer.longitude_e7&&b.min_latitude_e7<=customer.latitude_e7&&b.max_latitude_e7>=customer.latitude_e7);
 if(candidates.length>100)fail(422,'TOO_MANY_BOUNDARY_CANDIDATES');const geos=await geometries(c,d,candidates),inside:any[]=[],edges:any[]=[];
 for(const b of candidates){const location=locateGeometry(geos.get(b.id)!,customer.longitude_e7/1e7,customer.latitude_e7/1e7);if(location==='inside')inside.push(b);if(location==='boundary')edges.push(b)}
 const reasons:string[]=[];if(!hasPoint)reasons.push('coordinates_missing');if(hasPoint&&customer.coordinate_status!=='verified')reasons.push('coordinates_unverified');if(edges.length)reasons.push('on_boundary');if(inside.length>1)reasons.push('overlapping_boundaries');
 let codeBoundary:any=null;if(input.admin_code){if(input.code_namespace!==d.code_namespace)reasons.push('code_namespace_conflict');else{codeBoundary=all.find(b=>JSON.parse(b.hierarchy_json).village.code===input.admin_code);if(!codeBoundary)reasons.push('admin_code_not_found')}}
 if(codeBoundary&&hasPoint&&(inside.length!==1||inside[0].id!==codeBoundary.id))reasons.push('coordinate_code_conflict');
 let selected=inside.length===1&&!edges.length?inside[0]:!hasPoint?codeBoundary:null;
 if(reasons.some(r=>['code_namespace_conflict','admin_code_not_found','coordinate_code_conflict'].includes(r)))selected=null;
 const status=selected&&reasons.every(r=>r==='coordinates_missing')?'proposed':!inside.length&&!edges.length&&hasPoint&&customer.coordinate_status==='verified'&&!codeBoundary&&!input.admin_code?'outside_coverage':'needs_review';
 const seen=new Map([...inside,...edges,...(codeBoundary?[codeBoundary]:[])].map(b=>[b.id,b]));
 const body={dataset_id:d.id,dataset_version:d.version,customer_id:customer.id,customer_version:customer.version,mapping_revision:rev.revision,latitude_e7:customer.latitude_e7,longitude_e7:customer.longitude_e7,coordinate_status:customer.coordinate_status,code_namespace:input.code_namespace||null,admin_code:input.admin_code||null,status,reasons,candidate_ids:[...seen.keys()].sort(),suggested_boundary_id:selected?.id||null,algorithm:'jsts-indexed-point-in-area-v1',date:s.date};
 return {...body,preview_hash:await digest(canonicalJson(body)),dataset_status:d.status,can_publish:d.status==='active',candidates:[...seen.values()].map(b=>({id:b.id,name:b.name_snapshot,hierarchy:JSON.parse(b.hierarchy_json)})),current:rev.current,active_dataset:d};
}
export async function filterGeoCustomers(c:any,customers:any[]){
 const boundary=c.req.query('geo_boundary_id'),bucket=c.req.query('geo_bucket'),requestedDataset=c.req.query('geo_dataset_id');if(!boundary&&!bucket)return customers;if(bucket&&!['unmapped','confirmed','stale','needs_review','outside_coverage'].includes(bucket))fail(422,'INVALID_MAPPING_BUCKET');
 const d=await dataset(c,requestedDataset),org=c.get('identity').organization_id,date=c.get('scope').date;
 if(requestedDataset&&d?.status!=='active')fail(409,'DRAFT_NOT_OPERATIONAL');
 const mappings=(await(c.env.DB as D1Database).prepare('SELECT l.*,b.dataset_id FROM customer_admin_location l LEFT JOIN admin_boundary b ON b.organization_id=l.organization_id AND b.id=l.boundary_id WHERE l.organization_id=? AND l.outlet_id IN (SELECT value FROM json_each(?)) AND l.superseded_at IS NULL AND l.effective_from_date<=? AND (l.effective_to_date IS NULL OR l.effective_to_date>?) ORDER BY l.revision DESC').bind(org,JSON.stringify(customers.map(x=>x.id)),date,date).all<any>()).results;
 if(boundary&&!d)fail(409,'NO_ACTIVE_BOUNDARY_DATASET');
 return customers.filter(customer=>{const row=mappings.find(x=>x.outlet_id===customer.id),state=mappingState(row,customer,d);if(boundary)return state==='confirmed'&&row.boundary_id===boundary;return bucket==='unmapped'?state!=='confirmed':state===bucket});
}
export function createGeographyRoutes(mapPayload:(c:any)=>Promise<any>){
 const routes=new Hono<Env>();
 routes.onError((e,c)=>{const match=/^(403|404|409|412|422|428|503):(.+)$/.exec(e.message);return c.json({code:match?.[2]||'GEOGRAPHY_UNAVAILABLE'},(match?Number(match[1]):503) as any)});
 routes.get('/api/geo/map',async c=>{
  const channel=c.req.query('channel');if(channel&&!['field','telesales'].includes(channel))return c.json({code:'INVALID_CHANNEL'},422);const period=c.req.query('period');if(period&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return c.json({code:'INVALID_PERIOD'},422);
  const base=await mapPayload(c),d=await dataset(c,c.req.query('dataset_id')),org=c.get('identity').organization_id,date=c.get('scope').date;
  const revision=await readModelRevision(c),scope=c.get('scope');
  const boundaries=await cachedJson(c,scopeCacheKey(scope,'geo-boundary-rows',JSON.stringify([revision,d?.id,d?.version,d?.status])),60,()=>boundaryRows(c,d));
  const rows=boundaries.value;
  const mapRows=[...new Map([...base.data.all_customers,...base.data.customers].map((customer:any)=>[customer.id,customer])).values()];
  const cohortIds=JSON.stringify(mapRows.map((x:any)=>x.id));
  const mappingCache=await cachedJson(c,scopeCacheKey(scope,'geo-map-mappings',JSON.stringify([revision,await digest(cohortIds)])),60,async()=>{
   const result:any[]=[];
   for(const ids of chunkMapIds(mapRows.map((x:any)=>x.id)))result.push(...(await c.env.DB.prepare('SELECT l.outlet_id,l.boundary_id,b.dataset_id,l.status,l.evidence_json,l.revision FROM customer_admin_location l LEFT JOIN admin_boundary b ON b.organization_id=l.organization_id AND b.id=l.boundary_id WHERE l.organization_id=? AND l.outlet_id IN (SELECT value FROM json_each(?)) AND l.superseded_at IS NULL AND l.effective_from_date<=? AND (l.effective_to_date IS NULL OR l.effective_to_date>?) ORDER BY l.revision DESC').bind(org,JSON.stringify(ids),date,date).all<any>()).results);
   return result;
  });
  const mappings=mappingCache.value;
  const mappingByCustomer=new Map<string,any>();for(const row of mappings)if(!mappingByCustomer.has(row.outlet_id))mappingByCustomer.set(row.outlet_id,row);
  const enrich=(customer:any)=>{const row=mappingByCustomer.get(customer.id),state=mappingState(row,customer,d);return {...customer,geo_status:state,geo_boundary_id:state==='confirmed'?row.boundary_id:null}};
  const metricIds=base.data.all_customers.map((x:any)=>x.id);
  const metricKey=scopeCacheKey(c.get('scope'),'map-metrics',JSON.stringify([await readModelRevision(c),period||date.slice(0,7),channel||'field',c.req.query('rep_id')||'',c.req.query('area_id')||'',await digest(JSON.stringify([...metricIds].sort()))]));
  const metricCache=await cachedJson(c,metricKey,60,async()=>[...await readMapMetrics(c.env.DB,c.get('scope'),metricIds,period||date.slice(0,7),channel||'field',c.req.query('rep_id'),c.req.query('area_id'))]);
  c.header('X-NYALES-Metrics-Cache',metricCache.enabled?(metricCache.hit?'HIT':'MISS'):'OFF');
  const metrics=new Map<string,any>(metricCache.value as [string,any][]);
  const all=base.data.all_customers.map((x:any)=>({...enrich(x),metrics:metrics.get(x.id)}));
  const customerById=new Map<string,any>(mapRows.map((customer:any)=>[customer.id,{...enrich(customer),metrics:metrics.get(customer.id)}]));
  const membershipCache=await cachedJson(c,scopeCacheKey(scope,'geo-map-memberships',JSON.stringify([revision,d?.id,d?.version])),60,async()=>(await c.env.DB.prepare('SELECT m.admin_unit_id,m.area_id,m.boundary_id,a.name area_name FROM area_admin_membership m JOIN area a ON a.organization_id=m.organization_id AND a.id=m.area_id WHERE m.organization_id=? AND m.admin_unit_id IN(SELECT value FROM json_each(?)) AND m.effective_from_date<=? AND (m.effective_to_date IS NULL OR m.effective_to_date>?)').bind(org,JSON.stringify(rows.map(b=>b.admin_unit_id)),date,date).all<any>()).results);
  const areaMembership=membershipCache.value;
  c.header('X-NYALES-Geography-Cache',boundaries.enabled&&mappingCache.enabled&&membershipCache.enabled?(boundaries.hit&&mappingCache.hit&&membershipCache.hit?'HIT':'MISS'):'OFF');
  const counts=new Map<string,number>();for(const c of all)if(c.geo_boundary_id)counts.set(c.geo_boundary_id,(counts.get(c.geo_boundary_id)||0)+1);
  const compact=c.req.query('compact')==='1';
  const compactPin=(x:any)=>({id:x.id,name:x.name,field_rep_id:x.field_rep_id,telesales_rep_id:x.telesales_rep_id,telesales_owner:x.telesales_owner,area:x.area,area_id:x.area_id,owner:x.owner,status:x.status,lat:x.lat,lng:x.lng,directory_dataset_id:x.directory_dataset_id,geo_status:x.geo_status,geo_boundary_id:x.geo_boundary_id,metrics:x.metrics,demo_operation_overlay:x.demo_operation_overlay});
  const stats={total:all.length,confirmed:all.filter((x:any)=>x.geo_status==='confirmed').length,unmapped:all.filter((x:any)=>x.geo_status!=='confirmed').length};
  return c.json({data:{summary:mapSummary(all),map:{...base.data,all_customers:compact?[]:all,customers:base.data.customers.map((x:any)=>customerById.get(x.id)).map((x:any)=>compact?compactPin(x):x)},dataset:d?{id:d.id,version:d.version,release_version:d.release_version,status:d.status,attribution:d.attribution,coverage:JSON.parse(d.coverage_json),code_namespace:d.code_namespace}:null,period_context:period||date.slice(0,7),mapping_date:date,stats,boundaries:rows.map(b=>({id:b.id,name:b.name_snapshot,unit_id:b.admin_unit_id,hierarchy:JSON.parse(b.hierarchy_json),bbox:[b.min_longitude_e7,b.min_latitude_e7,b.max_longitude_e7,b.max_latitude_e7].map((n:number)=>n/1e7),confirmed_customer_count:counts.get(b.id)||0,area_business:areaMembership.find(m=>m.admin_unit_id===b.admin_unit_id)||null})),preview:d?.status==='draft',geometry_display_limit:50,source_state:d?'available':'no_active_dataset'}});
 });
 routes.get('/api/geo/geometry',async c=>{
  const ids=(c.req.query('ids')||'').split(',').filter(Boolean);if(ids.length<1||ids.length>50||ids.some(id=>id.length>128))return c.json({code:'INVALID_BOUNDARY_IDS'},422);
  const d=await dataset(c,c.req.query('dataset_id'));if(!d)return c.json({code:'NO_ACTIVE_BOUNDARY_DATASET'},409);const allowed=await boundaryRows(c,d),selected=ids.map(id=>allowed.find(b=>b.id===id));if(selected.some(x=>!x))return c.json({code:'BOUNDARY_NOT_FOUND'},404);
  const geos=await geometries(c,d,selected),features=selected.map(b=>({type:'Feature',id:b.id,properties:{boundary_id:b.id,name:b.name_snapshot},geometry:geos.get(b.id)}));
  const data={type:'FeatureCollection',features};if(new TextEncoder().encode(canonicalJson(data)).byteLength>2*1024*1024)return c.json({code:'REFINE_GEOMETRY_SELECTION'},422);return c.json({data,dataset_id:d.id,dataset_version:d.version});
 });
 routes.get('/api/geo/customers/:id',async c=>{const customer=await scopedCustomer(c,c.req.param('id')),d=await dataset(c),rev=await revisions(c.env.DB,c.get('identity').organization_id,customer.id,c.get('scope').date);c.header('ETag',`"${rev.revision}"`);return c.json({data:{customer_id:customer.id,customer_version:customer.version,mapping_revision:rev.revision,status:mappingState(rev.current,customer,d),current:rev.current,history:rev.history}})});
 routes.post('/api/geo/customers/:id/preview',async c=>{if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);const input=geoPreviewSchema.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'VALIDATION_ERROR'},422);const result=await preview(c,await scopedCustomer(c,c.req.param('id')),input.data);const {active_dataset,...data}=result;return c.json({data})});
 routes.post('/api/geo/customers/:id/review',async c=>{
  const input=geoReviewSchema.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'VALIDATION_ERROR'},422);const body=input.data;
  return operation(c,body,async()=>{
   const db=c.env.DB,org=c.get('identity').organization_id,customer=await scopedCustomer(c,c.req.param('id')),d=await dataset(c);if(!d||body.dataset_id!==d.id)fail(412,'ACTIVE_DATASET_CHANGED');
   const p=await preview(c,customer,{dataset_id:body.dataset_id,...(body.admin_code?{admin_code:body.admin_code,code_namespace:body.code_namespace}:{})});
   if(body.customer_version!==customer.version||body.mapping_revision!==p.mapping_revision||body.preview_hash!==p.preview_hash)fail(412,'GEOGRAPHY_PREVIEW_STALE');
   if(c.req.header('If-Match')!==`"${body.mapping_revision}"`)fail(c.req.header('If-Match')?412:428,'MAPPING_VERSION_REQUIRED');
   let boundary:any=null;const confirmed=['confirm_candidate','manual'].includes(body.decision);
   if(confirmed){if(!body.boundary_id)fail(422,'BOUNDARY_REQUIRED');boundary=await db.prepare('SELECT * FROM admin_boundary WHERE organization_id=? AND dataset_id=? AND id=?').bind(org,d.id,body.boundary_id).first<any>();if(!boundary)fail(422,'BOUNDARY_INVALID');if(body.decision==='confirm_candidate'&&(p.status!=='proposed'||p.suggested_boundary_id!==body.boundary_id))fail(422,'MANUAL_REVIEW_REQUIRED')}
   if(confirmed)await geometries(c,d,[boundary]);
   else if(body.boundary_id!==null)fail(422,'UNRESOLVED_BOUNDARY_MUST_BE_NULL');
   if(body.decision==='outside_coverage'&&p.status!=='outside_coverage')fail(422,'OUTSIDE_COVERAGE_NOT_PROVEN');
   const date=c.get('scope').date,now=new Date().toISOString(),id=crypto.randomUUID(),revision=p.mapping_revision+1,method=body.decision==='manual'?'manual':body.admin_code?'admin_code':'coordinate',status=confirmed?'confirmed':body.decision;
   const evidence={...p,current:undefined,active_dataset:undefined,latitude_e7:customer.latitude_e7,longitude_e7:customer.longitude_e7,coordinate_status:customer.coordinate_status,decision:body.decision};
   const statements:D1PreparedStatement[]=[db.prepare('INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN COALESCE(MAX(revision),0)=? THEN 1 ELSE 0 END FROM customer_admin_location WHERE organization_id=? AND outlet_id=?').bind(p.mapping_revision,org,customer.id),db.prepare('DELETE FROM master_mutation_guard'),db.prepare("INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN COUNT(*)=1 THEN 1 ELSE 0 END FROM admin_boundary_dataset WHERE organization_id=? AND id=? AND version=? AND status='active'").bind(org,d.id,d.version),db.prepare('DELETE FROM master_mutation_guard'),db.prepare('INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN COUNT(*)=1 THEN 1 ELSE 0 END FROM customer_outlet WHERE organization_id=? AND id=? AND version=? AND latitude_e7 IS ? AND longitude_e7 IS ? AND coordinate_status=?').bind(org,customer.id,customer.version,customer.latitude_e7,customer.longitude_e7,customer.coordinate_status),db.prepare('DELETE FROM master_mutation_guard')];
   if(p.current){statements.push(db.prepare(p.current.effective_from_date===date?'UPDATE customer_admin_location SET superseded_at=? WHERE organization_id=? AND id=? AND superseded_at IS NULL':'UPDATE customer_admin_location SET effective_to_date=? WHERE organization_id=? AND id=? AND superseded_at IS NULL').bind(p.current.effective_from_date===date?now:date,org,p.current.id))}
   statements.push(db.prepare('INSERT INTO customer_admin_location(id,organization_id,outlet_id,admin_unit_id,boundary_id,method,status,evidence_json,effective_from_date,reviewed_by,reviewed_at,reason,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,org,customer.id,boundary?.admin_unit_id||null,boundary?.id||null,method,status,JSON.stringify(evidence),date,c.get('identity').id,now,body.reason,revision,now));
   return {data:{id,customer_id:customer.id,version:revision,revision,status,boundary_id:boundary?.id||null,dataset_id:d.id,effective_from_date:date},statements,resource:'customer_admin_location',before:p.current};
  });
 });
 return routes;
}

export {dataset as loadGeographyDataset,geometries as readBoundaryGeometries,boundaryRows as scopedBoundaryRows};
