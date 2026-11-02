import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {scopedRoutes} from '../src/server/index';

test('bounded detail reconciles merged family, historical invoices, owner order and alias metadata',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-15T05:00:00Z')});
 const {sqlite,adapter}=database();
 sqlite.exec(`INSERT INTO organization(id,name) VALUES('o','Synthetic');
 INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A');
 INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Management'),('sr','o','Rep'),('tele','o','Tele');
 INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('c','o','a','Canonical'),('alias','o','a','Source'),('unrelated','o','a','Other');
 INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date) VALUES('field','o','alias','sr','field','2020-01-01'),('tele','o','c','tele','telesales','2020-01-01');
 INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state,is_current) VALUES
 ('previous','o','previous','1','alias','sr','a','field','2026-10-01',100,'validated','validated',1),
 ('current','o','current','1','c','sr','a','field','2026-11-01',200,'validated','validated',1),
 ('alias-current','o','alias-current','1','alias','sr','a','field','2026-11-02',300,'validated','validated',1),
 ('tele-current','o','tele-current','1','c','tele','a','telesales','2026-11-03',400,'validated','validated',1),
 ('future','o','future','1','alias','sr','a','field','2026-12-01',500,'validated','validated',1),
 ('cancelled','o','cancelled','1','c','sr','a','field','2026-11-04',600,'cancelled','validated',1),
 ('draft','o','draft','1','c','sr','a','field','2026-11-05',700,'draft','provisional',1),
 ('superseded','o','superseded','1','alias','sr','a','field','2026-11-06',800,'validated','validated',0),
 ('unrelated','o','unrelated','1','unrelated','sr','a','field','2026-11-07',900,'validated','validated',1);
 UPDATE customer_outlet SET merged_into_id='c',record_status='inactive' WHERE id='alias';
 INSERT INTO customer_alias VALUES('o','alias','c','SRC','2020-01-01','mg','Same location');
`);
 const get=(path:string,role='MANAGEMENT')=>{
  const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:role==='TELESALES'?'tele':role==='SALES_REP'?'sr':'mg',organization_id:'o',name:'Actor',role} as never);await next()});app.route('/',scopedRoutes);return app.request(path,{}, {DB:adapter});
 };
 for(const [role,total] of [['MANAGEMENT',900],['SALES_REP',500],['TELESALES',400]] as const){
  const list=await (await get('/api/customers',role)).json() as any;
  const expected=list.data.find((x:any)=>x.id==='c');
  assert.equal(expected.actual_minor,total);
  assert.equal(expected.last,'2026-11-03'); // Last invoice retains existing cross-channel semantics.
  for(const id of ['c','alias']){
   const response=await get('/api/customers/'+id,role);assert.equal(response.status,200);
   const body=await response.json() as any;
   assert.deepEqual(body.data,expected);
   assert.equal(response.headers.get('ETag'),'"1"');
   assert.equal(body.meta.requested_customer_id,id);
   assert.equal(body.meta.canonical_customer_id,'c');
   assert.equal(body.meta.alias_resolved,id==='alias');
  }
 }
 // Revocation is checked again; no cross-request detail cache hides the change.
 sqlite.exec("UPDATE customer_assignment SET effective_to_date='2026-11-10' WHERE id='tele'");
 assert.equal((await get('/api/customers/alias','TELESALES')).status,404);
 sqlite.close();
});

test('missing detail returns before segmentation is constructed',async()=>{
 const {sqlite,adapter}=database();
 sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Synthetic');INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Manager')");
 const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:'mg',organization_id:'o',name:'Actor',role:'MANAGEMENT'} as never);await next()});app.route('/',scopedRoutes);
 const response=await app.request('/api/customers/missing',{}, {DB:adapter});
 assert.equal(response.status,404);assert.deepEqual(await response.json(),{code:'NOT_FOUND'});
 assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM customer_segmentation_run').get() as any).n,0);
 sqlite.close();
});
