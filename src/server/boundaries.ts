import {Hono} from 'hono';
import {z} from 'zod';
import {digest,fail,guard,operation,type OperationEnv} from './operations';
import {boundaryDatasetSchema,boundaryReviewSchema,boundarySelectionSchema,boundaryLimits,canonicalJson,manifestJson,type BoundaryFeature} from '../shared/boundaries';
import {validateBoundaryCollection} from './boundary-geometry';

export const boundaries=new Hono<OperationEnv>();
const source='https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0';
const chunkSchema=z.object({index:z.number().int().min(0).max(99),collection:z.unknown()}).strict();
export const boundaryRequestSchemas={dataset:boundaryDatasetSchema,chunk:chunkSchema,review:z.union([boundaryReviewSchema,boundarySelectionSchema])};
const selectDataset='SELECT d.*,(SELECT COUNT(*) FROM admin_boundary_chunk c WHERE c.organization_id=d.organization_id AND c.dataset_id=d.id) uploaded_chunks,(SELECT COUNT(*) FROM admin_boundary b WHERE b.organization_id=d.organization_id AND b.dataset_id=d.id) uploaded_features FROM admin_boundary_dataset d';
function expose(row:any){const {metadata_json,coverage_json,...rest}=row;return {...rest,metadata:JSON.parse(metadata_json),coverage:JSON.parse(coverage_json)}}
async function load(db:D1Database,org:string,id:string){return db.prepare(selectDataset+' WHERE d.organization_id=? AND d.id=?').bind(org,id).first<any>()}
function version(c:any,row:any){const value=c.req.header('If-Match');if(!value)fail(428,'PRECONDITION_REQUIRED');if(value!==`"${row.version}"`)fail(412,'VERSION_CONFLICT')}
async function parsed<T extends z.ZodType>(c:any,schema:T):Promise<z.output<T>|null>{let value;try{value=await c.req.json()}catch{return null}const r=schema.safeParse(value);return r.success?r.data as z.output<T>:null}

// Dataset administration is national Management/NSM only. Scoped polygon reads belong to WEB-064.
boundaries.use('/api/admin-boundaries/*',async(c,next)=>{if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next()});
boundaries.get('/api/admin-boundaries/config',c=>c.json({data:{limits:boundaryLimits,source_reference:source,reference_release:'Semester 1 Tahun 2025',usage_terms_status:'unverified',note:'Sumber publik bukan bukti izin penggunaan. Pilih satu dataset aktif. Kelengkapan dan checksum diperiksa otomatis; metadata sumber tetap tersimpan.'}}));
boundaries.get('/api/admin-boundaries/datasets',async c=>{const after=c.req.query('after')||'',rows=await c.env.DB.prepare(selectDataset+' WHERE d.organization_id=? AND d.id>? ORDER BY d.id LIMIT 51').bind(c.get('identity').organization_id,after).all<any>();return c.json({data:rows.results.slice(0,50).map(expose),next:rows.results.length>50?rows.results[49].id:null})});
boundaries.get('/api/admin-boundaries/datasets/:id',async c=>{
 const org=c.get('identity').organization_id,row=await load(c.env.DB,org,c.req.param('id'));if(!row)return c.json({code:'NOT_FOUND'},404);
 const chunks=await c.env.DB.prepare('SELECT chunk_index,checksum,feature_count,byte_count,created_at FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=? ORDER BY chunk_index').bind(org,row.id).all();
 c.header('ETag',`"${row.version}"`);return c.json({data:{...expose(row),chunks:chunks.results}});
});
boundaries.post('/api/admin-boundaries/datasets',async c=>{
 const value=await parsed(c,boundaryDatasetSchema);if(!value)return c.json({code:'VALIDATION_ERROR'},422);
 return operation(c,value,async()=>{
  const org=c.get('identity').organization_id,who=c.get('identity').id,now=new Date().toISOString(),id=crypto.randomUUID();
  if(value.acquired_at>now||value.released_at&&value.released_at>value.acquired_at.slice(0,10))fail(422,'INVALID_SOURCE_DATE');
  const existing=await c.env.DB.prepare(selectDataset+' WHERE d.organization_id=? AND d.code_namespace=? AND d.release_version=? AND d.manifest_sha256=?').bind(org,value.code_namespace,value.release_version,value.manifest_sha256).first<any>();
  if(existing){
   if(existing.status!=='draft')fail(409,'RELEASE_ALREADY_SEALED');
   const same=existing.provider===value.provider&&existing.released_at===value.released_at&&existing.acquired_at===value.acquired_at&&existing.source_reference===value.source_reference&&existing.source_checksum===value.source_checksum&&existing.metadata_json===canonicalJson(value.metadata)&&existing.coverage_json===canonicalJson(value.coverage)&&existing.expected_features===value.expected_features&&existing.expected_chunks===value.expected_chunks;
   if(!same)fail(409,'RELEASE_METADATA_CONFLICT');
   return {data:expose(existing),status:200,resource:'admin_boundary_dataset',statements:[]};
  }
  const data={...value,id,status:'draft',version:1,created_at:now,uploaded_chunks:0,uploaded_features:0};
  return {data,status:201,resource:'admin_boundary_dataset',statements:[c.env.DB.prepare('INSERT INTO admin_boundary_dataset(id,organization_id,provider,code_namespace,release_version,released_at,acquired_at,source_reference,source_checksum,metadata_json,coverage_json,manifest_sha256,expected_features,expected_chunks,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,org,value.provider,value.code_namespace,value.release_version,value.released_at,value.acquired_at,value.source_reference,value.source_checksum,canonicalJson(value.metadata),canonicalJson(value.coverage),value.manifest_sha256,value.expected_features,value.expected_chunks,who,now)]};
 });
});
boundaries.post('/api/admin-boundaries/datasets/:id/chunks',async c=>{
 const value=await parsed(c,chunkSchema);if(!value)return c.json({code:'VALIDATION_ERROR'},422);
 return operation(c,value,async()=>{
  const db=c.env.DB,org=c.get('identity').organization_id,row=await load(db,org,c.req.param('id'));if(!row)fail(404,'NOT_FOUND');version(c,row);if(row.status!=='draft')fail(409,'DATASET_NOT_DRAFT');
  if(value.index>=row.expected_chunks)fail(422,'INVALID_CHUNK_INDEX');
  let validated:ReturnType<typeof validateBoundaryCollection>;
  try{validated=validateBoundaryCollection(value.collection)}catch(e){fail(422,e instanceof z.ZodError?'INVALID_BOUNDARY_PROPERTIES':(e as Error).message)}
  const {collection,bboxes}=validated,body=canonicalJson(collection),bytes=new TextEncoder().encode(body);
  const totals=await db.prepare('SELECT COALESCE(SUM(byte_count),0) bytes FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=?').bind(org,row.id).first<{bytes:number}>();
  if((totals?.bytes||0)+bytes.byteLength>boundaryLimits.maxDatasetBytes)fail(422,'DATASET_TOO_LARGE');
  if(row.uploaded_features+collection.features.length>row.expected_features)fail(422,'FEATURE_COUNT_EXCEEDED');
  const bucket=c.env.IMPORT_FILES;if(!bucket)fail(503,'BOUNDARY_STORAGE_UNAVAILABLE');
  if(await db.prepare('SELECT 1 FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=? AND chunk_index=?').bind(org,row.id,value.index).first())fail(409,'CHUNK_ALREADY_UPLOADED');
  const checksum=await digest(body),key=`${encodeURIComponent(org)}/admin-boundaries/${row.id}/${value.index}/${crypto.randomUUID()}.geojson`;
  const units=new Map<string,any>(),boundaryRows:any[]=[];
  for(let index=0;index<collection.features.length;index++){
   const feature:BoundaryFeature=collection.features[index],p=feature.properties,levels=['province','regency','district','village'] as const;let parent:string|null=null;
   for(const level of levels){
    const u=p[level],id=await digest(canonicalJson([org,row.code_namespace,u.code]));
    const record={id,parent_unit_id:parent,admin_code:u.code,name:u.name,level,village_type:level==='village'?p.village.type:null};
    const previous=units.get(id);if(previous&&canonicalJson(previous)!==canonicalJson(record))fail(422,'CONFLICTING_ADMIN_HIERARCHY');units.set(id,record);parent=id;
   }
   boundaryRows.push({id:crypto.randomUUID(),unit_id:parent,source_id:p.source_id,name:p.village.name,parent_code:p.district.code,hierarchy:canonicalJson(p),feature_index:index,geometry_type:feature.geometry.type,checksum:await digest(canonicalJson(feature.geometry)),bbox:bboxes[index]});
  }
  const unitList=[...units.values()],now=new Date().toISOString();
  const statements: D1PreparedStatement[]=[...guard(db,db.prepare("UPDATE admin_boundary_dataset SET version=version+1 WHERE organization_id=? AND id=? AND status='draft' AND version=?").bind(org,row.id,row.version))];
  for(const level of ['province','regency','district','village'])statements.push(db.prepare(`INSERT INTO admin_unit(id,organization_id,parent_unit_id,code_namespace,admin_code,name,level,village_type) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.parent_unit_id'),?,json_extract(value,'$.admin_code'),json_extract(value,'$.name'),json_extract(value,'$.level'),json_extract(value,'$.village_type') FROM json_each(?) WHERE json_extract(value,'$.level')=? ON CONFLICT(organization_id,code_namespace,admin_code) DO NOTHING`).bind(org,row.code_namespace,JSON.stringify(unitList),level));
  // Recheck identities inside the transaction to cover concurrent chunks sharing parents.
  statements.push(db.prepare(`INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN COUNT(*)=? THEN 1 ELSE 0 END FROM json_each(?) j JOIN admin_unit u ON u.organization_id=? AND u.id=json_extract(j.value,'$.id') AND u.level=json_extract(j.value,'$.level') AND u.parent_unit_id IS json_extract(j.value,'$.parent_unit_id') AND u.village_type IS json_extract(j.value,'$.village_type')`).bind(unitList.length,JSON.stringify(unitList),org),db.prepare('DELETE FROM master_mutation_guard'));
  statements.push(db.prepare(`INSERT INTO admin_boundary(id,organization_id,dataset_id,admin_unit_id,source_id,name_snapshot,parent_code_snapshot,hierarchy_json,geometry_object_key,geometry_feature_index,geometry_type,geometry_checksum,min_longitude_e7,min_latitude_e7,max_longitude_e7,max_latitude_e7) SELECT json_extract(value,'$.id'),?,?,json_extract(value,'$.unit_id'),json_extract(value,'$.source_id'),json_extract(value,'$.name'),json_extract(value,'$.parent_code'),json_extract(value,'$.hierarchy'),?,json_extract(value,'$.feature_index'),json_extract(value,'$.geometry_type'),json_extract(value,'$.checksum'),json_extract(value,'$.bbox[0]'),json_extract(value,'$.bbox[1]'),json_extract(value,'$.bbox[2]'),json_extract(value,'$.bbox[3]') FROM json_each(?)`).bind(org,row.id,key,JSON.stringify(boundaryRows)),db.prepare('INSERT INTO admin_boundary_chunk VALUES(?,?,?,?,?,?,?,?)').bind(org,row.id,value.index,checksum,key,collection.features.length,bytes.byteLength,now));
  try{await bucket.put(key,bytes.buffer,{httpMetadata:{contentType:'application/geo+json'},customMetadata:{sha256:checksum}})}catch{fail(503,'BOUNDARY_STORAGE_UNAVAILABLE')}
  // On uncertain DB acknowledgements retain the private immutable object; never delete a possibly committed source.
  return {data:{id:row.id,version:row.version+1,status:'draft',chunk_index:value.index,checksum,uploaded_features:row.uploaded_features+collection.features.length,uploaded_chunks:row.uploaded_chunks+1},statements,resource:'admin_boundary_chunk',before:{id:row.id,version:row.version}};
 });
});
boundaries.post('/api/admin-boundaries/datasets/:id/activate',async c=>{
 const value=await parsed(c,z.union([boundaryReviewSchema,boundarySelectionSchema]));if(!value)return c.json({code:'VALIDATION_ERROR'},422);
 return operation(c,value,async()=>{
  const db=c.env.DB,org=c.get('identity').organization_id,who=c.get('identity').id,row=await load(db,org,c.req.param('id'));if(!row)fail(404,'NOT_FOUND');version(c,row);const simple='enabled' in value;if(!simple&&row.status!=='draft')fail(409,'DATASET_NOT_DRAFT');
  const active=await db.prepare("SELECT id,version FROM admin_boundary_dataset WHERE organization_id=? AND status='active'").bind(org).first<any>();
  if((active?.id||null)!==value.expected_active_id)fail(412,'ACTIVE_DATASET_CHANGED');
  if(simple&&!value.enabled){
   if(row.status!=='active')fail(409,'DATASET_NOT_ACTIVE');
   return{data:{id:row.id,status:'retired',version:row.version+1},resource:'admin_boundary_dataset',before:expose(row),statements:guard(db,db.prepare("UPDATE admin_boundary_dataset SET status='retired',version=version+1 WHERE organization_id=? AND id=? AND status='active' AND version=?").bind(org,row.id,row.version))};
  }
  if(simple&&row.status==='active')fail(409,'DATASET_ALREADY_ACTIVE');
  const chunks=(await db.prepare('SELECT * FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=? ORDER BY chunk_index').bind(org,row.id).all<any>()).results;
  if(chunks.length!==row.expected_chunks||row.uploaded_features!==row.expected_features||chunks.reduce((n,x)=>n+x.feature_count,0)!==row.expected_features||chunks.some((x,i)=>x.chunk_index!==i))fail(409,'DATASET_INCOMPLETE');
  if(await digest(manifestJson(chunks.map(x=>x.checksum)))!==row.manifest_sha256)fail(409,'MANIFEST_CHECKSUM_MISMATCH');
  const bucket=c.env.IMPORT_FILES;if(!bucket)fail(503,'BOUNDARY_STORAGE_UNAVAILABLE');
  // Bounded manifest: at most 100 chunks; do not load all geometries into memory concurrently.
  for(const chunk of chunks){const object=await bucket.get(chunk.storage_key);if(!object)fail(503,'BOUNDARY_SOURCE_UNAVAILABLE');const bytes=await object.arrayBuffer();if(bytes.byteLength!==chunk.byte_count||await digest(bytes)!==chunk.checksum)fail(409,'BOUNDARY_SOURCE_CHANGED')}
  const statements:D1PreparedStatement[]=[];
  if(active)statements.push(...guard(db,db.prepare("UPDATE admin_boundary_dataset SET status='retired',version=version+1 WHERE organization_id=? AND id=? AND status='active' AND version=?").bind(org,active.id,active.version)));
  const now=new Date().toISOString();
  if(simple)statements.push(...guard(db,db.prepare("UPDATE admin_boundary_dataset SET status='active',version=version+1 WHERE organization_id=? AND id=? AND status=? AND version=?").bind(org,row.id,row.status,row.version)));
  else statements.push(...guard(db,db.prepare("UPDATE admin_boundary_dataset SET status='active',version=version+1,license_reference=?,license_note=?,attribution=?,reviewed_by=?,reviewed_at=? WHERE organization_id=? AND id=? AND status='draft' AND version=?").bind(value.license_reference,value.license_note,value.attribution,who,now,org,row.id,row.version)));
  return {data:{id:row.id,status:'active',version:row.version+1,replaced_dataset_id:active?.id||null,reason:simple?'Pemilihan batas wilayah':value.reason},statements,before:expose(row),resource:'admin_boundary_dataset'};
 });
});
boundaries.get('/api/admin-boundaries/datasets/:id/boundaries',async c=>{
 const org=c.get('identity').organization_id,row=await load(c.env.DB,org,c.req.param('id'));if(!row)return c.json({code:'NOT_FOUND'},404);
 const after=c.req.query('after')||'',q=(c.req.query('q')||'').trim(),area=c.req.query('area_id')||'',date=c.req.query('effective_from_date')||c.get('scope').date;
 if(q.length>120)return c.json({code:'INVALID_SEARCH'},422);
 if(!z.iso.date().safeParse(date).success)return c.json({code:'INVALID_DATE'},422);
 if(area&&!await c.env.DB.prepare("SELECT id FROM area WHERE organization_id=? AND id=? AND status='active'").bind(org,area).first())return c.json({code:'INVALID_AREA'},422);
 const membership=area?' AND EXISTS(SELECT 1 FROM area_admin_membership m WHERE m.organization_id=admin_boundary.organization_id AND m.admin_unit_id=admin_boundary.admin_unit_id AND m.boundary_id=admin_boundary.id AND m.area_id=? AND m.effective_from_date<=? AND(m.effective_to_date IS NULL OR m.effective_to_date>?))':'';
 const rows=await c.env.DB.prepare('SELECT id,admin_unit_id,name_snapshot,parent_code_snapshot,hierarchy_json,geometry_type,geometry_checksum,min_longitude_e7,min_latitude_e7,max_longitude_e7,max_latitude_e7 FROM admin_boundary WHERE organization_id=? AND dataset_id=? AND id>?'+(q?' AND (name_snapshot LIKE ? OR hierarchy_json LIKE ?)':'')+membership+' ORDER BY id LIMIT 101').bind(org,row.id,after,...(q?['%'+q+'%','%'+q+'%']:[]),...(area?[area,date,date]:[])).all<any>();
 return c.json({data:rows.results.slice(0,100).map(({hierarchy_json,...x})=>({...x,hierarchy:JSON.parse(hierarchy_json)})),next:rows.results.length>100?rows.results[99].id:null,dataset_status:row.status});
});
boundaries.get('/api/admin-boundaries/datasets/:id/chunks/:index',async c=>{
 const org=c.get('identity').organization_id,index=c.req.param('index');if(!/^\d{1,2}$/.test(index))return c.json({code:'NOT_FOUND'},404);
 const row=await c.env.DB.prepare('SELECT storage_key,checksum,byte_count FROM admin_boundary_chunk WHERE organization_id=? AND dataset_id=? AND chunk_index=?').bind(org,c.req.param('id'),Number(index)).first<any>();if(!row)return c.json({code:'NOT_FOUND'},404);
 const object=await c.env.IMPORT_FILES?.get(row.storage_key);if(!object)return c.json({code:'BOUNDARY_SOURCE_UNAVAILABLE'},503);const bytes=await object.arrayBuffer();if(bytes.byteLength!==row.byte_count||await digest(bytes)!==row.checksum)return c.json({code:'BOUNDARY_SOURCE_CHANGED'},409);
 c.header('Content-Type','application/geo+json');c.header('Content-Disposition','attachment; filename="boundary-chunk.geojson"');return c.body(bytes);
});
