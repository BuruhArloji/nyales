import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';

test('WEB-059 Overview counts recent invoice activity without requiring complete source history',async()=>{
 const f=fixture(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
 f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('uat','o','UAT','1','c','sr','a','field',?,1000,'validated','validated')").run(date);
 const unknown=await f.data(await f.req('GET','/api/dashboard',undefined,undefined,'mg'));
 assert.equal(unknown.active_customer_count,1);assert.equal(unknown.customer_status_unknown_count,0);assert.equal(unknown.observed_active_customer_count,1);
 await f.data(await f.req('POST','/api/customer-source-coverage',{complete_from:new Date(Date.parse(date)-100*86400000).toISOString().slice(0,10),complete_through:date,history_complete:true,reason:'Synthetic source reconciliation'},undefined,'mg'));
 const known=await f.data(await f.req('GET','/api/dashboard',undefined,undefined,'mg'));assert.equal(known.active_customer_count,1);assert.equal(known.customer_status_unknown_count,0);
 f.sqlite.prepare("UPDATE invoice SET is_current=0 WHERE id='uat'").run();
 f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('uat-v2','o','UAT','2','c','sr','a','field',?,1000,'cancelled','validated')").run(date);
 const zero=await f.data(await f.req('GET','/api/dashboard',undefined,undefined,'mg'));assert.equal(zero.active_customer_count,0);assert.equal(zero.customer_status_unknown_count,0);assert.equal(zero.observed_active_customer_count,0);
 f.sqlite.exec("UPDATE customer_outlet SET record_status='inactive' WHERE id='c'");
 assert.equal((await f.data(await f.req('GET','/api/dashboard',undefined,undefined,'mg'))).active_customer_count,0);
});
