import {test} from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
test('Overview returns canonical invoice facts without polygon analysis, references or sales tracking payload',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-07T05:00:00Z')});const f=fixture();try{
 f.sqlite.exec("UPDATE customer_outlet SET latitude_e7=-62000000,longitude_e7=1068000000 WHERE id='c';INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('invoice','o','INV-1','1','c','sr','a','field','2026-11-01',428000,'validated','validated');");
 const r=await f.req('GET','/api/geo/map?purpose=overview&compact=1&channel=field&period=2026-11',undefined,undefined,'mg');assert.equal(r.status,200,await r.clone().text());const {data}=await r.json()as any;assert.equal(data.period_context,'2026-11');assert.equal(data.map.customers[0].metrics.invoice_count,1);assert.equal(data.map.customers[0].metrics.actual_minor,428000);assert.deepEqual(data.map.all_customers,[]);assert.deepEqual(data.map.sales,[]);assert.deepEqual(data.map.reference_points,[]);assert.equal(data.boundaries,undefined);assert.equal(data.dataset,undefined);
 }finally{f.sqlite.close()}
});
