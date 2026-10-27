import {Hono} from 'hono';
import {z} from 'zod';
import {customerPredicate,invoicePredicate,type Scope} from './scope';
import type {Identity} from './auth';
type Env={Bindings:{DB:D1Database};Variables:{scope:Scope;identity:Identity}};
export const customerMasters=new Hono<Env>();
const name=z.string().trim().min(1).max(160),id=z.string().min(1).max(128);
const code=z.string().trim().min(1).max(128).transform(v=>v.toUpperCase());
export function normalizePhone(value:string){
 if(!/^[+\d\s().-]+$/.test(value))return null;
 let phone=value.replace(/[\s().-]/g,'');if(phone.startsWith('00'))phone='+'+phone.slice(2);else if(phone.startsWith('0'))phone='+62'+phone.slice(1);else if(phone.startsWith('62'))phone='+'+phone;
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
const contactInput=z.object({customer_id:id,name,phone:z.string().max(80).transform(normalizePhone).refine(v=>v!==null,'Nomor harus valid; gunakan 08… atau format +kode negara.'),contact_role:z.string().trim().max(100).default(''),preferred_channel:z.enum(['field','telesales']),permission_status:z.enum(['unknown','allowed','denied','dnc']).optional(),permission_note:z.string().trim().max(500).optional()}).strict();
const outletInput=z.object({name,address:z.string().trim().min(1).max(500),area_id:id,external_code:code.nullable().default(null),latitude_e7:z.number().int().min(-900000000).max(900000000).nullable().default(null),longitude_e7:z.number().int().min(-1800000000).max(1800000000).nullable().default(null),coordinate_status:z.enum(['missing','unverified','verified']).optional(),location_note:z.string().trim().max(500).default(''),record_status:z.enum(['active','inactive']).default('active'),outlet_type:z.string().trim().max(80).default(''),service_frequency_days:z.number().int().min(1).max(365).nullable().default(null),visit_window:z.string().trim().max(160).default('')}).strict().superRefine((v,ctx)=>{if((v.latitude_e7===null)!==(v.longitude_e7===null))ctx.addIssue({code:'custom',message:'Latitude dan longitude harus diisi berpasangan.'});if(v.coordinate_status==='missing'&&v.latitude_e7!==null)ctx.addIssue({code:'custom',message:'Koordinat yang terisi tidak boleh berstatus missing.'});if(v.coordinate_status&&v.coordinate_status!=='missing'&&v.latitude_e7===null)ctx.addIssue({code:'custom',message:'Koordinat diperlukan untuk status lokasi ini.'});if(v.coordinate_status==='verified'&&!v.location_note)ctx.addIssue({code:'custom',message:'Verifikasi lokasi manual memerlukan catatan.'})});
const tableFor={contacts:'contact',customers:'customer_outlet'} as const;
type Kind=keyof typeof tableFor;
async function visibleOutlet(db:D1Database,s:Scope,customerId:string){const f=customerPredicate(s);return db.prepare(`SELECT co.id FROM customer_outlet co WHERE co.id=? AND ${f.sql}`).bind(customerId,...f.params).first()}
function publicContact(row:any,s:Scope){const {phone,organization_id,permission_note,...rest}=row;return {...rest,...(s.orgWide?{permission_note}:{}),phone_display:s.orgWide?phone:phone.slice(0,3)+'••••'+phone.slice(-3),...(s.orgWide?{phone}:{})}}
async function list(c:any,kind:'contacts'){
 const s=c.get('scope') as Scope,f=customerPredicate(s),db=c.env.DB as D1Database;
 return (await db.prepare(`SELECT ct.*,co.name customer_name,co.id canonical_customer_id FROM contact ct LEFT JOIN customer_alias al ON al.source_id=ct.customer_id AND al.organization_id=ct.organization_id JOIN customer_outlet co ON co.id=COALESCE(al.canonical_id,ct.customer_id) AND co.organization_id=ct.organization_id WHERE ct.organization_id=? AND ${f.sql} ORDER BY ct.name,ct.id`).bind(s.identity.organization_id,...f.params).all()).results.map(row=>publicContact(row,s));
}
for(const kind of ['contacts'] as const){
 customerMasters.get('/api/'+kind,async c=>{let data=await list(c,kind);const customerId=c.req.query('customer_id');if(kind==='contacts'&&customerId)data=data.filter((x:any)=>x.customer_id===customerId||x.canonical_customer_id===customerId);return c.json({data})});
 customerMasters.get('/api/'+kind+'/:id',async c=>{const row=(await list(c,kind)).find((r:any)=>r.id===c.req.param('id')) as any;if(!row)return c.json({code:'NOT_FOUND'},404);c.header('ETag',`"${row.version}"`);return c.json({data:row})});
}
async function mutate(c:any,kind:Kind,archive=false){
 const s=c.get('scope') as Scope;if(!s.orgWide)return c.json({code:'SCOPE_DENIED'},403);
 const db=c.env.DB as D1Database,org=s.identity.organization_id;
 const key=c.req.header('Idempotency-Key');if(!key||key.length<8||key.length>128)return c.json({code:'IDEMPOTENCY_KEY_REQUIRED'},400);
 const input=await c.req.json().catch(()=>null),schema=archive?z.object({}).strict():kind==='contacts'?contactInput:outletInput;
 const valid=schema.safeParse(input);if(!valid.success)return c.json({code:'VALIDATION_ERROR',detail:valid.error.issues.map(i=>i.message).join('; ')},422);
 const body=valid.data as any,path=c.req.method+' '+c.req.path,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([body,c.req.header('If-Match')||''])))),x=>x.toString(16).padStart(2,'0')).join('');
 const lookup=()=>db.prepare('SELECT payload_hash,response_json FROM master_idempotency WHERE organization_id=? AND actor_id=? AND path=? AND key=?').bind(org,s.identity.id,path,key).first<{payload_hash:string;response_json:string}>();
 const saved=await lookup();if(saved){if(saved.payload_hash!==hash)return c.json({code:'IDEMPOTENCY_CONFLICT'},409);const result=JSON.parse(saved.response_json);c.header('ETag',`"${result.body.data.version}"`);return c.json(result.body,result.status)}
 const create=c.req.method==='POST'&&!archive,table=tableFor[kind],resourceId=create?crypto.randomUUID():c.req.param('id');
 const before=create?null:await db.prepare(`SELECT * FROM ${table} WHERE organization_id=? AND id=?`).bind(org,resourceId).first<any>();
 if(before?.merged_into_id)return c.json({code:'CUSTOMER_MERGED',detail:'Gunakan outlet yang dipertahankan.'},409);
 if(!create&&!before)return c.json({code:'NOT_FOUND'},404);
 if(!create){if(!c.req.header('If-Match'))return c.json({code:'PRECONDITION_REQUIRED'},428);if(c.req.header('If-Match')!==`"${before.version}"`)return c.json({code:'VERSION_CONFLICT'},412);if(before.status==='archived')return c.json({code:'RESOURCE_ARCHIVED'},409)}
 let fields:Record<string,any>;
 if(archive){fields={status:'archived'}}
 else if(kind==='customers'){
  if(!await db.prepare("SELECT id FROM area WHERE organization_id=? AND id=? AND status='active'").bind(org,body.area_id).first())return c.json({code:'INVALID_AREA'},422);
  if(before&&before.area_id!==body.area_id&&await db.prepare('SELECT id FROM customer_assignment WHERE organization_id=? AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=? AND (id=? OR merged_into_id=?)) UNION ALL SELECT id FROM invoice WHERE organization_id=? AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=? AND (id=? OR merged_into_id=?)) UNION ALL SELECT id FROM target_item WHERE organization_id=? AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=? AND (id=? OR merged_into_id=?)) LIMIT 1').bind(org,org,resourceId,resourceId,org,org,resourceId,resourceId,org,org,resourceId,resourceId).first())return c.json({code:'AREA_TRANSFER_REQUIRES_ASSIGNMENT_WORKFLOW',detail:'Outlet yang sudah memiliki assignment/transaksi memerlukan alur transfer territory.'},409);
  if(before?.external_code?.trim()&&before.external_code.trim().toUpperCase()!==body.external_code&&await db.prepare('SELECT source_id FROM customer_alias WHERE organization_id=? AND canonical_id=? LIMIT 1').bind(org,resourceId).first())return c.json({code:'MERGED_CODE_CHANGE_REQUIRES_REVIEW',detail:'Kode ERP outlet hasil merge harus dipertahankan agar identitas sumber tidak hilang.'},409);
  if(body.external_code&&await db.prepare('SELECT id FROM customer_outlet WHERE organization_id=? AND UPPER(TRIM(external_code))=? AND id<>? AND (merged_into_id IS NULL OR merged_into_id<>?) LIMIT 1').bind(org,body.external_code,resourceId,resourceId).first())return c.json({code:'EXTERNAL_CODE_EXISTS',detail:'Kode ERP outlet sudah dipakai dalam organisasi ini.'},409);
  fields={...body,coordinate_status:body.coordinate_status||(body.latitude_e7===null?'missing':'unverified'),external_code_key:body.external_code,external_code_review:0};
 }else if(kind==='contacts'){
  const original=await db.prepare('SELECT id,record_status,merged_into_id FROM customer_outlet WHERE organization_id=? AND id=?').bind(org,body.customer_id).first<any>();
  if(!original)return c.json({code:'INVALID_CUSTOMER'},422);
  if(create&&original.merged_into_id)return c.json({code:'CUSTOMER_MERGED'},409);
  const canonical=original.merged_into_id?await db.prepare('SELECT record_status FROM customer_outlet WHERE organization_id=? AND id=?').bind(org,original.merged_into_id).first<any>():original;
  if(canonical?.record_status!=='active')return c.json({code:'INVALID_CUSTOMER'},422);
  if(before&&body.customer_id!==before.customer_id)return c.json({code:'CONTACT_CUSTOMER_IMMUTABLE',detail:'Kontak tetap terikat outlet asal. Buat kontak pada outlet baru agar histori tetap jelas.'},409);
  const changedPhone=before&&before.phone!==body.phone;
  fields={...body,permission_status:changedPhone?'unknown':body.permission_status??before?.permission_status??'unknown',permission_note:changedPhone?'':body.permission_note??before?.permission_note??''};
  if(fields.permission_status!=='unknown'&&!fields.permission_note)return c.json({code:'PERMISSION_NOTE_REQUIRED',detail:'Catat alasan/sumber pengaturan izin kontak.'},422);
  if(before&&fields.permission_status!==before.permission_status&&fields.permission_status!=='unknown'&&!body.permission_note)return c.json({code:'PERMISSION_NOTE_REQUIRED'},422);
 }else fields={...body};
 const after={...before,...fields,id:resourceId,organization_id:org,version:create?1:before.version+1,...(create&&kind!=='customers'?{status:'active'}:{})};
 const exposed=kind==='contacts'?publicContact(after,s):after,response={data:exposed},status=create?201:200;
 const cols=Object.keys(fields),statement=create?db.prepare(`INSERT INTO ${table}(id,organization_id,${cols.join(',')}) VALUES(?,?,${cols.map(()=>'?').join(',')})`).bind(resourceId,org,...Object.values(fields)):db.prepare(`UPDATE ${table} SET ${cols.map(col=>col+'=?').join(',')},version=version+1 WHERE id=? AND organization_id=? AND version=?`).bind(...Object.values(fields),resourceId,org,before.version);
 try{await db.batch([statement,db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard'),db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),org,s.identity.id,kind,resourceId,archive?'archive':create?'create':'update',new Date().toISOString(),before?JSON.stringify(before):null,JSON.stringify(after)),db.prepare('INSERT INTO master_idempotency VALUES(?,?,?,?,?,?)').bind(org,s.identity.id,path,key,hash,JSON.stringify({body:response,status}))])}catch{
  const replay=await lookup();if(replay?.payload_hash===hash){const result=JSON.parse(replay.response_json);c.header('ETag',`"${result.body.data.version}"`);return c.json(result.body,result.status)}
  return c.json({code:replay?'IDEMPOTENCY_CONFLICT':'CUSTOMER_MASTER_CONFLICT',detail:'Data berubah, kode sudah digunakan, atau relasi tidak valid. Muat ulang dan periksa kembali.'},409);
 }
 c.header('ETag',`"${after.version}"`);return c.json(response,status);
}
for(const kind of Object.keys(tableFor) as Kind[]){customerMasters.post('/api/'+kind,c=>mutate(c,kind));customerMasters.put('/api/'+kind+'/:id',c=>mutate(c,kind));if(kind!=='customers')customerMasters.post('/api/'+kind+'/:id/archive',c=>mutate(c,kind,true))}
customerMasters.get('/api/customers/:id/timeline',async c=>{
 const s=c.get('scope'),db=c.env.DB,requested=c.req.param('id');const alias=await db.prepare('SELECT canonical_id FROM customer_alias WHERE organization_id=? AND source_id=?').bind(s.identity.organization_id,requested).first<{canonical_id:string}>();const id=alias?.canonical_id||requested;if(!await visibleOutlet(db,s,id))return c.json({code:'NOT_FOUND'},404);
 const inv=invoicePredicate(s);const invoices=await db.prepare(`SELECT i.id,'invoice' kind,i.created_at occurred_at,i.invoice_date,i.source_invoice_id label,i.net_minor amount FROM invoice i WHERE i.outlet_id IN(SELECT id FROM customer_outlet WHERE (id=? OR merged_into_id=?) AND organization_id=?) AND ${inv.sql} AND i.status='validated' AND i.validation_state='validated' ORDER BY i.created_at DESC,i.id LIMIT 101`).bind(id,id,s.identity.organization_id,...inv.params).all();
 const filter=s.orgWide||s.allRepsInArea?'':` AND user_id IN (${s.repIds.map(()=>'?').join(',')})`;const activities=await db.prepare(`SELECT id,activity_kind kind,occurred_at,notes label FROM activity WHERE organization_id=? AND outlet_id IN(SELECT id FROM customer_outlet WHERE (id=? OR merged_into_id=?) AND organization_id=?)${filter}${s.channel?' AND channel=?':''} ORDER BY occurred_at DESC,id LIMIT 101`).bind(s.identity.organization_id,id,id,s.identity.organization_id,...(s.orgWide||s.allRepsInArea?[]:s.repIds),...(s.channel?[s.channel]:[])).all();
 const audit=await db.prepare("SELECT id,'master' kind,occurred_at,CASE WHEN action LIKE '%/assignments' THEN 'Penugasan diperbarui' WHEN action='territory_effective' THEN 'Transfer area berlaku' ELSE action END label FROM master_audit WHERE organization_id=? AND resource_type='customers' AND resource_id IN(SELECT id FROM customer_outlet WHERE (id=? OR merged_into_id=?) AND organization_id=?) ORDER BY occurred_at DESC,id LIMIT 101").bind(s.identity.organization_id,id,id,s.identity.organization_id).all();
 const workEvents:any[]=[];for(const [table,kind,time,label] of [['sales_task','task','due_at',"title||' · '||status"],['sales_order','order','created_at',"'Order '||status||' (bukan actual)'"],['sales_lead','pipeline','stage_changed_at',"need||' · '||stage||' · next: '||next_action"],['forecast_contribution','forecast','created_at',"category||' · '||view_kind||' · '||reason"]]){const hasChannel=table!=='sales_lead';const rows=await db.prepare(`SELECT id,? kind,${time} occurred_at,${label} label FROM ${table} WHERE organization_id=? AND customer_id IN(SELECT id FROM customer_outlet WHERE organization_id=? AND (id=? OR merged_into_id=?))${filter}${s.channel&&hasChannel?' AND channel=?':''} ORDER BY ${time} DESC,id LIMIT 101`).bind(kind,s.identity.organization_id,s.identity.organization_id,id,id,...(s.orgWide||s.allRepsInArea?[]:s.repIds),...(s.channel&&hasChannel?[s.channel]:[])).all();workEvents.push(...rows.results)}
 const events=[...invoices.results,...activities.results,...audit.results,...workEvents].map((event:any)=>{const raw=String(event.occurred_at),instant=Date.parse(raw.includes(' ')?raw.replace(' ','T')+'Z':raw);return {...event,occurred_at:Number.isFinite(instant)?new Date(instant).toISOString():raw}}).sort((a:any,b:any)=>String(b.occurred_at).localeCompare(String(a.occurred_at))||String(a.id).localeCompare(String(b.id)));
 return c.json({data:events.slice(0,100),meta:{has_more:events.length>100}});
});
