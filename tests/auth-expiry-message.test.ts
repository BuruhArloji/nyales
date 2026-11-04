import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionExpiredMessage,shouldExpireSession} from '../src/client/auth-errors';

test('expired portfolio account keeps its explanation even before identity or device session loads',()=>{
 assert.equal(shouldExpireSession(401,'PORTFOLIO_ACCESS_EXPIRED',false),true);
 assert.equal(sessionExpiredMessage('PORTFOLIO_ACCESS_EXPIRED',false),'Waktu eksplorasi 20 menit untuk akun ini telah berakhir.');
 assert.equal(sessionExpiredMessage(undefined,true),'Waktu eksplorasi 20 menit untuk akun ini telah berakhir.');
 assert.equal(sessionExpiredMessage('DEVICE_SESSION_INVALID',false),'Sesi perangkat berakhir. Silakan masuk kembali.');
 assert.equal(shouldExpireSession(401,'REAUTH_REQUIRED',false),false);
});
