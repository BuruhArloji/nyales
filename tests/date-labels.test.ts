import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessDateLabel} from '../src/shared/date-labels';

test('business dates display Indonesian calendar dates without parsing timestamps or overflowing invalid days',()=>{
 assert.equal(businessDateLabel('2026-11-04'),'4 November 2026');
 assert.equal(businessDateLabel('2026-01-01'),'1 Januari 2026');
 assert.equal(businessDateLabel('2024-02-29'),'29 Februari 2024');
 for(const value of ['2026-02-29','2026-04-31','2026-13-01','2026-11-04T00:00:00Z','',null,undefined])assert.equal(businessDateLabel(value),'Belum tersedia');
});
