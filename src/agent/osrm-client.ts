import {visitGraphManifest} from '../shared/visit-generator';
import {canonicalJson} from '../shared/boundaries';
import {agentSha256} from '../shared/visit-agent-proof';
import {z} from 'zod';
const node=z.object({id:z.string().min(1).max(128),longitude_e7:z.number().int().min(-1800000000).max(1800000000),latitude_e7:z.number().int().min(-900000000).max(900000000)}).strict();
export const osrmMatrixRequest=z.object({graph:visitGraphManifest,routing_profile:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),maximum_snap_metres:z.number().int().min(1).max(5000),nodes:z.array(node).min(2).max(100)}).strict().refine(r=>new Set(r.nodes.map(n=>n.id)).size===r.nodes.length,'Duplicate matrix node');
const cell=z.number().finite().nonnegative().max(1e9).nullable(),waypoint=z.object({location:z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)]),distance:z.number().nonnegative().finite()}).passthrough();
const matrix=z.object({code:z.literal('Ok'),durations:z.array(z.array(cell)),distances:z.array(z.array(cell)),sources:z.array(waypoint),destinations:z.array(waypoint),fallback_speed_cells:z.array(z.tuple([z.number().int(),z.number().int()])).optional(),data_version:z.string().max(200).optional()}).passthrough();
// Geographic distance is only a snap-quality check, never a substitute travel edge.
function snapSeparation(p:z.infer<typeof node>,location:[number,number]){const rad=(v:number)=>v*Math.PI/180,a=p.latitude_e7/1e7,b=location[1],delta=rad(b-a),lng=rad(location[0]-p.longitude_e7/1e7),h=Math.sin(delta/2)**2+Math.cos(rad(a))*Math.cos(rad(b))*Math.sin(lng/2)**2;return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)))}
export function localOsrmOrigin(raw:string){const u=new URL(raw);if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||!u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('OSRM_LOOPBACK_ORIGIN_REQUIRED');return u.origin}
export async function matrixCacheKey(raw:z.infer<typeof osrmMatrixRequest>){const r=osrmMatrixRequest.parse(raw);return agentSha256(canonicalJson({format:'nyales-osrm-matrix-1',graph_sha256:r.graph.graph_sha256,engine_version:r.graph.engine_version,profile:r.graph.profile,profile_version:r.graph.profile_version,routing_profile:r.routing_profile,maximum_snap_metres:r.maximum_snap_metres,nodes:r.nodes,annotations:'duration,distance',fallback:false}))}
export function parseOsrmMatrix(raw:unknown,input:z.infer<typeof osrmMatrixRequest>){
 const request=osrmMatrixRequest.parse(input),data=matrix.parse(raw),n=request.nodes.length;
 if(data.fallback_speed_cells?.length)throw Error('OSRM_ESTIMATED_FALLBACK_DENIED');
 if(data.durations.length!==n||data.distances.length!==n||data.sources.length!==n||data.destinations.length!==n||data.durations.some(row=>row.length!==n)||data.distances.some(row=>row.length!==n))throw Error('OSRM_MATRIX_DIMENSION_MISMATCH');
 const [west,south,east,north]=request.graph.coverage_bbox;
 if(request.nodes.some(p=>p.longitude_e7/1e7<west||p.longitude_e7/1e7>east||p.latitude_e7/1e7<south||p.latitude_e7/1e7>north))throw Error('OSRM_POINT_OUTSIDE_GRAPH');
 if([...data.sources,...data.destinations].some(p=>p.distance>request.maximum_snap_metres))throw Error('OSRM_SNAP_DISTANCE_EXCEEDED');
 if(data.sources.some((p,i)=>snapSeparation(request.nodes[i],p.location)>request.maximum_snap_metres+2)||data.destinations.some((p,i)=>snapSeparation(request.nodes[i],p.location)>request.maximum_snap_metres+2))throw Error('OSRM_WAYPOINT_ORDER_OR_SNAP_MISMATCH');
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){if((data.durations[i][j]===null)!==(data.distances[i][j]===null))throw Error('OSRM_EDGE_UNKNOWN_MISMATCH');if(i===j&&(data.durations[i][j]!==0||data.distances[i][j]!==0))throw Error('OSRM_DIAGONAL_INVALID')}
 return{format:'nyales-osrm-matrix-1' as const,graph_id:request.graph.id,graph_sha256:request.graph.graph_sha256,profile_version:request.graph.profile_version,routing_profile:request.routing_profile,node_ids:request.nodes.map(p=>p.id),nodes:request.nodes,durations_seconds:data.durations.map(row=>row.map(v=>v===null?null:Math.ceil(v))),distances_metres:data.distances.map(row=>row.map(v=>v===null?null:Math.ceil(v))),unreachable_edges:data.durations.reduce((n,row)=>n+row.filter(v=>v===null).length,0),snapped_sources:data.sources.map(p=>({location:p.location,distance_metres:p.distance})),snapped_destinations:data.destinations.map(p=>({location:p.location,distance_metres:p.distance})),source_data_version:data.data_version||null,travel_traffic:'none' as const,estimated_fallback_used:false as const,rounding:'ceil_to_integer_seconds_and_metres' as const};
}
/** Explicit loopback only; never calls the public OSRM demo or accepts a URL from a job. */
export async function fetchOsrmMatrix(origin:string,raw:z.infer<typeof osrmMatrixRequest>,options:{signal?:AbortSignal;fetcher?:typeof fetch;timeout_ms?:number}={}){
 const input=osrmMatrixRequest.parse(raw),base=localOsrmOrigin(origin),[w,s,e,n]=input.graph.coverage_bbox;
 if(input.nodes.some(p=>p.longitude_e7/1e7<w||p.longitude_e7/1e7>e||p.latitude_e7/1e7<s||p.latitude_e7/1e7>n))throw Error('OSRM_POINT_OUTSIDE_GRAPH');
 const timeout=options.timeout_ms??30000;if(!Number.isInteger(timeout)||timeout<1||timeout>120000)throw Error('OSRM_TIMEOUT_BOUND');
 const url=new URL('/table/v1/'+input.routing_profile+'/'+input.nodes.map(p=>(p.longitude_e7/1e7).toFixed(7)+','+(p.latitude_e7/1e7).toFixed(7)).join(';'),base);url.searchParams.set('annotations','duration,distance');url.searchParams.set('radiuses',input.nodes.map(()=>input.maximum_snap_metres).join(';'));url.searchParams.set('generate_hints','false');
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),response=await(options.fetcher||fetch)(url,{redirect:'error',signal,headers:{Accept:'application/json'}});
 if(!response.ok&&response.status!==400){await response.body?.cancel();throw Error('OSRM_HTTP_UNAVAILABLE')}
 const maxBytes=2*1024*1024;if(Number(response.headers.get('Content-Length'))>maxBytes){await response.body?.cancel();throw Error('OSRM_RESPONSE_LIMIT')}const reader=response.body?.getReader();if(!reader)throw Error('OSRM_RESPONSE_EMPTY');const parts:Uint8Array[]= [];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>maxBytes)throw Error('OSRM_RESPONSE_LIMIT');parts.push(r.value)}}catch(error){await reader.cancel().catch(()=>{});throw error}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}let json:unknown;try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw Error('OSRM_RESPONSE_INVALID')}
 if((json as any)?.code==='NoSegment')throw Error('OSRM_SNAP_FAILED');if((json as any)?.code==='NoTable')throw Error('OSRM_NO_TABLE');if(!response.ok)throw Error('OSRM_HTTP_UNAVAILABLE');
 return{cache_key:await matrixCacheKey(input),...parseOsrmMatrix(json,input)};
}
