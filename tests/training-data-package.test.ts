import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {scopedRoutes} from '../src/server/index';
import {buildTrainingPackage,validateTrainingPackage,type TrainingPoint} from '../scripts/training-data-package';

test('training package is deterministic, relational, reconciled and idempotent across current three months',()=>{
 const bundle=buildTrainingPackage({month:'2026-11',customerCount:200});
 assert.equal(bundle.sql,buildTrainingPackage({month:'2026-11',customerCount:200}).sql);
 const check=validateTrainingPackage(bundle);
 assert.equal(check.idempotent,true);assert.equal(check.returns,'reconciled');
 assert.deepEqual(bundle.manifest.periods,['2026-09','2026-10','2026-11']);
 assert.equal(bundle.rows.product.length,29);assert.equal(bundle.rows.incentive_statement.length,30);
 assert.equal(bundle.rows.auth_role_assignment.filter(r=>r.role_code==='SALES_REP').length,8);
 assert.equal(bundle.rows.auth_role_assignment.filter(r=>r.role_code==='TELESALES').length,2);
 assert.ok(bundle.rows.invoice.every(i=>bundle.rows.customer_assignment.some(a=>a.outlet_id===i.outlet_id&&a.rep_id===i.rep_id&&a.channel===i.channel)));
 for(const rep of bundle.rows.app_user.filter(r=>String(r.id).includes('-rep-')))assert.ok(bundle.rows.invoice.some(i=>i.rep_id===rep.id),String(rep.name));
 assert.ok(bundle.rows.visit_event.every(e=>e.latitude_e7===null&&e.longitude_e7===null&&e.quality==='synthetic_not_verified'));
 assert.ok(bundle.rows.call_result.every(r=>r.connection_evidence==='manual_unverified'));
 assert.ok(bundle.rows.product.every(p=>/^\d{4}$/.test(String(p.sku))&&p.brand&&p.flavour&&p.size_ml));
 assert.ok(bundle.rows.app_user.every(r=>!String(r.name).includes('DEMO')));
 assert.deepEqual(new Set(bundle.rows.sales_order.map(r=>r.status)),new Set(['confirmed','draft','submitted','approved','pending_confirmation','rejected']));
 assert.deepEqual(new Set(bundle.rows.incentive_statement.map(r=>r.status)),new Set(['finalized','prepared','under_review']));
});

test('source point names and coordinates remain untouched and provenance is retained in local copied points',()=>{
 const points:TrainingPoint[]=Array.from({length:20},(_,n)=>({id:'import-'+n,name:'Warung Sumber '+n,address:'Bekasi '+n,latitude_e7:-62000000+n,longitude_e7:1070000000+n,coordinate_status:'unverified',directory_dataset_id:'directory-1'})),before=JSON.stringify(points);
 const bundle=buildTrainingPackage({month:'2026-11',customerCount:20,points});
 assert.equal(JSON.stringify(points),before);assert.equal(bundle.links.length,20);validateTrainingPackage(bundle);
 for(const point of points){const customer=bundle.rows.customer_outlet.find(c=>c.name===point.name)!;assert.ok(customer);assert.equal(customer.latitude_e7,point.latitude_e7);assert.equal(customer.longitude_e7,point.longitude_e7);assert.ok(bundle.links.some((l:any)=>l.source_customer_id===point.id&&l.customer_id===customer.id));}
 assert.throws(()=>buildTrainingPackage({month:'2026-11',points:[...points,points[0]],customerCount:20}),/DUPLICATE/);
 assert.throws(()=>buildTrainingPackage({month:'2026-13'}),/MONTH/);
 assert.throws(()=>buildTrainingPackage({month:'2026-11',points:points.slice(0,2)}),/INSUFFICIENT/);
 assert.throws(()=>buildTrainingPackage({month:'2026-11',points:points.map((p,n)=>n? p:{...p,longitude_e7:null}),customerCount:20}),/COORDINATE/);
});

test('local read APIs expose linked data for Management and scope each rep to their own channel and customers',async()=>{
 const month=new Date().toISOString().slice(0,7),points=Array.from({length:50},(_,n)=>({id:'point'+n,name:'Warung '+n,latitude_e7:-62000000+n,longitude_e7:1070000000+n})),bundle=buildTrainingPackage({month,customerCount:50,points}),f=database();f.sqlite.exec(bundle.sql);
 const request=async(path:string,actor='demo-management')=>{
  const role=bundle.rows.auth_role_assignment.find(r=>r.user_id===actor)!;
  const h=new Hono();h.use('*',async(c,next)=>{c.set('identity' as never,{id:actor,name:actor,role:role.role_code,channel:role.channel,organization_id:'demo-org'} as never);await next()});h.route('/',scopedRoutes);
  const response=await h.request(path,{method:'GET'},{DB:f.adapter});assert.ok(response.ok,path+': '+await response.clone().text());return await response.json() as any;
 };
 try{
  for(const path of ['/api/invoices?limit=50','/api/orders?limit=50','/api/leads?limit=50','/api/activities?limit=50','/api/tasks?limit=50','/api/work-plans?limit=50','/api/targets?period_start='+month+'-01','/api/incentive-statements','/api/coaching']){const body=await request(path);assert.ok(body.data.length>0,path);}
  const rep=bundle.rows.auth_role_assignment.find(r=>r.role_code==='TELESALES')!,body=await request('/api/invoices?limit=50',String(rep.user_id));assert.ok(body.data.length>0);assert.ok(body.data.every((r:any)=>r.rep_id===rep.user_id&&r.channel==='telesales'));
  const statements=await request('/api/incentive-statements',String(rep.user_id));assert.equal(statements.data.length,3);assert.ok(statements.data.every((r:any)=>r.user_id===rep.user_id));
  const summary=(await request('/api/dashboard/summary?period='+month)).data;assert.ok(summary.actual_net_minor>0);assert.ok(summary.target_minor>0);assert.ok(summary.coverage_percent>0);assert.ok(summary.channels.every((c:any)=>c.actual_net_minor>0));assert.equal(summary.verified_connections,null);
  const map=(await request('/api/map?period='+month)).data;assert.equal(map.customers.length,50);assert.ok(map.customers.every((c:any)=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)));assert.equal(map.sales.length,0);
  assert.ok(map.customers.some((c:any)=>c.status==='Churn'));assert.equal(Number((f.sqlite.prepare('SELECT COUNT(*) n FROM customer_assignment WHERE effective_to_date IS NOT NULL').get() as any).n),5);
  for(const channel of ['field','telesales']){const geo=(await request('/api/geo/map?compact=1&period='+month+'&channel='+channel)).data;assert.equal(geo.map.customers.length,50);assert.ok(geo.map.customers.some((c:any)=>c.metrics.actual_minor>0));assert.ok(geo.map.customers.some((c:any)=>c.metrics.activity_count>0));}
  const statement=statements.data[0],detail=(await request('/api/incentive-statements/'+statement.id,String(rep.user_id))).data;assert.ok(detail.inputs.sources.length>0);assert.ok(detail.result.payout_minor>=0);
 }finally{f.sqlite.close()}
});

test('prototype launcher accepts only validated local package with an exact SQL checksum',()=>{
 const require=createRequire(import.meta.url),{readTrainingPackage}=require('../scripts/ui-prototype.cjs'),folder=mkdtempSync(join(tmpdir(),'nyales-training-'));
 try{const bundle=buildTrainingPackage({month:'2026-11',customerCount:10}),sqlHash=createHash('sha256').update(bundle.sql).digest('hex'),manifest={...bundle.manifest,sql_sha256:sqlHash,validation:validateTrainingPackage(bundle)};writeFileSync(join(folder,'seed.local.sql'),bundle.sql);writeFileSync(join(folder,'manifest.json'),JSON.stringify(manifest));assert.equal(readTrainingPackage(folder).digest,sqlHash);writeFileSync(join(folder,'seed.local.sql'),bundle.sql+'-- modified');assert.throws(()=>readTrainingPackage(folder),/checksum/);writeFileSync(join(folder,'manifest.json'),JSON.stringify({...manifest,remote_allowed:true}));assert.throws(()=>readTrainingPackage(folder),/local-only/);}finally{rmSync(folder,{recursive:true,force:true})}
});
