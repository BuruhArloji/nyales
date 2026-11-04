import {test}from'node:test';
import assert from'node:assert/strict';
import {Hono}from'hono';
import {database}from'./sqlite-helper';
import {createFirstAdminRoutes}from'../src/server/first-admin';
import {httpSecurity}from'../src/server/http-security';
import {mappedIdentity,type verifyFirebaseClaims}from'../src/server/auth';
type Claims=Awaited<ReturnType<typeof verifyFirebaseClaims>>;
const base:Claims={subject:'owner-uid',email:'owner@example.test',emailVerified:true,displayName:'Owner',authTime:Math.floor(Date.now()/1000),provider:'google.com',mfa:true};
function fixture(overrides:Partial<Claims>={},environment:Record<string,unknown>={}){
 const {sqlite,adapter}=database();let claims={...base,...overrides};
 const app=new Hono();app.use('/api/*',httpSecurity);app.route('/',createFirstAdminRoutes(async token=>{if(token!=='signed-fixture')throw Error('invalid');return claims}));
 const env={DB:adapter,APP_ENV:'staging',FIREBASE_PROJECT_ID:'test',FIRST_ADMIN_EMAIL:'owner@example.test',FIRST_ADMIN_ORGANIZATION_NAME:'NYALES Pilot',...environment};
 const request=(init:RequestInit={})=>app.request('/api/auth/first-admin',{method:'POST',headers:{Authorization:'Bearer signed-fixture',...init.headers},...init},env);
 const count=(table:string)=>(sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get()as{n:number}).n;
 return {sqlite,adapter,request,count,setClaims:(update:Partial<Claims>)=>{claims={...claims,...update}}};
}
test('First admin requires explicit staging selection, verified Google identity, MFA and recent authentication before any data write',async()=>{
 for(const overrides of [{email:'someone@example.test'},{emailVerified:false},{provider:'password'},{mfa:false},{authTime:1}]){
  const f=fixture(overrides);const r=await f.request();assert.ok([401,403].includes(r.status),await r.text());assert.equal(f.count('organization'),0);assert.equal(f.count('app_user'),0);assert.equal(f.count('master_audit'),0);
 }
 for(const env of [{APP_ENV:'production'},{APP_ENV:'local'},{FIRST_ADMIN_EMAIL:''},{FIRST_ADMIN_ORGANIZATION_NAME:''}]){const f=fixture({},env);assert.equal((await f.request()).status,404);assert.equal(f.count('organization'),0)}
 const f=fixture();assert.equal((await f.request({headers:{}})).status,401);assert.equal((await f.request({headers:{Authorization:'Bearer malformed'}})).status,401);
 assert.equal((await f.request({headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await f.request({body:'{"email":"owner@example.test","mfa":true}'})).status,422);
 assert.equal(f.count('organization'),0);
});
test('First admin atomically creates one organization and scoped Management identity with audit; replay does not duplicate',async()=>{
 const f=fixture();const first=await f.request();assert.equal(first.status,201,await first.clone().text());const a=await first.json()as any;
 assert.equal(f.count('organization'),1);assert.equal(f.count('app_user'),1);assert.equal(f.count('auth_role_assignment'),1);assert.equal(f.count('master_audit'),1);assert.equal(f.count('master_mutation_guard'),0);
 const identity=await mappedIdentity(f.adapter,base.subject);assert.equal(identity?.role,'MANAGEMENT');assert.equal(identity?.organization_id,a.data.organization_id);
 const role=f.sqlite.prepare('SELECT channel FROM auth_role_assignment').get()as any;assert.equal(role.channel,null);
 assert.equal((f.sqlite.prepare('SELECT name FROM organization').get()as any).name,'NYALES Pilot');
 const repeat=await f.request();assert.equal(repeat.status,200);const b=await repeat.json()as any;assert.equal(b.data.id,a.data.id);assert.equal(b.data.already_initialized,true);assert.equal(f.count('master_audit'),1);
 const audit=JSON.stringify(f.sqlite.prepare('SELECT * FROM master_audit').all());assert.ok(!audit.includes('signed-fixture'));assert.ok(!audit.includes('session_token'));
 f.setClaims({subject:'replacement-uid'});assert.equal((await f.request()).status,409);assert.equal(f.count('app_user'),1);
 f.setClaims({subject:base.subject});f.sqlite.exec("UPDATE app_user SET status='inactive'");assert.equal((await f.request()).status,409);assert.equal(f.count('app_user'),1);
});

test('portfolio Google-only first admin accepts verified Google without MFA and audit reports actual assurance',async()=>{
 const f=fixture({mfa:false},{PORTFOLIO_ENABLED:'true'}),response=await f.request();assert.equal(response.status,201,await response.clone().text());const audit=JSON.parse(String((f.sqlite.prepare('SELECT after_json FROM master_audit').get() as any).after_json));assert.equal(audit.mfa_verified,false);assert.equal(audit.authentication_policy,'google_only');
 for(const claims of [{emailVerified:false},{provider:'password'},{email:'wrong@example.test'},{authTime:1}]){const denied=fixture({mfa:false,...claims},{PORTFOLIO_ENABLED:'true'});assert.ok([401,403].includes((await denied.request()).status));assert.equal(denied.count('organization'),0);}
});
test('Existing tenant or concurrent initialization cannot be adopted; failed bootstrap batch rolls back all new records',async()=>{
 const f=fixture();f.sqlite.exec("INSERT INTO organization(id,name) VALUES('existing','Existing')");assert.equal((await f.request()).status,409);assert.equal(f.count('organization'),1);assert.equal(f.count('app_user'),0);
 const race=fixture();const batch=race.adapter.batch.bind(race.adapter);race.adapter.batch=async statements=>{race.sqlite.exec("INSERT INTO organization(id,name) VALUES('raced','Raced')");return batch(statements)};
 assert.equal((await race.request()).status,409);assert.equal(race.count('organization'),1);assert.equal(race.count('app_user'),0);assert.equal(race.count('master_audit'),0);assert.equal(race.count('master_mutation_guard'),0);
 const failure=fixture();failure.sqlite.exec("CREATE TRIGGER fixture_fail_role BEFORE INSERT ON auth_role_assignment BEGIN SELECT RAISE(ABORT,'fixture failure');END;");assert.equal((await failure.request()).status,409);assert.equal(failure.count('organization'),0);assert.equal(failure.count('app_user'),0);assert.equal(failure.count('master_audit'),0);
});
