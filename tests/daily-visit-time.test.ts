import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customDailyWindow,suggestedDailyEnd} from '../src/client/daily-visit-time';
const now=Date.parse('2026-11-05T12:32:25Z');
test('start now is computed at submission with a two minute lead, not an old typed minute',()=>{
 const a=customDailyWindow('2026-11-05','Asia/Jakarta','now','','21:30',now);
 assert.equal(a.start_at,'2026-11-05T12:35:00.000Z');assert.equal(a.end_at,'2026-11-05T14:30:00.000Z');
 assert.equal(customDailyWindow('2026-11-05','Asia/Jakarta','now','','21:30',now+600000).start_at,'2026-11-05T12:45:00.000Z');
});
test('morning end after an evening start is rejected explicitly rather than interpreted as tomorrow',()=>{
 assert.throws(()=>customDailyWindow('2026-11-05','Asia/Jakarta','now','','05:30',now),/hari yang sama/);
 assert.throws(()=>customDailyWindow('2026-11-05','Asia/Jakarta','manual','19:32','21:30',now),/sudah lewat/);
});
test('manual departure stays explicit and valid windows are bounded to 12 hours',()=>{
 assert.equal(customDailyWindow('2026-11-05','Asia/Jakarta','manual','20:00','22:00',now).start_at,'2026-11-05T13:00:00.000Z');
 assert.throws(()=>customDailyWindow('2026-11-05','Asia/Jakarta','manual','08:00','21:00',Date.parse('2026-11-05T00:00:00Z')),/12 jam/);
});
test('end suggestion stays today and crossing midnight requires reopening the generator',()=>{
 assert.equal(suggestedDailyEnd('Asia/Jakarta',now),'23:32');
 assert.equal(suggestedDailyEnd('Asia/Jakarta',now+3600000),'23:59');
 assert.throws(()=>customDailyWindow('2026-11-05','Asia/Jakarta','now','','23:59',Date.parse('2026-11-05T16:59:00Z')),/Tanggal/);
 assert.throws(()=>customDailyWindow('2026-11-05','Asia/Jakarta','now','','23:59',Date.parse('2026-11-06T01:00:00Z')),/Tanggal/);
});
