import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './sales-fixture';
import {buildWalletDataStatements,inferWalletCategory} from '../scripts/customer-wallet-data';
import {walletComparison} from '../src/shared/customer-wallet';
import {readMapMetrics} from '../src/server/map-metrics';
import {resolveScope} from '../src/server/scope';

test('wallet profile additive package is idempotent and never changes imported masters or existing estimates',()=>{
 const f=fixture(),customer={id:'c',organization_id:'o',outlet_type:'grosir'},before=JSON.stringify(f.sqlite.prepare('SELECT * FROM customer_outlet').all()),epoch=(f.sqlite.prepare("SELECT epoch FROM geo_distribution_epoch WHERE organization_id='o'").get() as any).epoch;
 const sql=buildWalletDataStatements([customer],'o','mg','2026-11-05T00:00:00Z').join('\n');f.sqlite.exec(sql);f.sqlite.exec(sql);const profile=f.sqlite.prepare('SELECT * FROM customer_wallet_profile').get() as any;assert.equal(profile.wallet_size_minor,100000000);assert.equal(profile.hierarchy1,'agen_grosir');assert.equal(profile.source,'synthetic_category_preset');assert.equal((f.sqlite.prepare("SELECT epoch FROM geo_distribution_epoch WHERE organization_id='o'").get() as any).epoch,epoch+1);assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM customer_outlet').all()),before);
 f.sqlite.exec("UPDATE customer_wallet_profile SET wallet_size_minor=123,source='manual_estimate' WHERE customer_id='c'");f.sqlite.exec(sql);assert.equal((f.sqlite.prepare('SELECT wallet_size_minor n FROM customer_wallet_profile').get() as any).n,123);assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);f.sqlite.close();
});

test('wallet API compares selected current month with highest observed month including the selected month and preceding 12 months within historical invoice scope',async()=>{
 const f=fixture();f.sqlite.exec(buildWalletDataStatements([{id:'c',organization_id:'o',outlet_type:'retail'}],'o','mg','2026-11-05T00:00:00Z').join('\n'));
 const add=(id:string,date:string,amount:number,channel='field',rep='sr',current=1,status='validated')=>f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state,is_current) VALUES(?,'o',?,'1','c',?,'a',?,?,?,?,'validated',?)").run(id,id,rep,channel,date,amount,status,current);
 add('too-old','2025-10-01',99999999);add('first','2025-11-01',100);add('peak1','2026-09-03',200);add('peak2','2026-09-05',300);add('tie','2026-10-03',500);add('current','2026-11-02',900);add('other-channel','2026-10-01',99999,'telesales','tele');add('superseded','2026-10-01',99999,'field','sr',0);add('cancelled','2026-10-02',99999,'field','sr',1,'cancelled');
 const r=await f.req('GET','/api/customers/c/wallet?period=2026-11&channel=field',undefined,undefined,'mg'),data=await f.data(r);assert.equal(data.wallet_size_minor,5000000);assert.equal(data.highest_month_actual_minor,900);assert.equal(data.highest_month_period,'2026-11');assert.equal(data.current_month_actual_minor,900);assert.equal(data.highest_month_history_start,'2025-11-01');assert.equal(data.highest_month_history_end,'2026-12-01');assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await f.req('GET','/api/customers/c/wallet?period=2026-11&channel=telesales')).status,403);assert.equal((await f.req('GET','/api/customers/c/wallet',undefined,undefined,'other','MANAGEMENT','x')).status,404);assert.equal((await f.req('GET','/api/customers/c/wallet?period=bad')).status,422);
 const tele=await f.data(await f.req('GET','/api/customers/c/wallet?period=2026-11',undefined,undefined,'tele'));assert.equal(tele.highest_month_actual_minor,99999);assert.equal(tele.current_month_actual_minor,0);f.sqlite.close();
});

test('management default comparison aggregates both channels by month while explicit channel stays filtered',async()=>{
 const f=fixture();f.sqlite.exec("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('t1','o','T1','1','c','tele','a','telesales','2026-11-02',400,'validated','validated'),('t2','o','T2','1','c','tele','a','telesales','2026-10-02',700,'validated','validated'),('f1','o','F1','1','c','sr','a','field','2026-09-02',900,'validated','validated'),('f2','o','F2','1','c','sr','a','field','2026-10-02',300,'validated','validated')");
 const both=await f.data(await f.req('GET','/api/customers/c/wallet?period=2026-11',undefined,undefined,'mg'));assert.equal(both.channel,'all');assert.equal(both.current_month_actual_minor,400);assert.equal(both.highest_month_actual_minor,1000);assert.equal(both.highest_month_period,'2026-10');
 const field=await f.data(await f.req('GET','/api/customers/c/wallet?period=2026-11&channel=field',undefined,undefined,'mg'));assert.equal(field.current_month_actual_minor,0);assert.equal(field.highest_month_actual_minor,900);f.sqlite.close();
});

test('first observed month supplies the peak including observed zero, while future invoices remain excluded',async()=>{
 for(const amount of [428000,0]){
  const f=fixture();try{
   f.sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('now','o','NOW','1','c','sr','a','field','2026-11-02',?,'validated','validated')").run(amount);
   f.sqlite.exec("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('future','o','NEXT','1','c','sr','a','field','2026-12-01',999999999,'validated','validated')");
   const before=JSON.stringify(f.sqlite.prepare('SELECT * FROM invoice ORDER BY id').all());
   const data=await f.data(await f.req('GET','/api/customers/c/wallet?period=2026-11&channel=field'));
   assert.equal(data.current_month_actual_minor,amount);assert.equal(data.highest_month_actual_minor,amount);assert.equal(data.highest_month_period,'2026-11');assert.equal(data.invoice_count,1);
   assert.equal(JSON.stringify(f.sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),before);
  }finally{f.sqlite.close()}
 }
});

test('a tie chooses the selected month using the existing four bounded metric queries',async()=>{
 const f=fixture();try{
  f.sqlite.exec("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('prior','o','PRIOR','1','c','sr','a','field','2026-10-02',428000,'validated','validated'),('now','o','NOW','1','c','sr','a','field','2026-11-02',428000,'validated','validated')");
  const scope=await resolveScope(f.adapter,{id:'mg',organization_id:'o',name:'Manager',role:'MANAGEMENT'});let queries=0;
  const adapter=new Proxy(f.adapter,{get(target,key){if(key==='prepare')return(sql:string)=>{queries++;return target.prepare(sql)};return Reflect.get(target,key)}});
  const data=(await readMapMetrics(adapter,scope,['c'],'2026-11','field',undefined,undefined,true)).get('c');
  assert.equal(data.highest_month_actual_minor,428000);assert.equal(data.highest_month_period,'2026-11');assert.equal(data.current_month_actual_minor,428000);assert.equal(queries,4);
 }finally{f.sqlite.close()}
});

test('missing wallet/history are null, unknown categories use reproducible synthetic split and bar widths do not force ordering',async()=>{
 const f=fixture(),data=await f.data(await f.req('GET','/api/customers/c/wallet?period=2026-11'));assert.equal(data.wallet_size_minor,null);assert.equal(data.highest_month_actual_minor,null);assert.equal(data.current_month_actual_minor,0);f.sqlite.close();
 assert.equal(inferWalletCategory({id:'a',organization_id:'o',outlet_type:'wholesale'}),'wholesale');assert.equal(inferWalletCategory({id:'a',organization_id:'o'}),inferWalletCategory({id:'a',organization_id:'o'}));assert.deepEqual(walletComparison(100,200,50),{wallet_percent:50,highest_percent:100,current_percent:25});assert.deepEqual(walletComparison(null,null,0),{wallet_percent:null,highest_percent:null,current_percent:0});assert.deepEqual(walletComparison(5000000,10000000,3000000),{wallet_percent:50,highest_percent:100,current_percent:30});assert.equal(walletComparison(100,200,-30).current_percent,0);
});
