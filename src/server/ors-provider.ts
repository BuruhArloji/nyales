import {orsLimits} from '../shared/ors-planning';
import {fail} from './operations';

const endpoints={matrix:'https://api.heigit.org/openrouteservice/v2/matrix/driving-car',optimization:'https://api.heigit.org/vroom/v0',directions:'https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson'};
/** Fixed hosts and header-only key. Provider error bodies can contain request
 * coordinates; discard them instead of reflecting/logging them to the client. */
export async function orsPost(key:string,kind:keyof typeof endpoints,body:unknown){
 let response:Response;
 try{response=await fetch(endpoints[kind],{method:'POST',headers:{Authorization:key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(orsLimits.timeout_ms),redirect:'error'})}
 catch(e){fail(503,(e as Error).name==='TimeoutError'||(e as Error).name==='AbortError'?'ORS_PROVIDER_TIMEOUT':'ORS_PROVIDER_UNAVAILABLE')}
 if(response!.status===429)fail(503,'ORS_PROVIDER_RATE_LIMIT');
 if([401,403].includes(response!.status))fail(503,'ORS_PROVIDER_AUTH');
 if(!response!.ok)fail(503,'ORS_PROVIDER_UNAVAILABLE');
 // Bound decompressed bytes too; do not buffer an unbounded upstream response.
 const reader=response!.body?.getReader();if(!reader)fail(503,'ORS_INVALID_RESULT');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader!.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader!.cancel();fail(503,'ORS_INVALID_RESULT')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{fail(503,'ORS_INVALID_RESULT')}
}

export async function optimizeOrs(key:string,vehicles:any[],jobs:any[],locations:number[][]){
 const matrix=await orsPost(key,'matrix',{locations,metrics:['duration','distance'],units:'m'});
 const check=(m:any)=>Array.isArray(m)&&m.length===locations.length&&m.every((row:any)=>Array.isArray(row)&&row.length===locations.length&&row.every((v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0));
 if(!check(matrix.durations)||!check(matrix.distances))fail(422,'ORS_UNREACHABLE');
 const result=await orsPost(key,'optimization',{jobs,vehicles,matrices:{'driving-car':{durations:matrix.durations.map((r:number[])=>r.map(Math.ceil)),distances:matrix.distances.map((r:number[])=>r.map(Math.ceil))}}});
 if(result.code!==0||!Array.isArray(result.routes)||!Array.isArray(result.unassigned)||result.routes.length>vehicles.length)fail(503,'ORS_INVALID_RESULT');
 // Return travel geometry separately: matrix-derived ETAs remain the planning basis.
 const routeVehicle=new Set<number>(),seen=new Set<number>();
 for(const route of result.routes){
  const vehicle=vehicles.find(v=>v.id===route.vehicle);if(!vehicle||routeVehicle.has(route.vehicle)||!Array.isArray(route.steps)||route.steps.length>jobs.length+12)fail(503,'ORS_INVALID_RESULT');routeVehicle.add(route.vehicle);
  if(route.violations?.length)fail(503,'ORS_INVALID_RESULT');
  if(!Number.isFinite(route.duration)||route.duration<0||!Number.isFinite(route.distance)||route.distance<0)fail(503,'ORS_INVALID_RESULT');
  let previous=-Infinity;
  for(const step of route.steps){
   if(!Number.isFinite(step.arrival)||!Number.isFinite(step.waiting_time)||step.waiting_time<0||!Number.isFinite(step.service)||step.service<0||step.arrival<previous||step.violations?.length)fail(503,'ORS_INVALID_RESULT');previous=step.arrival+step.waiting_time+step.service;
   if(step.type==='job'){
    const job=jobs.find(j=>j.id===step.id);if(!job||seen.has(job.id)||!job.skills.every((s:number)=>vehicle.skills.includes(s)))fail(503,'ORS_INVALID_RESULT');
    const serviceStart=step.arrival+Number(step.waiting_time||0);
    if(step.service!==job.service||!job.time_windows.some((w:number[])=>serviceStart>=w[0]&&serviceStart<=w[1]))fail(503,'ORS_INVALID_RESULT');seen.add(job.id);
   }else if(!['start','end','break'].includes(step.type))fail(503,'ORS_INVALID_RESULT');
  }
  const first=route.steps[0],last=route.steps.at(-1);if(first?.type!=='start'||last?.type!=='end'||first.arrival<vehicle.time_window[0]||last.arrival>vehicle.time_window[1])fail(503,'ORS_INVALID_RESULT');
  for(const b of vehicle.breaks){const matches=route.steps.filter((s:any)=>s.type==='break'&&s.id===b.id);if(matches.length!==1||matches[0].service!==b.service||!b.time_windows.some((w:number[])=>matches[0].arrival+Number(matches[0].waiting_time||0)>=w[0]&&matches[0].arrival+Number(matches[0].waiting_time||0)<=w[1]))fail(503,'ORS_INVALID_RESULT')}
 }
 for(const job of result.unassigned){if(!jobs.some(j=>j.id===job.id)||seen.has(job.id))fail(503,'ORS_INVALID_RESULT');seen.add(job.id)}
 if(seen.size!==jobs.length)fail(503,'ORS_INVALID_RESULT');
 const geometries:any[]=[];
 for(const route of result.routes){
  const vehicle=vehicles.find(v=>v.id===route.vehicle),coordinates=[vehicle.start,...route.steps.filter((s:any)=>s.type==='job').map((s:any)=>jobs.find(j=>j.id===s.id).location),vehicle.end];
  // A geometry failure does not discard an otherwise valid optimization result.
  try{const geo=await orsPost(key,'directions',{coordinates,instructions:false,geometry_simplify:true});const geometry=geo.features?.[0]?.geometry;if(geometry?.type==='LineString'&&Array.isArray(geometry.coordinates)&&geometry.coordinates.length<=50000&&geometry.coordinates.every((p:any)=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90))geometries.push({type:'Feature',properties:{vehicle:route.vehicle},geometry})}catch{/* geometry_available below explicitly discloses this */}
 }
 return{result,geometry:{type:'FeatureCollection',features:geometries},matrix_nodes:locations.length};
}
