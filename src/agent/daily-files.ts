import {open,writeFile,link,unlink,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {installedGraph,verifyGraphInstallation} from './graph-installation';
import {computeDailyCandidate} from './daily-planner';
import {fetchOsrmMatrix,localOsrmOrigin} from './osrm-client';
import {visitSnapshot,visitGeneratorPolicy} from '../shared/visit-generator';
import {canonicalJson} from '../shared/boundaries';

async function boundedJson(path:string){
 const file=await open(resolve(path),'r');
 try{
  const before=await file.stat(),limit=4*1024*1024;
  if(!before.isFile()||before.size<2||before.size>limit)throw Error('DAILY_INPUT_FILE_BOUND');
  const bytes=Buffer.alloc(before.size+1);let read=0;
  while(read<bytes.length){const part=await file.read(bytes,read,bytes.length-read,null);if(!part.bytesRead)break;read+=part.bytesRead}
  const after=await file.stat();
  if(read!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error('DAILY_INPUT_FILE_CHANGED');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,read)));
 }finally{await file.close()}
}
/** Explicit local files, local/forwarded OSRM only. No DB mutation, upload or agenda publication. */
export async function runDailyFiles(options:{snapshot:string;policy:string;installation:string;graphDirectory:string;python:string;osrmOrigin:string;output:string;signal?:AbortSignal}){
 const output=resolve(options.output);
 try{await access(output);throw Error('DAILY_OUTPUT_EXISTS')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 const origin=localOsrmOrigin(options.osrmOrigin);
 const [rawSnapshot,rawPolicy,rawInstallation]=await Promise.all([boundedJson(options.snapshot),boundedJson(options.policy),boundedJson(options.installation)]);
 const snapshot=visitSnapshot.parse(rawSnapshot),policy=visitGeneratorPolicy.parse(rawPolicy),installation=installedGraph.parse(rawInstallation);
 if(canonicalJson(snapshot.graph)!==canonicalJson(installation.graph))throw Error('DAILY_INSTALLATION_SNAPSHOT_MISMATCH');
 const verified=await verifyGraphInstallation(options.graphDirectory,installation,options.signal);
 const candidate=await computeDailyCandidate(snapshot,policy,{python:options.python,routing_profile:installation.routing_profile,
   matrix:(request,signal)=>fetchOsrmMatrix(origin,request,{signal}),signal:options.signal,matrix_provenance:'operator_osrm_unverified'});
 const report={...candidate,installation:verified,agenda_written:false,uploaded:false,
   runtime_limit_seconds:Math.min(120,policy.runtime.solver_seconds),classification:'operator_local_draft_engine_unverified'};
 const data=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(data)>8*1024*1024)throw Error('DAILY_OUTPUT_LIMIT');
 options.signal?.throwIfAborted();
 const temporary=join(dirname(output),'.nyales-daily-'+randomUUID()+'.partial');
 try{await writeFile(temporary,data,{flag:'wx',mode:0o600});options.signal?.throwIfAborted();await link(temporary,output)}
 finally{await unlink(temporary).catch(()=>{})}
 return{output,solver_outcome:candidate.result.solver_outcome,scheduled:candidate.result.routes.reduce((n,r)=>n+r.visits.length,0),
  unscheduled:candidate.result.unscheduled.length,structurally_valid:candidate.validation.structurally_valid,publishable:false as const,
  osrm_process_identity_verified:false as const,agenda_written:false as const};
}
