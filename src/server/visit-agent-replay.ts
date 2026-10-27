import {agentNonceTargetHash,agentSha256,visitAgentNonceRequest,type AgentCredentialRecord,type VisitAgentProofClaims} from '../shared/visit-agent-proof';
/** Signed proof replay store used by the WEB-070 machine gateway and draft protocol tests. */
function at(seconds:number){if(!Number.isSafeInteger(seconds)||seconds<0)throw Error('INVALID_AGENT_CLOCK');return new Date(seconds*1000).toISOString()}
function bound(c:AgentCredentialRecord){return[c.organization_id,c.environment,c.id,c.agent_id,c.generation,c.generation]}
const credentialPredicate=`EXISTS(SELECT 1 FROM visit_generator_credential c JOIN visit_generator_agent a ON a.organization_id=c.organization_id AND a.environment=c.environment AND a.id=c.agent_id WHERE c.organization_id=? AND c.environment=? AND c.id=? AND c.agent_id=? AND c.generation=? AND a.credential_generation=? AND c.revoked_at IS NULL AND a.status='active' AND c.expires_at>?)`;
/** Must be called only after signature/hash verification. D1 CAS consumes proof-jti and challenge together. */
export async function consumeVisitAgentProof(db:D1Database,c:AgentCredentialRecord,claims:VisitAgentProofClaims,now:number){
 const stamp=at(now),expires=at(claims.exp),target=await agentNonceTargetHash(claims),jtiHash=await agentSha256(claims.jti),statements:D1PreparedStatement[]=[];
 if(claims.organization_id!==c.organization_id||claims.environment!==c.environment||claims.credential_id!==c.id||claims.agent_id!==c.agent_id||claims.generation!==c.generation||claims.exp<=now)return false;
 if(claims.purpose==='request'){
  if(!claims.nonce)return false;const nonceHash=await agentSha256(claims.nonce);
  statements.push(db.prepare(`UPDATE visit_generator_agent_nonce SET consumed_at=? WHERE organization_id=? AND environment=? AND credential_id=? AND generation=? AND kind='challenge' AND value_sha256=? AND target_sha256=? AND consumed_at IS NULL AND expires_at>? AND ${credentialPredicate}`).bind(stamp,c.organization_id,c.environment,c.id,c.generation,nonceHash,target,stamp,...bound(c),stamp),db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard'));
 }else if(claims.nonce!==null||claims.method!=='POST'||claims.target!=='/api/visit-agent/nonces')return false;
 statements.push(db.prepare(`INSERT INTO visit_generator_agent_nonce(id,organization_id,environment,credential_id,generation,kind,value_sha256,target_sha256,created_at,expires_at,consumed_at) SELECT ?,?,?,?,?,'proof_jti',?,?,?,?,? WHERE ${credentialPredicate}`).bind(crypto.randomUUID(),c.organization_id,c.environment,c.id,c.generation,jtiHash,target,stamp,expires,stamp,...bound(c),stamp),db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard'));
 try{await db.batch(statements);return true}catch{return false}
}
/** Bootstrap proof-jti is consumed atomically with issuing a bound short-lived challenge. */
export async function issueVisitAgentNonce(db:D1Database,c:AgentCredentialRecord,bootstrap:VisitAgentProofClaims,input:unknown,now:number){
 const request=visitAgentNonceRequest.parse(input),stamp=at(now),expires=at(now+120);if(bootstrap.purpose!=='nonce_request'||bootstrap.nonce!==null||bootstrap.target!=='/api/visit-agent/nonces'||bootstrap.method!=='POST'||bootstrap.exp<=now||bootstrap.organization_id!==c.organization_id||bootstrap.environment!==c.environment||bootstrap.credential_id!==c.id||bootstrap.agent_id!==c.agent_id||bootstrap.generation!==c.generation)throw Error('AGENT_NONCE_DENIED');
 const url=new URL(request.target,bootstrap.origin);if(url.origin!==bootstrap.origin||url.pathname+url.search!==request.target||url.hash||!url.pathname.startsWith('/api/visit-agent/')||url.pathname==='/api/visit-agent/nonces')throw Error('AGENT_NONCE_TARGET_DENIED');
 const random=crypto.getRandomValues(new Uint8Array(32));let raw='';for(const b of random)raw+=String.fromCharCode(b);const nonce=btoa(raw).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 const target=await agentNonceTargetHash({...bootstrap,...request}),nonceHash=await agentSha256(nonce),jtiHash=await agentSha256(bootstrap.jti);
 try{await db.batch([
  db.prepare(`INSERT INTO visit_generator_agent_nonce VALUES(?,?,?,?,?,'proof_jti',?,?,?,?,?)`).bind(crypto.randomUUID(),c.organization_id,c.environment,c.id,c.generation,jtiHash,await agentNonceTargetHash(bootstrap),stamp,at(bootstrap.exp),stamp),
  db.prepare(`INSERT INTO visit_generator_agent_nonce SELECT ?,?,?,?,?,'challenge',?,?,?,?,NULL WHERE ${credentialPredicate}`).bind(crypto.randomUUID(),c.organization_id,c.environment,c.id,c.generation,nonceHash,target,stamp,expires,...bound(c),stamp),
  db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard'),
 ]);return{nonce,expires_at:expires,server_time:stamp}}catch{throw Error('AGENT_NONCE_DENIED')}
}
