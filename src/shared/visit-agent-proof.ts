import {z} from 'zod';
import {canonicalJson} from './boundaries';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),sha=z.string().regex(/^[a-f0-9]{64}$/),int=z.number().int().safe().nonnegative();
export const visitAgentPublicKey=z.object({kty:z.literal('EC'),crv:z.literal('P-256'),x:z.string().regex(/^[A-Za-z0-9_-]{43}$/),y:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
export const visitAgentProofClaims=z.object({
 v:z.literal(1),purpose:z.enum(['nonce_request','request']),organization_id:id,environment:id,agent_id:id,credential_id:id,generation:int.min(1),
 method:z.enum(['GET','POST','PUT']),origin:z.string().max(500),target:z.string().min(1).max(2048),body_sha256:sha,idempotency_key:z.string().min(8).max(128).nullable(),credential_sha256:sha,
 nonce:z.string().regex(/^[A-Za-z0-9_-]{32,128}$/).nullable(),jti:z.string().uuid(),iat:int,exp:int,
}).strict().refine(v=>v.exp>v.iat&&v.exp-v.iat<=120&&(v.purpose==='request'?v.nonce!==null:v.nonce===null),'Short proof lifetime and purpose-specific nonce required');
export const visitAgentNonceRequest=z.object({method:z.enum(['GET','POST','PUT']),target:z.string().min(1).max(2048),body_sha256:sha,idempotency_key:z.string().min(8).max(128).nullable()}).strict();
export type VisitAgentProofClaims=z.infer<typeof visitAgentProofClaims>;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export async function agentSha256(raw:Uint8Array|string){const bytes=typeof raw==='string'?encoder.encode(raw):raw;const result=await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer);return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function encode(bytes:Uint8Array){let str='';for(const n of bytes)str+=String.fromCharCode(n);return btoa(str).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function decode(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('AGENT_PROOF_INVALID');const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(encode(bytes)!==value)throw Error('AGENT_PROOF_INVALID');return bytes}
export const agentBase64Url={encode,decode};
export function agentRequestTarget(raw:string,allowLocal=false){
 const url=new URL(raw),local=['127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.hash||url.protocol!=='https:'&&!(allowLocal&&local&&url.protocol==='http:')||!url.pathname.startsWith('/api/visit-agent/'))throw Error('AGENT_TARGET_DENIED');
 return{origin:url.origin,target:url.pathname+url.search};
}
export async function agentKeyThumbprint(raw:unknown){const key=visitAgentPublicKey.parse(raw);return agentSha256(canonicalJson({crv:key.crv,kty:key.kty,x:key.x,y:key.y}))}
export async function agentNonceTargetHash(value:Pick<VisitAgentProofClaims,'organization_id'|'environment'|'agent_id'|'credential_id'|'generation'|'method'|'origin'|'target'|'body_sha256'|'idempotency_key'>){return agentSha256(canonicalJson({organization_id:value.organization_id,environment:value.environment,agent_id:value.agent_id,credential_id:value.credential_id,generation:value.generation,method:value.method,origin:value.origin,target:value.target,body_sha256:value.body_sha256,idempotency_key:value.idempotency_key}))}
export async function signAgentProof(claims:VisitAgentProofClaims,privateKey:CryptoKey){
 const parsed=visitAgentProofClaims.parse(claims),header=encode(encoder.encode(canonicalJson({alg:'ES256',typ:'nyales-agent-proof-v1'}))),payload=encode(encoder.encode(canonicalJson(parsed))),signing=header+'.'+payload;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(signing));if(signature.byteLength!==64)throw Error('AGENT_SIGNATURE_FORMAT');return signing+'.'+encode(new Uint8Array(signature));
}
export type AgentCredentialRecord={id:string;organization_id:string;environment:string;agent_id:string;generation:number;active_generation:number;secret_sha256:string;public_key:unknown;key_thumbprint:string;expires_at:number;revoked:boolean;agent_active:boolean};
type Expected={url:string;method:'GET'|'POST'|'PUT';body:Uint8Array;idempotency_key:string|null;purpose:VisitAgentProofClaims['purpose'];now:number;organization_id:string;environment:string;allow_local?:boolean};
export async function verifyAgentProof(token:string,credentialSecret:string,record:AgentCredentialRecord,expected:Expected,consumeOnce:(claims:VisitAgentProofClaims)=>Promise<boolean>){
 const invalid=()=>{throw Error('AGENT_PROOF_DENIED')};
 if(token.length>8192||!Number.isSafeInteger(expected.now)||expected.now<0||!record.agent_active||record.revoked||record.expires_at<=expected.now||record.generation!==record.active_generation||expected.organization_id!==record.organization_id||expected.environment!==record.environment)invalid();
 if(await agentSha256(credentialSecret)!==record.secret_sha256)invalid();
 let claims:VisitAgentProofClaims,signature:Uint8Array,parts:string[];try{parts=token.split('.');if(parts.length!==3)throw Error();const head=JSON.parse(decoder.decode(decode(parts[0])));if(canonicalJson(head)!==canonicalJson({alg:'ES256',typ:'nyales-agent-proof-v1'}))throw Error();claims=visitAgentProofClaims.parse(JSON.parse(decoder.decode(decode(parts[1]))));signature=decode(parts[2]);if(signature.length!==64)throw Error()}catch{invalid()}
 const value=claims!,target=agentRequestTarget(expected.url,expected.allow_local);
 if(value.purpose!==expected.purpose||value.organization_id!==record.organization_id||value.environment!==record.environment||value.agent_id!==record.agent_id||value.credential_id!==record.id||value.generation!==record.generation||value.method!==expected.method||value.origin!==target.origin||value.target!==target.target||value.idempotency_key!==expected.idempotency_key||value.credential_sha256!==record.secret_sha256||value.body_sha256!==await agentSha256(expected.body)||value.iat>expected.now+30||value.exp<=expected.now||expected.now-value.iat>120)invalid();
 if(value.purpose==='nonce_request'&&(target.target!=='/api/visit-agent/nonces'||expected.method!=='POST'))invalid();
 let key:CryptoKey;try{const publicKey=visitAgentPublicKey.parse(record.public_key);if(await agentKeyThumbprint(publicKey)!==record.key_thumbprint)throw Error();key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,Uint8Array.from(signature!).buffer,encoder.encode(parts!.slice(0,2).join('.'))))throw Error()}catch{invalid()}
 // Runtime must consume both jti and the target-bound server nonce atomically in D1,
 // rechecking credential revocation/generation/expiry in that transaction.
 if(!await consumeOnce(value))invalid();return{organization_id:record.organization_id,environment:record.environment,agent_id:record.agent_id,credential_id:record.id,generation:record.generation,claims:value};
}
