import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from '../tests/sqlite-helper';
import {scopedRoutes} from '../src/server/index';
import {digest} from '../src/server/operations';

/** Separate-process rehearsal, injected identities and explicit business clock.
 * Never adds an authentication bypass to the running application. */
export async function pilotOperations(output:string,seed='pilot/local-20261021-v3/seed.sql'){
 const dir=resolve(output);mkdirSync(dir,{recursive:false});
 const {sqlite,adapter}=database();sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(readFileSync(seed,'utf8'));
 const NativeDate=Date,clock='2026-10-21T03:00:00.000Z';
 class PilotDate extends NativeDate{constructor(value?:any){super(arguments.length?value:clock)}static now(){return NativeDate.parse(clock)}}
 globalThis.Date=PilotDate as DateConstructor;
 const events:any[]=[],objects=new Map<string,Uint8Array>();
 const bucket={put:async(k:string,v:any)=>{objects.set(k,typeof v==='string'?new TextEncoder().encode(v):new Uint8Array(v));return{}},get:async(k:string)=>objects.has(k)?{arrayBuffer:async()=>objects.get(k)!.slice().buffer,body:new Blob([objects.get(k)!.slice().buffer]).stream()}:null,delete:async(k:string)=>objects.delete(k)} as unknown as R2Bucket;
 const tables=(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[]).map(r=>r.name);
 const keys=(table:string)=>(sqlite.prepare(`PRAGMA table_info("${table}")`).all() as any[]).filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
 const key=(row:any,pk:string[])=>JSON.stringify(pk.map(k=>row[k]));
 const before=new Map(tables.map(t=>[t,new Set((sqlite.prepare(`SELECT * FROM "${t}"`).all() as any[]).map(r=>key(r,keys(t))))]));
 const invoicesBefore=JSON.stringify(sqlite.prepare('SELECT * FROM invoice ORDER BY id').all());
 async function req(actor:string,method:string,path:string,body?:any,version?:number,expected=200,idempotency=crypto.randomUUID()){
  const u=sqlite.prepare('SELECT u.*,r.role_code role,r.channel FROM app_user u JOIN auth_role_assignment r ON r.user_id=u.id AND r.organization_id=u.organization_id WHERE u.id=?').get(actor) as any;
  assert.ok(u,'known synthetic actor');const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:u.id,name:u.name,role:u.role,channel:u.channel,organization_id:u.organization_id} as never);await next()});app.route('/',scopedRoutes);
  const response=await app.request(path,{method,headers:{'Content-Type':body instanceof ArrayBuffer?'application/pdf':'application/json','Idempotency-Key':idempotency,...(version?{'If-Match':`"${version}"`}:{})},...(body!==undefined?{body:body instanceof ArrayBuffer?body:JSON.stringify(body)}:{})},{DB:adapter,IMPORT_FILES:bucket,APP_ENV:'local',LOCAL_AUTH:'true'});
  const result=await response.json() as any;events.push({actor,method,path,status:response.status,expected});assert.equal(response.status,expected,path+': '+JSON.stringify(result));return result.data;
 }
 try{
  const mg='demo-management',field='demo-sales-01',tele='demo-sales-09';
  for(let i=1;i<=8;i++){
   const actor=`demo-sales-${String(i).padStart(2,'0')}`,customer=`demo-store-${String(i*2-1).padStart(2,'0')}`;
   const co=sqlite.prepare('SELECT * FROM customer_outlet WHERE id=?').get(customer) as any;
   const session=await req(actor,'POST','/api/work-sessions',{kind:'work',reason:'Simulasi pilot; bukan kehadiran nyata'},undefined,201);
   const activity=await req(actor,'POST','/api/activities',{customer_id:customer,kind:'visit',notes:'Kunjungan sintetis pilot'},undefined,201);
   const checkin={occurred_at:'2026-10-21T02:50:00.000Z',latitude_e7:co.latitude_e7,longitude_e7:co.longitude_e7,accuracy_cm:1000,source:'browser_gps',notes:'Koordinat simulasi, bukan sensor perangkat'};
   const replay=crypto.randomUUID();await req(actor,'POST',`/api/visits/${activity.id}/check-in`,checkin,1,200,replay);await req(actor,'POST',`/api/visits/${activity.id}/check-in`,checkin,1,200,replay);
   await req(actor,'POST',`/api/work-sessions/${session.id}/end`,{},1,409);
   await req(actor,'POST',`/api/visits/${activity.id}/check-out`,{...checkin,occurred_at:clock,outcome:i<=6?'productive':'closed',notes:'Hasil kunjungan simulasi'+(i>6?': toko tutup':''),...(i>6?{next_action:{title:'Kunjungan ulang simulasi',due_at:'2026-10-22T03:00:00.000Z'}}:{})},2);
   if(i===1){
    const bytes=new TextEncoder().encode('%PDF-1.7\n% NYALES synthetic pilot attachment. No customer evidence.\n%%EOF').buffer,sha256=await digest(bytes);
    const intent=await req(actor,'POST','/api/attachment-intents',{activity_id:activity.id,size:bytes.byteLength,mime:'application/pdf',sha256},undefined,201);
    await req(actor,'PUT',intent.upload_path,bytes);await req(actor,'POST',`/api/attachments/${intent.id}/finalize`,{},1);
   }
   await req(actor,'POST',`/api/work-sessions/${session.id}/end`,{},1);
  }
  const campaign=await req(mg,'POST','/api/campaigns',{name:'Simulasi pilot · jangan hubungi nomor dummy',start_time:'08:00',end_time:'18:00',max_attempts:3,lease_seconds:300,hold_active_visit:true},undefined,201);
  const script=await req(mg,'POST','/api/scripts',{campaign_id:campaign.id,name:'Skrip latihan',content:'Simulasi internal tanpa panggilan provider.',qualification:['Kebutuhan']},undefined,201);
  for(let i=17;i<=20;i++){
   const actor=i<19?tele:'demo-sales-10',customer=`demo-store-${i}`;
   const contact=await req(mg,'POST','/api/contacts',{customer_id:customer,name:'PIC Demo '+i,phone:'+6200000000'+i,preferred_channel:'telesales',permission_status:'allowed',permission_note:'Izin simulasi internal, bukan persetujuan orang nyata'},undefined,201);
   const claim={customer_id:customer,contact_id:contact.id,campaign_id:campaign.id,script_id:script.id};
   const lease=await req(actor,'POST','/api/telesales/queue/claim',claim,undefined,201);assert.equal(lease.connection_verified,false);
   await req(actor,'POST','/api/telesales/queue/claim',claim,undefined,409);
   if(i<=18)await req(actor,'POST',`/api/telesales/queue/${lease.id}/complete`,{disposition:'connected_pic',notes:'Simulasi tanpa qualification'},1,422);
   await req(actor,'POST',`/api/telesales/queue/${lease.id}/complete`,{disposition:i<=18?'connected_pic':i===19?'callback':'dnc',notes:'Hasil telepon simulasi; tidak ada telepon keluar',qualification:{Kebutuhan:'Stok simulasi'},...(i===19?{callback_at:'2026-10-22T04:00:00.000Z'}:{})},1);
   if(i===20)await req(actor,'POST','/api/telesales/queue/claim',claim,undefined,409);
  }
  const summary=await req(mg,'GET','/api/dashboard/summary?period=2026-10');
  assert.equal(summary.activity_count,12);assert.equal(summary.meaningful_count,8);assert.equal(summary.covered_customer_count,8);assert.equal(summary.coverage_percent,40);assert.equal(summary.declared_connected_pic,2);assert.equal(summary.verified_connections,null);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),invoicesBefore);
  const roleChecks:any[]=[];
  for(const [actor,count] of [[mg,20],['demo-reviewer',20],[field,20],[tele,2],['spv-field',16],['spv-telesales',4],['am-field',20]] as [string,number][]){
   const rows=await req(actor,'GET','/api/customers');assert.equal(rows.length,count);roleChecks.push({actor,customers:count});
   if(![mg,'demo-reviewer'].includes(actor))await req(actor,'POST','/api/campaigns',{name:'Denied change'},undefined,403);
  }
  await req(field,'POST','/api/activities',{customer_id:'demo-store-03',kind:'visit'},undefined,422);
  await req(tele,'GET','/api/customers/demo-store-01',undefined,undefined,404);
  // Only append new operational records. Existing financial/master rows cannot
  // be updated by this export; applied marker prevents accidental duplicate runs.
  const literal=(v:any)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
  const delta=["INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,after_json) VALUES('pilot-operations-v1','demo-org','demo-management','demo_fixture','pilot-operations-v1','synthetic_operations','2026-10-21T03:00:00Z','{}');"];
  const counts:Record<string,number>={};
  for(const table of tables){if(['customer_segmentation_run','customer_status_snapshot'].includes(table))continue;const pk=keys(table);if(!pk.length)continue;const added=(sqlite.prepare(`SELECT * FROM "${table}"`).all() as any[]).filter(r=>!before.get(table)!.has(key(r,pk)));if(added.length)counts[table]=added.length;for(const row of added){const cols=Object.keys(row);delta.push(`INSERT INTO "${table}"(${cols.map(c=>'"'+c+'"').join(',')}) VALUES(${cols.map(c=>literal(row[c])).join(',')});`)}}
  writeFileSync(resolve(dir,'operations.sql'),delta.join('\n')+'\n',{flag:'wx'});
  const attachment=sqlite.prepare("SELECT id,storage_key,sha256,size FROM evidence_attachment WHERE status='ready'").get() as any;
  assert.ok(attachment);writeFileSync(resolve(dir,'attachment.pdf'),objects.get(attachment.storage_key)!,{flag:'wx'});
  // Negative controls are rehearsal-only and never appear in the live seed.
  sqlite.exec("INSERT INTO area(id,organization_id,name,branch_id) VALUES('negative-area','demo-org','Outside test area','demo-branch');INSERT INTO customer_outlet(id,organization_id,area_id,name,address) VALUES('negative-customer','demo-org','negative-area','Negative control','Synthetic');");
  const areaRows=await req('am-field','GET','/api/customers');assert.equal(areaRows.length,20);assert.ok(!areaRows.some((r:any)=>r.id==='negative-customer'));await req('am-field','GET','/api/customers/negative-customer',undefined,undefined,404);
  const report={classification:'synthetic',status:'operational_rehearsal_passed',simulated_clock:clock,auth:'injected scoped-route identities; no Firebase/browser role login proof',counts,role_checks:roleChecks,activities:12,meaningful:8,covered_customers:8,coverage_percent:40,manual_pic_connections:2,provider_verified_connections:null,sales_positions:8,invoice_values_unchanged:true,scope_negative_controls_passed:true,attachment:{...attachment,file:'attachment.pdf',synthetic_bytes:true},human_training_completed:false,production_accepted:false};
  writeFileSync(resolve(dir,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});writeFileSync(resolve(dir,'api-events.json'),JSON.stringify(events,null,2)+'\n',{flag:'wx'});return report;
 }finally{globalThis.Date=NativeDate;sqlite.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const output=process.argv[2];if(!output)throw Error('Provide a new output folder');await pilotOperations(output);console.log('Synthetic operations rehearsal passed; incremental seed prepared.');}
