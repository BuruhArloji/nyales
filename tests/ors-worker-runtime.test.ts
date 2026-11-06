import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {Miniflare,convertV4MiniflareOptions,Response as WorkerResponse} from 'miniflare';

test('real Workers runtime sends ORS requests and refuses upstream redirects without forwarding credentials',async()=>{
 const provider=readFileSync(new URL('../src/server/ors-provider.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const script=ts.transpileModule(`const orsLimits={timeout_ms:1000};function fail(status:number,code:string):never{throw Error(status+':'+code)}\n${provider}\nexport default {async fetch(){try{return Response.json(await orsPost('test-key','matrix',{locations:[[107,-6.2]],metrics:['duration']}))}catch(e){return Response.json({code:e.message},{status:503})}}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 let redirect=false;const requests:{host:string,key:string}[]=[];
 const worker=new Miniflare(convertV4MiniflareOptions({cf:false,telemetry:{enabled:false},modules:true,script,compatibilityDate:'2026-10-01',outboundService:async request=>{
  requests.push({host:new URL(request.url).hostname,key:request.headers.get('Authorization')||''});
  return redirect?new WorkerResponse(null,{status:302,headers:{Location:'https://unexpected.invalid/steal-key'}}):WorkerResponse.json({durations:[[0]],distances:[[0]]});
 }}));
 try{
  const ok=await worker.dispatchFetch('https://local.test/');assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{durations:[[0]],distances:[[0]]});
  redirect=true;const denied=await worker.dispatchFetch('https://local.test/');assert.equal(denied.status,503);assert.deepEqual(await denied.json(),{code:'503:ORS_MATRIX_HTTP_302'});
  assert.equal(requests.length,2);assert.ok(requests.every(r=>r.host==='api.heigit.org'&&r.key==='test-key'));
 }finally{await worker.dispose()}
});
