import {test}from'node:test';
import assert from'node:assert/strict';
import {AuthApiError,loginProblem,shouldExpireSession,validTotpCode}from'../src/client/auth-errors';
test('MFA/enrollment and unmapped-account gates preserve setup identity, while existing business sessions are expired',()=>{
 for(const code of ['MFA_REQUIRED','USER_NOT_PROVISIONED_OR_INACTIVE']){assert.equal(shouldExpireSession(403,code,false),false);assert.equal(shouldExpireSession(403,code,true),true)}
 assert.equal(shouldExpireSession(401,'INVALID_ID_TOKEN',false),true);assert.equal(shouldExpireSession(401,'DEVICE_SESSION_INVALID',true),true);assert.equal(shouldExpireSession(401,'REAUTH_REQUIRED',false),false);assert.equal(shouldExpireSession(503,'OFFLINE',true),false);
});
test('OTP validation and login messages do not expose provider exception payloads or secret input',()=>{
 for(const code of ['123456','000012'])assert.ok(validTotpCode(code));for(const code of ['12345','1234567','12a456',' 123456','123456\n'])assert.equal(validTotpCode(code),false);
 assert.match(loginProblem({code:'auth/invalid-verification-code'}),/kode/i);assert.match(loginProblem({code:'auth/operation-not-allowed'}),/belum diaktifkan/);
 assert.equal(loginProblem({code:'auth/user-not-found'}),loginProblem({code:'auth/wrong-password'}));
 assert.ok(!loginProblem({code:'unknown',message:'private-token-and-otp'}).includes('private-token'));
 assert.equal(loginProblem(new AuthApiError('REAUTH_REQUIRED',401,'Masuk kembali.')),'Masuk kembali.');
});
