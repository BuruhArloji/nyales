import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactNumber} from '../src/client/numbers';
test('card abbreviation handles zero, unit boundaries, rounding carry and negative amounts',()=>{
 for(const [value,short] of [[0,'Rp0'],[999,'Rp999'],[1000,'Rp1 rb'],[12500,'Rp12,5 rb'],[275000000,'Rp275 jt'],[1250000000,'Rp1,25 M'],[2500000000000,'Rp2,5 T'],[999999,'Rp1 jt'],[-1250000,'-Rp1,25 jt']] as const)assert.equal(compactNumber(value,true).short,short);
 assert.equal(compactNumber(1250000).short,'1,25 jt');
 assert.equal(compactNumber(1250000000).full,'1.250.000.000');
 for(const value of [null,undefined,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(compactNumber(value).short,'Belum tersedia');
 assert.match(compactNumber(Number.MAX_SAFE_INTEGER,true).full,/9\.007\.199\.254\.740\.991/);
});
