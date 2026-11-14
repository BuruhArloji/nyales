import test from 'node:test';
import assert from 'node:assert/strict';
import {assessVisitLocation,defaultVisitLocationPolicy,visitLocationPolicy} from '../src/shared/visit-location';
import {fixture} from './sales-fixture';

const customer={latitude_e7:-62000000,longitude_e7:1068000000,coordinate_status:'verified'};
const fix={...customer,source:'browser_gps',accuracy_cm:500,captured_at:'2026-11-09T01:00:00Z',occurred_at:'2026-11-09T01:00:30Z'};
test('visit location validates the entire GPS uncertainty circle, not merely the reported center',()=>{
 const inside=assessVisitLocation(customer,fix);assert.equal(inside.status,'inside');assert.equal(inside.location_verified,true);assert.equal(inside.distance_m,0);assert.equal(inside.requires_reason,false);
 const outside=assessVisitLocation(customer,{...fix,latitude_e7:customer.latitude_e7+20000});assert.equal(outside.status,'outside');assert.equal(outside.location_verified,false);assert.equal(outside.requires_reason,true);assert.ok(outside.distance_m!>200);
 const uncertain=assessVisitLocation(customer,{...fix,latitude_e7:customer.latitude_e7+8500,accuracy_cm:2000});assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.location_verified,false);assert.equal(uncertain.requires_reason,true);
});
test('untrusted and missing customer locations never become verified simply by matching a GPS point',()=>{
 for(const [co,status] of [[{...customer,coordinate_status:'unverified'},'unverified_customer'],[{latitude_e7:null,longitude_e7:null,coordinate_status:'missing'},'missing_customer']]as const){
  const result=assessVisitLocation(co,fix);assert.equal(result.status,status);assert.equal(result.location_verified,false);assert.equal(result.requires_reason,false);assert.equal(result.can_check_in,true);
  assert.equal(assessVisitLocation(co,fix,{...defaultVisitLocationPolicy,allow_unverified_visits:false}).can_check_in,false);
 }
});
test('poor, stale, future, missing and unavailable GPS require exception evidence and cannot claim location verification',()=>{
 const cases=[{...fix,accuracy_cm:10001},{...fix,accuracy_cm:null},{...fix,captured_at:undefined},{...fix,captured_at:'2026-11-09T00:00:00Z'},{...fix,captured_at:'invalid'},{...fix,captured_at:'2026-11-09T01:02:00Z'},{...fix,latitude_e7:null,longitude_e7:null},{...fix,source:'permission_denied'}];
 for(const value of cases){const result=assessVisitLocation(customer,value);assert.notEqual(result.status,'inside');assert.equal(result.location_verified,false);assert.equal(result.requires_reason,true);assert.equal(assessVisitLocation(customer,value,{...defaultVisitLocationPolicy,allow_outside_exception:false}).can_check_in,false)}
 assert.equal(assessVisitLocation(customer,{...fix,accuracy_cm:10001}).status,'poor_accuracy');assert.equal(assessVisitLocation(customer,{...fix,captured_at:'2026-11-09T00:00:00Z'}).status,'stale_fix');assert.equal(assessVisitLocation(customer,{...fix,source:'unavailable'}).status,'missing_fix');
});

test('live visit events recompute geometry on server, require policy exceptions and always allow explained checkout',async()=>{
 const f=fixture();try{
  f.sqlite.prepare("UPDATE customer_outlet SET latitude_e7=?,longitude_e7=?,coordinate_status='verified' WHERE id='c'").run(customer.latitude_e7,customer.longitude_e7);
  const cfg={...defaultVisitLocationPolicy,allow_outside_exception:false};
  assert.equal((await f.req('PUT','/api/visit-location/policy',cfg,undefined,'sr','SALES_REP','o',crypto.randomUUID(),{'If-Match':'"0"'})).status,403);
  const saved=await f.data(await f.req('PUT','/api/visit-location/policy',cfg,undefined,'mg','MANAGEMENT','o',crypto.randomUUID(),{'If-Match':'"0"'}));assert.equal(saved.version,1);
  await f.session();const activity=await f.activity(),event={...f.event(),captured_at:new Date().toISOString(),latitude_e7:customer.latitude_e7+20000};
  const q=new URLSearchParams({latitude_e7:String(event.latitude_e7),longitude_e7:String(event.longitude_e7),accuracy_cm:String(event.accuracy_cm),captured_at:event.captured_at});const preview=await f.data(await f.req('GET',`/api/visits/${activity.id}/location-check?`+q));assert.equal(preview.status,'outside');assert.equal(preview.can_check_in,false);
  const denied=await f.req('POST',`/api/visits/${activity.id}/check-in`,{...event,reason:'Far from the outlet'},activity.version);assert.equal(denied.status,422);assert.equal((await denied.json()as any).code,'VISIT_LOCATION_NOT_ALLOWED');
  await f.data(await f.req('PUT','/api/visit-location/policy',{...cfg,allow_outside_exception:true},1,'mg','MANAGEMENT'));
  const noReason=await f.req('POST',`/api/visits/${activity.id}/check-in`,event,activity.version);assert.equal(noReason.status,422);assert.equal((await noReason.json()as any).code,'VISIT_LOCATION_REASON_REQUIRED');
  const checkin=await f.data(await f.req('POST',`/api/visits/${activity.id}/check-in`,{...event,reason:'Outlet storefront access is blocked'},activity.version));assert.equal(checkin.location_validation.status,'outside');assert.equal(checkin.location_validation.location_verified,false);
  // Even after management disallows future exceptions, an ongoing visit is not trapped.
  await f.data(await f.req('PUT','/api/visit-location/policy',cfg,2,'mg','MANAGEMENT'));
  const done=await f.data(await f.req('POST',`/api/visits/${activity.id}/check-out`,{...f.event(),captured_at:new Date().toISOString(),latitude_e7:null,longitude_e7:null,accuracy_cm:null,source:'permission_denied',reason:'Location permission was revoked during visit',outcome:'productive'},checkin.version));assert.equal(done.status,'needs_review');assert.equal(done.location_validation.location_verified,false);
  assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM visit_active').get()as any).n,0);const metadata=JSON.parse((f.sqlite.prepare('SELECT metadata_json FROM activity WHERE id=?').get(activity.id)as any).metadata_json);assert.equal(metadata.location_validated,false);
 }finally{f.sqlite.close()}
});

test('only two fresh inside GPS events establish validated visit location; legacy timestamps never fabricate validation',async()=>{
 const f=fixture();try{
  f.sqlite.prepare("UPDATE customer_outlet SET latitude_e7=?,longitude_e7=?,coordinate_status='verified' WHERE id='c'").run(customer.latitude_e7,customer.longitude_e7);
  await f.session();
  const run=async(captureCheckout:boolean)=>{
   const activity=await f.activity(),checkin=await f.data(await f.req('POST',`/api/visits/${activity.id}/check-in`,{...f.event(),captured_at:new Date().toISOString()},activity.version));
   assert.equal(checkin.location_validation.location_verified,true);
   const checkout={...f.event(),outcome:'productive',...(captureCheckout?{captured_at:new Date().toISOString()}:{})};
   const done=await f.data(await f.req('POST',`/api/visits/${activity.id}/check-out`,checkout,checkin.version));assert.equal(done.status,'done');
   const metadata=JSON.parse((f.sqlite.prepare('SELECT metadata_json FROM activity WHERE id=?').get(activity.id)as any).metadata_json);assert.equal(metadata.location_validated,captureCheckout);assert.equal(metadata.location_validation.capture_timestamp_supplied,captureCheckout);
  };
  await run(true);await run(false);
 }finally{f.sqlite.close()}
});

test('configured GPS accuracy limits are authoritative for check-in rather than a hidden hardcoded 100-meter threshold',async()=>{
 const f=fixture();try{
  f.sqlite.prepare("UPDATE customer_outlet SET latitude_e7=?,longitude_e7=?,coordinate_status='verified' WHERE id='c'").run(customer.latitude_e7,customer.longitude_e7);
  const config={...defaultVisitLocationPolicy,radius_m:500,max_accuracy_m:200,allow_outside_exception:false};
  await f.data(await f.req('PUT','/api/visit-location/policy',config,undefined,'mg','MANAGEMENT','o',crypto.randomUUID(),{'If-Match':'"0"'}));await f.session();const activity=await f.activity();
  const result=await f.req('POST',`/api/visits/${activity.id}/check-in`,{...f.event(),accuracy_cm:15000,captured_at:new Date().toISOString()},activity.version);
  assert.equal(result.status,200);const checkin=await f.data(result);assert.equal(checkin.location_validation.status,'inside');assert.equal(checkin.location_quality,'reported');assert.equal(checkin.location_validation.location_verified,true);
 }finally{f.sqlite.close()}
});
test('visit location settings enforce reasonable explicit limits and strict fields',()=>{
 assert.equal(visitLocationPolicy.safeParse(defaultVisitLocationPolicy).success,true);
 for(const change of [{radius_m:9},{radius_m:1001},{max_accuracy_m:4},{max_age_seconds:29},{radius_m:1.5},{allow_unverified_visits:'yes'},{unrecognized:true}])assert.equal(visitLocationPolicy.safeParse({...defaultVisitLocationPolicy,...change}).success,false);
});

test('GPS exceptions cannot bypass a policy prohibiting unverified customer locations',()=>{
 const policy={...defaultVisitLocationPolicy,allow_unverified_visits:false,allow_outside_exception:true};
 for(const co of [{...customer,coordinate_status:'unverified'},{...customer,latitude_e7:null,longitude_e7:null,coordinate_status:'missing'}])for(const bad of [{...fix,source:'unavailable',latitude_e7:null,longitude_e7:null},{...fix,accuracy_cm:100000},{...fix,captured_at:undefined}])assert.equal(assessVisitLocation(co,bad,policy).can_check_in,false);
});

test('Android GPS follows the same verification policy as browser GPS',()=>{
 const android={...fix,source:'android_gps'};
 assert.deepEqual(assessVisitLocation(customer,android),assessVisitLocation(customer,fix));
 assert.equal(assessVisitLocation(customer,{...android,accuracy_cm:10001}).status,'poor_accuracy');
 assert.equal(assessVisitLocation({...customer,coordinate_status:'unverified'},android).location_verified,false);
});

test('Android GPS check-in and checkout preserve location verification',async()=>{
 const f=fixture();try{
  f.sqlite.prepare("UPDATE customer_outlet SET latitude_e7=?,longitude_e7=?,coordinate_status='verified' WHERE id='c'").run(customer.latitude_e7,customer.longitude_e7);
  await f.session();const a=await f.activity();
  const checkin=await f.data(await f.req('POST',`/api/visits/${a.id}/check-in`,{...f.event(),source:'android_gps',captured_at:new Date().toISOString()},a.version));
  assert.equal(checkin.location_validation.location_verified,true);
  const done=await f.data(await f.req('POST',`/api/visits/${a.id}/check-out`,{...f.event(),source:'android_gps',captured_at:new Date().toISOString(),outcome:'productive'},checkin.version));
  assert.equal(done.location_validation.location_verified,true);
 }finally{f.sqlite.close()}
});
