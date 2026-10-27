import {setTimeout as wait} from 'node:timers/promises';
import {canonicalJson} from '../shared/boundaries';
import {agentSha256} from '../shared/visit-agent-proof';
import {AGENT_QUEUE_CONTRACT,queueClaimResponse,queueJobResponse} from '../shared/visit-agent-queue';
import {VisitAgentTransport} from './transport';
type Identity={agent_id:string;organization_id:string;environment:string;generation:number};
type Event={state:string;attempt_no?:number};
const terminal=(state:string)=>['completed','failed','cancelled','expired'].includes(state);
export async function runAgentProbeOnce(client:VisitAgentTransport,identity:Identity,options:{signal?:AbortSignal}={}){
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000),claimed=queueClaimResponse.parse((await client.json('POST','/api/visit-agent/queue/claim',{contract_version:AGENT_QUEUE_CONTRACT},{idempotency_key:crypto.randomUUID(),signal})).data).data;let job=claimed.job;if(!job)return{state:'waiting'} as Event;
 async function action(name:string,extra:object={}){const current=job!;job=queueJobResponse.parse((await client.json('POST',`/api/visit-agent/queue/jobs/${current.id}/${name}`,{contract_version:AGENT_QUEUE_CONTRACT,expected_version:current.version,attempt_no:current.attempt_no,fence:current.fence,payload_sha256:current.payload_sha256,...extra},{idempotency_key:crypto.randomUUID(),signal})).data).data.job;return job}
 try{
  if(terminal(job.state))return{state:job.state,attempt_no:job.attempt_no};if(job.state==='cancel_requested'){await action('cancel-ack');return{state:'cancelled',attempt_no:job!.attempt_no}}
  const payload=job.payload;if(!payload||payload.agent_id!==identity.agent_id||payload.organization_id!==identity.organization_id||payload.environment!==identity.environment||payload.generation!==identity.generation||payload.job_id!==job.id||await agentSha256(canonicalJson(payload))!==job.payload_sha256){await action('fail',{code:'input_invalid',retryable:false});return{state:'failed',attempt_no:job!.attempt_no}}
  await action('renew');if(job!.checkpoint==='claimed')await action('checkpoint',{checkpoint:'probe_received'});if(job!.checkpoint==='probe_received')await action('checkpoint',{checkpoint:'probe_verified'});await action('complete',{probe_nonce:payload.probe_nonce,agent_version:'nyales-probe-agent-1'});return{state:job!.state,attempt_no:job!.attempt_no};
 }catch(error){if((error as Error).message==='AGENT_HTTP_409'||(error as Error).message==='AGENT_HTTP_412'){const latest=queueJobResponse.parse((await client.json('GET','/api/visit-agent/queue/jobs/'+job!.id,null,{signal})).data).data.job;job=latest;if(job.state==='cancel_requested'){await action('cancel-ack');return{state:'cancelled',attempt_no:job!.attempt_no}}return{state:terminal(job.state)?job.state:'retry_pending',attempt_no:job.attempt_no}}throw error}
}
export async function runAgentProbeLoop(client:VisitAgentTransport,identity:Identity,options:{once?:boolean;signal:AbortSignal;onEvent?:(event:Event)=>void;wait?:(ms:number,signal:AbortSignal)=>Promise<void>;random?:()=>number;clock?:()=>number}){
 const sleep=options.wait||((ms:number,signal:AbortSignal)=>wait(ms,undefined,{signal})),clock=options.clock||Date.now,random=options.random||Math.random;let failures=0,lastHeartbeat=-Infinity;
 while(!options.signal.aborted){try{
  if(clock()-lastHeartbeat>=60000){await client.json('POST','/api/visit-agent/heartbeat',{contract_version:'nyales-visit-generator-1',agent_version:'nyales-probe-agent-1',capabilities:{daily:false,monthly:false,max_reps:1,graphs:[],solver_version:'not-installed'}},{idempotency_key:crypto.randomUUID(),signal:options.signal});lastHeartbeat=clock()}
  const result=await runAgentProbeOnce(client,identity,{signal:options.signal});options.onEvent?.(result);failures=0;if(options.once)return result;await sleep(60000,options.signal);
 }catch(error){if(options.signal.aborted)return{state:'stopped'};const code=(error as Error).message;if(/AGENT_HTTP_(401|403)|CREDENTIAL_EXPIRED/.test(code)||options.once)throw error;failures++;options.onEvent?.({state:'connection_retry'});const delay=Math.min(60000,1000*2**Math.min(failures,6));await sleep(Math.round(delay*(0.8+random()*0.2)),options.signal).catch(()=>{});}}
 return{state:'stopped'};
}
