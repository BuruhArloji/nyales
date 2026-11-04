import test from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {listPortfolioVisitors,recordPortfolioVisit} from '../src/server/portfolio-visitors';
import {createPortfolioGate} from '../src/server/portfolio-access';

test('verified visitor presence is throttled, login count ignores heartbeat and older tokens, and emails normalize',async()=>{
 const {sqlite,adapter}=database();sqlite.exec("INSERT INTO organization(id,name) VALUES('pilot','Pilot')");
 try{
  const claims={email:'Guest@Example.test',displayName:'Guest',authTime:100};
  await recordPortfolioVisit(adapter,'project','pilot',claims,'visitor',1000000);
  const first=sqlite.prepare('SELECT * FROM portfolio_visitor_history').get() as any;
  await recordPortfolioVisit(adapter,'project','pilot',claims,'visitor',1100000);
  assert.deepEqual(sqlite.prepare('SELECT * FROM portfolio_visitor_history').get(),first);
  await recordPortfolioVisit(adapter,'project','pilot',claims,'visitor',1400000);
  let row=sqlite.prepare('SELECT * FROM portfolio_visitor_history').get() as any;
  assert.equal(row.visit_count,1);assert.equal(row.last_seen_at,new Date(1400000).toISOString());assert.equal(row.email,'guest@example.test');
  await recordPortfolioVisit(adapter,'project','pilot',{...claims,email:'guest@example.test',authTime:101},'visitor',1500000);
  await recordPortfolioVisit(adapter,'project','pilot',{...claims,authTime:99},'visitor',1900000);
  row=sqlite.prepare('SELECT * FROM portfolio_visitor_history').get() as any;
  assert.equal(row.visit_count,2);assert.equal(row.first_seen_at,first.first_seen_at);assert.equal(row.last_auth_time,101);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM portfolio_visitor_history').get()!.n,1);
 }finally{sqlite.close()}
});

test('owner-only visitor list uses scoped keyset pagination without leaking internal IDs or other organizations',async()=>{
 const {sqlite,adapter}=database();sqlite.exec("INSERT INTO organization(id,name) VALUES('pilot','Pilot'),('foreign','Other')");
 try{
  for(let i=0;i<53;i++)await recordPortfolioVisit(adapter,'project','pilot',{email:`guest${i}@example.test`,authTime:100},'visitor',1000000+i);
  await recordPortfolioVisit(adapter,'project','foreign',{email:'private@example.test',authTime:100},'owner',2000000);
  const app=new Hono<any>();app.use('*',async(c,n)=>{c.set('identity',{organization_id:'pilot'});c.set('portfolioOwner',c.req.header('X-Test-Owner')==='yes');await n()});app.get('/api/portfolio-visitors',listPortfolioVisitors);
  const env={DB:adapter,PORTFOLIO_ORGANIZATION_ID:'pilot'},request=(path:string,owner=true)=>app.request(path,{headers:owner?{'X-Test-Owner':'yes'}:{}},env);
  assert.equal((await request('/api/portfolio-visitors',false)).status,403);
  const first=await(await request('/api/portfolio-visitors?limit=50')).json() as any;
  assert.equal(first.data.length,50);assert.equal(first.meta.has_more,true);assert.ok(first.meta.next_cursor);assert.ok(!JSON.stringify(first).includes('private@example.test'));assert.ok(!('subject_hash' in first.data[0]));
  const second=await(await request('/api/portfolio-visitors?limit=50&cursor='+first.meta.next_cursor)).json() as any;
  assert.equal(second.data.length,3);assert.equal(second.meta.has_more,false);assert.equal(new Set([...first.data,...second.data].map(x=>x.email)).size,53);
  assert.equal((await request('/api/portfolio-visitors?limit=500')).status,422);assert.equal((await request('/api/portfolio-visitors?cursor=bad')).status,422);
 }finally{sqlite.close()}
});

test('portfolio gate records only verified signed-in visits, preserves expiry and denies visitor access to identities',async()=>{
 const {sqlite,adapter}=database();sqlite.exec("INSERT INTO organization(id,name) VALUES('pilot','Pilot')");
 const claims={subject:'uid',email:'guest@example.test',displayName:'Guest',authTime:100,mfa:false,emailVerified:true,provider:'google.com'};
 const routes=new Hono<any>();let time=1000000;
 const app=new Hono<any>();app.use('/api/*',createPortfolioGate(()=>routes,async token=>{if(token==='bad')throw Error();return token==='owner'?{...claims,email:'didikpriyoutomo05@gmail.com'}:claims;},()=>time));app.get('/api/me',c=>c.json({portfolio_owner:c.get('portfolioOwner')===true}));
 const env={DB:adapter,PORTFOLIO_ORGANIZATION_ID:'pilot',PORTFOLIO_ENABLED:'true',LOCAL_AUTH:'false',FIREBASE_PROJECT_ID:'test',APP_ENV:'staging'},request=(path:string,token='guest')=>app.request(path,{headers:{Authorization:'Bearer '+token}},env);
 try{
  assert.equal((await request('/api/me','bad')).status,401);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM portfolio_visitor_history').get()!.n,0);
  assert.equal((await request('/api/me')).status,200);assert.equal((await request('/api/me')).status,200);assert.equal((await request('/api/portfolio-visitors')).status,403);
  const owner=await(await request('/api/me','owner')).json() as any;assert.equal(owner.portfolio_owner,true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM portfolio_visitor_history').get()!.n,2);assert.equal(sqlite.prepare("SELECT visit_count FROM portfolio_visitor_history WHERE email='guest@example.test'").get()!.visit_count,1);
  time+=20*60*1000;assert.equal((await request('/api/me')).status,401);assert.equal(sqlite.prepare("SELECT visit_count FROM portfolio_visitor_history WHERE email='guest@example.test'").get()!.visit_count,1);
 }finally{sqlite.close()}
});
