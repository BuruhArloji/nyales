import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectiveCustomerStatus} from '../src/shared/customer-recency';
import {fixture} from './sales-fixture';

test('recent invoice evidence establishes activity; incomplete older history never proves churn',()=>{
 assert.equal(effectiveCustomerStatus('2026-08-09','2026-11-07'),'Aktif');
 assert.equal(effectiveCustomerStatus('2026-08-08','2026-11-07'),'Unknown');
 assert.equal(effectiveCustomerStatus(null,'2026-11-07'),'Unknown');
 assert.equal(effectiveCustomerStatus('2026-11-08','2026-11-07'),'Unknown');
 assert.equal(effectiveCustomerStatus('2026-08-08','2026-11-07','Churn'),'Churn');
});
test('imported recent-invoice customer matches overview, status-filtered pages, detail and map without verifying unrelated history',async()=>{
 const f=fixture(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
 try{
  f.sqlite.exec("UPDATE customer_outlet SET transaction_history_unverified=1 WHERE id='c'; INSERT INTO customer_outlet(id,organization_id,area_id,name,transaction_history_unverified) VALUES('no-history','o','a','Other warung',1)");
  f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('recent','o','INV-01','1','c','sr','a','field',?,1000,'validated','validated')").run(date);
  const get=async(path:string)=>f.data(await f.req('GET',path,undefined,undefined,'mg'));
  const overview=await get('/api/dashboard');assert.equal(overview.active_customer_count,1);assert.equal(overview.customer_status_unknown_count,1);
  const active=await get('/api/customers?limit=50&status=Aktif');assert.deepEqual(active.map((c:any)=>c.id),['c']);assert.equal(active[0].status,'Aktif');
  const unknown=await get('/api/customers?limit=50&status=Unknown');assert.deepEqual(unknown.map((c:any)=>c.id),['no-history']);
  assert.equal((await get('/api/customers/c')).status,'Aktif');
  const map=await get('/api/map?compact=1');assert.equal(map.all_customers.length,0);
  const full=await get('/api/customers?all=1');assert.equal(full.find((c:any)=>c.id==='c').status,'Aktif');
  assert.equal((f.sqlite.prepare("SELECT transaction_history_unverified value FROM customer_outlet WHERE id='c'").get() as any).value,1);
  assert.equal((f.sqlite.prepare('SELECT SUM(net_minor) total FROM invoice').get() as any).total,1000);
 }finally{f.sqlite.close()}
});
