import test from 'node:test';
import assert from 'node:assert/strict';
import {NyalesApi,NyalesApiError} from '../mobile/src/api';

test('mobile API restricts the destination before obtaining credentials',async()=>{
 let calls=0;const api=new NyalesApi('https://example.com',async()=>{calls++;return{idToken:'secret'}});
 for(const path of ['/api/../other','/api/../../other','//other.example/api/me','/api/\\evil']) await assert.rejects(()=>api.request(path));
 assert.equal(calls,0);
 assert.throws(()=>new NyalesApi('http://example.com',async()=>({idToken:'x'})));
});

test('logout waits for an in-flight session write and removes the saved session', async()=>{
 const {MobileSession}=await import('../mobile/src/mobile-session'); const oldFetch=globalThis.fetch;
 let saved:any=null, release!:()=>void, entered!:()=>void;
 const saving=new Promise<void>(resolve=>{entered=resolve});
 const gate=new Promise<void>(resolve=>{release=resolve});
 const store={read:async()=>null,save:async(_subject:string,session:any)=>{entered();await gate;saved=session},clear:async()=>{saved=null}};
 try{
  globalThis.fetch=async()=>Response.json({data:{id:'s',version:1,session_token:'device'}},{status:201});
  const session=new MobileSession('https://example.com',store);
  const opening=session.open({subject:'subject-a',getIdToken:async()=> 'jwt'},'phone');
  await saving;
  const logout=session.clearLocal(); release();
  await assert.rejects(opening,/ACCOUNT_CHANGED/); await logout;
  assert.equal(saved,null);
 }finally{globalThis.fetch=oldFetch}
});

test('switching accounts cannot overwrite the new account session with an older write', async()=>{
 const {MobileSession}=await import('../mobile/src/mobile-session'); const oldFetch=globalThis.fetch;
 let saved:any=null, release!:()=>void, entered!:()=>void;
 const saving=new Promise<void>(resolve=>{entered=resolve});
 const gate=new Promise<void>(resolve=>{release=resolve});
 const store={read:async(subject:string)=>saved?.subject===subject?saved.session:null,
  save:async(subject:string,session:any)=>{if(subject==='a'){entered();await gate}saved={subject,session}},clear:async()=>{saved=null}};
 try{
  globalThis.fetch=async(input,init)=>{
   const auth=new Headers(init?.headers).get('Authorization');
   if(String(input).endsWith('/api/device-sessions')) return Response.json({data:{id:auth,version:1,session_token:auth}},{status:201});
   return Response.json({data:{id:auth,organization_id:'o'}});
  };
  const session=new MobileSession('https://example.com',store);
  const first=session.open({subject:'a',getIdToken:async()=> 'a'},'phone'); await saving;
  const second=session.open({subject:'b',getIdToken:async()=> 'b'},'phone'); release();
  await assert.rejects(first,/ACCOUNT_CHANGED/); assert.equal((await second).id,'Bearer b');
  assert.equal(saved.subject,'b');
 }finally{globalThis.fetch=oldFetch}
});
test('mobile API sends the verified identity token and device session and parses errors',async()=>{
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://example.com/api/me');const h=new Headers(init?.headers);assert.equal(h.get('Authorization'),'Bearer token');assert.equal(h.get('X-Device-Session'),'device');return Response.json({data:{id:'u',organization_id:'o'}})};
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));assert.equal((await api.me()).data.id,'u');
  globalThis.fetch=async()=>Response.json({code:'PORTFOLIO_ACCESS_EXPIRED'},{status:403});
  await assert.rejects(()=>api.me(),(error:unknown)=>error instanceof NyalesApiError&&error.status===403&&error.code==='PORTFOLIO_ACCESS_EXPIRED');
 }finally{globalThis.fetch=oldFetch}
});

test('mobile customers use scoped paginated API and reject malformed metadata',async()=>{
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input)); assert.equal(url.pathname,'/api/customers');
   assert.equal(url.searchParams.get('limit'),'50'); assert.equal(url.searchParams.get('offset'),'50');
   assert.equal(url.searchParams.get('channel'),'telesales'); assert.equal(url.searchParams.get('q'),'Toko & Co');
   assert.equal(new Headers(init?.headers).get('X-Device-Session'),'device');
   return Response.json({data:[{id:'1',name:'Toko'}],meta:{total:51,offset:50,limit:50}});
  };
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  const page=await api.customers(50,' Toko & Co ','telesales'); assert.equal(page.total,51);assert.equal(page.rows[0].name,'Toko');
  globalThis.fetch=async()=>Response.json({data:[],meta:{total:100,offset:0,limit:999}});
  await assert.rejects(()=>api.customers(),(e:unknown)=>e instanceof NyalesApiError&&e.code==='INVALID_RESPONSE');
  await assert.rejects(()=>api.customers(-1));
 }finally{globalThis.fetch=oldFetch}
});

test('mobile customer detail is authenticated, encoded and validated',async()=>{
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{assert.equal(new URL(String(input)).pathname,'/api/customers/customer%201');assert.equal(new Headers(init?.headers).get('X-Device-Session'),'device');return Response.json({data:{id:'customer 1',name:'Warung',address:'Jakarta'}})};
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  assert.equal((await api.customer('customer 1')).name,'Warung');await assert.rejects(()=>api.customer(''));
  globalThis.fetch=async()=>Response.json({data:{id:'1'}});await assert.rejects(()=>api.customer('1'),(e:unknown)=>e instanceof NyalesApiError&&e.code==='INVALID_RESPONSE');
 }finally{globalThis.fetch=oldFetch}
});

test('mobile overview and work pages use authenticated bounded endpoints and validate responses',async()=>{
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input)); assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer token');
   if(url.pathname==='/api/dashboard')return Response.json({data:{period:'2026-11',actual_net_minor:125000,target_net_minor:null,achievement:null,active_customer_count:3,sales_rep_count:1}});
   assert.equal(url.pathname,'/api/work-plans');assert.equal(url.searchParams.get('limit'),'50');assert.equal(url.searchParams.get('offset'),'50');
   return Response.json({data:[{id:'p1',customer_name:'Warung'}],meta:{pagination:{limit:50,offset:50,has_more:false}}});
  };
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  assert.equal((await api.overview()).actual_net_minor,125000);
  assert.deepEqual(await api.workPage('work-plans',50),{rows:[{id:'p1',customer_name:'Warung'}],offset:50,hasMore:false});
  globalThis.fetch=async()=>Response.json({data:[{}],meta:{pagination:{limit:50,offset:0,has_more:false}}});
  await assert.rejects(()=>api.workPage('activities'),(e:unknown)=>e instanceof NyalesApiError&&e.code==='INVALID_RESPONSE');
  await assert.rejects(()=>api.workPage('tasks',-1));
 }finally{globalThis.fetch=oldFetch}
});

test('mobile performance reads current-period targets and scoped incentive statements',async()=>{
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));assert.equal(new Headers(init?.headers).get('X-Device-Session'),'device');
   if(url.pathname==='/api/targets'){assert.equal(url.searchParams.get('period_start'),'2026-11-01');return Response.json({data:[{id:'t',target_minor:100}],meta:{pagination:{limit:50,offset:0,has_more:false}}})}
   assert.equal(url.pathname,'/api/incentive-statements');return Response.json({data:[{id:'s',entitlement_minor:10}],meta:{pagination:{limit:50,offset:0,has_more:false}}});
  };
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  assert.equal((await api.performance('targets','2026-11')).rows[0].id,'t');
  assert.equal((await api.performance('incentive-statements')).rows[0].id,'s');
  await assert.rejects(()=>api.performance('targets','2026-99'));
  globalThis.fetch=async()=>Response.json({data:[{name:'missing id'}]});
  await assert.rejects(()=>api.performance('targets'),(e:unknown)=>e instanceof NyalesApiError&&e.code==='INVALID_RESPONSE');
 }finally{globalThis.fetch=oldFetch}
});

test('daily generator keeps explicit preview consent and separate confirmed apply',async()=>{
 const oldFetch=globalThis.fetch;const calls:string[]=[];
 try{
  globalThis.fetch=async(input,init)=>{const path=new URL(String(input)).pathname;calls.push(path);const h=new Headers(init?.headers);assert.equal(h.get('Idempotency-Key'),'attempt-123');const body=JSON.parse(String(init?.body));if(path.endsWith('/runs')){assert.equal(body.confirmed_external_processing,true);return Response.json({data:{id:'run-1',current:true,status:'complete',planned:1,shortfall:0,route:null}})}assert.equal(path,'/api/visit-generator/daily/runs/run-1/apply');assert.deepEqual(body,{confirmed:true});return Response.json({data:{id:'run-1',status:'applied',created:1}})};
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  const input={rep_id:'sr',start:{latitude:-6.2,longitude:106.8},start_at:'2026-11-14T01:00:00Z',end_at:'2026-11-14T10:00:00Z',confirmed_external_processing:true as const,weights:{wallet:25,last_visit:30,sales:20,follow_up:10,proximity:15}};
  assert.equal((await api.dailyPreview(input,'attempt-123')).data.status,'complete');assert.equal(calls.length,1);
  assert.equal((await api.dailyApply('run-1','attempt-123')).data.status,'applied');assert.equal(calls.length,2);
 }finally{globalThis.fetch=oldFetch}
});

test('mobile visit event carries version and a stable idempotency key',async()=>{
 const {submitVisitEvent}=await import('../mobile/src/api'); const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://example.com/api/visits/v1/check-in');const h=new Headers(init?.headers);assert.equal(h.get('If-Match'),'"3"');assert.equal(h.get('Idempotency-Key'),'event-123');assert.equal(JSON.parse(String(init?.body)).source,'android_gps');return Response.json({data:{id:'v1'}})};
  const api=new NyalesApi('https://example.com',async()=>({idToken:'token',deviceSession:'device'}));
  await submitVisitEvent(api,'v1','check-in',{occurred_at:'2026-11-13T00:00:00Z',latitude_e7:0,longitude_e7:0,accuracy_cm:100,source:'android_gps',reason:'',notes:''},3,'event-123');
 }finally{globalThis.fetch=oldFetch}
});

 test('mobile session creates a subject-bound device session and loads identity',async()=>{
 const {MobileSession}=await import('../mobile/src/mobile-session');const oldFetch=globalThis.fetch;let saved:any=null;
 const store={read:async()=>null,save:async(subject:string,session:any)=>{saved={subject,...session}},clear:async()=>{saved=null}};
 try{
  globalThis.fetch=async(input,init)=>{const h=new Headers(init?.headers);if(String(input).endsWith('/api/device-sessions'))return Response.json({data:{id:'s',version:1,session_token:'device'}},{status:201});assert.equal(h.get('X-Device-Session'),'device');return Response.json({data:{id:'u',organization_id:'o'}})};
  const session=new MobileSession('https://example.com',store);assert.equal((await session.open({subject:'subject-a',getIdToken:async()=> 'jwt'},'phone')).id,'u');assert.equal(saved.subject,'subject-a');await session.clearLocal();assert.equal(saved,null);
 }finally{globalThis.fetch=oldFetch}
});
