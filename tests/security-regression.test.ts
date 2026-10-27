import {test} from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/server/index';
import {fixture,campaign} from './sales-fixture';
import {digest} from '../src/server/operations';
import {reportMaintenance} from '../src/server/monitoring';

function fullApp(){
 const f=fixture();
 f.sqlite.exec("INSERT INTO organization(id,name) VALUES('demo-org','Synthetic Demo');INSERT INTO app_user(id,organization_id,name) VALUES('demo-management','demo-org','Synthetic Manager');");
 const env={DB:f.adapter,IMPORT_FILES:f.bucket,APP_ENV:'local',LOCAL_AUTH:'true',FIREBASE_PROJECT_ID:''};
 const req=(path:string,method='GET',body?:string,headers:Record<string,string>={})=>app.request('https://nyales.example'+path,{method,headers:{Authorization:'Bearer nyales-local-demo','Content-Type':'application/json',...headers},...(body===undefined?{}:{body})},env);
 return {...f,env,request:req};
}

test('WEB-058 same-origin requests pass; hostile origins/preflight/fetch metadata are blocked before side effects',async()=>{
 const f=fullApp(),input=JSON.stringify({device_id:'synthetic-device'});
 for(const headers of [{Origin:'https://evil.example'},{Origin:'null'},{Origin:'https://nyales.example.evil.test'},{'Sec-Fetch-Site':'cross-site'}] as Record<string,string>[]){
  const r=await f.request('/api/device-sessions','POST',input,headers);assert.equal(r.status,403);assert.equal((await r.json() as any).code,'CROSS_ORIGIN_DENIED');assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 }
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM device_session').get() as any).n,0);
 assert.equal((await f.request('/api/customers','OPTIONS',undefined,{Origin:'https://evil.example','Access-Control-Request-Headers':'authorization,x-device-session'})).status,403);
 const same=await f.request('/api/device-sessions','POST',input,{Origin:'https://nyales.example'});assert.equal(same.status,201);
 const session=(await same.json() as any).data;
 const r=await f.request('/api/me','GET',undefined,{'X-Device-Session':session.session_token,Origin:'https://nyales.example'});assert.equal(r.status,200);
 assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.get('X-Frame-Options'),'DENY');
 assert.equal((await f.request('/api/me','GET',undefined,{'X-Device-Session':session.session_token})).status,200);
 const cookie=await app.request('https://nyales.example/api/me',{headers:{Cookie:'session='+session.session_token,'X-Device-Session':session.session_token}},f.env);assert.equal(cookie.status,401);
});

test('WEB-058 full app rejects oversized JSON and binary bodies and never writes a business object',async()=>{
 const f=fullApp(),r=await f.request('/api/device-sessions','POST',JSON.stringify({device_id:'size-test'}));const s=(await r.json() as any).data;
 const headers={'X-Device-Session':s.session_token,'Idempotency-Key':crypto.randomUUID()};
 assert.equal((await f.request('/api/recovery/backups','POST',' '.repeat(2*1024*1024+1),headers)).status,413);
 assert.equal((await f.request('/api/recovery/backups','POST',' '.repeat(2*1024*1024+1),{...headers,'Content-Length':'1'})).status,413);
 assert.equal((await f.request('/api/attachments/guessed/upload','PUT','x'.repeat(5*1024*1024+1),{...headers,'Content-Type':'application/pdf'})).status,413);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM recovery_manifest').get() as any).n,0);assert.equal(f.objects.size,0);
});

test('WEB-058 privileged operational APIs reject every non-admin role and forged tenant input',async()=>{
 const f=fixture();f.sqlite.exec("INSERT INTO app_user(id,organization_id,name) VALUES('am','o','AM'),('sp','o','SPV');INSERT INTO user_area_scope VALUES('o','am','a','2020-01-01',NULL),('o','sp','a','2020-01-01',NULL);");
 for(const [actor,role] of [['sr','SALES_REP'],['tele','TELESALES'],['sp','SUPERVISOR'],['am','AREA_MANAGER']]){
  for(const path of ['/api/recovery/summary','/api/observability/summary','/api/audit-events','/api/notification-policy'])assert.equal((await f.req('GET',path,undefined,undefined,actor,role)).status,403,role+' '+path);
  for(const path of ['/api/recovery/backups','/api/recovery/holds','/api/report-exports'])assert.equal((await f.req('POST',path,{kind:'customers',reason:'Synthetic denied report'},undefined,actor,role)).status,403,role+' '+path);
  const users=await f.data(await f.req('GET','/api/users',undefined,undefined,actor,role));assert.ok(users.every((u:any)=>u.organization_id!=='x'&&!u.auth_subject));
 }
 for(const role of ['MANAGEMENT','NSM'])assert.equal((await f.req('GET','/api/recovery/summary',undefined,undefined,'mg',role)).status,200);
 const backup=await f.data(await f.req('POST','/api/recovery/backups',{kind:'logical',reason:'Synthetic security review'},undefined,'mg'));
 assert.equal((await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Foreign guess'},undefined,'other','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('POST','/api/recovery/holds',{resource_type:'customer',resource_id:'c',reason:'Forged tenant',organization_id:'x'},undefined,'mg')).status,422);
});

test('WEB-058 SQL payloads remain data and unknown/privilege fields cannot change authorization',async()=>{
 const f=fixture(),payload="x'; DROP TABLE customer_outlet; --";
 assert.equal((await f.req('GET','/api/customers/'+encodeURIComponent(payload),undefined,undefined,'mg')).status,404);
 const created=await f.data(await f.req('POST','/api/customers',{name:payload,address:'Synthetic location',area_id:'a'},undefined,'mg'));
 assert.equal((f.sqlite.prepare('SELECT name FROM customer_outlet WHERE id=?').get(created.id) as any).name,payload);
 assert.equal((await f.req('POST','/api/customers',{name:'Spoof',address:'Synthetic',area_id:'a',role:'MANAGEMENT'},undefined,'mg')).status,422);
 assert.equal((await f.req('POST','/api/customers',{name:'Spoof',address:'Synthetic',area_id:'a',organization_id:'x'},undefined,'mg')).status,422);
 assert.ok(f.sqlite.prepare("SELECT id FROM customer_outlet WHERE id='c'").get());
});

test('WEB-058 concurrent replay and competing ETags produce one business mutation and one audit',async()=>{
 const f=fixture(),key=crypto.randomUUID(),input={name:'Synthetic concurrent customer',address:'Synthetic',area_id:'a'};
 const responses=await Promise.all([f.req('POST','/api/customers',input,undefined,'mg','MANAGEMENT','o',key),f.req('POST','/api/customers',input,undefined,'mg','MANAGEMENT','o',key)]);
 const a=await f.data(responses[0]),b=await f.data(responses[1]);assert.equal(a.id,b.id);
 assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_id=?").get(a.id) as any).n,1);
 assert.equal((await f.req('POST','/api/customers',{...input,name:'Conflicting payload'},undefined,'mg','MANAGEMENT','o',key)).status,409);
 const edits=await Promise.all(['First edit','Second edit'].map(name=>f.req('PUT','/api/customers/'+a.id,{...input,name},1,'mg')));
 assert.equal(edits.filter(r=>r.ok).length,1);assert.ok(edits.some(r=>[409,412].includes(r.status)));
 assert.equal((f.sqlite.prepare('SELECT version FROM customer_outlet WHERE id=?').get(a.id) as any).version,2);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM master_audit WHERE resource_id=?').get(a.id) as any).n,2);
});

test('WEB-058 simultaneous telesales claims have a single winner and a single active lease',async()=>{
 const f=fixture(),input=await campaign(f);
 const rs=await Promise.all([f.req('POST','/api/telesales/queue/claim',input,undefined,'tele'),f.req('POST','/api/telesales/queue/claim',input,undefined,'tele')]);
 assert.equal(rs.filter(r=>r.ok).length,1);assert.equal(rs.filter(r=>r.status===409).length,1);
 assert.equal((f.sqlite.prepare("SELECT COUNT(*) n FROM telesales_lease WHERE status='active'").get() as any).n,1);
});

test('WEB-058 evidence rejects disguised HTML, wrong checksum, oversize intent and unauthorized finalize',async()=>{
 const f=fixture();await f.session();const activity=await f.activity();const bytes=new TextEncoder().encode('<html>synthetic upload</html>').buffer;
 const intent=await f.data(await f.req('POST','/api/attachment-intents',{activity_id:activity.id,size:bytes.byteLength,mime:'application/pdf',sha256:await digest(bytes)}));
 const bad=await f.req('PUT',intent.upload_path,bytes,undefined,'sr','SALES_REP','o',undefined,{'Content-Type':'application/pdf'});assert.equal(bad.status,422);assert.equal((await bad.json() as any).code,'FILE_SIGNATURE_MISMATCH');assert.equal(f.objects.size,0);
 assert.equal((await f.req('POST','/api/attachment-intents',{activity_id:activity.id,size:5*1024*1024+1,mime:'application/pdf',sha256:await digest(bytes)})).status,422);
 assert.equal((await f.req('POST','/api/attachments/'+intent.id+'/finalize',{},1,'tele')).status,404);
 const pdf=new TextEncoder().encode('%PDF-1.7 synthetic').buffer;const second=await f.data(await f.req('POST','/api/attachment-intents',{activity_id:activity.id,size:pdf.byteLength,mime:'application/pdf',sha256:'0'.repeat(64)}));
 const mismatch=await f.req('PUT',second.upload_path,pdf,undefined,'sr','SALES_REP','o',undefined,{'Content-Type':'application/pdf'});assert.equal((await mismatch.json() as any).code,'CHECKSUM_OR_SIZE_MISMATCH');assert.equal(f.objects.size,0);
});

test('WEB-058 retention job preserves held report bytes across tenants and releases only after audited review',async()=>{
 const f=fixture();
 f.sqlite.exec("INSERT INTO report_export VALUES('held','o','customers','{}','2020-01-01','Asia/Jakarta','held-key','sha','mg','2020-01-01','2020-01-02','ready'),('expired','o','customers','{}','2020-01-01','Asia/Jakarta','expired-key','sha','mg','2020-01-01','2020-01-02','ready');");
 for(const key of ['held-key','expired-key'])f.objects.set(key,new ArrayBuffer(1));
 const hold=await f.data(await f.req('POST','/api/recovery/holds',{resource_type:'report_export',resource_id:'held',reason:'Synthetic audit hold'},undefined,'mg'));
 await reportMaintenance(f.adapter,f.bucket);assert.equal(f.objects.has('held-key'),true);assert.equal(f.objects.has('expired-key'),false);
 assert.equal((await f.req('POST','/api/recovery/holds/'+hold.id+'/release',{reason:'Foreign release'},1,'other','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('POST','/api/recovery/holds/'+hold.id+'/release',{reason:'Missing version'},undefined,'mg')).status,428);
 const key=crypto.randomUUID();for(let n=0;n<2;n++)assert.equal((await f.req('POST','/api/recovery/holds/'+hold.id+'/release',{reason:'Audit complete'},1,'mg','MANAGEMENT','o',key)).status,200);
 await reportMaintenance(f.adapter,f.bucket);assert.equal(f.objects.has('held-key'),false);
});

test('WEB-058 privacy completion requires approval, stale concurrent decisions fail and terminal retry is idempotent',async()=>{
 const f=fixture(),r=await f.data(await f.req('POST','/api/recovery/privacy-requests',{subject_type:'customer',subject_id:'c',request_kind:'erasure',reason:'Synthetic request'},undefined,'mg'));
 const policy={backup_interval_minutes:15,rpo_minutes:15,rto_minutes:240,retention_days:90,gps_detail_days:7,attachment_days:90,backup_days:35,legal_hold_required:true,reason:'Synthetic security policy'};
 await f.data(await f.req('POST','/api/recovery/policy',policy,undefined,'mg'));
 assert.equal((await f.req('POST','/api/recovery/policy',policy,undefined,'mg')).status,428);
 assert.equal((await f.req('POST','/api/recovery/policy',policy,99,'mg')).status,412);
 const policies=await Promise.all([1,2].map(()=>f.req('POST','/api/recovery/policy',policy,1,'mg')));assert.equal(policies.filter(x=>x.ok).length,1);
 assert.equal((f.sqlite.prepare("SELECT version FROM recovery_policy WHERE organization_id='o'").get() as any).version,2);
 const path='/api/recovery/privacy-requests/'+r.id+'/review';
 assert.equal((await f.req('POST',path,{status:'completed',outcome:'Bypass review'},1,'mg')).status,409);
 const decisions=await Promise.all(['approved','rejected'].map(status=>f.req('POST',path,{status,outcome:'Synthetic decision'},1,'mg')));assert.equal(decisions.filter(x=>x.ok).length,1);
 const winner=(f.sqlite.prepare('SELECT * FROM privacy_request WHERE id=?').get(r.id) as any);assert.equal(winner.version,2);
 if(winner.status==='approved'){const key=crypto.randomUUID();for(let i=0;i<2;i++)assert.equal((await f.req('POST',path,{status:'completed',outcome:'Manual review complete'},2,'mg','MANAGEMENT','o',key)).status,200);}
 assert.ok(f.sqlite.prepare("SELECT id FROM customer_outlet WHERE id='c'").get());
});

test('WEB-058 retention claim blocks late holds and R2 failures are retryable',async()=>{
 const f=fixture();f.sqlite.exec("INSERT INTO report_export VALUES('race','o','customers','{}','2020-01-01','Asia/Jakarta','race-key','sha','mg','2020-01-01','2020-01-02','ready');");f.objects.set('race-key',new ArrayBuffer(1));
 let start!:()=>void,finish!:()=>void;const started=new Promise<void>(r=>start=r),blocked=new Promise<void>(r=>finish=r);const original=f.bucket.delete.bind(f.bucket);
 (f.bucket as any).delete=async()=>{start();await blocked;throw new Error('Synthetic R2 outage')};
 const job=reportMaintenance(f.adapter,f.bucket);await started;
 const hold=await f.req('POST','/api/recovery/holds',{resource_type:'report_export',resource_id:'race',reason:'Too late for deletion claim'},undefined,'mg');assert.equal(hold.status,409);
 finish();await assert.rejects(job,/Synthetic R2 outage/);assert.equal(f.objects.has('race-key'),true);
 assert.equal((f.sqlite.prepare("SELECT status FROM report_export WHERE id='race'").get() as any).status,'deleting');
 (f.bucket as any).delete=original;await reportMaintenance(f.adapter,f.bucket);assert.equal(f.objects.has('race-key'),false);
 assert.equal((f.sqlite.prepare("SELECT status FROM report_export WHERE id='race'").get() as any).status,'expired');
});

test('WEB-058 backups retain organization row, reject source-read failure and detect tampered objects',async()=>{
 const f=fixture(),b=await f.data(await f.req('POST','/api/recovery/backups',{kind:'logical',reason:'Synthetic backup'},undefined,'mg'));
 const body=Array.from(f.objects.values())[0] as unknown as string;const payload=JSON.parse(body);assert.equal(payload.tables.organization[0].id,'o');assert.equal(payload.tables.device_session,undefined);
 const path='/api/recovery/drills';const key=Array.from(f.objects.keys())[0];f.objects.set(key,(body+' ') as any);
 const drill=await f.req('POST',path,{manifest_id:b.id,notes:'Checksum failure test'},undefined,'mg');assert.equal(drill.status,422);assert.equal((await drill.json() as any).data.status,'failed');
 const original=f.adapter.prepare.bind(f.adapter);f.adapter.prepare=((sql:string)=>{if(sql==='SELECT * FROM invoice WHERE organization_id=?')throw new Error('Simulated source outage');return original(sql)}) as typeof f.adapter.prepare;
 assert.equal((await f.req('POST','/api/recovery/backups',{kind:'logical',reason:'Source failure test'},undefined,'mg')).status,503);
 assert.equal((f.sqlite.prepare('SELECT COUNT(*) n FROM recovery_manifest').get() as any).n,1);
});
