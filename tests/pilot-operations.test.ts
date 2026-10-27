import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pilotOperations} from '../scripts/pilot-operations';
import {database} from './sqlite-helper';

test('pilot operations preserves finance, scoped roles, visit replay, DNC, qualification and append-only publication',async()=>{
 const dir=join(mkdtempSync(join(tmpdir(),'nyales-ops-')),'run'),originalDate=Date;
 const result=await pilotOperations(dir);assert.equal(Date,originalDate);assert.equal(result.coverage_percent,40);assert.equal(result.manual_pic_connections,2);assert.equal(result.provider_verified_connections,null);assert.equal(result.production_accepted,false);
 const db=database();try{
  db.sqlite.exec('PRAGMA foreign_keys=ON');db.sqlite.exec(readFileSync('pilot/local-20261021-v3/seed.sql','utf8'));
  const invoices=JSON.stringify(db.sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),sql=readFileSync(join(dir,'operations.sql'),'utf8');
  assert.ok(!/INSERT INTO "customer_(?:segmentation_run|status_snapshot)"/.test(sql));
  db.sqlite.exec(sql);assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(JSON.stringify(db.sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),invoices);
  assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM activity').get() as any).n,12);assert.equal((db.sqlite.prepare('SELECT COUNT(*) n FROM visit_event').get() as any).n,16);
  assert.equal((db.sqlite.prepare("SELECT COUNT(*) n FROM contact WHERE permission_status='dnc'").get() as any).n,1);
  assert.equal((db.sqlite.prepare("SELECT COUNT(*) n FROM customer_outlet WHERE id LIKE 'negative-%'").get() as any).n,0);
  assert.throws(()=>db.sqlite.exec(sql),/UNIQUE/);
 }finally{db.sqlite.close()}
});
