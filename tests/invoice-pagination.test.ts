import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';

function seeded(){
 const f=fixture(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
 const insert=f.sqlite.prepare(`INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state,is_current) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 for(let n=0;n<237;n++)insert.run('invoice-'+String(n).padStart(3,'0'),'o','INV-'+n,'1','c',n%2?'tele':'sr','a',n%2?'telesales':'field',date,100+n,n%7?'validated':'draft',n%7?'validated':'provisional',1);
 insert.run('foreign','x','FOREIGN','1','c','other','a','field',date,999999,'validated','validated',1);
 return {...f,date};
}

test('invoice SQL pages reach all records beyond 200 with stable disjoint order and unchanged full totals/export',async()=>{
 const f=seeded();try{
  const legacy=await(await f.req('GET','/api/invoices',undefined,undefined,'mg')).json() as any;
  assert.equal(legacy.data.length,200);assert.equal(legacy.meta.has_more,true);
  const ids:string[]=[];
  for(let offset=0;;offset+=50){
   const response=await f.req('GET','/api/invoices?limit=50&offset='+offset,undefined,undefined,'mg');assert.equal(response.status,200);
   const body=await response.json() as any;assert.deepEqual(body.totals,legacy.totals);assert.equal(body.meta.pagination.total,237);assert.equal(body.meta.pagination.limit,50);assert.ok(body.data.length<=50);
   ids.push(...body.data.map((r:any)=>r.id));if(!body.meta.has_more)break;
  }
  assert.equal(ids.length,237);assert.equal(new Set(ids).size,237);assert.deepEqual(ids,[...ids].sort());assert.ok(!ids.includes('foreign'));
  const csv=await f.req('GET','/api/invoices?limit=50&offset=100&format=csv',undefined,undefined,'mg');assert.equal(csv.status,200);
  const lines=(await csv.text()).trim().split(/\r?\n/);assert.equal(lines.length,238);assert.ok(lines.some(line=>line.includes('INV-236')));
 }finally{f.sqlite.close()}
});

test('invoice page filters and historical sales scope precede paging; malformed page bounds fail closed',async()=>{
 const f=seeded();try{
  const first=await(await f.req('GET','/api/invoices?channel=field&limit=100')).json() as any;
  const next=await(await f.req('GET','/api/invoices?channel=field&limit=100&offset=100')).json() as any;
  assert.equal(first.data.length,100);assert.equal(next.data.length,19);assert.equal(first.meta.pagination.total,119);assert.deepEqual(first.totals,next.totals);assert.ok([...first.data,...next.data].every((r:any)=>r.channel==='field'&&r.rep_id==='sr'));
  const none=await(await f.req('GET','/api/invoices?channel=telesales&limit=50')).json() as any;assert.equal(none.data.length,0);assert.equal(none.meta.pagination.total,0);
  for(const query of ['offset=10','limit=0','limit=101','limit=50&offset=-1','limit=50&offset=0.5','limit=50&offset=1000001'])assert.equal((await f.req('GET','/api/invoices?'+query)).status,422,query);
  const filtered=await(await f.req('GET','/api/invoices?status=draft&limit=50',undefined,undefined,'mg')).json() as any;assert.equal(filtered.data.length,34);assert.equal(filtered.totals.invoice_count,0);assert.equal(filtered.totals.excluded_count,34);
 }finally{f.sqlite.close()}
});
