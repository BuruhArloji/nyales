import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './geography-fixture';

test('map geography cache preserves summaries, separates scope and rejects old coordinate evidence after writes',async()=>{
 const f=harness();f.point();const dataset=await f.release(),preview=await f.preview();assert.equal((await f.review(preview)).status,200);
 const before=(globalThis as any).caches,store=new Map<string,Response>();(globalThis as any).caches={default:{match:async(r:Request)=>store.get(r.url)?.clone(),put:async(r:Request,response:Response)=>{store.set(r.url,response)}}};
 try{
  const path='/api/geo/map?compact=1&dataset_id='+dataset.id,first=await f.req('GET',path,undefined,undefined,undefined,'mg'),a=await first.json() as any;
  assert.equal(first.status,200);assert.equal(first.headers.get('X-NYALES-Geography-Cache'),'MISS');
  const second=await f.req('GET',path,undefined,undefined,undefined,'mg'),b=await second.json() as any;assert.equal(second.headers.get('X-NYALES-Geography-Cache'),'HIT');assert.deepEqual(a.data,b.data);assert.equal(b.data.stats.confirmed,1);
  const sr=await f.req('GET',path,undefined,undefined,undefined,'sr');assert.equal(sr.status,200);assert.equal(sr.headers.get('X-NYALES-Geography-Cache'),'MISS');
  f.point(106.06,-5.95);const changed=await f.req('GET',path,undefined,undefined,undefined,'mg'),c=await changed.json() as any;assert.equal(changed.headers.get('X-NYALES-Geography-Cache'),'MISS');assert.equal(c.data.stats.confirmed,0);assert.equal(c.data.map.customers[0].geo_status,'stale');
 }finally{(globalThis as any).caches=before;f.sqlite.close()}
});
