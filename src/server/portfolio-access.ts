import {apiBodyLimit} from './http-security';
import {Hono,type MiddlewareHandler} from 'hono';
import {verifyFirebaseClaims,type Identity} from './auth';
import {hashSession} from './sessions';
export const PORTFOLIO_OWNER_EMAIL='didikpriyoutomo05@gmail.com';
export const PORTFOLIO_DURATION_MS=20*60*1000;
export function portfolioAuthConfig(env:{PORTFOLIO_ENABLED?:string;LOCAL_AUTH?:string;FIREBASE_PROJECT_ID?:string;APP_ENV?:string}){
 const portfolio=env.PORTFOLIO_ENABLED==='true',local=!portfolio&&(env.APP_ENV==='local'||env.APP_ENV==='staging')&&env.LOCAL_AUTH==='true';
 return{mode:local?'local':'firebase',configured:local||Boolean(env.FIREBASE_PROJECT_ID),google_only:true,portfolio_enabled:portfolio};
}
type Claims=Awaited<ReturnType<typeof verifyFirebaseClaims>>;
type Bindings={DB:D1Database;PORTFOLIO_ORGANIZATION_ID?:string;PORTFOLIO_ENABLED?:string;FIREBASE_PROJECT_ID:string;APP_ENV:string;LOCAL_AUTH:string};
type Env={Bindings:Bindings;Variables:{identity:Identity;auth:{subject:string;authTime:number;mfa:boolean}}};
export function googleAccessClass(claims:Claims):'owner'|'visitor'{
 if(claims.provider!=='google.com'||!claims.emailVerified||!claims.email||!claims.subject)throw Error('VERIFIED_GOOGLE_REQUIRED');
 return claims.email.trim().toLowerCase()===PORTFOLIO_OWNER_EMAIL?'owner':'visitor';
}
export async function admitPortfolio(db:D1Database,project:string,verifiedAccount:string,now=Date.now()){
 const hash=await hashSession(project+':'+verifiedAccount),first=new Date(now).toISOString(),expires=new Date(now+PORTFOLIO_DURATION_MS).toISOString();
 await db.prepare('INSERT INTO portfolio_access(subject_hash,first_admitted_at,expires_at) VALUES(?,?,?) ON CONFLICT(subject_hash) DO NOTHING').bind(hash,first,expires).run();
 const row=await db.prepare('SELECT first_admitted_at,expires_at FROM portfolio_access WHERE subject_hash=?').bind(hash).first<{first_admitted_at:string;expires_at:string}>();
 if(!row||!Number.isFinite(Date.parse(row.expires_at)))throw Error('PORTFOLIO_ADMISSION_STORE_INVALID');
 return{...row,subject_hash:hash,expired:Date.parse(row.expires_at)<=now,remaining_seconds:Math.max(0,Math.floor((Date.parse(row.expires_at)-now)/1000))};
}
export const portfolioPreviewPaths=new Set(['/api/visit-generator/daily/runs','/api/visit-generator/ors/previews']);
export async function reservePortfolioPreview(db:D1Database,hash:string){
 await db.prepare('INSERT INTO portfolio_preview_budget(subject_hash,attempts) VALUES(?,0) ON CONFLICT(subject_hash) DO NOTHING').bind(hash).run();
 const row=await db.prepare('UPDATE portfolio_preview_budget SET attempts=attempts+1 WHERE subject_hash=? AND attempts<5 RETURNING attempts').bind(hash).first<{attempts:number}>();
 return Boolean(row);
}
const secretKeys=new Set(['auth_subject','email','phone','token_hash','session_token','public_key_json','credential_secret','secret_sha256','storage_key','before_json','after_json','api_key']);
export function redactPortfolio(value:unknown):unknown{
 if(Array.isArray(value))return value.map(redactPortfolio);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!secretKeys.has(k)).map(([k,v])=>{if(k.endsWith('_json')&&typeof v==='string'){try{return[k,JSON.stringify(redactPortfolio(JSON.parse(v)))]}catch{/* Preserve non-JSON display text. */}}return[k,redactPortfolio(v)]}));
 return value;
}
export function portfolioReadAllowed(method:string,path:string){
 if(method!=='GET')return false;
 if(!path.startsWith('/api/'))return false;
 return !/(?:\/export(?:s)?(?:\/|$)|\/sources$|\/street-view$|\/directory-details$|\/details\/|\/auth\/|\/audit-events(?:\/|$)|\/sensitive-access(?:\/|$)|\/visit-agent(?:\/|$)|\/visit-generator\/(?:agents|queue-jobs|credentials|nonces)(?:\/|$)|\/recovery(?:\/|$)|\/observability(?:\/|$)|\/device-sessions(?:\/|$))/.test(path);
}
/** Install before identity/session gates. Visitors share data but never inherit owner identity or write rights. */
export function createPortfolioGate(scopedRoutes:Hono<any>|(()=>Hono<any>),verify:(token:string,project:string)=>Promise<Claims>=verifyFirebaseClaims,clock=()=>Date.now()):MiddlewareHandler<Env>{
 return async(c,next)=>{
  if(c.env.PORTFOLIO_ENABLED!=='true'){await next();return;}
  if(c.env.LOCAL_AUTH==='true')return c.json({code:'PORTFOLIO_LOCAL_BYPASS_FORBIDDEN'},503);
  const token=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return c.json({code:'UNAUTHENTICATED'},401);
  let claims:Claims,kind:'owner'|'visitor';try{claims=await verify(token,c.env.FIREBASE_PROJECT_ID);kind=googleAccessClass(claims);}catch{return c.json({code:'VERIFIED_GOOGLE_REQUIRED',detail:'Gunakan akun Google dengan email terverifikasi.'},401);}
  if(kind==='owner'){await next();return;}
  const db=c.env.DB,org=c.env.PORTFOLIO_ORGANIZATION_ID;if(!org||!await db.prepare('SELECT id FROM organization WHERE id=?').bind(org).first())return c.json({code:'PORTFOLIO_DATA_NOT_CONFIGURED'},503);
  // Verified Google email survives Firebase user deletion/recreation; a new Firebase UID is not a new allowance.
  let admission:Awaited<ReturnType<typeof admitPortfolio>>;try{admission=await admitPortfolio(c.env.DB,c.env.FIREBASE_PROJECT_ID,claims.email!.trim().toLowerCase(),clock());}catch{return c.json({code:'PORTFOLIO_ACCESS_UNAVAILABLE'},503);}
  c.header('Cache-Control','private, no-store');
  if(admission.expired)return c.json({code:'PORTFOLIO_ACCESS_EXPIRED',detail:'Waktu eksplorasi 20 menit untuk akun ini telah berakhir.',expires_at:admission.expires_at},401);
  const actor:Identity={id:'portfolio-'+admission.subject_hash.slice(0,32),organization_id:org,name:'Pengunjung Portofolio',role:'MANAGEMENT'};
  await db.prepare("INSERT INTO app_user(id,organization_id,name,status) VALUES(?,?,?,'active') ON CONFLICT(id) DO NOTHING").bind(actor.id,org,actor.name).run();
  const stored=await db.prepare('SELECT organization_id,auth_subject FROM app_user WHERE id=?').bind(actor.id).first<{organization_id:string;auth_subject:string|null}>();if(stored?.organization_id!==org||stored.auth_subject)return c.json({code:'PORTFOLIO_ACTOR_CONFLICT'},503);
  const access={read_only:true,portfolio_read_only:true,can_preview_routes:true,portfolio_preview_limit:5,portfolio_expires_at:admission.expires_at,portfolio_remaining_seconds:admission.remaining_seconds};
  if(c.req.path==='/api/device-sessions'&&c.req.method==='POST')return c.json({data:{id:'portfolio-visitor',session_token:'portfolio-readonly',version:1,...access}},201);
  if(c.req.path==='/api/device-sessions/portfolio-visitor/revoke'&&c.req.method==='POST')return c.json({data:{revoked:true}});
  const preview=c.req.method==='POST'&&portfolioPreviewPaths.has(c.req.path);
  if(!preview&&!portfolioReadAllowed(c.req.method,c.req.path))return c.json({code:'PORTFOLIO_READ_ONLY',detail:'Mode portofolio hanya untuk melihat dan mencoba perhitungan rute; perubahan data tidak diizinkan.'},403);
  if(preview&&!await reservePortfolioPreview(db,admission.subject_hash))return c.json({code:'PORTFOLIO_PREVIEW_LIMIT',detail:'Batas 5 percobaan perhitungan rute untuk akun ini telah tercapai.'},429);
  if(c.req.path==='/api/me')return c.json({data:{...actor,capabilities:['customers:read','dashboard:read','map:read','telesales:read','settings:manage'],area_ids:[],scope:'organization',...access}});
  const wrapper=new Hono<Env>();wrapper.use('/api/*',apiBodyLimit);wrapper.use('*',async(x,n)=>{x.set('identity',actor);x.set('auth',{subject:'portfolio-readonly',authTime:claims.authTime,mfa:false});await n();});wrapper.route('/',typeof scopedRoutes==='function'?scopedRoutes():scopedRoutes);
  const response=await wrapper.fetch(c.req.raw,{...c.env,DB:db,GOOGLE_MAPS_EMBED_API_KEY:undefined,PORTFOLIO_ENABLED:'false'} as any);
  if(!response.headers.get('Content-Type')?.includes('application/json'))return c.json({code:'PORTFOLIO_DOWNLOAD_DISABLED'},403);
  const body=await response.json();return new Response(JSON.stringify(redactPortfolio(body)),{status:response.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
 };
}
