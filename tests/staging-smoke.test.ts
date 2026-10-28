import {test} from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../scripts/staging-smoke.mjs' as string);
function fixture(){const calls:any[]=[];const fetcher=async(url:string,init:any)=>{calls.push({url,init});const path=new URL(url).pathname,auth=init.headers.Authorization;
 const body=path==='/'?'<html><div id="root"></div><script src="/assets/app.js"></script></html>':path==='/api/health'?{name:'NYALES',status:'ok',environment:'staging'}:path==='/api/auth/config'?{mode:'firebase',configured:true}:{code:auth?'INVALID_ID_TOKEN':'UNAUTHENTICATED'};
 return new Response(typeof body==='string'?body:JSON.stringify(body),{status:['/','/api/health','/api/auth/config'].includes(path)?200:401,headers:{'Content-Type':path==='/'?'text/html':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})};return{fetcher,calls}}
test('Staging smoke exercises served app/auth boundaries without credentials or business writes',async()=>{
 const {inspectStaging}=await load(),f=fixture(),r=await inspectStaging('https://nyales-staging.authored.workers.dev',{fetcher:f.fetcher});
 assert.equal(r.status,'passed');assert.equal(r.checks.length,6);assert.equal(r.real_login_verified,false);assert.equal(r.database_contents_verified,false);assert.equal(r.r2_bytes_verified,false);assert.equal(r.production_accepted,false);assert.equal(r.mutated_data,false);
 assert.ok(f.calls.every(x=>x.init.method==='GET'&&x.init.redirect==='error'));assert.deepEqual(f.calls.filter(x=>x.init.headers.Authorization).map(x=>x.init.headers.Authorization),['Bearer nyales-local-demo']);
});
test('Staging smoke refuses arbitrary destinations before network and cannot follow redirect failures as success',async()=>{
 const {inspectStaging}=await load(),f=fixture();
 for(const url of ['http://nyales-staging.a.workers.dev','https://nyales.a.workers.dev','https://evil.example','https://nyales-staging.a.workers.dev/?token=not-real','https://user:pass@nyales-staging.a.workers.dev','https://nyales-staging.a.workers.dev/path'])await assert.rejects(inspectStaging(url,{fetcher:f.fetcher}),/ORIGIN_REQUIRED/);
 assert.equal(f.calls.length,0);const r=await inspectStaging('https://nyales-staging.authored.workers.dev',{fetcher:async()=>{throw Error('private provider failure')}});assert.equal(r.status,'failed');assert.equal(JSON.stringify(r).includes('private provider'),false);
});
test('Staging smoke detects local mode, public customer leakage, incorrect headers and wrong backend environment',async()=>{
 const {inspectStaging}=await load();
 for(const broken of ['local_auth','customer_leak','cached_auth','production']){
  const f=fixture(),r=await inspectStaging('https://nyales-staging.authored.workers.dev',{fetcher:async(url:string,init:any)=>{
   const path=new URL(url).pathname,base=await f.fetcher(url,init);
   if(broken==='local_auth'&&path==='/api/auth/config')return new Response(JSON.stringify({mode:'local',configured:true}),{headers:{'content-type':'application/json'}});
   if(broken==='customer_leak'&&path==='/api/customers')return new Response(JSON.stringify({data:[{id:'authored'}]}),{headers:{'content-type':'application/json'}});
   if(broken==='cached_auth'&&path==='/api/me'&&!init.headers.Authorization)base.headers.set('cache-control','public');
   if(broken==='production'&&path==='/api/health')return new Response(JSON.stringify({name:'NYALES',status:'ok',environment:'production'}),{headers:{'content-type':'application/json'}});
   return base;
  }});assert.equal(r.status,'failed',broken);
 }
});
