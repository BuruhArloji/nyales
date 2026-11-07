import {createExpression} from '@maplibre/maplibre-gl-style-spec';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapDisplayPayload,mapRenderPin,overviewMapData} from '../src/shared/map-payload';
import {mapFeatureFacts,mapPointStyle,mapSummary,mapClusterStyle,mapColors} from '../src/shared/map-analysis';
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

test('render-only map reconciles every metric and symbology while omitting empty history',()=>{
 const rows=Array.from({length:58331},(_,i)=>({id:'c'+i,name:'Warung '+i,lat:-6,lng:107,status:i%3===0?'Unknown':i%3===1?'Churn':'Active',directory_dataset_id:'source',external_code:'GMP-'+i,field_rep_id:i<20?'sales':null,
  metrics:{period:'2026-11',actual_minor:i===0?-100:i<10?100:0,invoice_count:i<10?1:0,activity_count:i<25?2:0,meaningful_count:i<15?1:0,last_activity:i<25?'2026-11-01':null,highest_month_actual_minor:null,highest_month_history_start:'2025-11-01',highest_month_history_end:'2026-11-01',wallet_size_minor:null,comparison_period:'2026-11'}}));
 const pins=JSON.parse(JSON.stringify(rows.map(mapRenderPin)));
 assert.equal(pins.length,rows.length);assert.deepEqual(mapSummary(pins),mapSummary(rows));
 for(let i=0;i<rows.length;i++){
  assert.deepEqual(mapFeatureFacts(pins[i]),mapFeatureFacts(rows[i]));
  for(const mode of ['scatter','performance','coverage','risk'] as const)assert.deepEqual(mapPointStyle(pins[i],mode),mapPointStyle(rows[i],mode));
 }
 assert.equal(pins[0].directory_dataset_id,'source');assert.equal(pins[0].external_code,'GMP-0');assert.equal(pins[0].field_rep_id,'sales');
 assert.deepEqual(pins[100].metrics,{actual_minor:0,invoice_count:0,activity_count:0,meaningful_count:0});
 assert.ok(Buffer.byteLength(JSON.stringify(pins))<Buffer.byteLength(JSON.stringify(rows))*.6);
});

test('Overview keeps canonical map invoice facts and highlights transactions at point and cluster level',()=>{
 const transacting={id:'customer',lat:-6,lng:107,metrics:{period:'2026-11',invoice_count:1,actual_minor:428000,activity_count:2,meaningful_count:1}},plain={id:'lead',lat:-6,lng:107,metrics:{invoice_count:0}};
 const payload={map:{customers:[transacting,plain],sales:[],all_customers:[]},period_context:'2026-11'};
 const data=overviewMapData(payload);assert.equal(data.analysis_mode,'scatter');assert.equal(data.analysis_period,'2026-11');assert.equal(data.customers[0],transacting);assert.notEqual(mapPointStyle(transacting,'scatter').color,mapPointStyle(plain,'scatter').color);assert.equal(mapFeatureFacts(transacting).invoice_total,1);assert.equal(payload.map.customers.length,2);const expression=createExpression(mapClusterStyle('scatter').color,'layers[customers].paint.circle-color');assert.equal(expression.result,'success');if(expression.result==='success'){assert.equal(expression.value.evaluateWithoutErrorHandling({zoom:8},{type:1,properties:{customer_total:200,invoice_total:1}}),mapColors.high);assert.equal(expression.value.evaluateWithoutErrorHandling({zoom:8},{type:1,properties:{customer_total:200,invoice_total:0}}),mapColors.neutral)}
});

test('OpenFreeMap road_shield_us normalizes null reference length exactly like highway shields',()=>{
 const source:any={version:8,sources:{},layers:[{id:'road_shield_us',type:'symbol',filter:['all',['<=',['get','ref_length'],6],['==',['get','network'],'us-highway']]}]};const fixed=normalizeBasemapStyle(source);
 assert.deepEqual((fixed.layers[0]as any).filter[1],['<=',['number',['get','ref_length'],7],6]);assert.deepEqual(source.layers[0].filter[1],['<=',['get','ref_length'],6]);assert.deepEqual(normalizeBasemapStyle(fixed),fixed);const compiled=createExpression((fixed.layers[0]as any).filter,'layers[road_shield_us].filter');assert.equal(compiled.result,'success');if(compiled.result==='success'){for(const value of [undefined,null,'bad',7])assert.equal(compiled.value.evaluateWithoutErrorHandling({zoom:10},{type:2,properties:{network:'us-highway',ref_length:value}}),false);for(const value of [1,6])assert.equal(compiled.value.evaluateWithoutErrorHandling({zoom:10},{type:2,properties:{network:'us-highway',ref_length:value}}),true)}
});
