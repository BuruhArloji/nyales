import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDemo} from '../scripts/pilot-demo';
import {parseCsv} from '../src/shared/csv';
import {invoiceCsv} from '../src/shared/invoices';
import {checkTraining} from '../scripts/training-check';
import {localSeed} from '../scripts/pilot-local-prepare';
import {database} from './sqlite-helper';

test('local pilot SQL restores complete finance history under D1 statement limits with all integrity guards enabled',async()=>{
 const dir=join(mkdtempSync(join(tmpdir(),'nyales-seed-')),'run');let sql='';
 await runDemo(dir,undefined,sqlite=>{sql=localSeed(sqlite)});
 assert.ok(sql.split('\n').every(statement=>Buffer.byteLength(statement)<90000));
 const {sqlite}=database();try{
  sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(sql);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM invoice WHERE organization_id='demo-org'").get() as any).n,80);
  const job=sqlite.prepare('SELECT plan_json,payload_json FROM invoice_import_job').get() as any;assert.ok(JSON.parse(job.plan_json));assert.ok(JSON.parse(job.payload_json));
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM target_version WHERE status='approved'").get() as any).n,2);
  assert.throws(()=>sqlite.exec("UPDATE target_item SET target_minor=1"),/TARGET_LOCKED/);
  assert.throws(()=>sqlite.exec("UPDATE invoice SET net_minor=1"),/INVOICE_REVISION_REQUIRED/);
 }finally{sqlite.close()}
});

test('WEB-065 seed transport preserves large Unicode audit snapshots without updating immutable restored records',async()=>{
 const dir=join(mkdtempSync(join(tmpdir(),'nyales-unicode-seed-')),'run');let sql='';const content='x'.repeat(8999)+'😀'.repeat(5001)+'nyales-training-only';
 await runDemo(dir,undefined,sqlite=>{const actor=sqlite.prepare("SELECT id FROM app_user WHERE organization_id='nyales-training-only' LIMIT 1").get() as any;sqlite.prepare("INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,after_json) VALUES('unicode-audit','nyales-training-only',?,'transport-fixture','large-snapshot','fixture',?,?)").run(actor.id,new Date().toISOString(),JSON.stringify({content}));sql=localSeed(sqlite)});
 assert.ok(sql.split('\n').every(statement=>Buffer.byteLength(statement)<90000));const {sqlite}=database();try{sqlite.exec(sql);const row=sqlite.prepare("SELECT after_json FROM master_audit WHERE id='unicode-audit'").get() as any;assert.equal(JSON.parse(row.after_json).content,content.replaceAll('nyales-training-only','demo-org'));assert.equal(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='nyales_seed_immutable_chunks'").get(),undefined);assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[])}finally{sqlite.close()}
});

test('WEB-060 isolated 10-sales rehearsal commits real finance/target routes, replays once and extracts independent DB facts',async()=>{
 const dir=join(mkdtempSync(join(tmpdir(),'nyales-rehearsal-')),'run'),before=readFileSync('pilot/demo-10-sales/source-data.json'),report=await runDemo(dir);
 assert.equal(report.status,'ready_for_named_review');assert.equal(report.data_classification,'synthetic');assert.equal(report.production_accepted,false);assert.equal(report.issues.length,0);
 const summary=JSON.parse(readFileSync(join(dir,'SUMMARY.json'),'utf8'));assert.equal(summary.sales,10);assert.equal(summary.customers,20);assert.equal(summary.invoices,80);assert.equal(summary.credits,4);assert.equal(summary.invoice_retry_same_job,true);assert.equal(summary.totals.invoice_net_idr,'36520000');assert.equal(summary.totals.approved_target_leaf_idr,'80000000');assert.equal(summary.totals.approved_target_reserve_idr,'200000');
 const steps=JSON.parse(readFileSync(join(dir,'api-rehearsal.json'),'utf8')).events;assert.equal(steps.filter((s:any)=>s.path.endsWith('/approve')&&s.actor==='demo-reviewer').length,2);assert.equal(steps.filter((s:any)=>s.path==='/api/invoice-imports').length,3);
 const parsed=parseCsv(readFileSync(join(dir,'invoice-import.csv'),'utf8')),expanded=invoiceCsv(parsed,Object.fromEntries(parsed.headers.map(h=>[h,h])));assert.equal(expanded.errors.length,0);assert.equal(expanded.invoices.length,80);assert.equal(expanded.credit_notes.length,4);assert.equal(parseCsv(readFileSync(join(dir,'customer-import.csv'),'utf8')).rows.length,20);
 assert.ok(readFileSync('pilot/demo-10-sales/source-data.json').equals(before));await assert.rejects(runDemo(dir));
});
test('WEB-060 rehearsal refuses real data and non-training organizations',async()=>{
 const base=mkdtempSync(join(tmpdir(),'nyales-real-denied-')),source=JSON.parse(readFileSync('pilot/demo-10-sales/source-data.json','utf8'));source.data_classification='real_pilot';const path=join(base,'source.json');writeFileSync(path,JSON.stringify(source));await assert.rejects(runDemo(join(base,'result'),path),/Only the synthetic/);
});
test('WEB-061 prepared materials are distinct from 15 human training cases and named handover acceptance',()=>{
 const r=JSON.parse(readFileSync('docs/WEB061_REGISTER.json','utf8')),checked=checkTraining(r);assert.equal(checked.materials_ready,true);assert.equal(checked.cases,15);assert.equal(checked.cases_passed,0);assert.equal(checked.handover_accepted,0);assert.equal(checked.human_training_completed,false);assert.equal(checked.production_accepted,false);assert.ok(checked.issues.some(i=>i.startsWith('SUPPORT_PENDING')));r.human_training_completed=true;assert.throws(()=>checkTraining(r),/completion claimed/);
});
test('WEB-061 passing case needs an independent evaluator, allowed role and existing evidence',()=>{
 const r=JSON.parse(readFileSync('docs/WEB061_REGISTER.json','utf8'));r.cases[0].status='pass';r.cases[0].executions=[{participant:'Novely',role:'UNKNOWN',evaluator:'Novely',performed_at:'2026-10-21T00:00:00Z',result:'pass',evidence:['missing-proof.txt']}];const checked=checkTraining(r);assert.ok(checked.issues.some(i=>i.startsWith('CASE_ROLE_OR_SELF_REVIEW')));assert.ok(checked.issues.some(i=>i.startsWith('MISSING_EVIDENCE')));
});
