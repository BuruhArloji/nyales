import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export type Identity={id:string;name:string;organization_id:string;role:string;channel?:'field'|'telesales'|null;performed_by?:{id:string;name:string}};
export type AuthBindings={DB:D1Database;APP_ENV:string;LOCAL_AUTH:string;FIREBASE_PROJECT_ID:string};
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export function localAuthEnabled(env:Pick<AuthBindings,'APP_ENV'|'LOCAL_AUTH'>){return (env.APP_ENV==='local'||env.APP_ENV==='staging')&&env.LOCAL_AUTH==='true'}
export async function verifyFirebaseClaims(token:string,project:string,key:JWTVerifyGetKey=keys){
 const {payload}=await jwtVerify(token,key,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${project}`,audience:project,requiredClaims:['exp','iat','sub','auth_time']});
 const now=Math.floor(Date.now()/1000);
 if(!payload.sub||payload.sub.length>128||typeof payload.iat!=='number'||payload.iat>now||typeof payload.auth_time!=='number'||payload.auth_time>now)throw new Error('Invalid identity claims');
 const firebase=typeof payload.firebase==='object'&&payload.firebase!==null?payload.firebase as Record<string,unknown>:{};
 return {subject:payload.sub,authTime:payload.auth_time,mfa:['totp','phone'].includes(String(firebase.sign_in_second_factor||'')),
  email:typeof payload.email==='string'?payload.email:null,emailVerified:payload.email_verified===true,
  provider:typeof firebase.sign_in_provider==='string'?firebase.sign_in_provider:null,
  displayName:typeof payload.name==='string'?payload.name.slice(0,120):null};
}
export async function verifyFirebaseToken(token:string,project:string,key:JWTVerifyGetKey=keys){return (await verifyFirebaseClaims(token,project,key)).subject}
export async function mappedIdentity(db:D1Database,subject:string):Promise<Identity|null>{
 const rows=await db.prepare(`SELECT u.id,u.name,u.organization_id,r.role_code AS role,r.channel FROM app_user u JOIN auth_role_assignment r ON r.user_id=u.id AND r.organization_id=u.organization_id WHERE u.auth_subject=? AND u.status='active' AND r.effective_from_date<=date('now','+7 hours') AND (r.effective_to_date IS NULL OR r.effective_to_date>date('now','+7 hours'))`).bind(subject).all<Identity>();
 // Ambiguous identities require explicit administrative resolution, never first-row selection.
 return rows.results.length===1?rows.results[0]:null;
}
