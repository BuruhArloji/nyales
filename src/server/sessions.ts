import {Hono,type MiddlewareHandler} from 'hono';
import {z} from 'zod';
import {localAuthEnabled,type Identity} from './auth';
export type SessionAuth={subject:string;authTime:number;mfa:boolean};
export type SessionEnv={Bindings:{DB:D1Database;APP_ENV:string;LOCAL_AUTH:string;FIREBASE_PROJECT_ID:string};Variables:{identity:Identity;auth:SessionAuth;deviceSession:SessionRow}};
type SessionRow={id:string;organization_id:string;user_id:string;auth_subject:string;device_id:string;device_label:string;token_hash:string;auth_time:number;created_at:string;last_seen_at:string;expires_at:string;revoked_at:string|null;revoked_by:string|null;revoke_reason:string|null;version:number};
export const sessions=new Hono<SessionEnv>();
export async function hashSession(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')}
const privileged=(i:Identity)=>['MANAGEMENT','NSM'].includes(i.role);
const recent=(auth:SessionAuth)=>auth.authTime>=Math.floor(Date.now()/1000)-300;
export function securityPolicy(local:boolean){return {device_binding:'required',session_hours:12,admin_mfa:local?'local_demo_bypass':'required',mfa_provider:'Firebase Identity Platform',mfa_rollout_gate:'pending_project_verification',reauth_minutes:5}}
export const sessionGate:MiddlewareHandler<SessionEnv>=async(c,next)=>{
 const identity=c.get('identity'),auth=c.get('auth');
 if(privileged(identity)&&!localAuthEnabled(c.env)&&!auth.mfa)return c.json({code:'MFA_REQUIRED',detail:'Akun admin memerlukan MFA. Konfigurasi provider dan enrollment belum diverifikasi; rollout admin masih ditahan.'},403);
 if(c.req.path==='/api/device-sessions'&&c.req.method==='POST'){await next();return}
 const token=c.req.header('X-Device-Session');
 if(!token||!/^[a-f0-9]{64}$/.test(token))return c.json({code:'DEVICE_SESSION_REQUIRED',detail:'Sesi perangkat diperlukan. Silakan masuk kembali.'},401);
 try{
  const row=await c.env.DB.prepare('SELECT * FROM device_session WHERE token_hash=? AND organization_id=? AND user_id=? AND auth_subject=?').bind(await hashSession(token),identity.organization_id,identity.id,auth.subject).first<SessionRow>();
  const now=new Date().toISOString();
  if(!row||row.revoked_at||row.expires_at<=now)return c.json({code:'DEVICE_SESSION_INVALID',detail:'Sesi perangkat berakhir atau telah dicabut. Silakan masuk kembali.'},401);
  c.set('deviceSession',row);
  if(Date.parse(now)-Date.parse(row.last_seen_at)>900000)await c.env.DB.prepare('UPDATE device_session SET last_seen_at=? WHERE id=? AND revoked_at IS NULL AND last_seen_at<?').bind(now,row.id,new Date(Date.now()-900000).toISOString()).run();
 }catch{return c.json({code:'SESSION_STORE_UNAVAILABLE',detail:'Status sesi belum dapat diperiksa. Coba lagi.'},503)}
 await next();
};
function summary(row:SessionRow,current?:string){return {id:row.id,user_id:row.user_id,device_id:row.device_id,device_label:row.device_label,version:row.version,created_at:row.created_at,last_seen_at:row.last_seen_at,expires_at:row.expires_at,revoked:Boolean(row.revoked_at),revoked_at:row.revoked_at,current:row.id===current}}
async function target(c:any){const i=c.get('identity') as Identity;return c.env.DB.prepare(`SELECT * FROM device_session WHERE id=? AND organization_id=?${privileged(i)?'':' AND user_id=?'}`).bind(c.req.param('id'),i.organization_id,...(privileged(i)?[]:[i.id])).first() as Promise<SessionRow|null>}
sessions.post('/api/device-sessions',async c=>{
 const input=sessionCreateInput.safeParse(await c.req.json().catch(()=>null));
 if(!input.success)return c.json({code:'INVALID_DEVICE'},422);
 const i=c.get('identity'),auth=c.get('auth');
 if(!recent(auth))return c.json({code:'REAUTH_REQUIRED',detail:'Masuk kembali untuk mendaftarkan sesi perangkat.'},401);
 const now=new Date().toISOString(),db=c.env.DB;
 try{
  const floor=await db.prepare('SELECT MAX(auth_time) value FROM device_session WHERE organization_id=? AND user_id=? AND revoked_at IS NOT NULL').bind(i.organization_id,i.id).first<{value:number|null}>();
  if(floor?.value!==null&&floor?.value!==undefined&&auth.authTime<=floor.value)return c.json({code:'REAUTH_REQUIRED',detail:'Ada sesi yang telah dicabut. Lakukan login baru untuk membuka perangkat ini.'},401);
  const count=await db.prepare('SELECT COUNT(*) value FROM device_session WHERE organization_id=? AND user_id=? AND created_at>=?').bind(i.organization_id,i.id,new Date(Date.now()-600000).toISOString()).first<{value:number}>();
  if((count?.value||0)>=20){c.header('Retry-After','600');return c.json({code:'SESSION_RATE_LIMIT',detail:'Terlalu banyak pendaftaran sesi. Coba lagi nanti.'},429)}
  const id=crypto.randomUUID(),token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const row:SessionRow={id,organization_id:i.organization_id,user_id:i.id,auth_subject:auth.subject,device_id:input.data.device_id,device_label:(c.req.header('User-Agent')||'Perangkat tidak diketahui').slice(0,180),token_hash:await hashSession(token),auth_time:auth.authTime,created_at:now,last_seen_at:now,expires_at:new Date(Date.now()+12*3600000).toISOString(),revoked_at:null,revoked_by:null,revoke_reason:null,version:1};
  await db.batch([db.prepare(`INSERT INTO device_session(id,organization_id,user_id,auth_subject,device_id,device_label,token_hash,auth_time,created_at,last_seen_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM device_session WHERE organization_id=? AND user_id=? AND revoked_at IS NOT NULL AND auth_time>=?) AND (SELECT COUNT(*) FROM device_session WHERE organization_id=? AND user_id=? AND created_at>=?)<20`).bind(id,i.organization_id,i.id,auth.subject,row.device_id,row.device_label,row.token_hash,auth.authTime,now,now,row.expires_at,i.organization_id,i.id,auth.authTime,i.organization_id,i.id,new Date(Date.now()-600000).toISOString()),db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard'),db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),i.organization_id,i.id,'device_session',id,'create',now,null,JSON.stringify(summary(row)))]);
  c.header('ETag','"1"');return c.json({data:{...summary(row),session_token:token}},201);
 }catch{return c.json({code:'SESSION_CREATE_FAILED',detail:'Sesi belum dapat dibuat. Coba login kembali.'},503)}
});
sessions.get('/api/device-sessions',async c=>{const i=c.get('identity');const rows=await c.env.DB.prepare(`SELECT * FROM device_session WHERE organization_id=?${privileged(i)?'':' AND user_id=?'} ORDER BY created_at DESC LIMIT 201`).bind(i.organization_id,...(privileged(i)?[]:[i.id])).all<SessionRow>();const names=await c.env.DB.prepare(`SELECT id,name FROM app_user WHERE organization_id=?${privileged(i)?'':' AND id=?'}`).bind(i.organization_id,...(privileged(i)?[]:[i.id])).all<{id:string;name:string}>();return c.json({data:rows.results.slice(0,200).map(r=>({...summary(r,c.get('deviceSession').id),user_name:names.results.find(u=>u.id===r.user_id)?.name||r.user_id})),meta:{has_more:rows.results.length>200,security:securityPolicy(localAuthEnabled(c.env))}})});
sessions.get('/api/device-sessions/:id',async c=>{const row=await target(c);if(!row)return c.json({code:'NOT_FOUND'},404);c.header('ETag',`"${row.version}"`);return c.json({data:summary(row,c.get('deviceSession').id)})});
sessions.post('/api/device-sessions/:id/revoke',async c=>{
 const i=c.get('identity'),row=await target(c);if(!row)return c.json({code:'NOT_FOUND'},404);
 const input=sessionRevokeInput.safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({code:'REASON_REQUIRED'},422);
 if(row.user_id!==i.id&&!recent(c.get('auth')))return c.json({code:'REAUTH_REQUIRED',detail:'Login baru diperlukan sebelum mencabut sesi user lain.'},401);
 if(!c.req.header('If-Match'))return c.json({code:'PRECONDITION_REQUIRED'},428);
 if(row.revoked_at)return c.json({data:summary(row,c.get('deviceSession').id)});
 if(c.req.header('If-Match')!==`"${row.version}"`)return c.json({code:'VERSION_CONFLICT'},412);
 const now=new Date().toISOString(),after={...row,revoked_at:now,revoked_by:i.id,revoke_reason:input.data.reason,version:row.version+1};
 try{await c.env.DB.batch([c.env.DB.prepare('UPDATE device_session SET revoked_at=?,revoked_by=?,revoke_reason=?,version=version+1 WHERE id=? AND organization_id=? AND version=? AND revoked_at IS NULL').bind(now,i.id,input.data.reason,row.id,i.organization_id,row.version),c.env.DB.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),c.env.DB.prepare('DELETE FROM master_mutation_guard'),c.env.DB.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),i.organization_id,i.id,'device_session',row.id,'revoke',now,JSON.stringify(summary(row)),JSON.stringify({...summary(after),reason:input.data.reason}))]);c.header('ETag',`"${after.version}"`);return c.json({data:summary(after,c.get('deviceSession').id)})}catch{return c.json({code:'VERSION_CONFLICT'},409)}
});
sessions.onError((_e,c)=>c.json({code:'SESSION_STORE_UNAVAILABLE'},503));

const sessionCreateInput=z.object({device_id:z.string().trim().min(1).max(128)}).strict();
const sessionRevokeInput=z.object({reason:z.string().trim().min(1).max(500)}).strict();
export const sessionRequestSchemas={create:sessionCreateInput,revoke:sessionRevokeInput};
