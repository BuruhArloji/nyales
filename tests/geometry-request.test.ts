import test from 'node:test';import assert from 'node:assert/strict';
import {readGeometryBatches,GEOMETRY_BATCH_SIZE} from '../src/client/geometry-request';
const feature=(id:string)=>({type:'Feature',id,properties:{boundary_id:id},geometry:{type:'Polygon',coordinates:[]}});
test('polygon loading is bounded, progressive, deduplicated and keeps request order',async()=>{
 let inFlight=0,peak=0;const sizes:number[]=[],updates:number[]=[];
 const send=async(url:string)=>{const ids=new URL(url,'https://local.test').searchParams.get('ids')!.split(',');sizes.push(ids.length);peak=Math.max(peak,++inFlight);await new Promise(r=>setTimeout(r,2));inFlight--;return Response.json({data:{type:'FeatureCollection',features:ids.map(feature)}})};
 const ids=Array.from({length:40},(_,i)=>String(i)),result=await readGeometryBatches(send,'dataset',[...ids,'0'],{onUpdate:c=>updates.push(c.features.length)});
 assert.deepEqual(result.features.map(f=>f.id),ids);assert.ok(sizes.every(n=>n<=GEOMETRY_BATCH_SIZE));assert.ok(peak<=2);assert.ok(updates[0]<40);assert.equal(updates.at(-1),40);
});
test('oversized polygons split automatically while scope failures do not retry',async()=>{
 let calls=0;const send=async(url:string)=>{calls++;const ids=new URL(url,'https://local.test').searchParams.get('ids')!.split(',');return ids.length>1?Response.json({code:'REFINE_GEOMETRY_SELECTION'},{status:422}):Response.json({data:{type:'FeatureCollection',features:ids.map(feature)}})};
 const result=await readGeometryBatches(send,'d',['1','2','3','4']);assert.equal(result.features.length,4);assert.equal(calls,7);
 calls=0;await assert.rejects(readGeometryBatches(async()=>{calls++;return Response.json({code:'SCOPE_DENIED'},{status:403})},'d',['1','2']),/SCOPE_DENIED/);assert.equal(calls,1);
});
test('aborted viewport requests never update a later map even if transport ignores cancellation',async()=>{
 const controller=new AbortController();let updates=0,release!:()=>void;
 const pending=readGeometryBatches(async()=>{await new Promise<void>(r=>{release=r});return Response.json({data:{type:'FeatureCollection',features:[feature('1')]}})},'d',['1'],{signal:controller.signal,onUpdate:()=>updates++});
 controller.abort();release();await assert.rejects(pending,e=>(e as Error).name==='AbortError');assert.equal(updates,0);
});
