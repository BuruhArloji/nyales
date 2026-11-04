import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapDisplayPayload} from '../src/shared/map-payload';
import {normalizeBasemapStyle} from '../src/client/map-style';

test('display map keeps every pin, source link and operational facts without serializing the full directory twice',()=>{
 const customers=Array.from({length:58331},(_,i)=>({id:'c'+i,name:'Warung '+i,lat:-6,lng:107,
  directory_dataset_id:'directory',status:'Unknown',owner:'Sales',external_code:'GMP-'+i,
  visit_window:'form detail',segmentation:{evidence:'not for pins'},location_note:'detail only',
  metrics:{actual_minor:i,activity_count:1},demo_operation_overlay:i===1?{actual_minor:5}:undefined}));
 const source={customers,all_customers:customers,reference_points:[{id:'ref'}],sales:[{id:'sales'}],total_customer_count:customers.length};
 const data=mapDisplayPayload(source,true);
 assert.equal(data.customers.length,customers.length);assert.deepEqual(data.all_customers,[]);
 assert.equal(data.customers.reduce((n:number,c:any)=>n+c.metrics.actual_minor,0),customers.reduce((n,c)=>n+c.metrics.actual_minor,0));
 assert.equal(data.customers[1].demo_operation_overlay,customers[1].demo_operation_overlay);
 assert.equal(data.reference_points,source.reference_points);assert.equal(data.sales,source.sales);
 assert.equal(data.customers[0].directory_dataset_id,'directory');assert.ok(!('visit_window' in data.customers[0]));
 assert.equal(source.all_customers.length,58331);
 assert.equal(mapDisplayPayload(source).all_customers.length,58331);
 assert.ok(Buffer.byteLength(JSON.stringify(data))<Buffer.byteLength(JSON.stringify(source))/2);
});

test('road shield style handles missing/nonnumeric length without mutating provider filters or other layers',()=>{
 const style:any={version:8,sources:{},layers:[{id:'highway-shield-non-us',type:'symbol',source:'osm',filter:['all',['<=',['get','ref_length'],6],['==',['get','network'],'road']]},{id:'other',type:'symbol',source:'osm',filter:['<=',['get','ref_length'],6]}]};
 const result=normalizeBasemapStyle(style);
 assert.deepEqual((result.layers[0] as any).filter,['all',['<=',['number',['get','ref_length'],7],6],['==',['get','network'],'road']]);
 assert.deepEqual(style.layers[0].filter[1],['<=',['get','ref_length'],6]);
 assert.equal(result.layers[1],style.layers[1]);assert.deepEqual(normalizeBasemapStyle(result),result);
});
