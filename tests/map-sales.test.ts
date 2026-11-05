import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExpression} from '@maplibre/maplibre-gl-style-spec';
import {salesMapCustomers,salesClusterStyle,salesColor} from '../src/shared/map-sales';
import {mapPointStyle} from '../src/shared/map-analysis';
import {mapCustomerPin} from '../src/shared/map-payload';
import {readMapSalesHierarchy} from '../src/server/map-sales';
import {fixture} from './sales-fixture';
import {resolveScope} from '../src/server/scope';

const customers=[{id:'a',field_rep_id:'one',owner:'Dina'},{id:'b',field_rep_id:'two',owner:'Rizal'},{id:'c',field_rep_id:null,owner:'Belum assigned'}];
const hierarchy=[{rep_id:'one',id:'spv',name:'Ayu',role_code:'SUPERVISOR'},{rep_id:'two',id:'spv',name:'Ayu',role_code:'SUPERVISOR'},{rep_id:'one',id:'am',name:'Rama',role_code:'AREA_MANAGER'},{rep_id:'two',id:'am',name:'Rama',role_code:'AREA_MANAGER'}];
test('sales map groups by chosen hierarchy while stable colors do not depend on row order',()=>{
 const reps=salesMapCustomers(customers,hierarchy,'rep','field'),sup=salesMapCustomers(customers,hierarchy,'supervisor','field');
 assert.equal(reps.groups.length,3);assert.equal(sup.groups.length,2);assert.equal(sup.customers[0].sales_group_name,'Ayu');assert.equal(sup.customers[0].sales_group_color,sup.customers[1].sales_group_color);
 assert.equal(salesMapCustomers([...customers].reverse(),hierarchy,'rep','field').customers[2].sales_group_color,reps.customers[0].sales_group_color);
 assert.equal(mapPointStyle(reps.customers[0],'sales').color,salesColor('rep:one'));
 assert.equal(salesMapCustomers(customers,hierarchy,'area_manager','field').customers[0].sales_group_name,'Rama');
 assert.equal(salesMapCustomers(customers,[],'supervisor','field').customers[0].sales_group_name,'Hirarki belum tersedia');
 assert.equal(salesMapCustomers(customers,[...hierarchy,{rep_id:'one',id:'spv2',name:'Ambiguous',role_code:'SUPERVISOR'}],'supervisor','field').customers[0].sales_group_name,'Hirarki perlu ditinjau');
});
test('telesales uses its own assignment and compact pins preserve IDs needed for symbology',()=>{
 const pin=mapCustomerPin({...customers[0],telesales_rep_id:'tele',telesales_owner:'Lina'});
 assert.equal(pin.field_rep_id,'one');assert.equal(pin.telesales_rep_id,'tele');assert.equal(pin.telesales_owner,'Lina');
 const group=salesMapCustomers([pin],[],'rep','telesales');assert.equal(group.customers[0].sales_group_id,'rep:tele');assert.equal(group.customers[0].sales_group_name,'Lina');
});
test('MapLibre cluster colors use dominant assigned group and deterministic ties, with gray unassigned',()=>{
 const {groups}=salesMapCustomers(customers,hierarchy,'rep','field'),style=salesClusterStyle(groups),assigned=groups.filter(g=>g.id!=='unassigned');
 const evaluate=(value:any,p:any)=>{const result=createExpression(value,"layers[0].paint.circle-color");assert.equal(result.result,'success',JSON.stringify(result.value));return(result.value as any).evaluate({zoom:8},{type:1,properties:p})};
 const chosen:any={[assigned[0].property]:2,[assigned[1].property]:1};assert.ok(evaluate(style.color,chosen));
 assert.equal(evaluate(style.color,{}).toString(),evaluate('#a4aeaa',{}).toString());
 assert.equal(evaluate(style.color,chosen).toString(),evaluate(assigned[0].color,{}).toString());
 assert.equal(evaluate(style.color,{[assigned[0].property]:1,[assigned[1].property]:1}).toString(),evaluate(assigned[0].color,{}).toString());
 assert.equal(evaluate((style.properties[assigned[0].property] as any)[1],{sales_group_id:assigned[0].id}),1);
});
test('hierarchy map lookup excludes foreign tenants and stops at edges outside area scope',async()=>{
 const f=fixture();try{
  f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('sp','o','Supervisor'),('am','o','Area Manager'),('far','o','Other Manager');INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('sp','o','sp','SUPERVISOR','field','2020-01-01'),('am','o','am','AREA_MANAGER','field','2020-01-01'),('far','o','far','AREA_MANAGER','field','2020-01-01');INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date) VALUES('sp-edge','o','sr','sp','a','field','2020-01-01'),('am-edge','o','sp','am','a','field','2020-01-01');");
  const scope=await resolveScope(f.adapter,{id:'mg',organization_id:'o',name:'Management',role:'MANAGEMENT'});
  assert.deepEqual((await readMapSalesHierarchy(f.adapter,scope,['sr'],'field')).map(x=>x.name).sort(),['Area Manager','Supervisor']);
  assert.deepEqual(await readMapSalesHierarchy(f.adapter,{...scope,orgWide:false,areaIds:[]},['sr'],'field'),[]);
  assert.deepEqual(await readMapSalesHierarchy(f.adapter,{...scope,identity:{...scope.identity,organization_id:'x'}},['sr'],'field'),[]);
  assert.deepEqual(await readMapSalesHierarchy(f.adapter,scope,[],'field'),[]);
  assert.deepEqual(await readMapSalesHierarchy(f.adapter,scope,['sr'],'telesales'),[]);
 }finally{f.sqlite.close()}
});
