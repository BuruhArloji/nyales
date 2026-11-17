import test from 'node:test';
import assert from 'node:assert/strict';
import {localClock,localInstant} from '../mobile/src/daily-time';
test('custom visit time resolves Jakarta time and midnight date boundaries',()=>{assert.equal(localInstant('2026-11-18','21:30','Asia/Jakarta'),'2026-11-18T14:30:00.000Z');assert.deepEqual(localClock(Date.parse('2026-11-17T17:01:00Z'),'Asia/Jakarta'),{date:'2026-11-18',time:'00:01'})});
test('custom visit time rejects invalid wall clocks and DST gaps and overlaps',()=>{assert.equal(localInstant('2026-11-18','24:00','Asia/Jakarta'),null);assert.equal(localInstant('2026-11-18','12:99','Asia/Jakarta'),null);assert.equal(localInstant('2024-03-10','02:30','America/New_York'),null);assert.equal(localInstant('2024-11-03','01:30','America/New_York'),null)});
