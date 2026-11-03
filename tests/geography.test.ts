import {Hono} from 'hono';
import {createGeographyRoutes} from '../src/server/geography';
import {resolveScope} from '../src/server/scope';
import {readFileSync} from 'node:fs';
import {database} from './sqlite-helper';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {digest} from '../src/server/operations';
import {canonicalJson,manifestJson,type BoundaryCollection,type Geometry} from '../src/shared/boundaries';
import {locateGeometry} from '../src/server/geography';
const square=(x=106,y=-6):Geometry=>({type:'Polygon',coordinates:[[[x,y],[x+.1,y],[x+.1,y+.1],[x,y+.1],[x,y]]]});
const collection=(geometries:Geometry[]=[square()]):BoundaryCollection=>({type:'FeatureCollection',features:geometries.map((geometry,i)=>({type:'Feature',properties:{source_id:'v'+i,province:{code:'31',name:'Province'},regency:{code:'31.71',name:'City'},district:{code:'31.71.01',name:'District'},village:{code:'v'+i,name:'Village '+i,type:'kelurahan'}},geometry}))});
function harness(){const f=fixture();const req=(m:string,p:string,b?:any,v?:number,key=crypto.randomUUID(),actor='mg',role=actor==='mg'?'MANAGEMENT':actor==='tele'?'TELESALES':'SALES_REP',org='o')=>f.req(m,p,b,v,actor,role,org,key,v===0?{'If-Match':'"0"'}:{});return {...f,req,
 point:(x:number|null=106.05,y:number|null=-5.95,status='verified')=>f.sqlite.prepare('UPDATE customer_outlet SET longitude_e7=?,latitude_e7=?,coordinate_status=?,version=version+1 WHERE id=?').run(x===null?null:Math.round(x*1e7),y===null?null:Math.round(y*1e7),status,'c'),
 release:async(geos:Geometry[]=[square()],activate=true,previous:string|null=null)=>{const c=collection(geos);let d=await f.data(await req('POST','/api/admin-boundaries/datasets',{provider:'Synthetic geometry',code_namespace:'fixture',release_version:crypto.randomUUID(),released_at:null,acquired_at:'2026-01-01T00:00:00Z',source_reference:'https://example.test/fixture',source_checksum:await digest('fixture'),metadata:{reference_release:'Fixture',origin:'Authored for test',code_mapping:'Fixture namespace',usage_terms_status:'unverified',notes:'Synthetic test only'},coverage:{label:'Fixture scope',source_filter:'fixture',national_complete:false},manifest_sha256:await digest(manifestJson([await digest(canonicalJson(c))])),expected_features:c.features.length,expected_chunks:1}));d=await f.data(await req('POST',`/api/admin-boundaries/datasets/${d.id}/chunks`,{index:0,collection:c},d.version));if(activate)d=await f.data(await req('POST',`/api/admin-boundaries/datasets/${d.id}/activate`,{reason:'Synthetic review for tests',license_reference:'https://example.test/fixture-terms',license_note:'Geometry authored solely for this test.',attribution:'NYALES synthetic fixture',confirm_usage_rights:true,expected_active_id:previous},d.version));return d},
 preview:async(body:any={})=>f.data(await req('POST','/api/geo/customers/c/preview',body)),
 review:(p:any,decision='confirm_candidate',boundary=p.suggested_boundary_id,key=crypto.randomUUID())=>req('POST','/api/geo/customers/c/review',{dataset_id:p.dataset_id,preview_hash:p.preview_hash,customer_version:p.customer_version,mapping_revision:p.mapping_revision,decision,boundary_id:boundary,reason:'Reviewed synthetic customer mapping',...(p.admin_code?{admin_code:p.admin_code,code_namespace:p.code_namespace}:{})},p.mapping_revision,key)
 }}
test('WEB-064 full geometry matching handles holes, multipolygon, outer and inner edges',()=>{
 const hole=square() as any;hole.coordinates.push([[106.02,-5.98],[106.02,-5.96],[106.04,-5.96],[106.04,-5.98],[106.02,-5.98]]);
 assert.equal(locateGeometry(hole,106.03,-5.97),'outside');assert.equal(locateGeometry(hole,106.02,-5.97),'boundary');assert.equal(locateGeometry(hole,106.05,-5.95),'inside');assert.equal(locateGeometry(hole,106,-5.95),'boundary');
 const multi={type:'MultiPolygon',coordinates:[(square() as any).coordinates,(square(107) as any).coordinates]} as Geometry;assert.equal(locateGeometry(multi,107.05,-5.95),'inside');assert.equal(locateGeometry(multi,106.5,-5.95),'outside');
});
test('WEB-064 preview is read-only; reviewed revisions, idempotency, stale writes and commercial preservation',async()=>{
 const f=harness();await f.release();f.point();const before=f.sqlite.prepare('SELECT * FROM customer_outlet').all(),assign=f.sqlite.prepare('SELECT * FROM customer_assignment').all();
 const p=await f.preview();assert.equal(p.status,'proposed');assert.equal(f.sqlite.prepare('SELECT count(*) n FROM customer_admin_location').get()!.n,0);
 const key=crypto.randomUUID(),saved=await f.data(await f.review(p,undefined,undefined,key));assert.equal(saved.revision,1);assert.equal((await f.data(await f.review(p,undefined,undefined,key))).id,saved.id);
 assert.equal((await f.review(p)).status,412);const p2=await f.preview();await f.data(await f.review(p2,'needs_review',null));const history=await f.data(await f.req('GET','/api/geo/customers/c'));assert.equal(history.mapping_revision,2);assert.equal(history.history.length,2);assert.ok(history.history[1].superseded_at);assert.equal(history.status,'needs_review');
 assert.throws(()=>f.sqlite.exec("DELETE FROM customer_admin_location"),/IMMUTABLE/);assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_outlet').all(),before);assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_assignment').all(),assign);
 const p3=await f.preview();f.point(106.06);assert.equal((await f.review(p3)).status,412);
});
test('WEB-064 ambiguity, coordinate quality and namespaced code require explicit review',async()=>{
 const f=harness();await f.release([square(),square(106.05)]);f.point(106.075);assert.equal((await f.preview()).status,'needs_review');assert.ok((await f.preview()).reasons.includes('overlapping_boundaries'));
 f.point(106);assert.ok((await f.preview()).reasons.includes('on_boundary'));f.point(106.02,-5.95,'unverified');assert.equal((await f.preview()).status,'needs_review');f.point(109,-6,'unverified');assert.equal((await f.preview()).status,'needs_review');f.point(109);assert.equal((await f.preview()).status,'outside_coverage');
 f.point(null,null,'missing');const code=await f.preview({admin_code:'v0',code_namespace:'fixture'});assert.equal(code.status,'proposed');assert.equal((await f.data(await f.review(code))).status,'confirmed');assert.equal((await f.preview({admin_code:'v0',code_namespace:'bps'})).status,'needs_review');assert.equal((await f.preview({admin_code:'missing',code_namespace:'fixture'})).status,'needs_review');
 f.point(106.02);assert.ok((await f.preview({admin_code:'v1',code_namespace:'fixture'})).reasons.includes('coordinate_code_conflict'));
});
test('WEB-064 geometry and customer drilldown enforce organization, area and telesales scope',async()=>{
 const f=harness(),d=await f.release([square(),square(107)]);f.point();await f.data(await f.review(await f.preview()));const map=await f.data(await f.req('GET','/api/geo/map'));assert.deepEqual(map.stats,{total:1,confirmed:1,unmapped:0});const [b,hidden]=map.boundaries;
 f.sqlite.exec("INSERT INTO area(id,organization_id,name,branch_id) VALUES('b','o','Other area','br');INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES('hidden','o','b','Hidden','Other');");
 for(const [actor,role] of [['sr','SALES_REP'],['tele','TELESALES'],['sr','AREA_MANAGER']]){const scoped=await f.data(await f.req('GET','/api/geo/map',undefined,undefined,undefined,actor,role));assert.equal(scoped.stats.total,1);assert.equal(scoped.boundaries.length,1);const boundary=scoped.boundaries[0];const g=await f.data(await f.req('GET',`/api/geo/geometry?dataset_id=${d.id}&ids=${boundary.id}`,undefined,undefined,undefined,actor,role));assert.equal(g.features.length,1);assert.equal((await f.req('GET',`/api/geo/geometry?ids=${hidden.id}`,undefined,undefined,undefined,actor,role)).status,404);assert.equal((await f.req('GET','/api/geo/customers/hidden',undefined,undefined,undefined,actor,role)).status,404);assert.equal((await f.req('POST','/api/geo/customers/c/preview',{},undefined,undefined,actor,role)).status,403)}
 const drill=await f.data(await f.req('GET',`/api/customers?geo_boundary_id=${b.id}`));assert.equal(drill.length,1);assert.equal(drill[0].id,'c');assert.equal((await f.data(await f.req('GET','/api/customers?geo_bucket=unmapped'))).length,1);
 assert.equal((await f.req('GET',`/api/geo/geometry?dataset_id=${d.id}&ids=${b.id}`,undefined,undefined,undefined,'other','MANAGEMENT','x')).status,404);
});
test('WEB-064 draft cannot publish; missing/tampered source fails closed; changes mark confirmed mapping stale',async()=>{
 const f=harness(),draft=await f.release([square()],false);f.point();const p=await f.preview({dataset_id:draft.id});assert.equal(p.can_publish,false);assert.equal((await f.review(p)).status,412);assert.equal((await f.req('GET',`/api/geo/map?dataset_id=${draft.id}`,undefined,undefined,undefined,'sr')).status,403);
 const d=await f.release();const active=await f.preview();await f.data(await f.review(active));f.point(106.06);let m=await f.data(await f.req('GET','/api/geo/map'));assert.equal(m.stats.unmapped,1);assert.equal(m.map.all_customers[0].geo_status,'stale');
 await f.data(await f.review(await f.preview()));await f.release([square()],true,d.id);m=await f.data(await f.req('GET','/api/geo/map'));assert.equal(m.map.all_customers[0].geo_status,'stale');assert.equal((await f.req('GET',`/api/geo/map?dataset_id=${d.id}`)).status,409);assert.equal((await f.req('GET','/api/geo/map?channel=invalid')).status,422);
 const latest=await f.preview(),objects=[...f.objects];f.objects.clear();assert.equal((await f.req('POST','/api/geo/customers/c/preview',{})).status,503);for(const [key,val]of objects)f.objects.set(key,val);for(const [key]of objects)f.objects.set(key,new TextEncoder().encode('tampered').buffer);assert.equal((await f.req('POST','/api/geo/customers/c/preview',{})).status,409);assert.equal((await f.review(latest)).status,409);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM customer_admin_location').get()!.n,2);
});

test('WEB-064 migration preserves existing immutable review history and backfills revision ordering',()=>{
 const {sqlite}=database('0035');sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO branch(id,organization_id,name,timezone) VALUES('b','o','Branch','Asia/Jakarta');INSERT INTO area(id,organization_id,name,branch_id) VALUES('a','o','Area','b');INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES('c','o','a','Customer','Address');INSERT INTO customer_admin_location(id,organization_id,outlet_id,method,status,evidence_json,effective_from_date) VALUES('old-b','o','c','coordinate','needs_review','{}','2026-09-02'),('old-a','o','c','coordinate','needs_review','{}','2026-09-01');");
 const before=sqlite.prepare('SELECT id,evidence_json,effective_from_date FROM customer_admin_location ORDER BY id').all();sqlite.exec(readFileSync('migrations/0036_customer_geography_review.sql','utf8'));assert.deepEqual(sqlite.prepare('SELECT id,evidence_json,effective_from_date FROM customer_admin_location ORDER BY id').all(),before);assert.deepEqual(sqlite.prepare('SELECT revision FROM customer_admin_location ORDER BY id').all().map(r=>r.revision),[1,2]);assert.throws(()=>sqlite.exec("UPDATE customer_admin_location SET evidence_json='changed'"),/NEW_REVISION/);sqlite.close();
});

test('geo map joins a DEMO-filtered logical customer to its existing source point by source ID',async()=>{
 const f=fixture();f.sqlite.prepare("INSERT INTO customer_admin_location(id,organization_id,outlet_id,method,status,evidence_json,effective_from_date) VALUES('source-review','o','c','coordinate','needs_review','{}','2026-01-01')").run();
 const demo={id:'bekasi-demo-customer-001',name:'DEMO customer 001',latitude_e7:null,longitude_e7:null,coordinate_status:'missing',record_status:'active'};
 const source={id:'c',name:'Existing source customer',latitude_e7:-59500000,longitude_e7:1060500000,coordinate_status:'unverified',record_status:'active',lat:-5.95,lng:106.05,demo_operation_overlay:{demo_customer_id:demo.id,source_customer_id:'c'}};
 const h=new Hono();h.use('*',async(c,next)=>{const identity={id:'mg',name:'Manager',role:'MANAGEMENT',organization_id:'o'} as any;c.set('identity' as never,identity);c.set('scope' as never,await resolveScope(f.adapter as any,identity) as never);await next()});
 h.route('/',createGeographyRoutes(async()=>({data:{all_customers:[demo],customers:[source],sales:[]}})));
 const response=await h.request('/api/geo/map?channel=field&area_id=bekasi-demo-area-kota',{}, {DB:f.adapter});assert.equal(response.status,200);const payload=(await response.json() as any).data;
 assert.equal(payload.map.all_customers[0].id,demo.id);assert.equal(payload.map.customers.length,1);assert.equal(payload.map.customers[0].id,'c');assert.equal(payload.map.customers[0].geo_status,'needs_review');assert.equal(payload.map.customers[0].demo_operation_overlay.demo_customer_id,demo.id);assert.deepEqual([payload.map.customers[0].lat,payload.map.customers[0].lng],[-5.95,106.05]);
});


test('15k map points join by indexed identity without quadratic scans or missing customers',async()=>{
 const f=fixture();let idReads=0;
 const customers=Array.from({length:15000},(_,i)=>({get id(){assert.ok(++idReads<200000,'Quadratic customer identity scan');return 'point-'+i},name:'Point '+i,coordinate_status:'unverified',latitude_e7:-62000000,longitude_e7:1068000000}));
 const h=new Hono();h.use('*',async(c,next)=>{const identity={id:'mg',name:'Manager',role:'MANAGEMENT',organization_id:'o'} as any;c.set('identity' as never,identity);c.set('scope' as never,await resolveScope(f.adapter as any,identity) as never);await next()});
 h.route('/',createGeographyRoutes(async()=>({data:{all_customers:customers,customers,sales:[]}})));
 const response=await h.request('/api/geo/map?channel=field',{}, {DB:f.adapter});assert.equal(response.status,200);const payload=(await response.json() as any).data;
 assert.equal(payload.stats.total,15000);assert.equal(payload.map.customers.length,15000);assert.equal(payload.map.customers[0].id,'point-0');assert.equal(payload.map.customers[14999].id,'point-14999');assert.equal(payload.stats.unmapped,15000);assert.ok(idReads<200000);
});
