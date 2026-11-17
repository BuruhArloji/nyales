import test from 'node:test';import assert from 'node:assert/strict';
import {validMapPeriod,validMapPoints,visibleMapPoints,pointMapFacts,validSelectedBoundary} from '../mobile/src/map-data';
import {salesMapCustomers} from '../src/shared/map-sales';
test('map period rejects incomplete or impossible month',()=>{assert.equal(validMapPeriod('2026-11'),true);for(const v of ['2026-00','2026-13','2026-1','abcd','1900-01'])assert.equal(validMapPeriod(v),false)});
test('sales map preserves single location and resolves supervisor grouping using shared web rules',()=>{const points=validMapPoints([{id:'a',name:'Toko',lat:-6,lng:107,field_rep_id:'s',owner:'Sari',metrics:{invoice_count:1}},{id:'b',name:'Kios',lat:-6.2,lng:107,field_rep_id:'s',owner:'Sari'}]);const result=salesMapCustomers(points,[{rep_id:'s',role_code:'SUPERVISOR',id:'spv',name:'Andi'}],'supervisor','field');assert.equal(result.customers.length,2);assert.equal(result.groups[0].name,'Andi');assert.equal(visibleMapPoints(points,true).length,1);assert.equal(pointMapFacts(points[0]).invoice_count,1)});

test('boundary response is limited to the selected polygon',()=>{const f={type:'FeatureCollection',features:[{type:'Feature',id:'v1',properties:{boundary_id:'v1'},geometry:{type:'Polygon',coordinates:[]}}]};assert.equal(validSelectedBoundary(f,'v1'),true);assert.equal(validSelectedBoundary(f,'v2'),false);assert.equal(validSelectedBoundary({...f,features:[...f.features,...f.features]},'v1'),false);assert.equal(validSelectedBoundary({...f,features:[]},'v1'),false)});


test('external street view and maps links contain only validated coordinates',async()=>{
 const {externalMapUrl}=await import('../mobile/src/map-data');const a=new URL(externalMapUrl({lat:-6.2,lng:106.8},true));assert.equal(a.hostname,'www.google.com');assert.equal(a.searchParams.get('viewpoint'),'-6.2,106.8');assert.equal(a.searchParams.get('map_action'),'pano');const b=new URL(externalMapUrl({lat:-6.2,lng:106.8},false));assert.equal(b.searchParams.get('query'),'-6.2,106.8');assert.throws(()=>externalMapUrl({lat:91,lng:106},true));
});
