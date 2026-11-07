import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {readCustomerRows} from '../src/server/customer-read-rows';
import {resolveScope,customerPredicate} from '../src/server/scope';

test('customer read keyset pages preserve all canonical rows, detail scope, no-GPS records and SQLite name ordering',async()=>{
 const f=fixture();try{
  f.sqlite.exec('BEGIN');const insert=f.sqlite.prepare('INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES(?,?,?,?,?)');
  for(let i=0;i<2305;i++)insert.run('p'+String(i).padStart(5,'0'),'o','a',i%2?'Warung '+i:'Toko '+i,'Alamat '+i);
  insert.run('unicode1','o','a','😀 Warung','One');insert.run('unicode2','o','a','\uE000 Warung','Two');
  f.sqlite.exec("INSERT INTO area(id,organization_id,name) VALUES('foreign','x','Other');INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('foreign','x','foreign','Foreign');UPDATE customer_outlet SET merged_into_id='c' WHERE id='p00001';COMMIT");
  const scope=await resolveScope(f.adapter,{id:'mg',name:'Manager',organization_id:'o',role:'MANAGEMENT'}),calls:{sql:string;n:number}[]=[];
  const db=new Proxy(f.adapter,{get(target,key){if(key!=='prepare')return (target as any)[key];return(sql:string)=>{const st=target.prepare(sql);const wrap=(s:any):any=>({bind:(...args:any[])=>wrap(s.bind(...args)),all:async()=>{const r=await s.all();calls.push({sql,n:r.results.length});assert.ok(r.results.length<=1000,'D1 response exceeds bounded row count');return r}});return wrap(st)}}});
  const rows=await readCustomerRows(db,scope),expected=f.sqlite.prepare("SELECT id,name,address FROM customer_outlet WHERE organization_id='o' AND merged_into_id IS NULL ORDER BY name").all();
  assert.deepEqual(rows.map(({id,name,address})=>({id,name,address})),JSON.parse(JSON.stringify(expected)));assert.equal(rows.length,2307);assert.equal(rows.filter(r=>r.latitude_e7===null).length,2307);assert.equal(calls.length,3);assert.ok(calls.every(c=>!c.sql.includes('OFFSET')));
  const plan=f.sqlite.prepare("EXPLAIN QUERY PLAN "+calls[1].sql).all('o','p00998') as any[];assert.ok(plan.some(p=>p.detail.includes('customer_org_identity')&&p.detail.includes('id>?')));assert.ok(!plan.some(p=>p.detail.includes('TEMP B-TREE')));
  const sr=await resolveScope(f.adapter,{id:'sr',name:'Sales',organization_id:'o',role:'SALES_REP',channel:'field'});assert.deepEqual(await readCustomerRows(f.adapter,sr,'foreign'),[]);assert.equal((await readCustomerRows(f.adapter,sr,'c'))[0].id,'c');
  const tele=await resolveScope(f.adapter,{id:'tele',name:'Tele',organization_id:'o',role:'TELESALES',channel:'telesales'}),predicate=customerPredicate(tele);
  const allowed=f.sqlite.prepare(`SELECT co.id FROM customer_outlet co WHERE ${predicate.sql} AND co.merged_into_id IS NULL ORDER BY co.name`).all(...predicate.params) as any[];
  assert.deepEqual((await readCustomerRows(f.adapter,tele)).map(r=>r.id),allowed.map(r=>r.id));
 }finally{f.sqlite.close()}
});
