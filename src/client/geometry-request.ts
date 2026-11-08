import {readMapData} from './map-request';

export const GEOMETRY_BATCH_SIZE=4;
type Collection={type:'FeatureCollection';features:any[]};
/** Keep polygon downloads separate from the point map. Small batches stay within
 * server read/response budgets and publish useful geometry as it arrives. */
export async function readGeometryBatches(send:(url:string,init:RequestInit)=>Promise<Response>,dataset:string,ids:string[],options:{signal?:AbortSignal;onUpdate?:(data:Collection)=>void}={}){
 const requested=[...new Set(ids)],features=new Map<string,any>(),controller=new AbortController();
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
 const snapshot=():Collection=>({type:'FeatureCollection',features:requested.flatMap(id=>features.has(id)?[features.get(id)]:[])});
 async function load(batch:string[]):Promise<void>{
  controller.signal.throwIfAborted();
  let data:any;
  try{data=await readMapData(send,'/api/geo/geometry?'+new URLSearchParams({dataset_id:dataset,ids:batch.join(',')}),controller.signal)}
  catch(e){if(!controller.signal.aborted&&batch.length>1&&['GEOMETRY_READ_LIMIT','REFINE_GEOMETRY_SELECTION'].includes((e as Error).message)){const middle=Math.ceil(batch.length/2);await load(batch.slice(0,middle));await load(batch.slice(middle));return}throw e}
  controller.signal.throwIfAborted();
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('INVALID_GEOMETRY_RESPONSE');
  for(const feature of data.features){const id=String(feature.id??feature.properties?.boundary_id??'');if(!batch.includes(id))throw Error('INVALID_GEOMETRY_RESPONSE');features.set(id,feature)}
  options.onUpdate?.(snapshot());
 }
 try{
  // Two concurrent requests avoid flooding D1/R2 when the viewport changes.
  for(let offset=0;offset<requested.length;offset+=GEOMETRY_BATCH_SIZE*2){const wave=requested.slice(offset,offset+GEOMETRY_BATCH_SIZE*2);await Promise.all([wave.slice(0,GEOMETRY_BATCH_SIZE),wave.slice(GEOMETRY_BATCH_SIZE)].filter(b=>b.length).map(load))}
  controller.signal.throwIfAborted();return snapshot();
 }catch(e){controller.abort();throw e}finally{options.signal?.removeEventListener('abort',abort)}
}
