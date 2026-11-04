import {Hono} from 'hono';
import {verifyFirebaseClaims} from './auth';

type Env={Bindings:{DB:D1Database;APP_ENV:string;FIREBASE_PROJECT_ID:string;PORTFOLIO_ENABLED?:string;FIRST_ADMIN_EMAIL?:string;FIRST_ADMIN_ORGANIZATION_NAME?:string}};
type Claims=Awaited<ReturnType<typeof verifyFirebaseClaims>>;

/** Explicit operator-selected identity only, staging only. Never a general signup route. */
export function createFirstAdminRoutes(verify:(token:string,project:string)=>Promise<Claims>=verifyFirebaseClaims){
 const app=new Hono<Env>();
 app.post('/api/auth/first-admin',async c=>{
  const selected=c.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase(),name=c.env.FIRST_ADMIN_ORGANIZATION_NAME?.trim();
  if(c.env.APP_ENV!=='staging'||!selected||!name||name.length>120)return c.json({code:'NOT_FOUND'},404);
  // Some transports expose an empty POST stream rather than a null body.
  if(c.req.raw.body){const reader=c.req.raw.body.getReader();try{for(;;){const part=await reader.read();if(part.done)break;if(part.value.byteLength){void reader.cancel().catch(()=>{});return c.json({code:'BODY_NOT_ALLOWED'},422)}}}catch{return c.json({code:'INVALID_REQUEST_BODY'},400)}finally{reader.releaseLock()}}
  const token=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return c.json({code:'UNAUTHENTICATED'},401);
  let claims:Claims;
  try{claims=await verify(token,c.env.FIREBASE_PROJECT_ID)}catch{return c.json({code:'INVALID_ID_TOKEN'},401)}
  if(!claims.emailVerified||claims.provider!=='google.com'||claims.email?.trim().toLowerCase()!==selected)return c.json({code:'BOOTSTRAP_IDENTITY_DENIED',detail:'Akun ini belum memiliki akses NYALES. Hubungi administrator.'},403);
  if(c.env.PORTFOLIO_ENABLED!=='true'&&!claims.mfa)return c.json({code:'MFA_REQUIRED',detail:'Aktifkan Authenticator lalu masuk kembali untuk mengaktifkan akun Management pertama.'},403);
  if(claims.authTime<Math.floor(Date.now()/1000)-300)return c.json({code:'REAUTH_REQUIRED',detail:'Masuk kembali untuk melanjutkan aktivasi akun pertama.'},401);
  const db=c.env.DB;
  try{
   const existing=await db.prepare(`SELECT u.id,u.organization_id FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id
    JOIN master_audit a ON a.organization_id=u.organization_id AND a.actor_id=u.id AND a.action='bootstrap_first_admin'
    WHERE u.auth_subject=? AND u.status='active' AND r.role_code='MANAGEMENT' AND r.effective_from_date<=date('now','+7 hours') AND (r.effective_to_date IS NULL OR r.effective_to_date>date('now','+7 hours')) LIMIT 1`).bind(claims.subject).first<{id:string;organization_id:string}>();
   if(existing)return c.json({data:{...existing,role:'MANAGEMENT',already_initialized:true}});
   const org=crypto.randomUUID(),user=crypto.randomUUID(),now=new Date().toISOString();
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   await db.batch([
    db.prepare(`INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM organization) AND NOT EXISTS(SELECT 1 FROM app_user) AND NOT EXISTS(SELECT 1 FROM auth_role_assignment) THEN 1 ELSE 0 END`),
    db.prepare('INSERT INTO organization(id,name,timezone) VALUES(?,?,?)').bind(org,name,'Asia/Jakarta'),
    db.prepare("INSERT INTO app_user(id,organization_id,auth_subject,name,status) VALUES(?,?,?,?,'active')").bind(user,org,claims.subject,claims.displayName?.trim()||'Management'),
    db.prepare("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES(?,?,?,'MANAGEMENT',NULL,?)").bind(crypto.randomUUID(),org,user,date),
    db.prepare("INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) VALUES(?,?,?,'organization',?,'bootstrap_first_admin',?,NULL,?)").bind(crypto.randomUUID(),org,user,org,now,JSON.stringify({organization_name:name,user_id:user,auth_subject:claims.subject,email:claims.email,role:'MANAGEMENT',mfa_verified:claims.mfa,authentication_policy:c.env.PORTFOLIO_ENABLED==='true'?'google_only':'google_mfa'})),
    db.prepare('DELETE FROM master_mutation_guard')
   ]);
   return c.json({data:{id:user,organization_id:org,role:'MANAGEMENT',already_initialized:false}},201);
  }catch{
   // Failed D1 batches roll back together. Never attach a new identity to existing data.
   return c.json({code:'BOOTSTRAP_UNAVAILABLE',detail:'Aktivasi pertama tidak dapat dijalankan. Hubungi administrator untuk memeriksa status organisasi.'},409);
  }
 });
 return app;
}
