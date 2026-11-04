import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {sessions,sessionGate,hashSession,type SessionEnv,type SessionAuth} from '../src/server/sessions';
import {mappedIdentity,type Identity} from '../src/server/auth';
function fixture(){
 const {sqlite,adapter}=database();sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org'),('x','Other');INSERT INTO app_user(id,organization_id,name,auth_subject) VALUES('mg','o','Management','uid-mg'),('sr','o','Rep','uid-sr'),('sr2','o','Rep2','uid-sr2'),('other','x','Other','uid-other');INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('r','o','sr','SALES_REP','field','2020-01-01');");
 const user=(id='sr'):Identity=>({id,name:id,organization_id:id==='other'?'x':'o',role:id==='mg'?'MANAGEMENT':'SALES_REP'});
 const now=Math.floor(Date.now()/1000);
 const req=(id:string,method:string,path:string,body?:object,token?:string,extra:Record<string,string>={},auth:Partial<SessionAuth>={},production=false,portfolio=false)=>{const h=new Hono<SessionEnv>();h.use('*',async(c,next)=>{c.set('identity',user(id));c.set('auth',{subject:'uid-'+id,authTime:now,mfa:false,...auth});await next()});h.use('*',sessionGate);h.route('/',sessions);h.get('/api/protected',c=>c.json({ok:true}));return h.request(path,{method,headers:{'Content-Type':'application/json',...(token?{'X-Device-Session':token}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})},{DB:adapter,APP_ENV:production?'production':'local',LOCAL_AUTH:'true',FIREBASE_PROJECT_ID:'test',PORTFOLIO_ENABLED:portfolio?'true':'false'})};
 const create=async(id='sr',auth:Partial<SessionAuth>={})=>{const r=await req(id,'POST','/api/device-sessions',{device_id:crypto.randomUUID()},undefined,{},auth);assert.equal(r.status,201,await r.clone().text());return (await r.json() as any).data};
 return {sqlite,adapter,req,create,now};
}
test('session binding, token hashing, identity ownership and summaries do not disclose secrets',async()=>{
 const {sqlite,req,create}=fixture();const s=await create();assert.equal(s.session_token.length,64);const stored=sqlite.prepare('SELECT * FROM device_session WHERE id=?').get(s.id) as any;assert.equal(stored.token_hash,await hashSession(s.session_token));assert.notEqual(stored.token_hash,s.session_token);
 assert.equal((await req('sr','GET','/api/protected')).status,401);assert.equal((await req('sr','GET','/api/protected',undefined,'a'.repeat(64))).status,401);assert.equal((await req('sr','GET','/api/protected',undefined,s.session_token)).status,200);assert.equal((await req('sr2','GET','/api/protected',undefined,s.session_token)).status,401);assert.equal((await req('other','GET','/api/protected',undefined,s.session_token)).status,401);assert.equal((await req('sr','GET','/api/protected',undefined,s.session_token,{}, {subject:'wrong-uid'})).status,401);
 const admin=await create('mg'),other=await create('other'),rep2=await create('sr2');const list=await req('sr','GET','/api/device-sessions',undefined,s.session_token);const json=await list.text();assert.ok(!json.includes('token_hash'));assert.ok(!json.includes('session_token'));assert.ok(!json.includes('auth_subject'));assert.ok(!json.includes(admin.id));assert.ok(!json.includes(other.id));assert.ok(!json.includes(rep2.id));assert.equal((await req('sr','GET','/api/device-sessions/'+rep2.id,undefined,s.session_token)).status,404);assert.equal((await req('mg','GET','/api/device-sessions/'+other.id,undefined,admin.session_token)).status,404);assert.equal((await req('mg','GET','/api/device-sessions/'+rep2.id,undefined,admin.session_token)).status,200);
 const audit=sqlite.prepare('SELECT after_json FROM master_audit').all();assert.ok(!JSON.stringify(audit).includes(s.session_token));assert.ok(!JSON.stringify(audit).includes(stored.token_hash));
});
test('per-device revoke immediately blocks requests; existing other sessions survive and old login cannot rebind',async()=>{
 const {sqlite,req,create,now}=fixture();const a=await create(),b=await create(),admin=await create('mg');const path='/api/device-sessions/'+a.id+'/revoke';
 assert.equal((await req('mg','POST',path,{reason:'Lost device'},admin.session_token)).status,428);assert.equal((await req('mg','POST',path,{reason:'Lost device'},admin.session_token,{'If-Match':'"9"'})).status,412);assert.equal((await req('mg','POST',path,{reason:''},admin.session_token,{'If-Match':'"1"'})).status,422);
 const revoked=await req('mg','POST',path,{reason:'Lost device'},admin.session_token,{'If-Match':'"1"'});assert.equal(revoked.status,200);assert.equal((await req('sr','GET','/api/protected',undefined,a.session_token)).status,401);assert.equal((await req('sr','GET','/api/protected',undefined,b.session_token)).status,200);
 assert.equal((await req('mg','POST',path,{reason:'Lost device'},admin.session_token,{'If-Match':'"1"'})).status,200);assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE action='revoke'").get() as any).n,1);
 assert.equal((await req('sr','POST','/api/device-sessions',{device_id:'new-id'})).status,401);const fresh=await create('sr',{authTime:now+1});assert.ok(fresh.session_token);
 const second=await req('sr','POST','/api/device-sessions/'+b.id+'/revoke',{reason:'Logout'},b.session_token,{'If-Match':'"1"'});assert.equal(second.status,200);assert.equal((await req('sr','GET','/api/protected',undefined,b.session_token)).status,401);
});
test('MFA admin gate and recent-auth protection cannot be bypassed by client input or session headers',async()=>{
 const {req,create,now}=fixture();const admin=await create('mg'),rep=await create();assert.equal((await req('mg','GET','/api/protected',undefined,admin.session_token,{}, {},true)).status,403);assert.equal((await req('mg','POST','/api/device-sessions',{device_id:'x',mfa:true},undefined,{}, {},true)).status,403);assert.equal((await req('mg','GET','/api/protected',undefined,admin.session_token,{}, {mfa:true},true)).status,200);assert.equal((await req('sr','GET','/api/protected',undefined,rep.session_token,{}, {},true)).status,200);
 assert.equal((await req('sr','POST','/api/device-sessions',{device_id:'old'},undefined,{}, {authTime:now-301})).status,401);assert.equal((await req('mg','POST','/api/device-sessions/'+rep.id+'/revoke',{reason:'Lost'},admin.session_token,{'If-Match':'"1"'},{authTime:now-301})).status,401);
 assert.equal((await req('sr','POST','/api/device-sessions',{device_id:'invalid',user_id:'mg'})).status,422);
});
test('expired sessions fail closed, activity writes are throttled, rate limit enforced, deactivated mapping disappears',async()=>{
 const {sqlite,adapter,req,create}=fixture();const s=await create();const old='2000-01-01T00:00:00.000Z';sqlite.prepare('UPDATE device_session SET last_seen_at=? WHERE id=?').run(old,s.id);assert.equal((await req('sr','GET','/api/protected',undefined,s.session_token)).status,200);const first=(sqlite.prepare('SELECT last_seen_at FROM device_session WHERE id=?').get(s.id) as any).last_seen_at;await req('sr','GET','/api/protected',undefined,s.session_token);assert.equal((sqlite.prepare('SELECT last_seen_at FROM device_session WHERE id=?').get(s.id) as any).last_seen_at,first);
 const secret='e'.repeat(64);sqlite.prepare('INSERT INTO device_session(id,organization_id,user_id,auth_subject,device_id,device_label,token_hash,auth_time,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('expired','o','sr','uid-sr','expired','Test',await hashSession(secret),1,old,old,old);assert.equal((await req('sr','GET','/api/protected',undefined,secret)).status,401);
 for(let i=1;i<20;i++)await create();assert.equal((await req('sr','POST','/api/device-sessions',{device_id:'too-many'})).status,429);assert.ok(await mappedIdentity(adapter,'uid-sr'));sqlite.exec("UPDATE app_user SET status='inactive' WHERE id='sr'");assert.equal(await mappedIdentity(adapter,'uid-sr'),null);
 adapter.prepare=()=>{throw new Error('Store offline')};assert.equal((await req('sr','GET','/api/protected',undefined,s.session_token)).status,503);
});


test('portfolio mapped admin without MFA retains device-bound session and nonportfolio still requires MFA',async()=>{
 const {req,sqlite}=fixture();
 const created=await req('mg','POST','/api/device-sessions',{device_id:'google-only-owner'},undefined,{}, {mfa:false},true,true);assert.equal(created.status,201,await created.clone().text());const session=(await created.json() as any).data;
 assert.equal((await req('mg','GET','/api/protected',undefined,session.session_token,{}, {mfa:false},true,true)).status,200);
 assert.equal((await req('mg','GET','/api/protected',undefined,undefined,{}, {mfa:false},true,true)).status,401);
 assert.equal((await req('mg','GET','/api/protected',undefined,session.session_token,{}, {mfa:false},true,false)).status,403);
 const listed=await req('mg','GET','/api/device-sessions',undefined,session.session_token,{}, {mfa:false},true,true),body=await listed.json() as any;assert.equal(body.meta.security.admin_mfa,'google_only');assert.equal(body.meta.security.device_binding,'required');assert.equal(body.meta.security.session_hours,12);sqlite.close();
});
