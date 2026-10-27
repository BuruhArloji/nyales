import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {scopedRoutes} from '../src/server/index';
import {normalizePhone} from '../src/server/customers';
function fixture(){
 const {sqlite,adapter}=database();sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org'),('other','Other');INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A'),('b','o','Area B'),('x','other','Area X');INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Management'),('sr','o','Rep'),('am','o','Manager'),('tele','o','Tele');INSERT INTO user_area_scope VALUES('o','sr','a','2020-01-01',NULL),('o','am','a','2020-01-01',NULL);");
 const req=async(method:string,path:string,body?:object,version?:number,key=crypto.randomUUID(),role='MANAGEMENT')=>{const h=new Hono();h.use('*',async(c,next)=>{c.set('identity' as never,{id:role==='MANAGEMENT'?'mg':role==='AREA_MANAGER'?'am':role==='TELESALES'?'tele':'sr',name:'Actor',organization_id:'o',role} as never);await next()});h.route('/',scopedRoutes);return h.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,...(version?{'If-Match':`"${version}"`}:{})},...(body?{body:JSON.stringify(body)}:{})},{DB:adapter})};
 const create=async(path:string,body:object)=>{const r=await req('POST',path,body);assert.equal(r.status,201,await r.clone().text());return (await r.json() as any).data};
 const outlet=(extra={})=>({name:'Outlet',address:'Jakarta',area_id:'a',...extra});
 return {sqlite,req,create,outlet};
}
test('phone normalization supports Indonesia, international E164 and rejects malformed/ambiguous input',()=>{
 for(const value of ['0812-3456-7890','(0812) 3456 7890','6281234567890','+62 812 3456 7890','006281234567890'])assert.equal(normalizePhone(value),'+6281234567890');
 assert.equal(normalizePhone('+1 (212) 555-1234'),'+12125551234');for(const value of ['hello081234567890','1234567890','+620','++6281234567890','+1234567890123456'])assert.equal(normalizePhone(value),null);
});
test('customer masters enforce tenant, role, unique external codes, location validation, idempotency and audit',async()=>{
 const {sqlite,req,create,outlet}=fixture();
 assert.equal((await req('POST','/api/customers',outlet(),undefined,undefined,'SALES_REP')).status,403);
 const key=crypto.randomUUID(),input=outlet({external_code:' erp-01 '});const first=await req('POST','/api/customers',input,undefined,key);assert.equal(first.status,201);const customer=(await first.json() as any).data;
 assert.equal(customer.external_code,'ERP-01');assert.equal(customer.coordinate_status,'missing');assert.equal((await req('POST','/api/customers',input,undefined,key).then(r=>r.json()) as any).data.id,customer.id);assert.equal((await req('POST','/api/customers',{...input,name:'Changed'},undefined,key)).status,409);
 assert.equal((await req('POST','/api/customers',input)).status,409);assert.equal((await req('POST','/api/customers',outlet({latitude_e7:0}))).status,422);assert.equal((await req('POST','/api/customers',outlet({latitude_e7:900000001,longitude_e7:0}))).status,422);
 assert.equal((await req('POST','/api/customers',outlet({latitude_e7:0,longitude_e7:0,coordinate_status:'verified'}))).status,422);
 const zero=await create('/api/customers',outlet({latitude_e7:0,longitude_e7:0}));assert.equal(zero.coordinate_status,'unverified');
 assert.equal((await req('POST','/api/customers',outlet({area_id:'x'}))).status,422);
 assert.equal((await req('PUT','/api/customers/'+customer.id,outlet())).status,428);assert.equal((await req('PUT','/api/customers/'+customer.id,outlet(),99)).status,412);
 assert.equal((await req('PUT','/api/customers/'+customer.id,outlet({name:'Edited',latitude_e7:-62000000,longitude_e7:1068000000,coordinate_status:'verified',location_note:'Dikonfirmasi manual'}),1)).status,200);
 const list=await req('GET','/api/customers').then(r=>r.json()) as any;assert.equal(list.data.length,2);assert.equal(list.data.find((c:any)=>c.id===zero.id).lat,0);assert.equal(list.data.find((c:any)=>c.id===zero.id).latitude_e7,0);assert.ok(list.data.some((c:any)=>c.id===customer.id));
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM master_audit WHERE resource_type='customers'").get() as any).n,3);
});
test('shared numbers remain separate; contact preferences survive omitted fields and scope masks phone',async()=>{
 const {req,create,outlet}=fixture();const a=await create('/api/customers',outlet());const b=await create('/api/customers',outlet({area_id:'b'}));
 const payload=(customer_id:string)=>({customer_id,name:'PIC',phone:'0812-3456-7890',preferred_channel:'telesales',permission_status:'dnc',permission_note:'Permintaan pelanggan'});
 const ca=await create('/api/contacts',payload(a.id));const cb=await create('/api/contacts',payload(b.id));assert.equal(ca.phone,cb.phone);assert.notEqual(ca.id,cb.id);
 const safe=await req('GET','/api/contacts',undefined,undefined,undefined,'SALES_REP').then(r=>r.json()) as any;assert.equal(safe.data.length,1);assert.equal(safe.data[0].id,ca.id);assert.equal(safe.data[0].phone,undefined);assert.equal(safe.data[0].permission_note,undefined);assert.ok(!JSON.stringify(safe).includes(ca.phone));
 assert.equal((await req('GET','/api/contacts/'+cb.id,undefined,undefined,undefined,'AREA_MANAGER')).status,404);
 assert.equal((await req('PUT','/api/contacts/'+ca.id,{customer_id:a.id,name:'PIC Edit',phone:ca.phone,preferred_channel:'field'},1)).status,200);let detail=await req('GET','/api/contacts/'+ca.id).then(r=>r.json()) as any;assert.equal(detail.data.permission_status,'dnc');
 assert.equal((await req('PUT','/api/contacts/'+ca.id,{customer_id:a.id,name:'PIC',phone:'+628999999999',preferred_channel:'field',permission_status:'allowed',permission_note:'Old consent must not follow a new number'},2)).status,200);detail=await req('GET','/api/contacts/'+ca.id).then(r=>r.json()) as any;assert.equal(detail.data.permission_status,'unknown');
 assert.equal((await req('PUT','/api/contacts/'+ca.id,{...payload(b.id)},3)).status,409);
 assert.equal((await req('POST','/api/contacts',{...payload(a.id),permission_status:'allowed',permission_note:''})).status,422);
 assert.equal((await req('POST','/api/contacts/'+ca.id+'/archive',{},3)).status,200);assert.equal((await req('POST','/api/contacts/'+ca.id+'/archive',{},4)).status,409);
});
test('customer lists and timeline remain scoped; inactive outlets persist and historical invoice attribution is protected',async()=>{
 const {sqlite,req,create,outlet}=fixture();const a=await create('/api/customers',outlet());const b=await create('/api/customers',outlet({area_id:'b'}));
 const list=await req('GET','/api/customers',undefined,undefined,undefined,'AREA_MANAGER').then(r=>r.json()) as any;assert.equal(list.data.length,1);assert.equal((await req('GET','/api/customers/'+b.id+'/timeline',undefined,undefined,undefined,'SALES_REP')).status,404);
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()).slice(0,7)+'-01';
 sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('i','o','INV','1',?,'sr','a','field',?,1000,'validated','validated')").run(a.id,month);
 sqlite.prepare("INSERT INTO activity(id,organization_id,outlet_id,user_id,channel,activity_kind,status,occurred_at,notes) VALUES('visible','o',?,'sr','field','visit','done',?,'visible'),('hidden','o',?,'tele','telesales','call','done',?,'secret-call')").run(a.id,new Date().toISOString(),a.id,new Date().toISOString());
 const timeline=await req('GET','/api/customers/'+a.id+'/timeline',undefined,undefined,undefined,'SALES_REP').then(r=>r.json()) as any;assert.ok(timeline.data.some((x:any)=>x.id==='i'));assert.ok(timeline.data.some((x:any)=>x.id==='visible'));assert.ok(!JSON.stringify(timeline).includes('secret-call'));
 assert.equal((await req('PUT','/api/customers/'+a.id,outlet({area_id:'b'}),1)).status,409);assert.equal((sqlite.prepare("SELECT area_id FROM invoice WHERE id='i'").get() as any).area_id,'a');
 for(const c of[a,b])assert.equal((await req('PUT','/api/customers/'+c.id,outlet({area_id:c.area_id,record_status:'inactive'}),1)).status,200);
 assert.equal((await req('GET','/api/customers').then(r=>r.json()) as any).data.length,2);const map=await req('GET','/api/map').then(r=>r.json()) as any;assert.equal(map.data.total_customer_count,2);assert.equal(map.data.inactive_customer_count,2);assert.equal(map.data.customers.length,0);
 assert.equal((await req('GET','/api/accounts')).status,404);
});

test('migration flags legacy duplicate codes without deleting history; seed can be rerun without changing edited coordinates',()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').sort().filter(x=>x<'0009'))db.exec(readFileSync('migrations/'+file,'utf8'));
 db.exec("INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO area(id,organization_id,name) VALUES('a','o','A');INSERT INTO customer_outlet(id,organization_id,area_id,name,external_code) VALUES('one','o','a','One','same'),('two','o','a','Two',' SAME '),('three','o','a','Three','single');");db.exec(readFileSync('migrations/0009_customer_masters.sql','utf8'));
 assert.equal((db.prepare('SELECT COUNT(*) n FROM customer_outlet').get() as any).n,3);assert.equal((db.prepare('SELECT COUNT(*) n FROM account WHERE needs_review=1').get() as any).n,3);assert.equal((db.prepare('SELECT COUNT(*) n FROM customer_outlet WHERE external_code_review=1').get() as any).n,2);assert.equal((db.prepare("SELECT external_code FROM customer_outlet WHERE id='two'").get() as any).external_code,' SAME ');
 const fresh=database();const seed=readFileSync('scripts/seed.sql','utf8');fresh.sqlite.exec(seed);fresh.sqlite.exec("UPDATE customer_outlet SET latitude_e7=0,longitude_e7=0 WHERE id='CUS-001'");fresh.sqlite.exec(seed);assert.equal((fresh.sqlite.prepare("SELECT latitude_e7 FROM customer_outlet WHERE id='CUS-001'").get() as any).latitude_e7,0);assert.equal((fresh.sqlite.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='account'").get() as any).n,0);fresh.sqlite.exec("UPDATE customer_assignment SET effective_to_date='2026-02-01' WHERE id='assign-001';INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date) VALUES('seed-replacement','demo-org','CUS-001','demo-sr-01','field','2026-02-01');");fresh.sqlite.exec(seed);assert.equal((fresh.sqlite.prepare("SELECT effective_to_date FROM customer_assignment WHERE id='assign-001'").get() as any).effective_to_date,'2026-02-01');
});

test('retiring the account layer preserves customers and facts with recoverable audit snapshots',()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').sort().filter(x=>x<'0017'))db.exec(readFileSync('migrations/'+file,'utf8'));
 db.exec("INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO area(id,organization_id,name) VALUES('a','o','Area');INSERT INTO app_user(id,organization_id,name) VALUES('sr','o','Rep');INSERT INTO account(id,organization_id,name,external_code) VALUES('old','o','Legacy Legal Entity','LEGAL');INSERT INTO customer_outlet(id,organization_id,area_id,name,address,account_id) VALUES('c','o','a','Toko Sentosa','Jakarta','old');INSERT INTO contact(id,organization_id,customer_id,name,phone,preferred_channel) VALUES('pic','o','c','Bu Sari','+6281234567890','field');INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date) VALUES('assign','o','c','sr','field','2026-01-01');INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES('inv','o','INV','1','c','sr','a','field','2026-10-01',1000,'validated','validated');");
 const tables=['contact','customer_assignment','invoice'];const before=tables.map(t=>db.prepare('SELECT * FROM '+t).all());const customer={...db.prepare("SELECT * FROM customer_outlet WHERE id='c'").get()} as any;delete customer.account_id;
 db.exec(readFileSync('migrations/0017_remove_customer_accounts.sql','utf8'));
 assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t).all()),before);assert.deepEqual({...db.prepare("SELECT * FROM customer_outlet WHERE id='c'").get()},customer);
 assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='account'").get(),undefined);assert.ok(!(db.prepare('PRAGMA table_info(customer_outlet)').all() as any[]).some(c=>c.name==='account_id'));
 const audit=db.prepare("SELECT before_json FROM master_audit WHERE id='remove-account:old'").get() as any;assert.equal(JSON.parse(audit.before_json).name,'Legacy Legal Entity');assert.equal((db.prepare("SELECT COUNT(*) n FROM master_audit WHERE action='retire_account_relation'").get() as any).n,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>db.exec("INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('bad','o','missing','Bad')"),/INVALID_AREA/);
});
test('customer writes reject the retired account relationship',async()=>{
 const {req,outlet}=fixture();assert.equal((await req('POST','/api/customers',outlet({account_id:'old'}))).status,422);assert.equal((await req('GET','/api/accounts')).status,404);
});
