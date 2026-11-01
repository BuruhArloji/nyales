// Cross-request cache for expensive read models.
//
// Scope of the cache: one Cloudflare data center (the Cache API never replicates
// outside the colo that wrote the entry). That is deliberate — a stale copy can
// never travel to another region, and the key never contains a person, only the
// resolved authorization scope.
import type {Scope} from './scope';

const ORIGIN='https://nyales-cache.internal/';
export const READ_MODEL_TTL_SECONDS=60;
export const DASHBOARD_TTL_SECONDS=300;

export type CacheLookup<T>={value:T;hit:boolean;enabled:boolean};

/** Stable key for one authorization scope. Two users with the same scope share an entry. */
export function scopeCacheKey(s:Scope,name:string,version='v1'):string{
  return [
    name,version,
    s.identity.organization_id,
    s.identity.role,
    s.date,
    s.channel??'-',
    s.orgWide?'organization':s.allRepsInArea?'area':'assigned',
    [...s.areaIds].sort().join(','),
    [...s.repIds].sort().join(','),
  ].join('|');
}

export function cacheStatus<T>(lookup:CacheLookup<T>):string{
  return lookup.enabled?(lookup.hit?'HIT':'MISS'):'OFF';
}

/**
 * Returns the cached JSON for `key`, or runs `produce` once and stores the result.
 * Any cache failure degrades to an uncached read; it never fails the request.
 */
export async function cachedJson<T>(
  c:any,
  key:string,
  ttlSeconds:number,
  produce:()=>Promise<T>,
):Promise<CacheLookup<T>>{
  const cache=(globalThis as any).caches?.default as Cache|undefined;
  if(!cache)return{value:await produce(),hit:false,enabled:false};

  const request=new Request(ORIGIN+encodeURIComponent(key),{method:'GET'});
  try{
    const hit=await cache.match(request);
    if(hit)return{value:await hit.json() as T,hit:true,enabled:true};
  }catch(error){
    // Cache read unavailable: fall through to the origin read.
  }

  const value=await produce();
  try{
    const response=new Response(JSON.stringify(value),{
      headers:{'content-type':'application/json','cache-control':`public, max-age=${Math.max(1,ttlSeconds)}`},
    });
    const task=cache.put(request,response);
    if(c?.executionCtx?.waitUntil)c.executionCtx.waitUntil(task);else await task;
  }catch(error){
    // Cache write unavailable: the response is still correct, it just is not stored.
  }
  return{value,hit:false,enabled:true};
}