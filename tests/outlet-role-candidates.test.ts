import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertApprovedRoleScope,assertRoleReadOnlySql,assertRoleStaging,outletSourceAuditSql,ROLE_STAGING_ACCOUNT,ROLE_STAGING_DATABASE,summarizeOutletSources} from '../scripts/audit-outlet-role-candidates';

test('outlet-role preflight accounts for all current points and keeps synthetic cohorts separate',()=>{
 const groups=[{cohort:'external_directory',outlet_type:'source label',row_count:45950},{cohort:'synthetic_demo',outlet_type:'retail_demo',row_count:1000},{cohort:'training_blank',outlet_type:'',row_count:20}];
 const summary=summarizeOutletSources(groups);assert.equal(summary.total,46970);assertApprovedRoleScope(summary);
 assert.throws(()=>assertApprovedRoleScope(summarizeOutletSources(groups.slice(0,1))),/SCOPE_MISMATCH/);
 assert.throws(()=>assertApprovedRoleScope(summarizeOutletSources([...groups,{cohort:'other',outlet_type:'unexpected',row_count:1}])),/SCOPE_MISMATCH/);
 const sql=outletSourceAuditSql("org'quoted");assert.match(sql,/organization_id='org''quoted'/);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
});

test('read-only audit query guard rejects multi-statements, comments, and mutation keywords',()=>{
 assertRoleReadOnlySql('SELECT id FROM customer_outlet ORDER BY id LIMIT 10');
 for(const sql of ['SELECT 1; DROP TABLE customer_outlet','SELECT 1 -- trailing comment','SELECT 1 /* comment */','WITH x AS (SELECT 1) DELETE FROM customer_outlet','UPDATE customer_outlet SET name=\'x\''])assert.throws(()=>assertRoleReadOnlySql(sql),/READ_ONLY_AUDIT_QUERY_REQUIRED/);
});

test('outlet-role operations require the exact established staging account and database',()=>{
 const config={name:'nyales-staging',vars:{APP_ENV:'staging'},account_id:ROLE_STAGING_ACCOUNT,d1_databases:[{database_name:'nyales-staging',database_id:ROLE_STAGING_DATABASE}]};
 const env={CF_ACCOUNT_ID:ROLE_STAGING_ACCOUNT,CF_D1_DATABASE_ID:ROLE_STAGING_DATABASE,CLOUDFLARE_API_TOKEN:'unit-fixture-not-a-credential'};
 assertRoleStaging(config,env,true);
 assert.throws(()=>assertRoleStaging(config,env,false),/REMOTE_FLAG_REQUIRED/);
 assert.throws(()=>assertRoleStaging({...config,name:'production'},env,true),/EXACT_STAGING_TARGET_REQUIRED/);
 assert.throws(()=>assertRoleStaging(config,{...env,CF_D1_DATABASE_ID:'other'},true),/EXACT_STAGING_TARGET_REQUIRED/);
 assert.throws(()=>assertRoleStaging(config,{...env,CLOUDFLARE_API_TOKEN:''},true),/STAGING_CREDENTIAL_REQUIRED/);
});

test('candidate saver is opt-in and uses a dedicated staging job with unrelated data actions disabled',()=>{
 const workflow=readFileSync('.github/workflows/deploy-staging.yml','utf8');
 for(const input of ['seed_bekasi_demo','map_bekasi_demo_points','complete_bekasi_analysis','expand_beverage_demo','normalize_identity_names','audit_outlet_role_candidates','save_outlet_role_candidates'])assert.match(workflow,new RegExp(input+':[\\s\\S]*?default: false'));
 assert.match(workflow,/inputs\.audit_outlet_role_candidates == true/);
 assert.match(workflow,/inputs\.save_outlet_role_candidates == true/);
 assert.match(workflow,/candidate_overlay:[\s\S]*?save-outlet-role-candidates\.ts --apply --remote/);
 assert.match(workflow,/inputs\.save_outlet_role_candidates != true/);
 assert.match(workflow,/CANDIDATE_SAVE:[\s\S]*?SEED_BEKASI_DEMO:[\s\S]*?MAP_BEKASI_DEMO_POINTS:[\s\S]*?COMPLETE_BEKASI_ANALYSIS:[\s\S]*?EXPAND_BEVERAGE_DEMO:[\s\S]*?NORMALIZE_IDENTITY_NAMES:[\s\S]*?AUDIT_OUTLET_ROLE_CANDIDATES:/);
});
