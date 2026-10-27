import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {localAuthEnabled,verifyFirebaseToken,verifyFirebaseClaims,mappedIdentity} from '../src/server/auth';
import app from '../src/server/index';
test('demo identity requires both local environment and explicit flag',()=>{
 assert.equal(localAuthEnabled({APP_ENV:'production',LOCAL_AUTH:'true'}),false);
 assert.equal(localAuthEnabled({APP_ENV:'local',LOCAL_AUTH:'false'}),false);
 assert.equal(localAuthEnabled({APP_ENV:'local',LOCAL_AUTH:'true'}),true);
});
test('JWT verifies signature, issuer, audience, expiry and auth time',async()=>{
 const keys=await generateKeyPair('RS256');const other=await generateKeyPair('RS256');
 const now=Math.floor(Date.now()/1000);
 const token=async(overrides:Record<string,unknown>={})=>new SignJWT({sub:'uid-1',iat:now,exp:now+600,auth_time:now,iss:'https://securetoken.google.com/nyales-test',aud:'nyales-test',...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(keys.privateKey);
 const getKey=async()=>keys.publicKey;
 assert.equal(await verifyFirebaseToken(await token(),'nyales-test',getKey),'uid-1');
 assert.equal((await verifyFirebaseClaims(await token(),'nyales-test',getKey)).mfa,false);
 assert.equal((await verifyFirebaseClaims(await token({firebase:{sign_in_second_factor:'totp'}}),'nyales-test',getKey)).mfa,true);
 assert.equal((await verifyFirebaseClaims(await token({mfa:true}),'nyales-test',getKey)).mfa,false);
 for(const claims of [{aud:'other'},{iss:'https://evil.example'},{exp:now-1},{auth_time:now+600},{sub:''},{iat:now+600}])await assert.rejects(()=>token(claims).then(t=>verifyFirebaseToken(t,'nyales-test',getKey)));
 await assert.rejects(()=>token().then(t=>verifyFirebaseToken(t,'nyales-test',async()=>other.publicKey)));
});
test('all domain APIs require identity; production rejects local token',async()=>{
 const local={APP_ENV:'local',LOCAL_AUTH:'true',FIREBASE_PROJECT_ID:''};
 for(const path of ['/api/me','/api/customers','/api/dashboard','/api/map','/api/telesales/queue'])assert.equal((await app.request(path,{},local)).status,401);
 // Identity alone cannot open data without a device binding.
 assert.equal((await app.request('/api/me',{headers:{Authorization:'Bearer nyales-local-demo'}},local)).status,401);
 assert.equal((await app.request('/api/me',{headers:{Authorization:'Bearer nyales-local-demo'}},{...local,APP_ENV:'production'})).status,503);
 assert.equal((await app.request('/api/me',{headers:{Authorization:'Bearer malformed'}},{...local,APP_ENV:'production',FIREBASE_PROJECT_ID:'test'})).status,401);
});
test('unmapped and ambiguous identities do not receive access',async()=>{
 const db=(results:unknown[])=>({prepare:()=>({bind:()=>({all:async()=>({results})})})}) as unknown as D1Database;
 assert.equal(await mappedIdentity(db([]),'uid'),null);
 assert.equal(await mappedIdentity(db([{},{}]),'uid'),null);
 const user={id:'u1',name:'User',organization_id:'o1',role:'SALES_REP'};
 assert.deepEqual(await mappedIdentity(db([user]),'uid'),user);
});
