// Cross-request cache for expensive read models.
//
// Scope of the cache: one Cloudflare data center (the Cache API never replicates
// outside the colo that wrote the entry). That is deliberate — a stale copy can
// never travel to another region, and the key never contains a person, only the
// resolved authorization scope.
import type {Scope} from './scope';
import {digest} from './operations';

const ORIGIN='https://nyales-cache.internal/';
const pendingReads=new WeakMap<object,Map<string,Promise<unknown>>>();
export const READ_MODEL_TTL_SECONDS=60;
export const DASHBOARD_TTL_SECONDS=300;

export type CacheLookup<T>={value:T;hit:boolean;enabled:boolean};

/** Stable key for one authorization scope. Two users with the same scope share an entry. */
export function scopeCacheKey(s:Scope,name:string,version='v2'):string{
  return JSON.stringify([
    name,version,
    s.identity.organization_id,
    s.identity.role,
    s.date,
    s.channel??'-',
    s.orgWide?'organization':s.allRepsInArea?'area':'assigned',
    s.orgWide?[]:[...s.areaIds].sort(),
    s.orgWide?[]:[...s.repIds].sort(),
    [...s.capabilities].sort(),
  ]);
}

/** Existing transactional epochs invalidate shared data after a write without
 * adding new per-row invalidation triggers. Memoization lasts one request only.
 * Never cache identity, device-session validation or resolveScope here. */
export async function readModelRevision(c:any):Promise<string>{
 const memo=c.get?.('readModelRevision');if(memo)return memo;
 const org=c.get('scope').identity.organization_id;
 const row=await (c.env.DB as D1Database).prepare(`SELECT v.source_epoch,g.epoch geography_epoch,f.epoch finance_epoch,
   (SELECT group_concat(token,'|') FROM (SELECT id||':'||version||':'||status token FROM customer_tier_rule WHERE organization_id=? ORDER BY id)) tier_revision
   FROM organization o
   LEFT JOIN visit_planning_revision v ON v.organization_id=o.id
   LEFT JOIN geo_distribution_epoch g ON g.organization_id=o.id
   LEFT JOIN finance_epoch f ON f.organization_id=o.id WHERE o.id=?`).bind(org,org).first<any>();
 if(!row||row.source_epoch===null||row.geography_epoch===null)throw Error('READ_REVISION_UNAVAILABLE');
 const revision=await digest(JSON.stringify(row));c.set?.('readModelRevision',revision);return revision;
}

export function cacheStatus<T>(lookup:CacheLookup<T>):string{
  return lookup.enabled?(lookup.hit?'HIT':'MISS'):'OFF';
}

/**
 * Returns the cached JSON for `key`, or runs `produce` once and stores the result.
 * Any cache failure degrades to an uncached read; it never fails the request.
 */
export async function cachedJson<T>(
  _c:any,
  key:string,
  ttlSeconds:number,
  produce:()=>Promise<T>,
):Promise<CacheLookup<T>>{
  const cache=(globalThis as any).caches?.default as Cache|undefined;
  if(!cache)return{value:await produce(),hit:false,enabled:false};

  // Register before async hashing/cache lookup: simultaneous misses must not race
  // ahead of the shared producer, including when the producer rejects immediately.
  let pending=pendingReads.get(cache);if(!pending){pending=new Map();pendingReads.set(cache,pending)}
  const existing=pending.get(key);if(existing)return await existing as CacheLookup<T>;
  const task=(async():Promise<CacheLookup<T>>=>{
    const request=new Request(ORIGIN+await digest(key),{method:'GET'});
    try{const hit=await cache.match(request);if(hit)return{value:await hit.json() as T,hit:true,enabled:true}}catch{/* Fall back to origin on cache failure. */}
    const value=await produce();
    try{await cache.put(request,new Response(JSON.stringify(value),{headers:{'content-type':'application/json','cache-control':`public, max-age=${Math.max(1,ttlSeconds)}`}}))}catch{/* Preserve successful origin reads when cache storage fails. */}
    return{value,hit:false,enabled:true};
  })();
  pending.set(key,task);
  try{return await task}finally{if(pending.get(key)===task)pending.delete(key)}
}
