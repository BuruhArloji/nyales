import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {readDirectoryFacts} from '../src/server/directory-facts';
import type {Scope} from '../src/server/scope';

function fixture(){
 const f=database();
 f.sqlite.exec(`INSERT INTO organization(id,name) VALUES('o','Synthetic');
 INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A'),('b','o','Area B');
 INSERT INTO app_user(id,organization_id,name) VALUES('one','o','One'),('two','o','Two');
 INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('c','o','a','Canonical'),('alias','o','a','Alias'),('empty','o','a','Empty');
 INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date,effective_to_date) VALUES
 ('old','o','c','two','field','2026-10-01','2026-11-01'),('new','o','alias','one','field','2026-11-01',NULL);
 UPDATE customer_outlet SET merged_into_id='c' WHERE id='alias';
 INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state,is_current) VALUES
 ('i1','o','i1','1','c','one','a','field','2026-11-01',100,'validated','validated',1),
 ('i2','o','i2','1','alias','two','b','field','2026-11-02',200,'validated','validated',1),
 ('i3','o','i3','1','alias','one','a','telesales','2026-11-03',300,'validated','validated',1),
 ('i4','o','i4','1','c','one','a','field','2026-12-01',400,'validated','validated',1),
 ('i5','o','i5','1','c','one','a','field','2026-11-02',500,'draft','provisional',1),
 ('i6','o','i6','1','c','one','a','field','2026-11-02',600,'validated','validated',0),
 ('i7','o','i7','1','alias','one','a','field','2026-10-01',700,'validated','validated',1);`);
 const scope={identity:{id:'one',organization_id:'o',role:'MANAGEMENT'},date:'2026-11-04',orgWide:true,allRepsInArea:false,areaIds:['a'],repIds:['one'],channel:null,capabilities:[]} as unknown as Scope;
 return {...f,scope};
}

test('directory aggregates reconcile aliases, latest field owner, invoice versions and cutoff',async()=>{
 const f=fixture();try{
  const facts=await readDirectoryFacts(f.adapter,f.scope);
  assert.equal(facts.invoices.get('c')?.actual,600);
  assert.equal(facts.invoices.get('c')?.last,'2026-11-03');
  assert.equal(facts.owners.get('c'),'One');assert.equal(facts.invoices.has('empty'),false);
  const detail=await readDirectoryFacts(f.adapter,f.scope,'c');assert.deepEqual(detail,facts);
  const empty=await readDirectoryFacts(f.adapter,f.scope,'empty');assert.equal(empty.invoices.size,0);assert.equal(empty.owners.size,0);
 }finally{f.sqlite.close()}
});

test('directory amounts retain historical invoice scope for all sales roles',async()=>{
 const f=fixture();try{
  for(const [role,allRepsInArea,channel,expected] of [
   ['AREA_MANAGER',true,null,400],['SUPERVISOR',false,null,400],
   ['SALES_REP',false,'field',100],['TELESALES',false,'telesales',300],
  ] as const){
   const facts=await readDirectoryFacts(f.adapter,{...f.scope,identity:{...f.scope.identity,role},orgWide:false,allRepsInArea,channel});
   assert.equal(facts.invoices.get('c')?.actual,expected,role);
   assert.equal(facts.invoices.get('c')?.last,'2026-11-03',role);
  }
 }finally{f.sqlite.close()}
});
