import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('existing Beverage audit is explicit, staging-only and isolated from all deployments and mutations',()=>{
 const workflow=readFileSync('.github/workflows/deploy-staging.yml','utf8');
 assert.match(workflow,/audit_beverage_overlay:\n\s+description:[^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/);
 const start=workflow.indexOf('\n  beverage_overlay_audit:\n');
 assert.ok(start>0);
 const job=workflow.slice(start),previous=workflow.slice(0,start);
 for(const name of ['package','candidate_overlay','deploy']){
  const block=previous.slice(previous.indexOf('\n  '+name+':\n'));
  assert.match(block.split('\n    runs-on:')[0],/inputs\.audit_beverage_overlay != true/);
 }
 assert.match(job,/environment: staging/);
 assert.match(job,/github\.ref == 'refs\/heads\/main' && inputs\.audit_beverage_overlay == true/);
 assert.match(job,/audit-existing-beverage-overlay\.ts --remote/);
 assert.doesNotMatch(job,/--apply|migrations apply|wrangler deploy|r2 object|seed-[\w-]+\.ts|save-outlet-role-candidates\.ts/);
 for(const flag of ['CANDIDATE_SAVE','SEED_BEKASI_DEMO','MAP_BEKASI_DEMO_POINTS','COMPLETE_BEKASI_ANALYSIS','EXPAND_BEVERAGE_DEMO','NORMALIZE_IDENTITY_NAMES','AUDIT_OUTLET_ROLE_CANDIDATES'])assert.ok(job.includes('test "$'+flag+'" = false'));
 assert.match(job,/path: test-results\/beverage-overlay-audit\.json/);
 assert.match(job,/permissions:\n\s+contents: read/);
});
