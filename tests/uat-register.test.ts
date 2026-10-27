import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

test('WEB-059 preserves all 82 PRD scenarios with exact applicability and no deferred pass',()=>{
 execFileSync(process.execPath,['scripts/generate-uat-register.cjs','--check']);
 const r=JSON.parse(readFileSync('docs/WEB059_UAT_REGISTER.json','utf8'));assert.equal(new Set(r.scenarios.map((s:any)=>s.id)).size,82);
 const browser=JSON.parse(readFileSync('docs/WEB059_BROWSER_EVIDENCE.json','utf8'));assert.deepEqual(browser.summary,r.browser_summary);assert.equal(browser.summary.total,browser.checks.length);for(const [key,outcome]of [['passed','expected'],['failed','unexpected'],['flaky','flaky'],['skipped','skipped']])assert.equal(browser.summary[key],browser.checks.filter((c:any)=>c.outcome===outcome).length);
 assert.deepEqual(r.counts,{total:82,web_release:53,deferred_integration_p1:8,deferred_android:21,accepted:r.scenarios.filter((s:any)=>s.acceptance_status==='accepted').length});
 for(const s of r.scenarios){for(const path of s.supporting_regression)assert.ok(existsSync(path),s.id+' '+path);if(s.applicability.startsWith('Deferred'))assert.equal(s.acceptance_status,'deferred');if(s.acceptance_status==='accepted'){assert.ok(s.reviewer&&s.reviewed_at&&s.signoff_evidence.length,'Acceptance needs named reviewer and evidence')}assert.ok(s.execution_steps.length>=3)}
});
