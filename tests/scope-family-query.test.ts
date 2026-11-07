import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';import {resolveScope,customerPredicate} from '../src/server/scope';

test('indexed canonical family scope matches legacy visibility for every role and uses merge-key lookup',async()=>{
 const f=fixture();try{
  f.sqlite.exec(`INSERT INTO area(id,organization_id,name) VALUES('a2','o','Other area'),('x-area','x','Foreign');
   INSERT INTO app_user(id,organization_id,name) VALUES('spv','o','Supervisor'),('am','o','Area manager');
   INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('spv-role','o','spv','SUPERVISOR','field','2020-01-01');
   INSERT INTO user_area_scope VALUES('o','spv','a','2020-01-01',NULL),('o','am','a','2020-01-01',NULL);
   INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date) VALUES('edge','o','sr','spv','a','field','2020-01-01');
   INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('canonical','o','a2','Canonical outside area'),('alias','o','a','Merged source'),('unassigned','o','a2','Unassigned'),('area-only','o','a','Area only'),('foreign-customer','x','x-area','Foreign');
   INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES('merged-assignment','o','alias','sr','field','a','2020-01-01');UPDATE customer_outlet SET merged_into_id='canonical' WHERE id='alias';`);
  for(const [id,role] of [['mg','MANAGEMENT'],['nsm','NSM'],['am','AREA_MANAGER'],['spv','SUPERVISOR'],['sr','SALES_REP'],['tele','TELESALES']] as const){
   const scope=await resolveScope(f.adapter,{id,name:id,organization_id:'o',role}),filter=customerPredicate(scope);
   const sql=`SELECT co.id FROM customer_outlet co WHERE ${filter.sql} AND co.merged_into_id IS NULL ORDER BY co.id`;
   const legacy=sql.replace('SELECT co.id UNION ALL SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND f.merged_into_id=co.id','SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)');
   const ids=(q:string)=>(f.sqlite.prepare(q).all(...filter.params) as any[]).map(r=>r.id);
   assert.deepEqual(ids(sql),ids(legacy),role);assert.ok(!ids(sql).includes('foreign-customer'));assert.ok(!ids(sql).includes('alias'));
   if(role==='SALES_REP'){assert.ok(ids(sql).includes('canonical'));assert.ok(ids(sql).includes('area-only'));assert.ok(!ids(sql).includes('unassigned'))}
   if(role==='TELESALES'){assert.deepEqual(ids(sql),['c'])}
   if(['SALES_REP','TELESALES','SUPERVISOR'].includes(role)){
    const plan=f.sqlite.prepare('EXPLAIN QUERY PLAN '+sql).all(...filter.params) as any[];
    assert.ok(plan.some(p=>p.detail.includes('customer_family')&&p.detail.includes('merged_into_id=?')),role+' must seek by merge key, not scan organization for every customer');
    assert.ok(!plan.some(p=>p.detail==='SEARCH f USING INDEX customer_family (organization_id=?)'));
   }
  }
 }finally{f.sqlite.close()}
});
