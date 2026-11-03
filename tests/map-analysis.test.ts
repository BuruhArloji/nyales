import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database} from './sqlite-helper';
import {buildBekasiPortfolio,toInsertStatements} from '../scripts/bekasi-portfolio-data';
import {analysisSql,buildBekasiAnalysis,demoRules} from '../scripts/bekasi-analysis-data';
import {readMapMetrics,mapPeriod} from '../src/server/map-metrics';
import {resolveScope} from '../src/server/scope';
import {mapPointStyle,mapSummary,pointFacts} from '../src/shared/map-analysis';
import {calculateIncentive} from '../src/server/incentive-engine';

test('monthly map facts reconcile invoice and activity totals without double counting location overlays',async()=>{
 const {sqlite,adapter}=database();
 sqlite.exec("INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO app_user(id,organization_id,name) VALUES('m','o','Management');");
 const base=buildBekasiPortfolio({organizationId:'o',managementId:'m',createdAt:'2026-11-03T00:00:00Z',financeEpoch:0});
 for(const sql of toInsertStatements(base))sqlite.exec(sql);
 const scope=await resolveScope(adapter,{id:'m',organization_id:'o',name:'Manager',role:'MANAGEMENT'});
 const ids=base.rows.customer_outlet.map(c=>String(c.id));
 for(const period of ['2026-08','2026-09','2026-10']){
  const facts=await readMapMetrics(adapter,scope,ids,period,'field');
  const expected=base.rows.invoice.filter(i=>String(i.invoice_date).startsWith(period));
  const customers=ids.map(id=>({id,metrics:facts.get(id)})),summary=mapSummary(customers);
  assert.equal(summary.actual,expected.reduce((n,i)=>n+Number(i.net_minor),0));assert.equal(summary.invoices,expected.length);
  assert.equal(summary.activities,base.visits.filter(v=>v.date.startsWith(period)).length);
  const source={id:'location',demo_operation_overlay:{...facts.get(ids[0]),productive_count:1,follow_up_count:2}};
  assert.equal(mapSummary([...customers,source]).actual,summary.actual);
  assert.equal(pointFacts(source).synthetic,true);assert.equal(pointFacts(source).meaningful_count,3);
 }
 // Other-month and channel facts cannot leak into this view.
 assert.equal(mapSummary(ids.map(id=>({metrics:(new Map()).get(id)}))).actual,0);
 const empty=await readMapMetrics(adapter,scope,ids,'2026-10','telesales');assert.equal([...empty.values()].reduce((n,m)=>n+m.actual_minor,0),0);
 const rep=String(base.rows.customer_assignment[0].rep_id),filtered=await readMapMetrics(adapter,scope,ids,'2026-10','field',rep);
 assert.equal([...filtered.values()].reduce((n,m)=>n+m.actual_minor,0),base.rows.invoice.filter(i=>i.rep_id===rep&&String(i.invoice_date).startsWith('2026-10')).reduce((n,i)=>n+Number(i.net_minor),0));
 const restricted={...scope,orgWide:false,allRepsInArea:false,repIds:['unrelated'],areaIds:[],channel:'field' as const};
 const denied=await readMapMetrics(adapter,restricted,ids,'2026-10','field');assert.equal([...denied.values()].reduce((n,m)=>n+m.actual_minor+m.activity_count,0),0);
 const other={...scope,identity:{...scope.identity,organization_id:'other'}};assert.equal([...await readMapMetrics(adapter,other,ids,'2026-10','field')].reduce((n,[,m])=>n+m.actual_minor+m.activity_count,0),0);
 sqlite.close();
});

test('analysis fixture adds monthly targets and incentive previews without changing original facts',()=>{
 const {sqlite}=database();sqlite.exec("PRAGMA foreign_keys=ON;INSERT INTO organization(id,name) VALUES('o','Org');INSERT INTO app_user(id,organization_id,name) VALUES('m','o','Management');");
 const d=buildBekasiAnalysis('o','m','2026-11-03T00:00:00Z');for(const sql of toInsertStatements(d.base))sqlite.exec(sql);
 const before=JSON.stringify(sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),visits=JSON.stringify(sqlite.prepare('SELECT * FROM activity ORDER BY id').all());
 sqlite.exec('BEGIN');for(const sql of analysisSql(d))sqlite.exec(sql);sqlite.exec('COMMIT');
 assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM invoice ORDER BY id').all()),before);assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM activity ORDER BY id').all()),visits);
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM target_version WHERE status='approved'").get() as any).n,3);
 assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM incentive_statement').get() as any).n,12);
 assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM incentive_statement WHERE status<>'prepared'").get() as any).n,0);
 for(const run of d.rows.calculation_run){const inputs=JSON.parse(String(run.inputs_json)),result=JSON.parse(String(run.result_json));assert.equal(result.payout_minor,calculateIncentive(demoRules,inputs.target_minor,inputs.actual_minor).payout_minor);assert.equal(inputs.sources.reduce((n:number,s:any)=>n+s.net_minor,0),inputs.actual_minor)}
 assert.equal(calculateIncentive(demoRules,10000000,8000000).payout_minor,500000);
 assert.equal(calculateIncentive(demoRules,10000000,11000000).payout_minor,540000);
 sqlite.close();
});

test('map symbology and calendar bounds communicate observed data, unknowns and negative sales',()=>{
 assert.deepEqual(mapPeriod('2026-12'),{start:'2026-12-01',end:'2027-01-01'});assert.throws(()=>mapPeriod('2026-13'));
 const a=mapPointStyle({metrics:{invoice_count:1,actual_minor:1e6}},'performance'),b=mapPointStyle({metrics:{invoice_count:1,actual_minor:1e7}},'performance');assert.ok(b.radius>a.radius);
 assert.notEqual(mapPointStyle({status:'Unknown'},'risk').color,mapPointStyle({status:'Churn'},'risk').color);
 assert.notEqual(mapPointStyle({metrics:{invoice_count:1,actual_minor:-100}},'performance').color,mapPointStyle({metrics:{invoice_count:0}},'performance').color);
});
