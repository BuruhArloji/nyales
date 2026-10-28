import {test}from'node:test';
import assert from'node:assert/strict';
import {spawnSync}from'node:child_process';
test('Source cleanup merges strong identity only, holds different close IDs and preserves geographic uncertainty',()=>{
 const p=spawnSync('python',['tests/fixtures/warung-dedup-check.py'],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);
});
