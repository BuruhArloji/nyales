import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orsPost} from '../src/server/ors-provider';
import {orsErrorMessage,orsLimits} from '../src/shared/ors-planning';

test('ORS keeps stage and upstream HTTP status without exposing provider text or request contents',async t=>{
 const logs:string[]=[];t.mock.method(console,'warn',(line:string)=>logs.push(line));
 for(const status of [400,403,404,429,500,503]){
  const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error:{code:2010,message:'PRIVATE_LOCATION_AND_KEY'}},{status}));
  await assert.rejects(orsPost('PRIVATE_API_KEY','matrix',{locations:[[107,-6]]}),{message:`503:ORS_MATRIX_HTTP_${status}_CODE_2010`});mock.mock.restore();
  const log=JSON.parse(logs.at(-1)!);assert.equal(log.http_status,status);assert.equal(log.stage,'matrix');assert.equal(log.provider_code,2010);
  assert.deepEqual(Object.keys(log).sort(),['elapsed_ms','event','http_status','provider_code','reason','stage']);
  assert.ok(orsErrorMessage(`ORS_MATRIX_HTTP_${status}`)?.includes('HTTP '+status));
 }
 assert.ok(!logs.join('').includes('PRIVATE_'));assert.ok(!logs.join('').includes('locations'));
});
test('ORS separates network failure, invalid JSON and excessive response size',async t=>{
 t.mock.method(console,'warn',()=>{});
 const mock=t.mock.method(globalThis,'fetch',async()=>{throw Error('PRIVATE_TRANSPORT_DETAILS')});
 await assert.rejects(orsPost('key','optimization',{}),{message:'503:ORS_OPTIMIZATION_NETWORK'});mock.mock.restore();
 const bad=t.mock.method(globalThis,'fetch',async()=>new Response('not JSON'));
 await assert.rejects(orsPost('key','optimization',{}),{message:'503:ORS_OPTIMIZATION_INVALID_RESULT'});bad.mock.restore();
 t.mock.method(globalThis,'fetch',async()=>new Response('x'.repeat(2_000_001)));
 await assert.rejects(orsPost('key','directions',{}),{message:'503:ORS_DIRECTIONS_INVALID_RESULT'});
});
test('ORS bounds a stalled response stream after headers arrive',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});t.mock.method(console,'warn',()=>{});
 t.mock.method(globalThis,'fetch',async(_url:any,init:any)=>new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')))}})));
 const pending=assert.rejects(orsPost('key','matrix',{}),{message:'503:ORS_MATRIX_TIMEOUT'});
 await Promise.resolve();await Promise.resolve();t.mock.timers.tick(orsLimits.timeout_ms);await pending;
});
test('ORS messages preserve existing codes and explain the failing stage',()=>{
 assert.match(orsErrorMessage('ORS_PROVIDER_UNAVAILABLE')!,/Agenda|agenda/);
 assert.match(orsErrorMessage('ORS_OPTIMIZATION_HTTP_400')!,/optimasi rute/);
 assert.match(orsErrorMessage('ORS_MATRIX_NETWORK')!,/Koneksi/);
 assert.equal(orsErrorMessage('UNTRUSTED_INPUT'),undefined);
});
