import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedJson,cacheStatus,scopeCacheKey} from '../src/server/cache';

function fakeRuntime(){
  const store=new Map<string,Response>();
  return {
    store,
    caches:{
      default:{
        match:async(request:Request)=>store.get(request.url)?.clone(),
        put:async(request:Request,response:Response)=>{store.set(request.url,response)},
      },
    },
  };
}

function scope(overrides:Record<string,unknown>={}){
  return {
    identity:{organization_id:'o',role:'MANAGEMENT'},
    areaIds:[],repIds:['u1'],orgWide:true,allRepsInArea:false,channel:null,date:'2026-10-31',
    capabilities:[],...overrides,
  } as never;
}

function withRuntime(runtime:unknown,run:()=>Promise<void>){
  const previous=(globalThis as any).caches;
  (globalThis as any).caches=runtime;
  return run().finally(()=>{(globalThis as any).caches=previous});
}

test('cache key is stable and scope-specific',()=>{
  const base=scope();
  assert.equal(scopeCacheKey(base,'customers'),scopeCacheKey(scope(),'customers'));
  assert.notEqual(scopeCacheKey(base,'customers'),scopeCacheKey(scope({identity:{organization_id:'other',role:'MANAGEMENT'}}),'customers'));
  assert.notEqual(scopeCacheKey(base,'customers'),scopeCacheKey(scope({identity:{organization_id:'o',role:'AREA_MANAGER'},orgWide:false}),'customers'));
  assert.notEqual(scopeCacheKey(base,'customers'),scopeCacheKey(scope({date:'2026-11-01'}),'customers'));
  assert.equal(scopeCacheKey(base,'customers'),scopeCacheKey(scope({repIds:['u2']}),'customers'),'Organization-wide users share authorized nonpersonal data');
  assert.notEqual(scopeCacheKey(scope({orgWide:false,repIds:['u1']}),'customers'),scopeCacheKey(scope({orgWide:false,repIds:['u2']}),'customers'));
  assert.notEqual(scopeCacheKey(base,'customers'),scopeCacheKey(scope({capabilities:['extra']}),'customers'));
  // Array order must not split one scope into two entries.
  assert.equal(
    scopeCacheKey(scope({repIds:['b','a'],areaIds:['y','x']}),'customers'),
    scopeCacheKey(scope({repIds:['a','b'],areaIds:['x','y']}),'customers'),
  );
});

test('second read within the TTL is served from cache',async()=>{
  const runtime=fakeRuntime();
  let reads=0;
  await withRuntime(runtime.caches,async()=>{
    const first=await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{rows:3}});
    const second=await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{rows:3}});
    assert.equal(first.hit,false);
    assert.equal(second.hit,true);
    assert.deepEqual(second.value,{rows:3});
  });
  assert.equal(reads,1,'The expensive read model must not run twice for one scope');
  assert.equal(runtime.store.size,1);
});

test('a different scope never shares an entry',async()=>{
  const runtime=fakeRuntime();
  let reads=0;
  await withRuntime(runtime.caches,async()=>{
    await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{owner:'management'}});
    const other=await cachedJson({},scopeCacheKey(scope({identity:{organization_id:'o',role:'AREA_MANAGER'},orgWide:false,areaIds:['a1']}),'customers'),60,async()=>{reads++;return{owner:'area'}});
    assert.equal(other.hit,false);
    assert.equal(other.value.owner,'area');
  });
  assert.equal(reads,2);
});

test('without a cache runtime the read still succeeds',async()=>{
  let reads=0;
  await withRuntime(undefined,async()=>{
    const first=await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{rows:1}});
    const second=await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{rows:1}});
    assert.equal(first.enabled,false);
    assert.equal(cacheStatus(first),'OFF');
    assert.equal(second.enabled,false);
  });
  assert.equal(reads,2);
});

test('a failing cache never fails the request',async()=>{
  const broken={default:{match:async()=>{throw new Error('cache read down')},put:async()=>{throw new Error('cache write down')}}};
  let reads=0;
  await withRuntime(broken,async()=>{
    const result=await cachedJson({},scopeCacheKey(scope(),'customers'),60,async()=>{reads++;return{rows:9}});
    assert.deepEqual(result.value,{rows:9});
    assert.equal(result.hit,false);
  });
  assert.equal(reads,1);
});
