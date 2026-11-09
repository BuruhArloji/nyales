import {readRecoveryBytes,verifyRecoveryObjects,recoveryObjectLimits} from './recovery-objects';
import {Hono} from 'hono';
import {z} from 'zod';
import {digest,fail,operation,guard,type OperationEnv} from './operations';

export const recovery=new Hono<OperationEnv>();
const org=(c:any)=>c.get('identity').organization_id;
const reason=z.string().trim().min(3).max(500);
const id=z.string().trim().min(1).max(128);
const now=()=>new Date().toISOString();
const MANIFEST_MAX_BYTES=50*1024*1024;
const drillInput=z.object({manifest_id:id,notes:reason,verify_objects:z.boolean().optional()}).strict();
const holdInput=z.object({resource_type:z.enum(['customer','invoice','activity','attachment','report_export','backup','privacy_subject']),resource_id:id,reason}).strict();
const releaseInput=z.object({reason}).strict();
const privacyInput=z.object({subject_type:z.enum(['customer','user','contact','privacy_subject']),subject_id:id,request_kind:z.enum(['access','correction','erasure']),reason}).strict();
const reviewInput=z.object({status:z.enum(['approved','rejected','completed']),outcome:reason}).strict();
const rollbackInput=z.object({migration_id:id,reason}).strict();
const BACKUP_TABLES=['visit_location_policy','customer_proposal','organization','branch','area','app_user','auth_role_assignment','user_area_scope','reporting_assignment','customer_outlet','customer_assignment','contact','product_group','product','invoice','invoice_line','activity','visit_off_day','visit_event','sales_task','sales_order','target_plan','target_version','target_item','in_app_notification','device_outbox','report_export','evidence_attachment','ops_policy','ops_usage_snapshot','retention_hold','privacy_request','recovery_policy','admin_boundary_dataset','admin_boundary_chunk','admin_unit','admin_boundary','area_admin_membership','village_sales_owner','customer_admin_location','geo_distribution_epoch','geo_distribution_run','customer_risk_policy_version','customer_risk_run','workload_policy_version','territory_scenario','territory_scenario_revision','territory_scenario_application','visit_generator_agent','visit_generator_pairing','visit_generator_credential','visit_generator_agent_event','visit_agent_queue_job','visit_agent_queue_attempt','visit_agent_queue_event','visit_generator_policy_version','visit_generator_graph_release','visit_planning_revision','visit_planning_preflight','visit_rep_planning_profile','visit_customer_planning_profile'];

function admin(c:any){return Boolean(c.get('scope')?.orgWide)}
function adminGate(c:any){if(!admin(c))fail(403,'SCOPE_DENIED')}
function tableName(value:string){return /^[a-z_][a-z0-9_]*$/.test(value)}
async function tableExists(db:D1Database,name:string){return Boolean(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first())}
async function rows(db:D1Database,name:string,organization:string){
 if(!BACKUP_TABLES.includes(name)||!tableName(name))fail(422,'INVALID_BACKUP_TABLE');
 if(!(await tableExists(db,name)))return [];
 try{return(await db.prepare(`SELECT * FROM ${name} WHERE ${name==='organization'?'id':'organization_id'}=?`).bind(organization).all<any>()).results}catch{fail(503,'BACKUP_SOURCE_UNAVAILABLE')}
}
function versionMatch(c:any,r:any){if(!c.req.header('If-Match'))fail(428,'IF_MATCH_REQUIRED');if(c.req.header('If-Match')!==`"${r.version}"`)fail(412,'VERSION_CONFLICT')}
function redact(name:string,row:any){if(name==='device_session')return null;return row}
async function buildPayload(c:any,kind:'logical'|'attachment_metadata'){
 const db=c.env.DB as D1Database,organization=org(c),tables=kind==='attachment_metadata'?['evidence_attachment']:BACKUP_TABLES;
 const payload:any={format:'nyales-recovery-v1',kind,organization_id:organization,created_at:now(),schema_version:'0045',tables:{},attachments:{count:0,bytes:0,rows:[]},risk_snapshots:{count:0,bytes:0,rows:[]},scenario_snapshots:{count:0,bytes:0,rows:[]},visit_readiness_snapshots:{count:0,bytes:0,rows:[]}};
 let count=0;
 for(const name of tables){const values=(await rows(db,name,organization)).map(r=>redact(name,r)).filter(Boolean);payload.tables[name]=values;count+=values.length;if(name==='evidence_attachment'){payload.attachments.rows=values.map((r:any)=>({id:r.id,storage_key:r.storage_key,size:r.size,mime:r.mime,sha256:r.sha256,status:r.status}));payload.attachments.count=values.length;payload.attachments.bytes=values.reduce((n:number,r:any)=>n+Number(r.size||0),0)}}
 if(kind==='logical'){payload.risk_snapshots.rows=(payload.tables.customer_risk_run||[]).map((r:any)=>({id:r.id,storage_key:r.storage_key,size:r.byte_count,sha256:r.snapshot_sha256}));payload.risk_snapshots.count=payload.risk_snapshots.rows.length;payload.risk_snapshots.bytes=payload.risk_snapshots.rows.reduce((n:number,r:any)=>n+r.size,0)}
 if(kind==='logical'){payload.scenario_snapshots.rows=(payload.tables.territory_scenario_revision||[]).map((r:any)=>({id:r.id,storage_key:r.storage_key,size:r.byte_count,sha256:r.snapshot_sha256}));payload.scenario_snapshots.count=payload.scenario_snapshots.rows.length;payload.scenario_snapshots.bytes=payload.scenario_snapshots.rows.reduce((n:number,r:any)=>n+r.size,0)}
 if(kind==='logical'){payload.visit_readiness_snapshots.rows=(payload.tables.visit_planning_preflight||[]).map((r:any)=>({id:r.id,storage_key:r.storage_key,size:r.byte_count,sha256:r.snapshot_sha256}));payload.visit_readiness_snapshots.count=payload.visit_readiness_snapshots.rows.length;payload.visit_readiness_snapshots.bytes=payload.visit_readiness_snapshots.rows.reduce((n:number,r:any)=>n+r.size,0)}
 const body=JSON.stringify(payload);const byteCount=new TextEncoder().encode(body).byteLength;if(byteCount>MANIFEST_MAX_BYTES)fail(422,'BACKUP_BYTES_LIMIT');return{payload,body,count,byteCount,attachmentCount:payload.attachments.count,attachmentBytes:payload.attachments.bytes}
}
async function manifest(c:any,idValue:string){const db=c.env.DB as D1Database;return db.prepare('SELECT * FROM recovery_manifest WHERE organization_id=? AND id=?').bind(org(c),idValue).first<any>()}
async function policy(c:any){const db=c.env.DB as D1Database;return db.prepare('SELECT * FROM recovery_policy WHERE organization_id=?').bind(org(c)).first<any>()}

recovery.get('/api/recovery/summary',async c=>{adminGate(c);const db=c.env.DB as D1Database;const [p,m,d,h,q]=await Promise.all([policy(c),db.prepare('SELECT id,kind,created_at,cutoff_at,row_count,byte_count,sha256,attachment_count,attachment_bytes,status,expires_at FROM recovery_manifest WHERE organization_id=? ORDER BY created_at DESC LIMIT 20').bind(org(c)).all(),db.prepare('SELECT * FROM recovery_drill WHERE organization_id=? ORDER BY started_at DESC LIMIT 20').bind(org(c)).all(),db.prepare("SELECT * FROM retention_hold WHERE organization_id=? AND status='active' ORDER BY created_at DESC LIMIT 200").bind(org(c)).all(),db.prepare('SELECT * FROM privacy_request WHERE organization_id=? ORDER BY created_at DESC LIMIT 200').bind(org(c)).all()]);return c.json({data:{policy:p,manifests:m.results,drills:d.results,holds:h.results,privacy_requests:q.results,limits:{object_verification:recoveryObjectLimits,max_backup_bytes:MANIFEST_MAX_BYTES,backup_rows:'bounded by byte limit',rpo_target_minutes:p?.rpo_minutes??15,rto_target_minutes:p?.rto_minutes??240}}})});

const policyInput=z.object({backup_interval_minutes:z.number().int().min(5).max(1440),rpo_minutes:z.number().int().min(1).max(1440),rto_minutes:z.number().int().min(1).max(1440),retention_days:z.number().int().min(1).max(3650),gps_detail_days:z.number().int().min(1).max(365),attachment_days:z.number().int().min(1).max(3650),backup_days:z.number().int().min(1).max(3650),legal_hold_required:z.boolean(),reason}).strict();
recovery.post('/api/recovery/policy',async c=>{adminGate(c);const input=policyInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_RECOVERY_POLICY'},422);return operation(c,input.data,async()=>{const before=await policy(c);if(before)versionMatch(c,before);const version=(before?.version||0)+1,data={id:org(c),version,...input.data,legal_hold_required:input.data.legal_hold_required?1:0,updated_at:now(),updated_by:c.get('identity').id};return{resource:'recovery-policy',before,data,statements:guard(c.env.DB,c.env.DB.prepare('INSERT INTO recovery_policy VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET backup_interval_minutes=excluded.backup_interval_minutes,rpo_minutes=excluded.rpo_minutes,rto_minutes=excluded.rto_minutes,retention_days=excluded.retention_days,gps_detail_days=excluded.gps_detail_days,attachment_days=excluded.attachment_days,backup_days=excluded.backup_days,legal_hold_required=excluded.legal_hold_required,version=excluded.version,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE recovery_policy.version=excluded.version-1').bind(org(c),data.backup_interval_minutes,data.rpo_minutes,data.rto_minutes,data.retention_days,data.gps_detail_days,data.attachment_days,data.backup_days,data.legal_hold_required,version,data.updated_at,data.updated_by))}})});

const backupInput=z.object({kind:z.enum(['logical','attachment_metadata']),reason}).strict();
recovery.post('/api/recovery/backups',async c=>{adminGate(c);const input=backupInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_BACKUP_REQUEST'},422);return operation(c,input.data,async()=>{if(!c.env.IMPORT_FILES)fail(503,'PRIVATE_STORAGE_UNAVAILABLE');const built=await buildPayload(c,input.data.kind),idValue=crypto.randomUUID(),checksum=await digest(built.body),created=now(),p=await policy(c),expires=new Date(Date.now()+Number(p?.backup_days||35)*86400000).toISOString(),key=org(c)+'/recovery/'+idValue+'.json';await c.env.IMPORT_FILES!.put(key,built.body,{httpMetadata:{contentType:'application/json'}});const data={id:idValue,kind:input.data.kind,created_at:created,cutoff_at:created,schema_version:'0045',row_count:built.count,byte_count:built.byteCount,sha256:checksum,attachment_count:built.attachmentCount,attachment_bytes:built.attachmentBytes,status:'ready',expires_at:expires};return{resource:'recovery-manifest',data,statements:[c.env.DB.prepare('INSERT INTO recovery_manifest VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(idValue,org(c),data.kind,key,created,created,data.schema_version,data.row_count,data.byte_count,data.sha256,data.attachment_count,data.attachment_bytes,data.status,c.get('identity').id,expires,JSON.stringify({reason:input.data.reason,format:'nyales-recovery-v1'}))]}})});

recovery.post('/api/recovery/drills',async c=>{
 adminGate(c);const input=drillInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_RESTORE_DRILL'},422);
 const m=await manifest(c,input.data.manifest_id);if(!m)return c.json({code:'RECOVERY_MANIFEST_NOT_FOUND'},404);
 const started=now(),drillId=crypto.randomUUID();let status='passed',checksumMatch=0,rowCount=0,attachmentCount=0;
 const reconciliation:Record<string,any>={};
 try{
  if(input.data.verify_objects&&m.byte_count>recoveryObjectLimits.max_source_manifest_bytes)fail(422,'RECOVERY_OBJECT_MANIFEST_LIMIT');
  if(!Number.isSafeInteger(m.byte_count)||m.byte_count<1||m.byte_count>MANIFEST_MAX_BYTES)fail(422,'RECOVERY_MANIFEST_BYTES_LIMIT');
  const stored=await c.env.IMPORT_FILES?.get(m.storage_key);if(!stored)fail(404,'RECOVERY_OBJECT_MISSING');
  const bytes=await readRecoveryBytes(stored,Number(m.byte_count)),body=new TextDecoder('utf-8',{fatal:true}).decode(bytes),actual=await digest(body);
  if(actual!==m.sha256)fail(422,'RECOVERY_CHECKSUM_MISMATCH');
  const parsed=JSON.parse(body);
  if(parsed.format!=='nyales-recovery-v1'||parsed.organization_id!==org(c)||parsed.kind!==m.kind||!parsed.tables||typeof parsed.tables!=='object'||Array.isArray(parsed.tables))fail(422,'RECOVERY_PAYLOAD_INVALID');
  for(const [name,values]of Object.entries(parsed.tables)){
   if(!BACKUP_TABLES.includes(name)||!Array.isArray(values)||values.some((r:any)=>!r||typeof r!=='object'||(name==='organization'?r.id:r.organization_id)!==org(c)))fail(422,'RECOVERY_PAYLOAD_INVALID');
   reconciliation[name]={backup_rows:values.length,current_rows:(await rows(c.env.DB,name,org(c))).length};rowCount+=values.length;
  }
  attachmentCount=Number(parsed.attachments?.count||0);
  if(rowCount!==m.row_count||attachmentCount!==m.attachment_count||bytes.byteLength!==m.byte_count)fail(422,'RECOVERY_MANIFEST_MISMATCH');
  checksumMatch=1;
  if(input.data.verify_objects){
   try{reconciliation.objects=await verifyRecoveryObjects(c.env.IMPORT_FILES,parsed.tables,org(c));if(reconciliation.objects.status!=='passed')status='failed'}
   catch(error){status='failed';const code=(error as Error).message;reconciliation.objects={status:'failed',error:/^RECOVERY_[A-Z_]+$/.test(code)?code:'RECOVERY_OBJECT_VERIFICATION_FAILED',actual_restore_performed:false}}
  }else reconciliation.objects={status:'not_requested',actual_restore_performed:false};
 }catch(error){status='failed';const code=(error as Error).message.replace(/^\d+:/,'');reconciliation.error=/^RECOVERY_[A-Z_]+$/.test(code)?code:'RECOVERY_PAYLOAD_UNREADABLE'}
 const finished=now();
 await c.env.DB.prepare('INSERT INTO recovery_drill VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(drillId,org(c),m.id,started,finished,status,rowCount,attachmentCount,checksumMatch,JSON.stringify(reconciliation),c.get('identity').id,input.data.notes).run();
 return c.json({...(status==='failed'?{code:'RECOVERY_DRILL_FAILED',detail:'Pemeriksaan backup belum lulus. Lihat rincian hasil uji untuk mengetahui berkas atau metadata yang perlu diperbaiki.'}:{}),data:{id:drillId,manifest_id:m.id,status,checksum_match:Boolean(checksumMatch),row_count:rowCount,attachment_count:attachmentCount,reconciliation,actual_restore_performed:false}},status==='passed'?200:422);
});

recovery.post('/api/recovery/holds',async c=>{
 adminGate(c);const input=holdInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_RETENTION_HOLD'},422);
 return operation(c,input.data,async()=>{
  const data={id:crypto.randomUUID(),...input.data,status:'active',created_at:now(),created_by:c.get('identity').id,version:1};
  if(data.resource_type==='report_export'){
   const report=await c.env.DB.prepare('SELECT status FROM report_export WHERE organization_id=? AND id=?').bind(org(c),data.resource_id).first<any>();
   if(!report)fail(404,'REPORT_NOT_FOUND');if(report.status!=='ready')fail(409,'REPORT_RETENTION_STARTED');
  }
  return{resource:'retention-hold',data,statements:guard(c.env.DB,c.env.DB.prepare("INSERT INTO retention_hold SELECT ?,?,?,?,?,?,?,NULL,?,NULL,? WHERE ?<>'report_export' OR EXISTS(SELECT 1 FROM report_export WHERE organization_id=? AND id=? AND status='ready')").bind(data.id,org(c),data.resource_type,data.resource_id,data.reason,data.status,data.created_at,data.created_by,data.version,data.resource_type,org(c),data.resource_id))};
 });
});
recovery.post('/api/recovery/holds/:id/release',async c=>{
 adminGate(c);const input=releaseInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_RETENTION_RELEASE'},422);
 return operation(c,{...input.data,id:c.req.param('id')},async()=>{
  const h=await c.env.DB.prepare("SELECT * FROM retention_hold WHERE organization_id=? AND id=? AND status='active'").bind(org(c),c.req.param('id')).first<any>();if(!h)fail(404,'RETENTION_HOLD_NOT_FOUND');versionMatch(c,h);
  const data={...h,status:'released',released_at:now(),released_by:c.get('identity').id,version:Number(h.version)+1};
  return{resource:'retention-hold',before:h,data,statements:guard(c.env.DB,c.env.DB.prepare("UPDATE retention_hold SET status='released',released_at=?,released_by=?,version=? WHERE organization_id=? AND id=? AND version=? AND status='active'").bind(data.released_at,data.released_by,data.version,org(c),h.id,h.version))};
 });
});

recovery.post('/api/recovery/privacy-requests',async c=>{adminGate(c);const input=privacyInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_PRIVACY_REQUEST'},422);return operation(c,input.data,async()=>{const data={id:crypto.randomUUID(),...input.data,status:'pending_review',created_at:now(),requested_by:c.get('identity').id,version:1};return{resource:'privacy-request',data,statements:[c.env.DB.prepare('INSERT INTO privacy_request VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(data.id,org(c),data.subject_type,data.subject_id,data.request_kind,data.reason,data.status,data.created_at,data.requested_by,null,null,null,data.version)]}})});
recovery.post('/api/recovery/privacy-requests/:id/review',async c=>{
 adminGate(c);const input=reviewInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_PRIVACY_REVIEW'},422);
 return operation(c,{...input.data,id:c.req.param('id')},async()=>{
  const r=await c.env.DB.prepare('SELECT * FROM privacy_request WHERE organization_id=? AND id=?').bind(org(c),c.req.param('id')).first<any>();if(!r)fail(404,'PRIVACY_REQUEST_NOT_FOUND');versionMatch(c,r);
  if(r.status==='completed'||r.status==='rejected')fail(409,'PRIVACY_REQUEST_FINAL');
  if(input.data.status==='completed'&&r.status!=='approved')fail(409,'PRIVACY_APPROVAL_REQUIRED');
  const data={...r,status:input.data.status,outcome:input.data.outcome,reviewed_at:now(),reviewed_by:c.get('identity').id,version:Number(r.version)+1};
  return{resource:'privacy-request',before:r,data,statements:guard(c.env.DB,c.env.DB.prepare('UPDATE privacy_request SET status=?,reviewed_at=?,reviewed_by=?,outcome=?,version=? WHERE organization_id=? AND id=? AND version=?').bind(data.status,data.reviewed_at,data.reviewed_by,data.outcome,data.version,org(c),r.id,r.version))};
 });
});

recovery.post('/api/recovery/retention/preview',async c=>{adminGate(c);const p=await policy(c),days=Number(p?.attachment_days||90),cutoff=new Date(Date.now()-days*86400000).toISOString(),db=c.env.DB;const [reports,attachments,holds]=await Promise.all([db.prepare("SELECT COUNT(*) n FROM report_export r WHERE r.organization_id=? AND r.status='ready' AND r.expires_at<? AND NOT EXISTS(SELECT 1 FROM retention_hold h WHERE h.organization_id=r.organization_id AND h.resource_type='report_export' AND h.resource_id=r.id AND h.status='active')").bind(org(c),now()).first<any>(),db.prepare("SELECT COUNT(*) n FROM evidence_attachment a WHERE a.organization_id=? AND a.created_at<? AND a.status='ready' AND NOT EXISTS(SELECT 1 FROM retention_hold h WHERE h.organization_id=a.organization_id AND h.resource_type='attachment' AND h.resource_id=a.id AND h.status='active')").bind(org(c),cutoff).first<any>(),db.prepare("SELECT COUNT(*) n FROM retention_hold WHERE organization_id=? AND status='active'").bind(org(c)).first<any>()]);return c.json({data:{cutoff,policy:p,candidates:{report_exports:Number(reports?.n||0),attachments:Number(attachments?.n||0)},active_holds:Number(holds?.n||0),action:'preview_only',warning:'Tidak ada penghapusan bisnis otomatis; eksekusi retention memerlukan runbook dan legal hold review.'}})});

recovery.post('/api/recovery/migration-rollback/plan',async c=>{adminGate(c);const input=rollbackInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'INVALID_ROLLBACK_PLAN'},422);const exists=await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").first();let applied:any[]=[],appliedKnown=false;if(exists){applied=(await c.env.DB.prepare('SELECT * FROM d1_migrations ORDER BY applied_at DESC LIMIT 20').all()).results;appliedKnown=true}return c.json({data:{migration_id:input.data.migration_id,dry_run:true,applied_known:appliedKnown,applied,plan:['Take fresh logical backup and verify checksum','Stop writes and maintenance jobs','Review migration-specific inverse SQL manually','Restore/forward-fix in staging first','Reconcile outbox, accepted orders, invoices, attachments and audit rows','Run smoke tests before reopening writes'],warning:'Rollback plan only. This endpoint never drops tables, deletes business data or rewrites accepted orders.'}})});

recovery.onError((e,c)=>{const m=/^(403|404|409|412|422|428|503):(.+)$/.exec((e as Error).message);return c.json({code:m?m[2]:'RECOVERY_UNAVAILABLE'},(m?Number(m[1]):503) as any)});

export const recoveryRequestSchemas={policy:policyInput,backup:backupInput,drill:drillInput,hold:holdInput,release:releaseInput,privacy:privacyInput,review:reviewInput,rollback:rollbackInput};
