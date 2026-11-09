/** Read-only checks against frozen backup rows. This never copies, restores or deletes R2 objects. */
export const recoveryObjectLimits={max_objects:64,max_object_bytes:8*1024*1024,max_total_bytes:32*1024*1024,max_source_manifest_bytes:8*1024*1024} as const;
const sources=[
 {table:'customer_proposal',kind:'customer_proposal_photo',bytes:'photo_size',hash:'photo_sha256'},
 {table:'evidence_attachment',kind:'attachment',bytes:'size',hash:'sha256'},
 {table:'admin_boundary_chunk',kind:'boundary_chunk',bytes:'byte_count',hash:'checksum'},
 {table:'customer_risk_run',kind:'risk_snapshot',bytes:'byte_count',hash:'snapshot_sha256'},
 {table:'territory_scenario_revision',kind:'territory_snapshot',bytes:'byte_count',hash:'snapshot_sha256'},
 {table:'visit_planning_preflight',kind:'readiness_snapshot',bytes:'byte_count',hash:'snapshot_sha256'},
] as const;
type Reference={resource_type:string;resource_id:string;storage_key:string;bytes:number;sha256:string};
type Check={resource_type:string;resource_id:string;status:'passed'|'missing'|'size_mismatch'|'checksum_mismatch'|'unavailable'};
export function collectRecoveryObjects(tables:Record<string,any[]>,organization:string){
 const objects=new Map<string,Reference>(),included:string[]=[];let skipped=0,references=0;
 for(const source of sources){
  if(!Object.hasOwn(tables,source.table))continue;included.push(source.table);
  const rows=tables[source.table];if(!Array.isArray(rows))throw Error('RECOVERY_OBJECT_INVENTORY_INVALID');
  for(const row of rows){
   if(!row||row.organization_id!==organization)throw Error('RECOVERY_OBJECT_TENANT_MISMATCH');
   if(source.table==='customer_proposal'&&!row.photo_key){skipped++;continue}
   if(source.table==='evidence_attachment'&&row.status!=='ready'){skipped++;continue}
   if(source.table==='admin_boundary_chunk'&&(typeof row.dataset_id!=='string'||!row.dataset_id.length||!Number.isInteger(row.chunk_index)||row.chunk_index<0||row.chunk_index>99))throw Error('RECOVERY_OBJECT_INVENTORY_INVALID');
   const resourceId=source.table==='admin_boundary_chunk'?String(row.dataset_id)+':'+String(row.chunk_index):row.id;
   const key=source.table==='customer_proposal'?row.photo_key:row.storage_key,size=row[source.bytes],hash=row[source.hash];
   const prefix=source.table==='customer_proposal'?'customer-proposals/'+organization+'/':source.table==='evidence_attachment'?'evidence/'+organization+'/':source.table==='admin_boundary_chunk'?encodeURIComponent(organization)+'/admin-boundaries/':organization+'/'+({customer_risk_run:'risk',territory_scenario_revision:'scenario',visit_planning_preflight:'visit-readiness'} as Record<string,string>)[source.table]+'/';
   if(typeof resourceId!=='string'||!resourceId.length||resourceId.length>256||typeof key!=='string'||key.length>1024||!key.startsWith(prefix)||key.length===prefix.length||key.split('/').some(p=>!p||p==='.'||p==='..')||!Number.isSafeInteger(size)||size<0||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw Error('RECOVERY_OBJECT_INVENTORY_INVALID');
   const previous=objects.get(key);if(previous&&(previous.bytes!==size||previous.sha256!==hash))throw Error('RECOVERY_OBJECT_REFERENCE_CONFLICT');
   references++;if(!previous)objects.set(key,{resource_type:source.kind,resource_id:resourceId,storage_key:key,bytes:size,sha256:hash});
  }
 }
 const list=[...objects.values()],bytes=list.reduce((n,o)=>n+o.bytes,0);
 if(list.length>recoveryObjectLimits.max_objects)throw Error('RECOVERY_OBJECT_COUNT_LIMIT');
 if(list.some(o=>o.bytes>recoveryObjectLimits.max_object_bytes)||!Number.isSafeInteger(bytes)||bytes>recoveryObjectLimits.max_total_bytes)throw Error('RECOVERY_OBJECT_BYTES_LIMIT');
 return{objects:list,expected_bytes:bytes,reference_count:references,skipped_uncommitted_attachments:skipped,included_tables:included};
}
export async function readRecoveryBytes(stored:any,limit:number):Promise<Uint8Array>{
 if(stored.size!==undefined&&(!Number.isSafeInteger(stored.size)||stored.size<0||stored.size>limit)){if(typeof stored.body?.cancel==='function')await stored.body.cancel().catch(()=>{});throw Error('RECOVERY_READ_BOUND')}
 if(stored.body&&typeof stored.body.getReader==='function'){
  const reader=stored.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw Error('RECOVERY_READ_BOUND');chunks.push(part.value)}}
  catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}return bytes;
 }
 const value=await stored.arrayBuffer(),bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);
 if(bytes.byteLength>limit)throw Error('RECOVERY_READ_BOUND');return bytes;
}
export async function verifyRecoveryObjects(bucket:R2Bucket|undefined,tables:Record<string,any[]>,organization:string){
 const inventory=collectRecoveryObjects(tables,organization),checks:Check[]=[];let verifiedBytes=0;
 for(const object of inventory.objects){
  const item:Check={resource_type:object.resource_type,resource_id:object.resource_id,status:'unavailable'};
  try{
   if(!bucket)throw Error('STORAGE_UNAVAILABLE');const stored=await bucket.get(object.storage_key);
   if(!stored)item.status='missing';
   else{
    let bytes:Uint8Array;try{bytes=await readRecoveryBytes(stored,object.bytes)}catch(error){if((error as Error).message==='RECOVERY_READ_BOUND'){item.status='size_mismatch';checks.push(item);continue}throw error}
    if(bytes.byteLength!==object.bytes)item.status='size_mismatch';
    else{const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer),hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
     item.status=hash===object.sha256?'passed':'checksum_mismatch';if(item.status==='passed')verifiedBytes+=bytes.byteLength}
   }
  }catch{item.status='unavailable'}
  checks.push(item);
 }
 return{status:checks.every(c=>c.status==='passed')?'passed' as const:'failed' as const,object_count:checks.length,verified_count:checks.filter(c=>c.status==='passed').length,
  expected_bytes:inventory.expected_bytes,verified_bytes:verifiedBytes,reference_count:inventory.reference_count,
  skipped_uncommitted_attachments:inventory.skipped_uncommitted_attachments,included_tables:inventory.included_tables,
  excluded_scope:'Transient reports, import source files and objects outside the supported table families are not verified by this drill.',
  checks,limits:recoveryObjectLimits,actual_restore_performed:false as const};
}
