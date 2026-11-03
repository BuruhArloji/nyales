import {digest}from'./operations';
import type {Scope}from'./scope';

type DirectoryDetail={external_code:string;name:string;category?:string;address?:string;phone?:string;phone_valid?:number;website?:string;rating?:string;reviews?:string;status?:string;hours?:string;maps_url?:string;photo_url?:string;area_kelurahan?:string;area_kecamatan?:string;area_kota?:string;import_city?:string;is_closed?:number;is_target?:number;needs_review?:number;administrative_boundary_verified?:boolean;coordinate_verified?:boolean};
type DirectoryPoint={id:string;name:string;lat:number;lng:number;category?:string;city?:string};
type DetailShard={storage_key:string;storage_sha256:string;byte_count:number;count:number};
type DirectoryObject={format:string;organization_id:string;dataset_id:string;points:DirectoryPoint[];details?:DirectoryDetail[];detail_shards?:Record<string,DetailShard>};
type DirectoryData={points:DirectoryPoint[];referenceCodes:Set<string>;details:Map<string,DirectoryDetail>;shards?:Record<string,DetailShard>};
type Manifest={id:string;storage_key:string;storage_sha256:string;byte_count:number;reference_count:number};

// Bound retained memory to one directory per isolate; share concurrent reads and retry failures.
let cached:{key:string;expires:number;pending:Promise<DirectoryData>}|undefined;
let detailCache:{key:string;expires:number;pending:Promise<Map<string,DirectoryDetail>>}|undefined;
async function readDirectoryObject(c:any,row:Manifest):Promise<DirectoryData>{
 const org=c.get('scope').identity.organization_id;
 const prefix=encodeURIComponent(org)+'/point-directories/'+row.id+'/';
 if(!row.storage_key.startsWith(prefix))throw Error('REFERENCE_NAMESPACE_INVALID');
 if(!Number.isSafeInteger(row.byte_count)||row.byte_count<0||row.byte_count>16*1024*1024)throw Error('REFERENCE_SOURCE_UNAVAILABLE');
 const key=JSON.stringify([org,row.id,row.storage_key,row.storage_sha256,row.byte_count,row.reference_count]);
 if(!cached||cached.key!==key||cached.expires<=Date.now()){
  const pending=(async()=>{
   const bucket=c.env.IMPORT_FILES as R2Bucket|undefined;if(!bucket)throw Error('REFERENCE_STORAGE_UNAVAILABLE');
   const obj=await bucket.get(row.storage_key);if(!obj||obj.size!==row.byte_count)throw Error('REFERENCE_SOURCE_UNAVAILABLE');
   const bytes=await obj.arrayBuffer();if(await digest(bytes)!==row.storage_sha256)throw Error('REFERENCE_SOURCE_CHANGED');
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as DirectoryObject;
   if(!['nyales-reference-points-1','nyales-reference-points-2'].includes(data.format)||data.organization_id!==org||data.dataset_id!==row.id||!Array.isArray(data.points)||data.points.length!==row.reference_count||data.points.length>20000||data.details!==undefined&&(!Array.isArray(data.details)||data.details.length>20000))throw Error('REFERENCE_MANIFEST_INVALID');
   if(data.format==='nyales-reference-points-2'){
    if(!data.detail_shards||typeof data.detail_shards!=='object'||Array.isArray(data.detail_shards)||Object.keys(data.detail_shards).length>32)throw Error('REFERENCE_MANIFEST_INVALID');
    for(const [partition,shard] of Object.entries(data.detail_shards))if(!/^(0[0-9a-f]|1[0-9a-f])$/.test(partition)||!shard||!shard.storage_key.startsWith(prefix+'details/')||!/^[a-f0-9]{64}$/.test(shard.storage_sha256)||!Number.isSafeInteger(shard.byte_count)||shard.byte_count<=0||shard.byte_count>4*1024*1024||!Number.isSafeInteger(shard.count)||shard.count<0||shard.count>20000)throw Error('REFERENCE_MANIFEST_INVALID');
   }
   const referenceCodes=new Set<string>();
   for(const p of data.points){
    if(typeof p.id!=='string'||typeof p.name!=='string'||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||referenceCodes.has(p.id.toLowerCase()))throw Error('REFERENCE_POINT_INVALID');
    referenceCodes.add(p.id.toLowerCase());
   }
   const details=new Map<string,DirectoryDetail>();for(const detail of data.details||[]){
    if(!detail||typeof detail.external_code!=='string'||typeof detail.name!=='string'||details.has(detail.external_code.toLowerCase()))throw Error('REFERENCE_DETAIL_INVALID');
    details.set(detail.external_code.toLowerCase(),detail);
   }
   return {points:data.points,referenceCodes,details,shards:data.format==='nyales-reference-points-2'?data.detail_shards:undefined};
  })();
  const entry={key,expires:Date.now()+5*60*1000,pending};cached=entry;
  void pending.catch(()=>{if(cached===entry)cached=undefined});
 }
 const data=await cached.pending;
 // Recheck after asynchronous storage work, also on cache hits.
 const current=await c.env.DB.prepare("SELECT storage_key,storage_sha256,byte_count,reference_count FROM point_directory_dataset WHERE id=? AND organization_id=? AND status='ready'").bind(row.id,org).first();
 if(!current||current.storage_key!==row.storage_key||current.storage_sha256!==row.storage_sha256||current.byte_count!==row.byte_count||current.reference_count!==row.reference_count)throw Error('REFERENCE_METADATA_CHANGED');
 return data;
}

export async function directoryDetails(c:any,datasetId:string,externalCode:string,referenceOnly=false){
 const row=await c.env.DB.prepare("SELECT id,storage_key,storage_sha256,byte_count,reference_count FROM point_directory_dataset WHERE id=? AND organization_id=? AND status='ready'").bind(datasetId,c.get('scope').identity.organization_id).first();
 if(!row)return null;
 const data=await readDirectoryObject(c,row),code=externalCode.toLowerCase();
 // Held and master rows require their own workflows; the reference endpoint exposes only map references.
 if(referenceOnly&&!data.referenceCodes.has(code))return null;
 if(!data.shards)return data.details.get(code)||null;
 if(!/^gmp-[a-f0-9]{24}$/.test(code))return null;
 const partition=(parseInt(code.slice(4,6),16)%32).toString(16).padStart(2,'0'),shard=data.shards[partition];if(!shard)return null;
 const key=JSON.stringify([c.get('scope').identity.organization_id,row.id,shard]);
 if(!detailCache||detailCache.key!==key||detailCache.expires<=Date.now()){
  const pending=(async()=>{
   const obj=await (c.env.IMPORT_FILES as R2Bucket).get(shard.storage_key);if(!obj||obj.size!==shard.byte_count)throw Error('REFERENCE_SOURCE_UNAVAILABLE');
   const bytes=await obj.arrayBuffer();if(await digest(bytes)!==shard.storage_sha256)throw Error('REFERENCE_SOURCE_CHANGED');
   const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(payload.format!=='nyales-directory-details-1'||payload.organization_id!==c.get('scope').identity.organization_id||payload.dataset_id!==row.id||!Array.isArray(payload.details)||payload.details.length!==shard.count)throw Error('REFERENCE_DETAIL_INVALID');
   const result=new Map<string,DirectoryDetail>();for(const item of payload.details){if(!item||typeof item.external_code!=='string'||typeof item.name!=='string'||!/^GMP-[A-F0-9]{24}$/i.test(item.external_code)||((parseInt(item.external_code.slice(4,6),16)%32).toString(16).padStart(2,'0'))!==partition||result.has(item.external_code.toLowerCase()))throw Error('REFERENCE_DETAIL_INVALID');result.set(item.external_code.toLowerCase(),item)}return result;
  })();const entry={key,expires:Date.now()+5*60*1000,pending};detailCache=entry;void pending.catch(()=>{if(detailCache===entry)detailCache=undefined});
 }
 const result=await detailCache.pending;
 const current=await c.env.DB.prepare("SELECT storage_sha256,storage_key FROM point_directory_dataset WHERE id=? AND organization_id=? AND status='ready'").bind(row.id,c.get('scope').identity.organization_id).first();
 if(!current||current.storage_sha256!==row.storage_sha256||current.storage_key!==row.storage_key)throw Error('REFERENCE_METADATA_CHANGED');
 return result.get(code)||null;
}

/** Reference-only POIs never become assignments, invoices, coverage or customer counts. */
export async function referencePoints(c:any){
 const scope=c.get('scope')as Scope;
 // Region labels in the files are not verified territory assignments.
 if(!scope.orgWide||c.req.query('area_id')||c.req.query('rep_id')||c.req.query('customer_status'))return {points:[],total:0,scope_note:'Referensi tersedia pada tampilan organisasi tanpa filter customer.'};
 const db=c.env.DB as D1Database,rows=(await db.prepare("SELECT id,storage_key,storage_sha256,byte_count,reference_count FROM point_directory_dataset WHERE organization_id=? AND status='ready' ORDER BY id LIMIT 4").bind(scope.identity.organization_id).all<any>()).results;
 if(!rows.length)return {points:[],total:0};
 const points:any[]=[];let bytesRead=0;
 for(const row of rows){
  // V2 indexes contain only reference pins and shard checksums; photos/details load on demand.
  bytesRead+=row.byte_count;if(bytesRead>20*1024*1024)throw Error('REFERENCE_SOURCE_UNAVAILABLE');
  const data=await readDirectoryObject(c,row);if(points.length+data.points.length>20000)throw Error('REFERENCE_MANIFEST_INVALID');
  for(const p of data.points)points.push({id:p.id,external_code:p.id,dataset_id:row.id,name:p.name.slice(0,160),lat:p.lat,lng:p.lng,category:String(p.category||'').slice(0,120),city:String(p.city||''),source:'Direktori titik · belum diverifikasi',reference_only:true});
 }
 return {points,total:points.length,source:'Direktori titik dari Google Drive; bukan customer, transaksi atau kunjungan.'};
}
