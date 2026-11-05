import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readMapData} from '../src/client/map-request';

test('map request times out even when transport ignores cancellation',async()=>{
 let signal:AbortSignal|undefined;
 await assert.rejects(readMapData(async(_url,init)=>{signal=init.signal as AbortSignal;return new Promise(()=>{})},'/map',undefined,10),/Pemuatan peta terlalu lama/);
 assert.equal(signal?.aborted,true);
});
test('map timeout covers JSON decoding and exposes server errors',async()=>{
 await assert.rejects(readMapData(async()=>({ok:true,json:()=>new Promise(()=>{})}) as Response,'/map',undefined,10),/Pemuatan peta terlalu lama/);
 await assert.rejects(readMapData(async()=>Response.json({code:'SERVICE_UNAVAILABLE'},{status:503}),'/map'),/SERVICE_UNAVAILABLE/);
 assert.deepEqual(await readMapData(async()=>Response.json({data:{customers:[]}}),'/map'),{customers:[]});
});
test('map navigation cancellation stops the pending read and prevents an already cancelled send',async()=>{
 const controller=new AbortController();let sent=0;
 const send=async()=>{sent++;return new Promise<Response>(()=>{})};
 const pending=readMapData(send,'/map',controller.signal);controller.abort();
 await assert.rejects(pending,{name:'AbortError'});
 await assert.rejects(readMapData(send,'/map',controller.signal),{name:'AbortError'});
 assert.equal(sent,1);
});
