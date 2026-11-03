import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {Hono} from 'hono';
import {scopedRoutes} from '../src/server/index';
import {resolveScope} from '../src/server/scope';
import type {Identity} from '../src/server/auth';
import {database} from './sqlite-helper';
test('resource scopes enforce organization, area, subtree, assignment, invoice attribution and safe field projection',async()=>{
 const {sqlite,adapter}=database();
 const date=new Date().toISOString().slice(0,10);const month=date.slice(0,7)+'-01';
 sqlite.exec(`INSERT INTO organization(id,name,timezone,created_at) VALUES('o','Org','Asia/Jakarta',CURRENT_TIMESTAMP),('other','Other','Asia/Jakarta',CURRENT_TIMESTAMP);
 INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A'),('b','o','Area B'),('x','other','Area X');
 INSERT INTO app_user(id,organization_id,name) VALUES ('mg','o','Management'),('am','o','AM'),('sp','o','SPV'),('r1','o','Rep1'),('r2','o','Rep2'),('r3','o','Rep3'),('ts','o','Tele'),('outsider','other','Other');
 INSERT INTO user_area_scope VALUES ('o','am','a','2020-01-01',NULL),('o','sp','a','2020-01-01',NULL),('o','r1','a','2020-01-01',NULL),('o','r2','a','2020-01-01',NULL),('o','r3','b','2020-01-01',NULL);
 INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date,channel) VALUES('role-sp','o','sp','SUPERVISOR','2020-01-01','field'),('role-r1','o','r1','SALES_REP','2020-01-01','field'),('role-r3','o','r3','SALES_REP','2020-01-01','field');
 INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,effective_from_date,effective_to_date) VALUES('h1','o','r1','sp','a','2020-01-01',NULL),('h2','o','r3','sp','b','2020-01-01',NULL);
 INSERT INTO customer_outlet(id,organization_id,area_id,name,latitude_e7,longitude_e7) VALUES('c1','o','a','C1',-62000000,1068000000),('c2','o','a','C2',-62000000,1068000000),('c3','o','b','C3',-62000000,1068000000),('c4','o','b','C4',NULL,NULL),('cx','other','x','CX',-62000000,1068000000);
 INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date,effective_to_date) VALUES('as1','o','c1','r1','field','2020-01-01',NULL),('as2','o','c2','r2','field','2020-01-01',NULL),('as3','o','c3','r3','field','2020-01-01',NULL),('as4','o','c4','r1','field','2020-01-01',NULL),('as5','o','c1','ts','telesales','2020-01-01',NULL),('old','o','c2','ts','telesales','2020-01-01','2020-02-01');
 INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('i1','o','i1','1','c1','r1','a','field','${month}',100,'validated','validated'),('i2','o','i2','1','c2','r2','a','field','${month}',200,'validated','validated'),('i3','o','i3','1','c3','r3','b','field','${month}',300,'validated','validated'),('ix','other','ix','1','cx','outsider','x','field','${month}',900,'validated','validated'),('cancelled','o','bad','1','c1','r1','a','field','${month}',999,'cancelled','validated');
 INSERT INTO sales_last_position VALUES('o','r1',-62000000,1068000000,'${date}T00:00:00Z','check-in',10),('o','r2',-62000000,1068000000,'${date}T00:00:00Z','check-in',10),('o','r3',-62000000,1068000000,'${date}T00:00:00Z','check-in',10),('other','outsider',-62000000,1068000000,'${date}T00:00:00Z','check-in',10);`);
 const request=(user:string,role:string,path:string,method='GET')=>{
  const harness=new Hono();harness.use('*',async(c,next)=>{c.set('identity' as never,{id:user,name:user,organization_id:'o',role} as never);await next()});harness.route('/',scopedRoutes);
  return harness.request(path,{method},{DB:adapter});
 };
 const json=async(u:string,r:string,path:string)=>{const response=await request(u,r,path);assert.equal(response.status,200,path);return await response.json() as any};
 for(const [user,role,ids,total] of [ ['mg','MANAGEMENT',['c1','c2','c3','c4'],600],['mg','NSM',['c1','c2','c3','c4'],600],['am','AREA_MANAGER',['c1','c2'],300],['sp','SUPERVISOR',['c1'],100],['r1','SALES_REP',['c1','c2','c4'],100],['ts','TELESALES',['c1'],0] ] as const){
  const list=await json(user,role,'/api/customers');assert.deepEqual(list.data.map((c:any)=>c.id).sort(),[...ids].sort(),role);
  const assignmentPage=await json(user,role,'/api/customers?projection=assignment&limit=100');
  assert.deepEqual(assignmentPage.data.map((c:any)=>c.id).sort(),[...ids].sort(),role+' assignment page');
  // Detail must preserve every business field and the exact same authorization
  // as the legacy directory for all six hierarchy/channel roles.
  for(const row of list.data){const detail=await request(user,role,'/api/customers/'+row.id);assert.equal(detail.status,200,role);assert.equal(detail.headers.get('ETag'),`"${row.version}"`);assert.deepEqual((await detail.json() as any).data,row,role+' detail parity')}
  assert.equal((await json(user,role,'/api/dashboard')).data.actual_net_minor,total,role);
  assert.equal((await request(user,role,'/api/customers/cx')).status,404,role);
  assert.equal(JSON.stringify(list).includes('auth_subject'),false);
 }
 assert.equal((await request('am','AREA_MANAGER','/api/customers/c3')).status,404);
 assert.deepEqual((await json('am','AREA_MANAGER','/api/customers?area_id=b')).data,[]);
 assert.deepEqual((await json('am','AREA_MANAGER','/api/customers?organization_id=other')).data.map((x:any)=>x.id),['c1','c2']);
 assert.deepEqual((await json('am','AREA_MANAGER','/api/map')).data.sales.map((x:any)=>x.id).sort(),['r1','r2']);
 assert.deepEqual((await json('sp','SUPERVISOR','/api/map')).data.sales.map((x:any)=>x.id),['r1']);
 assert.equal((await request('r1','SALES_REP','/api/telesales/queue')).status,403);
 assert.deepEqual((await json('ts','TELESALES','/api/telesales/queue')).data.map((x:any)=>x.id),['c1']);
 assert.equal((await request('r1','SALES_REP','/api/customers','POST')).status,403);
 sqlite.exec("DELETE FROM user_area_scope WHERE user_id='am'");
 assert.deepEqual((await json('am','AREA_MANAGER','/api/customers')).data,[]);
 sqlite.close();
});
test('scope storage failure never returns fixture data',async()=>{
 const harness=new Hono();harness.use('*',async(c,next)=>{c.set('identity' as never,{id:'u',organization_id:'o',role:'MANAGEMENT'} as never);await next()});harness.route('/',scopedRoutes);
 assert.equal((await harness.request('/api/customers',{},{})).status,503);
});
