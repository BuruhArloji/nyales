import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {readModelRevision,scopeCacheKey,cachedJson} from '../src/server/cache';
import {readCustomerPage} from '../src/server/customer-page';
import type {Scope} from '../src/server/scope';

function fixture(){
 const f=database();f.sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Synthetic');INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A');INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Manager');INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('c','o','a','Alpha'),('s','o','a','Alias'),('other','o','a','Zeta');UPDATE customer_outlet SET merged_into_id='c' WHERE id='s';");
 const s={identity:{organization_id:'o',id:'mg',role:'MANAGEMENT'},orgWide:true,allRepsInArea:false,repIds:['mg'],areaIds:[],channel:null,date:'2026-11-04',capabilities:[]} as unknown as Scope;
 const context=()=>{const vars=new Map<string,any>([['scope',s]]);return{env:{DB:f.adapter},get:(k:string)=>vars.get(k),set:(k:string,v:any)=>vars.set(k,v)}};
 return{...f,s,context};
}

test('revision changes for customer, invoice and tier writes; authorization keys never merge assigned scopes',async()=>{
 const f=fixture();const first=await readModelRevision(f.context());
 f.sqlite.exec("UPDATE customer_outlet SET name='Changed',version=version+1 WHERE id='c'");const second=await readModelRevision(f.context());assert.notEqual(first,second);
 f.sqlite.exec("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('i','o','i','1','c','mg','a','field','2026-11-01',100,'validated','validated')");const third=await readModelRevision(f.context());assert.notEqual(second,third);
 f.sqlite.exec("INSERT INTO customer_tier_rule(id,organization_id,name,method,parameters_json,created_by,created_at) VALUES('r','o','Tier','nominal','{\"low_max\":100,\"mid_max\":200}','mg','2026-11-01')");assert.notEqual(third,await readModelRevision(f.context()));
 assert.notEqual(scopeCacheKey({...f.s,orgWide:false,repIds:['one']},'x'),scopeCacheKey({...f.s,orgWide:false,repIds:['two']},'x'));f.sqlite.close();
});

test('paged facts reconcile merged customers, historical invoice scope and cutoff without unrelated invoices',async()=>{
 const f=fixture();f.sqlite.exec(`INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state,is_current) VALUES
 ('i1','o','i1','1','c','mg','a','field','2026-11-01',100,'validated','validated',1),
 ('i2','o','i2','1','s','mg','a','field','2026-11-02',200,'validated','validated',1),
 ('i3','o','i3','1','s','mg','a','field','2026-12-01',300,'validated','validated',1),
 ('i4','o','i4','1','c','mg','a','field','2026-11-03',400,'draft','provisional',1),
 ('i5','o','i5','1','other','mg','a','field','2026-11-03',500,'validated','validated',1),
 ('i6','o','i6','1','c','mg','a','field','2026-11-03',600,'validated','validated',0)`);
 const page=await readCustomerPage(f.adapter,f.s,{limit:1});assert.equal(page.rows[0].id,'c');assert.equal(page.rows[0].actual_minor,300);assert.equal(page.rows[0].last,'2026-11-02');assert.equal(page.total,2);
 const next=await readCustomerPage(f.adapter,f.s,{limit:1,offset:1});assert.equal(next.rows[0].actual_minor,500);assert.equal(next.total,2);f.sqlite.close();
});

test('counts are shared across pages and invalidated on customer writes',async()=>{
 const f=fixture(),previous=(globalThis as any).caches,store=new Map<string,Response>();
 (globalThis as any).caches={default:{match:async(r:Request)=>store.get(r.url)?.clone(),put:async(r:Request,v:Response)=>{store.set(r.url,v)}}};
 try{
  await readCustomerPage(f.adapter,f.s,{limit:1,projection:'assignment'},f.context());assert.equal(store.size,1);
  await readCustomerPage(f.adapter,f.s,{limit:1,offset:1,projection:'assignment'},f.context());assert.equal(store.size,1);
  f.sqlite.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('new','o','a','New')");const changed=await readCustomerPage(f.adapter,f.s,{limit:1,projection:'assignment'},f.context());assert.equal(changed.total,3);assert.equal(store.size,2);
 }finally{(globalThis as any).caches=previous;f.sqlite.close()}
});
