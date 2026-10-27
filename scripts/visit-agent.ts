import {runAgentProbeLoop} from '../src/agent/queue-runner';
async function secretInput(){return new Promise<string>((resolve,reject)=>{let value='';const raw=Boolean(process.stdin.isTTY);if(raw)process.stdin.setRawMode(true);process.stdin.resume();const finish=(error?:Error)=>{process.stdin.off('data',onData);if(raw)process.stdin.setRawMode(false);process.stdin.pause();process.stderr.write('\n');if(error)reject(error);else resolve(value.trim())};const onData=(chunk:Buffer)=>{for(const char of chunk.toString('utf8')){if(char==='\u0003'){finish(Error('PAIRING_CANCELLED'));return}if(char==='\r'||char==='\n'){finish();return}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else value+=char;if(value.length>256){finish(Error('INVALID_PAIRING_CODE'));return}}};process.stdin.on('data',onData);process.stdin.once('end',()=>finish())})}
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {pairVisitComputer} from '../src/agent/pairing-client';
import {loadAgentCredential} from '../src/agent/credential-store';
import {VisitAgentTransport} from '../src/agent/transport';
// Secrets are read privately. Diagnostic foreground polling is explicit; no autostart, solver or background service is installed.
const [command,...args]=process.argv.slice(2);
try{
 if(command==='pair'){
  const [origin,environment,name,vault,...flags]=args;if(!origin||!environment||!name||!vault||flags.some(f=>f!=='--local-loopback'))throw Error('Usage: visit-agent.ts pair <origin> <environment> <machine-name> <new-vault-file> [--local-loopback]. Pairing code is read privately from stdin.');
  if(existsSync(resolve(vault)))throw Error('AGENT_VAULT_EXISTS_CHOOSE_NEW_FILE');process.stderr.write('Kode pairing sekali pakai (input disembunyikan): ');const code=await secretInput();const result=await pairVisitComputer({origin,environment,machine_name:name,code,vault_path:resolve(vault),allow_local:flags.includes('--local-loopback')});console.log(JSON.stringify({...result,phase:'identity_ready_queue_and_routing_pending'}));
 }else if(command==='run'){
  const [vault,...flags]=args;if(!vault||flags.some(f=>f!=='--once')||flags.length>1)throw Error('Usage: visit-agent.ts run <vault-file> [--once]');const identity=await loadAgentCredential(vault),client=new VisitAgentTransport(identity.origin,identity,{allow_local:identity.allow_local}),controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());await runAgentProbeLoop(client,identity,{once:flags.includes('--once'),signal:controller.signal,onEvent:event=>console.log(JSON.stringify(event))});
 }else if(command==='status'||command==='heartbeat'){
  const [vault]=args;if(!vault||args.length!==1)throw Error('Usage: visit-agent.ts '+command+' <vault-file>');const identity=await loadAgentCredential(vault),client=new VisitAgentTransport(identity.origin,identity,{allow_local:identity.allow_local});const result=command==='status'?await client.json('GET','/api/visit-agent/status'):await client.json('POST','/api/visit-agent/heartbeat',{contract_version:'nyales-visit-generator-1',agent_version:'nyales-local-agent-identity-1',capabilities:{daily:false,monthly:false,max_reps:1,graphs:[],solver_version:'not-installed'}},{idempotency_key:crypto.randomUUID()});console.log(JSON.stringify(result.data));
 }else throw Error('Commands: pair, status, heartbeat, run. Run processes connection probes only; routing/solver remain unavailable.');
}catch(error){const code=(error as Error).message;console.error(/^[A-Z0-9_: -]+$/.test(code)?code:code.startsWith('Usage:')||code.startsWith('Commands:')?code:'VISIT_AGENT_FAILED; inspect configuration or issue a new pairing code. Secret values are not logged.');process.exitCode=1}
