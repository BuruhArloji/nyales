import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {businessSignatureSql,digest} from '../scripts/bekasi-real-point-mapping';

test('business preservation guard reads actual invoice source versions and detects changes without an invoice.version column',()=>{
 const {sqlite}=database(),org="guard'org";
 try{
  sqlite.prepare('INSERT INTO organization(id,name) VALUES(?,?)').run(org,'Guard fixture');
  sqlite.prepare('INSERT INTO organization(id,name) VALUES(?,?)').run('other-org','Other fixture');
  const insert=sqlite.prepare('INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,invoice_date,net_minor,status) VALUES(?,?,?,?,?,?,?)');
  insert.run('invoice-a',org,'source-a','revision-1','2026-10-01',100,'validated');
  insert.run('invoice-b',org,'source-b','revision-2|special','2026-10-02',200,'validated');
  insert.run('invoice-other','other-org','source-other','999','2026-10-02',99999,'validated');
  assert.equal(sqlite.prepare('PRAGMA table_info(invoice)').all().some((c:any)=>c.name==='version'),false);
  const signature=()=>sqlite.prepare(businessSignatureSql(org)).get() as any;
  const before=signature();
  assert.equal(before.invoice_count,2);assert.equal(before.invoice_total,300);
  assert.deepEqual(JSON.parse(before.invoice_versions),['revision-1','revision-2|special']);
  assert.equal(before.assignments,0);assert.equal(before.target_versions,0);assert.equal(before.activities,0);assert.equal(before.visit_events,0);
  assert.equal(digest(signature()),digest(before));
  insert.run('invoice-c',org,'source-a','revision-3','2026-10-01',100,'validated');
  assert.notEqual(digest(signature()),digest(before),'Version preservation must be checked, not silently dropped');
 }finally{sqlite.close()}
});
