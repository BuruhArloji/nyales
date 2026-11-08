import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './sqlite-helper';
import {resolveScope,customerPredicate,invoicePredicate} from '../src/server/scope';
import {roleName} from '../src/client/hierarchy-model';

test('regional role migration preserves dated roles and all existing role triggers',()=>{
 const {sqlite}=database('0061');try{
  sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO app_user(id,organization_id,name) VALUES('m','o','Manager');INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('old','o','m','NSM','2020-01-01');");
  const before=sqlite.prepare('SELECT * FROM auth_role_assignment').all();
  const triggers=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND(tbl_name='auth_role_assignment' OR sql LIKE '%auth_role_assignment%') ORDER BY name").all();
  sqlite.exec(readFileSync('migrations/0062_regional_manager.sql','utf8'));
  assert.deepEqual(sqlite.prepare('SELECT * FROM auth_role_assignment').all(),before);
  assert.deepEqual(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND(tbl_name='auth_role_assignment' OR sql LIKE '%auth_role_assignment%') ORDER BY name").all(),triggers);
  assert.throws(()=>sqlite.exec("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('overlap','o','m','REGIONAL_MANAGER','2021-01-01')"),/ROLE_OVERLAP/);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{sqlite.close()}
});

test('regional manager sees assigned cities across channels without national settings or other regions',async()=>{
 const {sqlite,adapter}=database();try{
  sqlite.exec(`INSERT INTO organization(id,name,timezone) VALUES('o','Org','Asia/Jakarta'),('foreign','Other','Asia/Jakarta');
   INSERT INTO area(id,organization_id,name) VALUES('a','o','City A'),('b','o','City B'),('c','o','Outside region'),('x','foreign','Foreign');
   INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Management'),('rm','o','Regional'),('am','o','Area'),('sp','o','Supervisor'),('rep','o','Sales');
   INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('mg-r','o','mg','MANAGEMENT',NULL,'2020-01-01'),('rm-r','o','rm','REGIONAL_MANAGER',NULL,'2020-01-01'),('am-r','o','am','AREA_MANAGER','field','2020-01-01'),('sp-r','o','sp','SUPERVISOR','field','2020-01-01'),('rep-r','o','rep','SALES_REP','field','2020-01-01');
   INSERT INTO user_area_scope VALUES('o','rm','a','2020-01-01',NULL),('o','rm','b','2020-01-01',NULL);
   INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date) VALUES('rm-mg','o','rm','mg','a','field','2020-01-01'),('am-rm','o','am','rm','a','field','2020-01-01'),('sp-am','o','sp','am','a','field','2020-01-01'),('rep-sp','o','rep','sp','a','field','2020-01-01');
   INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('ca','o','a','A'),('cb','o','b','B'),('cc','o','c','C'),('cx','foreign','x','X');`);
  const scope=await resolveScope(adapter,{id:'rm',name:'Regional',organization_id:'o',role:'REGIONAL_MANAGER',channel:null});
  assert.equal(scope.orgWide,false);assert.equal(scope.allRepsInArea,true);assert.equal(scope.channel,null);
  assert.ok(!scope.capabilities.includes('settings:manage'));assert.ok(scope.repIds.includes('rep'));
  const predicate=customerPredicate(scope);
  assert.deepEqual(sqlite.prepare('SELECT co.id FROM customer_outlet co WHERE '+predicate.sql+' ORDER BY co.id').all(...predicate.params).map((r:any)=>r.id),['ca','cb']);
  const invoice=invoicePredicate(scope);assert.ok(invoice.sql.includes('area_id IN'));assert.ok(!invoice.sql.includes('channel=?'));
  assert.equal(roleName('REGIONAL_MANAGER'),'Regional Manager');
  assert.throws(()=>sqlite.exec("INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date) VALUES('invalid','o','sp','rm','a','field','2030-01-01')"),/INVALID_REPORTING_ROLES|HIERARCHY_OVERLAP/);
 }finally{sqlite.close()}
});
