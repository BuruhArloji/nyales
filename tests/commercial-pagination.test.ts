import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';

function seeded(){
 const f=fixture(),month=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}).slice(0,7),date=month+'-01';
 const co=f.sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES(?,'o','a',?)");
 const lead=f.sqlite.prepare("INSERT INTO sales_lead(id,organization_id,customer_id,user_id,source,need,stage,next_action,next_due_at,created_at,stage_changed_at) VALUES(?,'o',?,'sr','Customer','Stock','new','Call',?,?,?)");
 const order=f.sqlite.prepare("INSERT INTO sales_order(id,organization_id,customer_id,user_id,channel,client_order_id,lines_json,net_minor,reason,created_at) VALUES(?,'o',?,'sr','field',?,'[]',100,'Order',?)");
 const forecast=f.sqlite.prepare("INSERT INTO forecast_contribution(id,organization_id,customer_id,user_id,channel,source_kind,category,view_kind,expected_invoice_date,amount_minor,reason,created_at) VALUES(?,'o',?,'sr','field','repeat','pipeline','sales',?,100,'Estimate',?)");
 for(let n=0;n<251;n++){
  const key=String(n).padStart(3,'0'),customer='cp'+key;co.run(customer,'Customer '+key);
  lead.run('lead'+key,customer,date+'T01:00:00Z',date,date);
  order.run('order'+key,customer,'external'+key,date);
  forecast.run('forecast'+key,customer,date,date);
 }
 f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('peer','o','Other owner');INSERT INTO sales_lead(id,organization_id,customer_id,user_id,source,need,stage,next_action,next_due_at,created_at,stage_changed_at) VALUES('private','o','c','peer','Other','Other','new','Other','2026-01-01','2026-01-01','2026-01-01')");
 return {...f,month};
}

test('commercial lists support bounded disjoint pages beyond 200 rows while preserving owner scope',async()=>{
 const f=seeded();try{
  for(const path of ['leads','opportunities','orders','forecast-contributions']){
   const legacy=await f.data(await f.req('GET','/api/'+path));assert.equal(legacy.length,200,path);
   const ids:string[]=[];
   for(let offset=0;;offset+=50){const r=await f.req('GET','/api/'+path+'?limit=50&offset='+offset);assert.equal(r.status,200,path);const body=await r.json() as any;assert.ok(body.data.length<=50);ids.push(...body.data.map((x:any)=>x.id));if(!body.meta.pagination.has_more)break}
   assert.equal(ids.length,251,path);assert.equal(new Set(ids).size,251,path);assert.ok(!ids.includes('private'));
   const hundred=await f.req('GET','/api/'+path+'?limit=100&offset=100');assert.equal((await hundred.json() as any).data.length,100);
  }
 }finally{f.sqlite.close()}
});

test('commercial reference filter applies before pagination; malformed paging fails closed',async()=>{
 const f=seeded();try{
  for(const path of ['leads','orders','forecast-contributions']){
   const result=await f.data(await f.req('GET','/api/'+path+'?limit=50&customer_id=cp250'));assert.equal(result.length,1);assert.equal(result[0].customer_id,'cp250');
   assert.deepEqual(await f.data(await f.req('GET','/api/'+path+'?limit=50&customer_id=foreign')),[]);
   for(const query of ['offset=10','limit=101','limit=0','limit=50&offset=-1','limit=50&unexpected=x'])assert.equal((await f.req('GET','/api/'+path+'?'+query)).status,422,path+'?'+query);
  }
 }finally{f.sqlite.close()}
});

test('forecast review remains full scope rather than using the visible forecast page',async()=>{
 const f=seeded();try{
  const review=await f.data(await f.req('GET','/api/forecast-review?period='+f.month));
  assert.equal(review.alternatives.find((r:any)=>r.view_kind==='sales').residual_minor,25100);
  assert.equal(review.next_actions.length,200);
  const page=await f.data(await f.req('GET','/api/forecast-contributions?limit=50'));assert.equal(page.length,50);
  const after=await f.data(await f.req('GET','/api/forecast-review?period='+f.month));assert.deepEqual(after,review);
 }finally{f.sqlite.close()}
});
