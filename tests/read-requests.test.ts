import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReadRequests,identityHeartbeat} from '../src/client/read-requests';

test('identical concurrent reads share a request; settled reads, different scopes and writes do not',async()=>{
 let calls=0;const resolves:Array<(r:Response)=>void>=[];
 const send=(()=>{calls++;return new Promise<Response>(resolve=>resolves.push(resolve))}) as typeof fetch;
 const reads=createReadRequests(send),a=reads.request('/api/customers?limit=2&q=x',{},'session-a'),b=reads.request('/api/customers?q=x&limit=2',{},'session-a');
 assert.equal(calls,1);resolves.shift()!(new Response('{"data":[1]}'));
 assert.deepEqual(await(await a).json(),{data:[1]});assert.deepEqual(await(await b).json(),{data:[1]});
 const next=reads.request('/api/customers?q=x&limit=2',{},'session-a');assert.equal(calls,2);resolves.shift()!(new Response('next'));await next;
 const c=reads.request('/api/users',{},'session-a'),d=reads.request('/api/users',{},'session-b');assert.equal(calls,4);resolves.shift()!(new Response('a'));resolves.shift()!(new Response('b'));await Promise.all([c,d]);
 const writes=[reads.request('/api/customers',{method:'POST'},'session-a'),reads.request('/api/customers',{method:'POST'},'session-a')];assert.equal(calls,6);resolves.shift()!(new Response('1'));resolves.shift()!(new Response('2'));await Promise.all(writes);
});

test('one canceled caller does not cancel other read consumers; logout discards pending results',async()=>{
 let finish!:(r:Response)=>void,signal!:AbortSignal;
 const reads=createReadRequests(((_url,init)=>{signal=init!.signal!;return new Promise<Response>(resolve=>{finish=resolve})}) as typeof fetch);
 const controller=new AbortController(),a=reads.request('/api/users',{signal:controller.signal},'a'),b=reads.request('/api/users',{},'a');
 controller.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(signal.aborted,false);finish(new Response('ok'));assert.equal(await(await b).text(),'ok');
 const pending=reads.request('/api/users',{},'a');reads.clear();assert.equal(signal.aborted,true);finish(new Response('old account'));await assert.rejects(pending,{name:'AbortError'});
});

test('failed reads are not retained and security heartbeat merges focus bursts without delaying its timer',async()=>{
 let calls=0;const reads=createReadRequests((async()=>{calls++;throw Error('offline')}) as typeof fetch);
 await assert.rejects(reads.request('/api/me',{},'a'));await assert.rejects(reads.request('/api/me',{},'a'));assert.equal(calls,2);
 let now=0,count=0,release!:()=>void;const beat=identityHeartbeat(async()=>{count++;await new Promise<void>(r=>{release=r})},()=>now);
 now=30000;const first=beat(true);await beat(true);await beat(false);assert.equal(count,1);release();await first;
 now=35000;await beat(true);assert.equal(count,1);now=60000;const second=beat(true);assert.equal(count,2);release();await second;
});
