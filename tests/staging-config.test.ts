import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=()=>import('../scripts/prepare-staging-wrangler.mjs' as string);
const values={CF_D1_DATABASE_ID:'12345678-1234-1234-1234-123456789abc',CF_ACCOUNT_ID:'a'.repeat(32),CF_R2_BUCKET:'nyales-staging-files',FIREBASE_PROJECT_ID:'nyales-test',VITE_FIREBASE_PROJECT_ID:'nyales-test',VITE_FIREBASE_API_KEY:'authored-config-fixture',VITE_FIREBASE_AUTH_DOMAIN:'nyales-test.firebaseapp.com'};
test('Staging deploy binds built Worker, root paths, matching Firebase and isolated resources without demo or cron',async()=>{
 const {stagingConfig}=await load(),config=stagingConfig(values);
 assert.equal(config.main,'dist/nyales/index.js');assert.equal(config.no_bundle,true);assert.equal(config.assets.directory,'./dist/client');assert.equal(config.vars.APP_ENV,'staging');assert.equal(config.vars.LOCAL_AUTH,'false');assert.equal(config.d1_databases[0].migrations_dir,'migrations');assert.equal(config.d1_databases[0].database_name,'nyales-staging');assert.deepEqual(config.triggers.crons,[]);
 assert.equal(JSON.stringify(config).includes(values.VITE_FIREBASE_API_KEY),false);
 for(const overrides of [{CF_D1_DATABASE_ID:'00000000-0000-0000-0000-000000000000'},{CF_R2_BUCKET:'nyales-import-sources'},{CF_ACCOUNT_ID:'invalid'},{FIREBASE_PROJECT_ID:''},{VITE_FIREBASE_PROJECT_ID:'another-project'},{VITE_FIREBASE_AUTH_DOMAIN:'https://invalid/path'}])assert.throws(()=>stagingConfig({...values,...overrides}));
});
test('Staging mutation is dispatched explicitly; Firebase is available before build and no generated bindings are uploaded',async()=>{
 const workflow=await readFile('.github/workflows/deploy-staging.yml','utf8');assert.ok(workflow.includes('workflow_dispatch:'));assert.ok(!/^  push:/m.test(workflow));assert.ok(workflow.indexOf('Validate staging configuration')<workflow.indexOf('Build with matching Firebase'));assert.ok(workflow.indexOf('--dry-run')<workflow.indexOf('migrations apply'));assert.ok(!workflow.includes('seed.sql'));assert.ok(!workflow.includes('upload-artifact'));assert.ok(workflow.includes('test "$GITHUB_REF" = refs/heads/main'));
});
