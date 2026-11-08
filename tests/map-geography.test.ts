import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './geography-fixture';
import {mappingState} from '../src/server/geography';
import {projectedMappingState,readMapGeographyStates,MAP_GEOGRAPHY_PAGE_SIZE} from '../src/server/map-geography';

test('map evidence projection preserves strict JSON freshness semantics',()=>{
 const customer={id:'c',latitude_e7:null,longitude_e7:1,coordinate_status:'unverified'};
 for(const evidence of [{latitude_e7:null,longitude_e7:1,coordinate_status:'unverified'},{longitude_e7:1,coordinate_status:'unverified'},{latitude_e7:null,longitude_e7:true,coordinate_status:'unverified'},{latitude_e7:null,longitude_e7:'1',coordinate_status:'unverified'},{latitude_e7:null,longitude_e7:1.0,coordinate_status:'unverified'},{}]){
  for(const status of ['confirmed','needs_review','outside_coverage'])for(const active of [{id:'d'},{id:'other'},null]){
   const raw=(key:string)=>Object.hasOwn(evidence,key)?JSON.stringify((evidence as any)[key]):null;
   const row={outlet_id:'c',boundary_id:'b',dataset_id:'d',status,latitude_json:raw('latitude_e7'),longitude_json:raw('longitude_e7'),coordinate_status_json:raw('coordinate_status')};
   assert.equal(projectedMappingState(row,customer,active),mappingState({...row,evidence_json:JSON.stringify(evidence)},customer,active));
  }
 }
});

test('map geography reads bounded latest projections without transferring audit evidence',async()=>{
 const f=harness();try{
  const dataset=await f.release();const boundary=f.sqlite.prepare('SELECT * FROM admin_boundary WHERE dataset_id=?').get(dataset.id) as any;
  const customers:Array<{id:string;latitude_e7:number;longitude_e7:number;coordinate_status:string}>=[];
  const addCustomer=f.sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,latitude_e7,longitude_e7,coordinate_status) VALUES(?,'o','a',?,-59500000,1060500000,'verified')");
  const addMapping=f.sqlite.prepare("INSERT INTO customer_admin_location(id,organization_id,outlet_id,admin_unit_id,boundary_id,method,status,evidence_json,effective_from_date,effective_to_date,reviewed_by,reviewed_at,reason,revision,created_at) VALUES(?,'o',?,?,?,'coordinate',?,?,?,?,'mg','2026-01-01T00:00:00Z','Synthetic map evidence',?,'2026-01-01T00:00:00Z')");
  const evidence=JSON.stringify({latitude_e7:-59500000,longitude_e7:1060500000,coordinate_status:'verified',audit_notes:'x'.repeat(5000)});
  f.sqlite.exec('BEGIN');
  for(let i=0;i<2005;i++){const id='pin-'+i;addCustomer.run(id,id);customers.push({id,latitude_e7:-59500000,longitude_e7:1060500000,coordinate_status:'verified'});addMapping.run('map-'+i,id,boundary.admin_unit_id,boundary.id,'confirmed',evidence,'2020-01-01',null,1)}
  addMapping.run('review','pin-0',boundary.admin_unit_id,boundary.id,'needs_review','invalid JSON is not parsed for nonconfirmed states','2020-01-01',null,2);
  addMapping.run('future','pin-1',boundary.admin_unit_id,boundary.id,'needs_review','{}','2030-01-01',null,2);
  f.sqlite.exec('COMMIT');
  let queries=0,maxRows=0,bytes=0;
  const adapter={prepare:(sql:string)=>{assert.ok(!sql.includes('l.evidence_json,'));const statement=f.adapter.prepare(sql);const st:any={bind:(...params:any[])=>{assert.ok(JSON.parse(params[1]).length<=MAP_GEOGRAPHY_PAGE_SIZE);statement.bind(...params);return st},all:async()=>{queries++;const result=await statement.all();maxRows=Math.max(maxRows,result.results.length);bytes+=Buffer.byteLength(JSON.stringify(result.results));return result}};return st}} as unknown as D1Database;
  const result=await readMapGeographyStates(adapter,'o','2026-11-08',[...customers,customers[0],{...customers[0],id:'not-authorized'}],dataset);
  assert.equal(queries,3);assert.ok(maxRows<=1000);assert.equal(result.length,2005);assert.ok(bytes<800000);
  assert.equal(result.find(r=>r.outlet_id==='pin-0')!.geo_status,'needs_review');assert.equal(result.find(r=>r.outlet_id==='pin-1')!.geo_status,'confirmed');
  for(const row of result){assert.deepEqual(Object.keys(row),['outlet_id','geo_status','geo_boundary_id']);assert.ok(!JSON.stringify(row).includes('audit_notes'))}
  assert.deepEqual(await readMapGeographyStates(f.adapter,'x','2026-11-08',customers,dataset),[]);
  assert.deepEqual(await readMapGeographyStates(f.adapter,'o','2026-11-08',[],dataset),[]);
 }finally{f.sqlite.close()}
});
