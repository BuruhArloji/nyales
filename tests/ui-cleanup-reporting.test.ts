import {test} from 'node:test';import assert from 'node:assert/strict';import {fixture} from './sales-fixture';import {customerRelationshipLabel,presentationLabel} from '../src/shared/business-labels';
const today=new Date('2026-11-05T05:00:00Z');
test('customer relationship filters include historical zero-net invoices without changing segmentation or GPS evidence',async t=>{
 t.mock.timers.enable({apis:['Date'],now:today});const f=fixture();try{
 f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name,coordinate_status) VALUES('lead','o','a','Warung Baru','unverified'); INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('past','o','INV-OLD','1','c','sr','a','field','2026-01-01',0,'validated','validated');");
 const original=f.sqlite.prepare('SELECT id,coordinate_status,version FROM customer_outlet ORDER BY id').all();
 const get=async(status:string)=>f.data(await f.req('GET','/api/customers?limit=50&status='+encodeURIComponent(status),undefined,undefined,'mg'));
 const leads=await get('Leads'),verified=await get('Diverifikasi manual');assert.ok(leads.some((c:any)=>c.id==='lead'));assert.ok(!leads.some((c:any)=>c.id==='c'));assert.deepEqual(verified.map((c:any)=>c.id),['c']);assert.equal(verified[0].has_invoice_history,true);assert.equal(customerRelationshipLabel(verified[0]),'Pernah bertransaksi');assert.equal(customerRelationshipLabel(leads.find((c:any)=>c.id==='lead')),'Leads');assert.deepEqual(f.sqlite.prepare('SELECT id,coordinate_status,version FROM customer_outlet ORDER BY id').all(),original);
 assert.equal(presentationLabel('Jakarta Pusat · penempatan awal sumber'),'Jakarta Pusat');
 }finally{f.sqlite.close()}
});
test('telesales recap is scoped and read-only; completed calls and manual PIC outcomes are counted once',async t=>{
 t.mock.timers.enable({apis:['Date'],now:today});const f=fixture();try{
 f.sqlite.exec(`INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES('call1','o','c','tele','telesales','call','done','2026-11-05T02:00:00Z','{"disposition":"connected_pic"}'),('call2','o','c','tele','telesales','call','done','2026-11-05T03:00:00Z','{"disposition":"no_answer"}'),('field-call','o','c','sr','field','call','done','2026-11-05T02:00:00Z','{"disposition":"connected_pic"}'),('unreviewed','o','c','tele','telesales','call','needs_review','2026-11-05T02:00:00Z','{"disposition":"connected_pic"}'); INSERT INTO work_plan VALUES('p','o','c','tele','2026-11-05T03:00:00Z','2026-11-05T03:00:00Z','call','planned','Call agenda',1,'mg','2026-11-01T00:00:00Z','{}');`);
 const before=f.sqlite.prepare('SELECT * FROM activity ORDER BY id').all(),path='/api/visit-attendance?period=2026-11&channel=telesales&start_date=2026-11-01&end_date=2026-11-05';
 const response=await f.req('GET',path,undefined,undefined,'mg'),body=await response.json()as any;assert.equal(response.status,200);assert.equal(body.meta.target_basis,'scheduled_calls');assert.equal(body.meta.success_basis,'manual_connected_pic');assert.deepEqual(body.data.map((r:any)=>[r.id,r.call_target,r.call_count,r.success_count,r.success_rate_percent]),[['tele',1,2,1,50]]);
 assert.equal((await f.data(await f.req('GET',path,undefined,undefined,'sr'))).length,0);assert.equal((await f.data(await f.req('GET',path+'&area_id=foreign',undefined,undefined,'mg'))).length,0);assert.deepEqual(f.sqlite.prepare('SELECT * FROM activity ORDER BY id').all(),before);
 }finally{f.sqlite.close()}
});
