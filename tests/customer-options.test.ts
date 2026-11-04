import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {customerOptions,readCustomerOptions,customerOptionsQuery} from '../src/server/customer-options';
import type {Scope} from '../src/server/scope';

function fixture(){
 const f=database(),sql:string[]=[];
 f.sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Synthetic'),('x','Other');INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A'),('b','o','Area B'),('z','x','Foreign');INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Manager'),('sr','o','Rep'),('tele','o','Tele'),('other','x','Other');");
 const put=f.sqlite.prepare('INSERT INTO customer_outlet(id,organization_id,area_id,name,external_code,record_status) VALUES(?,?,?,?,?,?)');
 for(let i=0;i<65;i++)put.run('c'+String(i).padStart(3,'0'),'o',i%2?'a':'b',i<3?'Warung Sama':'Warung '+String(i).padStart(3,'0'),'ERP'+String(i).padStart(3,'0'),'active');
 put.run('foreign','x','z','Warung Foreign','ERP999','active');put.run('inactive','o','a','Warung Lama','OLD','inactive');put.run('special','o','a','Toko %_ Asli','K%_1','active');
 put.run('alias','o','b','Alias','ALIAS','active');f.sqlite.exec("UPDATE customer_outlet SET merged_into_id='c000' WHERE id='alias';INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date) VALUES('s','o','c000','sr','field','2020-01-01'),('t','o','c001','tele','telesales','2020-01-01')");
 const adapter=new Proxy(f.adapter,{get(target,key){if(key==='prepare')return(query:string)=>{sql.push(query);return target.prepare(query)};return Reflect.get(target,key)}});
 const scope=(role='MANAGEMENT',areaIds:string[]=[],repIds=['mg'],org='o'):Scope=>({identity:{id:repIds[0],name:'Actor',organization_id:org,role},orgWide:['MANAGEMENT','NSM'].includes(role),allRepsInArea:role==='AREA_MANAGER',areaIds,repIds,date:'2026-11-04',channel:role==='TELESALES'?'telesales':role==='SALES_REP'?'field':null,capabilities:['customers:read']});
 async function get(query='',s=scope()){
  const h=new Hono();h.use('*',async(c,next)=>{c.set('scope' as never,s as never);await next()});h.route('/',customerOptions);return h.request('/api/customer-options'+(query?'?'+query:''),{}, {DB:adapter});
 }
 return{...f,sql,scope,get};
}

test('options are bounded, projected, keyset paged and deduplicated across name/code search',async()=>{
 const f=fixture();f.sqlite.exec("UPDATE customer_outlet SET external_code='Warung-060' WHERE id='c060'");let next='',seen:string[]=[];
 do{const response=await f.get(new URLSearchParams({q:'Warung',limit:'7',...(next?{after:next}:{})}).toString());assert.equal(response.status,200);const body=await response.json() as any;assert.ok(body.data.length<=7);seen.push(...body.data.map((r:any)=>r.id));next=body.meta.next||''}while(next);
 assert.equal(seen.length,65);assert.equal(new Set(seen).size,65);assert.ok(!seen.includes('foreign')&&!seen.includes('inactive')&&!seen.includes('alias'));
 const exact=await(await f.get('q=ERP061')).json() as any;assert.equal(exact.data[0].id,'c061');assert.deepEqual(Object.keys(exact.data[0]).sort(),['id','name','external_code','area_id','record_status','visit_window'].sort());
 assert.ok(!f.sql.some(s=>/\b(invoice|customer_status_snapshot|customer_segmentation_run)\b|COUNT\(/i.test(s)));f.sqlite.close();
});

test('literal wildcards, selected ID hydration, inactive records and malformed queries fail safely',async()=>{
 const f=fixture();for(const q of ['K%','Toko %_']){const body=await(await f.get('q='+encodeURIComponent(q))).json() as any;assert.deepEqual(body.data.map((r:any)=>r.id),['special'])}
 assert.equal((await(await f.get('id=inactive')).json() as any).data.length,0);assert.equal((await(await f.get('id=inactive&record_status=all')).json() as any).data[0].id,'inactive');assert.equal((await(await f.get('id=foreign')).json() as any).data.length,0);
 for(const query of ['limit=0','limit=51','limit=1.1','after=bad','id=c000&q=x','unknown=x'])assert.equal((await f.get(query)).status,422,query);
 const body=await(await f.get('limit=2')).json() as any;assert.equal((await f.get('q=Warung&after='+encodeURIComponent(body.meta.next))).status,422);
 assert.equal((await f.get('after='+encodeURIComponent(body.meta.next),f.scope('AREA_MANAGER',['a']))).status,422);f.sqlite.close();
});

test('six organization roles retain their customer scope before paging and hydration',async()=>{
 const f=fixture();for(const role of ['MANAGEMENT','NSM','AREA_MANAGER','SUPERVISOR','SALES_REP','TELESALES']){
  const s=f.scope(role,['a'],role==='TELESALES'?['tele']:role==='SUPERVISOR'||role==='SALES_REP'?['sr']:['mg']);
  const all=(await(await f.get('limit=50',s)).json() as any).data;
  assert.ok(all.every((r:any)=>r.id!=='foreign'));if(role==='AREA_MANAGER')assert.ok(all.every((r:any)=>r.area_id==='a'));if(role==='SUPERVISOR')assert.equal(all.length,0);if(role==='TELESALES')assert.deepEqual(all.map((r:any)=>r.id),['c001']);
  if(role==='SALES_REP'){assert.ok(all.some((r:any)=>r.id==='c000'));assert.ok(all.every((r:any)=>r.area_id==='a'||r.id==='c000'))}
  assert.equal((await(await f.get('id=foreign',s)).json() as any).data.length,0);
 }
 const foreign=await(await f.get('',f.scope('MANAGEMENT',[],['other'],'x'))).json() as any;assert.deepEqual(foreign.data.map((r:any)=>r.id),['foreign']);f.sqlite.close();
});

test('prefix predicates seek both indexed ranges rather than scanning the organization',async()=>{
 const f=fixture();let sql='',params:any[]=[];
 const capture={prepare(query:string){sql=query;return{bind(...bindings:any[]){params=bindings;return{all:async()=>({results:[]})}}}}} as unknown as D1Database;
 await readCustomerOptions(capture,f.scope(),customerOptionsQuery.parse({q:'warung'}));
 const plan=f.sqlite.prepare('EXPLAIN QUERY PLAN '+sql).all(...params).map((r:any)=>r.detail).join('\n');
 assert.match(plan,/customer_options_name \(organization_id=\? AND name>\? AND name<\?\)/);
 assert.match(plan,/customer_options_code \(organization_id=\? AND external_code>\? AND external_code<\?\)/);
 f.sqlite.close();
});
