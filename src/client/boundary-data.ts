import {apiFetch} from './auth';
export async function readBoundaryDatasets(){
 const all:any[]=[];let after='';
 do{const result=await(await apiFetch('/api/admin-boundaries/datasets'+(after?'?after='+encodeURIComponent(after):''))).json() as {data:any[];next:string|null};all.push(...result.data);after=result.next||''}while(after);
 return all;
}
