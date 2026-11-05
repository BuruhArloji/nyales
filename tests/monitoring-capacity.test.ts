import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
function populate(f:ReturnType<typeof fixture>,invoices=2600,activities=2500){
 const {sqlite}=f;sqlite.exec('BEGIN');
 const customer=sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES(?,'o','a',?,'Jakarta')");
 for(let i=0;i<120;i++)customer.run('bulk-c-'+i,'Customer '+i);
 const inv=sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'o',?,?,'bulk','1',?,?,'a',?,'2026-09-10',?,'validated','validated')");
 let total=0,field=0,tele=0;for(let i=0;i<invoices;i++){const id='bulk-i-'+String(i).padStart(5,'0'),amount=i===0?25:100,channel=i%4===0?'telesales':'field';inv.run(id,id,id,'bulk-c-'+i%120,channel==='field'?'sr':'tele',channel,amount);total+=amount;if(channel==='field')field+=amount;else tele+=amount;}
 const activity=sqlite.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES(?,'o',?,'sr','field','visit','done','2026-09-10T01:00:00Z',?)");
 for(let i=0;i<activities;i++)activity.run('bulk-a-'+String(i).padStart(5,'0'),'bulk-c-'+i%120,JSON.stringify(i%2===0?{meaningful:true}:{disposition:'closed'}));
 sqlite.exec('COMMIT');return {total,field,tele};
}
const get=(f:ReturnType<typeof fixture>,path:string,actor='mg')=>f.req('GET',path,undefined,undefined,actor);
test('large monitoring aggregates full invoices/events with bounded previews, correct workload actuals and complete keyset drill',async()=>{
 const f=fixture(),expected=populate(f);const summary=await f.data(await get(f,'/api/dashboard/summary?period=2026-09'));
 assert.equal(summary.observed_actual_net_minor,expected.total);assert.equal(summary.actual_net_minor,expected.total);assert.equal(summary.freshness.source_complete,false);assert.equal(summary.customer_count,121);assert.equal(summary.activity_count,2500);assert.equal(summary.meaningful_count,1250);assert.equal(summary.covered_customer_count,60);assert.equal(summary.source_pages.invoices.total,2600);assert.equal(summary.sources.invoices.length,50);assert.equal(summary.source_pages.invoices.has_more,true);assert.equal(summary.sources.activities.length,50);assert.equal(summary.workforce.find((u:any)=>u.id==='sr').observed_actual_minor,expected.field);assert.equal(summary.workforce.find((u:any)=>u.id==='tele').observed_actual_minor,expected.tele);
 let after:string|null=null;const seen=new Set<string>();do{const r=await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices&limit=100'+(after?'&after='+encodeURIComponent(after):''));assert.equal(r.headers.get('Cache-Control'),'no-store');const page=await f.data(r);for(const row of page.rows){assert.equal(seen.has(row.id),false);seen.add(row.id)}assert.ok(page.rows.length<=100);after=page.pagination.next_cursor;}while(after);assert.equal(seen.size,2600);
 const covered=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=customers&covered=true&limit=100'));assert.equal(covered.rows.length,60);assert.ok(covered.rows.every((c:any)=>c.covered));const un=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=customers&covered=false&limit=100'));assert.equal(un.rows.length,61);
 const act=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=activities&meaningful=false&source_channel=field&limit=100'));assert.ok(act.rows.every((a:any)=>a.meaningful===false&&a.channel==='field'));
 const own=await f.data(await get(f,'/api/dashboard/summary?period=2026-09','sr'));assert.equal(own.observed_actual_net_minor,expected.field);const ownPage=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices','sr'));assert.ok(ownPage.rows.every((r:any)=>r.rep_id==='sr'&&r.channel==='field'));
});
test('source cursors are filter/identity bound; query validation and unicode pagination preserve scope',async()=>{
 const f=fixture();populate(f,2,0);const first=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices&limit=1'));const token=encodeURIComponent(first.pagination.next_cursor);
 for(const path of ['kind=invoices&limit=101','kind=invoices&limit=0','kind=invoices&covered=true','kind=activities&after=broken','kind=invoices&area_id=other&after='+token])assert.equal((await get(f,'/api/dashboard/sources?period=2026-09&'+path)).status,422);
 assert.equal((await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices&after='+token,'sr')).status,422);
 assert.equal((await f.data(await f.req('GET','/api/dashboard/sources?period=2026-09&kind=invoices',undefined,undefined,'other','MANAGEMENT','x'))).rows.length,0);
 const empty=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=customers&area_id=other'));assert.equal(empty.rows.length,0);
 f.sqlite.exec('DELETE FROM invoice');for(const id of ['销售一','销售二'])f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'o',?,?,'unicode','1','c','sr','a','field','2026-09-10',1,'validated','validated')").run(id,id,id);
 const u=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices&limit=1'));assert.ok(u.pagination.next_cursor);const v=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&kind=invoices&limit=1&after='+encodeURIComponent(u.pagination.next_cursor)));assert.notEqual(u.rows[0].id,v.rows[0].id);assert.equal(v.pagination.has_more,false);
});
test('CSV export covers all 2600 rows rather than summary preview; export cap never leaves a partial report',async()=>{
 const f=fixture();populate(f,2600,0);const exp=await f.data(await f.req('POST','/api/report-exports',{kind:'invoices',filters:{period:'2026-09'},reason:'Complete report'},undefined,'mg'));const download=await get(f,exp.download_path);const text=await download.text();assert.equal(text.trim().split('\r\n').length===1?text.trim().split('\n').length:text.trim().split('\r\n').length,2601);assert.match(text,/bulk-i-02599/);
 const g=fixture();populate(g,10001,0);const size=g.objects.size;const rejected=await g.req('POST','/api/report-exports',{kind:'invoices',filters:{period:'2026-09'},reason:'Too big report'},undefined,'mg');assert.equal(rejected.status,422);assert.equal((await rejected.json() as any).code,'REPORT_EXPORT_LIMIT_NARROW_FILTERS');assert.equal(g.objects.size,size);assert.equal((g.sqlite.prepare('SELECT COUNT(*) n FROM report_export').get() as any).n,0);
 g.sqlite.prepare("DELETE FROM invoice WHERE id='bulk-i-10000'").run();const full=await g.data(await g.req('POST','/api/report-exports',{kind:'invoices',filters:{period:'2026-09'},reason:'Exact pilot report'},undefined,'mg'));const bytes=await(await get(g,full.download_path)).arrayBuffer();assert.equal(new TextDecoder().decode(bytes).trim().split('\n').length,10001);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');assert.equal(hash,full.checksum);
});
test('SQL aggregation retains exact monetary overflow checks and meaningful requires JSON true',async()=>{
 const f=fixture();
 f.sqlite.exec(`INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES
 ('numeric','o','c','sr','field','visit','done','2026-09-10','{"meaningful":1}'),
 ('bool','o','c','sr','field','visit','done','2026-09-10','{"meaningful":true}'),
 ('planned','o','c','sr','field','visit','planned','2026-09-10','{"disposition":"connected_pic"}');`);
 const report=await f.data(await get(f,'/api/dashboard/summary?period=2026-09'));assert.equal(report.meaningful_count,1);assert.equal(report.declared_connected_pic,1);
 for(const id of ['huge1','huge2'])f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'o',?,?,'overflow','1','c','sr','a','field','2026-09-10',?,'validated','validated')").run(id,id,id,Number.MAX_SAFE_INTEGER);
 const response=await get(f,'/api/dashboard/summary?period=2026-09');assert.equal(response.status,422);assert.equal((await response.json() as any).code,'AMOUNT_OVERFLOW');
});

test('merged-family rep filter and area-manager source paging retain existing scope boundaries',async()=>{
 const f=fixture();f.sqlite.exec(`INSERT INTO app_user(id,organization_id,name) VALUES('alias-rep','o','Alias rep'),('am','o','Area manager');
 INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('alias-role','o','alias-rep','SALES_REP','field','2020-01-01');
 INSERT INTO user_area_scope VALUES('o','alias-rep','a','2020-01-01',NULL),('o','am','a','2020-01-01',NULL);
 INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES('alias','o','a','Old shop','Jakarta');
 INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES('alias-assignment','o','alias','alias-rep','field','a','2020-01-01');
 INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('alias-inv','o','A','A','alias','1','alias','alias-rep','a','field','2026-09-10',150,'validated','validated');
 INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,metadata_json) VALUES('alias-act','o','alias','alias-rep','field','visit','done','2026-09-10','{"meaningful":true}');
 UPDATE customer_outlet SET merged_into_id='c',record_status='inactive' WHERE id='alias';
 INSERT INTO area(id,organization_id,name,branch_id) VALUES('outside','o','Other','br');
 INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES('outside-c','o','outside','Outside','Jakarta');`);
 const summary=await f.data(await get(f,'/api/dashboard/summary?period=2026-09&rep_id=alias-rep'));assert.equal(summary.customer_count,1);assert.equal(summary.covered_customer_count,1);assert.equal(summary.observed_actual_net_minor,150);
 const co=await f.data(await get(f,'/api/dashboard/sources?period=2026-09&rep_id=alias-rep&kind=customers'));assert.deepEqual(co.rows.map((r:any)=>r.id),['c']);assert.equal(co.rows[0].covered,true);
 const am=await f.data(await f.req('GET','/api/dashboard/sources?period=2026-09&kind=customers',undefined,undefined,'am','AREA_MANAGER'));assert.deepEqual(am.rows.map((r:any)=>r.id),['c']);
 const outside=await f.data(await f.req('GET','/api/dashboard/sources?period=2026-09&kind=customers&area_id=outside',undefined,undefined,'am','AREA_MANAGER'));assert.equal(outside.rows.length,0);
});

test('CSV byte budget rejects an oversized UTF-8 export before creating R2/report records',async()=>{
 const f=fixture();const insert=f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,external_invoice_id,source_system,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'o',?,?,'utf8','1','c','sr','a','field','2026-09-10',1,'validated','validated')");f.sqlite.exec('BEGIN');for(let i=0;i<9000;i++){const id='🏪'.repeat(60)+i;insert.run(id,id,id)}f.sqlite.exec('COMMIT');
 const response=await f.req('POST','/api/report-exports',{kind:'invoices',filters:{period:'2026-09'},reason:'Byte budget'},undefined,'mg');assert.equal(response.status,422);assert.equal((await response.json() as any).code,'REPORT_EXPORT_BYTES_LIMIT_NARROW_FILTERS');assert.equal(f.objects.size,0);assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM report_export').get() as any).n,0);
});
