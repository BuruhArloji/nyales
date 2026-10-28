import {digest}from'./operations';
import type {Scope}from'./scope';

/** Reference-only POIs never become assignments, invoices, coverage or customer counts. */
export async function referencePoints(c:any){
 const scope=c.get('scope')as Scope;
 // Region labels in the files are not verified territory assignments.
 if(!scope.orgWide||c.req.query('area_id')||c.req.query('rep_id')||c.req.query('customer_status'))return {points:[],total:0,scope_note:'Referensi tersedia pada tampilan organisasi tanpa filter customer.'};
 const db=c.env.DB as D1Database,rows=(await db.prepare("SELECT id,storage_key,storage_sha256,byte_count,reference_count FROM point_directory_dataset WHERE organization_id=? AND status='ready' ORDER BY id LIMIT 4").bind(scope.identity.organization_id).all<any>()).results;
 if(!rows.length)return {points:[],total:0};
 const bucket=c.env.IMPORT_FILES as R2Bucket|undefined;if(!bucket)throw Error('REFERENCE_STORAGE_UNAVAILABLE');
 const points:any[]=[];let bytesRead=0;
 for(const row of rows){
  const prefix=encodeURIComponent(scope.identity.organization_id)+'/point-directories/'+row.id+'/';
  if(!row.storage_key.startsWith(prefix))throw Error('REFERENCE_NAMESPACE_INVALID');
  const obj=await bucket.get(row.storage_key);if(!obj||obj.size!==row.byte_count||obj.size+bytesRead>16*1024*1024)throw Error('REFERENCE_SOURCE_UNAVAILABLE');
  const bytes=await obj.arrayBuffer();bytesRead+=bytes.byteLength;if(await digest(bytes)!==row.storage_sha256)throw Error('REFERENCE_SOURCE_CHANGED');
  const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(data.format!=='nyales-reference-points-1'||data.organization_id!==scope.identity.organization_id||data.dataset_id!==row.id||!Array.isArray(data.points)||data.points.length!==row.reference_count||points.length+data.points.length>20000)throw Error('REFERENCE_MANIFEST_INVALID');
  for(const p of data.points){
   if(typeof p.id!=='string'||typeof p.name!=='string'||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat< -90||p.lat>90||p.lng< -180||p.lng>180)throw Error('REFERENCE_POINT_INVALID');
   points.push({id:p.id,name:p.name.slice(0,160),lat:p.lat,lng:p.lng,category:String(p.category||'').slice(0,120),city:String(p.city||''),source:'Direktori titik · belum diverifikasi',reference_only:true});
  }
 }
 return {points,total:points.length,source:'Direktori titik dari Google Drive; bukan customer, transaksi atau kunjungan.'};
}
