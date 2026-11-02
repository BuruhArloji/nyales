import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {demoTerritoryFiles} from '../src/server/demo-territory';

const bytes=new TextEncoder().encode('abcdefgh');
function body(data:Uint8Array,range?:{offset:number;length:number}){
 const copy=new Uint8Array(data.length);copy.set(data);
 return {size:data.length,httpEtag:'"demo-etag"',range,body:new Blob([copy.buffer as ArrayBuffer]).stream()} as unknown as R2ObjectBody;
}
function harness(size=bytes.length){
 const calls:{key:string;range?:unknown}[]=[];
 const bucket={
  head:async(key:string)=>({key,size,httpEtag:'"demo-etag"'}),
  get:async(key:string,options?:{range?:{offset?:number;length?:number}})=>{
   calls.push({key,range:options?.range});
   if(key==='portfolio-demo/manifest.json')return body(new TextEncoder().encode('{"demo":true}'));
   if(key==='portfolio-demo/area-summary.json')return body(new TextEncoder().encode('[]'));
   if(key==='portfolio-demo/exceptions.csv')return body(new TextEncoder().encode('exception_id,category\nDEMO-1,PUM_CODE_MISSING\n'));
   const offset=options?.range?.offset??0,length=options?.range?.length??bytes.length;
   return body(bytes.slice(offset,offset+length),{offset,length});
  },
 } as unknown as R2Bucket;
 const app=new Hono();app.route('/',demoTerritoryFiles);
 return {app,bucket,calls};
}

test('staging PMTiles serves exact byte ranges from R2',async()=>{
 const {app,bucket,calls}=harness();
 const response=await app.request('/demo/territories-demo.pmtiles',{headers:{Range:'bytes=2-5'}},{APP_ENV:'staging',IMPORT_FILES:bucket});
 assert.equal(response.status,206);
 assert.equal(response.headers.get('Accept-Ranges'),'bytes');
 assert.equal(response.headers.get('Content-Type'),'application/vnd.pmtiles');
 assert.equal(response.headers.get('Content-Range'),'bytes 2-5/8');
 assert.equal(response.headers.get('Content-Length'),'4');
 assert.equal(response.headers.get('Vary'),'Range');
 assert.equal(await response.text(),'cdef');
 assert.deepEqual(calls,[{key:'portfolio-demo/territories-demo.pmtiles',range:{offset:2,length:4}}]);
});

test('staging serves only allowlisted JSON and CSV review data from R2',async()=>{
 const {app,bucket,calls}=harness();
 const response=await app.request('/demo/manifest.json',{}, {APP_ENV:'staging',IMPORT_FILES:bucket});
 assert.equal(response.status,200);
 assert.match(response.headers.get('Content-Type')||'',/^application\/json/);
 assert.deepEqual(await response.json(),{demo:true});
 const exceptions=await app.request('/demo/exceptions.csv',{}, {APP_ENV:'staging',IMPORT_FILES:bucket});
 assert.equal(exceptions.status,200);
 assert.match(exceptions.headers.get('Content-Type')||'',/^text\/csv/);
 assert.match(await exceptions.text(),/PUM_CODE_MISSING/);
 assert.equal((await app.request('/demo/private.csv',{}, {APP_ENV:'staging',IMPORT_FILES:bucket})).status,404);
 assert.equal((await app.request('/demo/__proto__',{}, {APP_ENV:'staging',IMPORT_FILES:bucket})).status,404);
 assert.deepEqual(calls,[{key:'portfolio-demo/manifest.json',range:undefined},{key:'portfolio-demo/exceptions.csv',range:undefined}]);
});

test('PMTiles rejects unbounded, malformed and excessive ranges rather than streaming the whole archive',async()=>{
 const {app,bucket,calls}=harness();
 const unbounded=await app.request('/demo/territories-demo.pmtiles',{}, {APP_ENV:'staging',IMPORT_FILES:bucket});
 assert.equal(unbounded.status,416);
 assert.equal(unbounded.headers.get('Content-Range'),'bytes */8');
 const malformed=await app.request('/demo/territories-demo.pmtiles',{headers:{Range:'bytes=0-1,4-5'}},{APP_ENV:'staging',IMPORT_FILES:bucket});
 assert.equal(malformed.status,416);
 assert.equal(malformed.headers.get('Content-Range'),'bytes */8');
 const {app:largeApp,bucket:largeBucket,calls:largeCalls}=harness(9_000_001);
 const tooLarge=await largeApp.request('/demo/territories-demo.pmtiles',{headers:{Range:'bytes=0-8000000'}},{APP_ENV:'staging',IMPORT_FILES:largeBucket});
 assert.equal(tooLarge.status,416);
 assert.equal(tooLarge.headers.get('Content-Range'),'bytes */9000001');
 assert.deepEqual(largeCalls,[]);
 assert.deepEqual(calls,[]);
});

test('portfolio files stay unavailable outside staging',async()=>{
 const {app,bucket,calls}=harness();
 const response=await app.request('/demo/territories-demo.pmtiles',{headers:{Range:'bytes=0-1'}},{APP_ENV:'production',IMPORT_FILES:bucket});
 assert.equal(response.status,404);
 assert.deepEqual(calls,[]);
});
