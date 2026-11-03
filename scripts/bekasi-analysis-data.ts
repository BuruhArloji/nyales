import {createHash} from 'node:crypto';
import {buildBekasiPortfolio,type SeedRow} from './bekasi-portfolio-data';
import {calculateIncentive,incentiveRules} from '../src/server/incentive-engine';

export const ANALYSIS_DEMO_ID='bekasi-analysis-v1';
export const demoRules=incentiveRules.parse({model:'threshold_progressive',threshold_bps:8000,bonus_minor:500000,tiers:[{from_bps:0,to_bps:8000,rate_bps:0},{from_bps:8000,to_bps:10000,rate_bps:100},{from_bps:10000,to_bps:null,rate_bps:200}]});
const json=JSON.stringify,hash=(x:unknown)=>createHash('sha256').update(json(x)).digest('hex');
export function buildBekasiAnalysis(org:string,actor:string,now:string){
 const base=buildBekasiPortfolio({organizationId:org,managementId:actor,createdAt:now,financeEpoch:0});
 const rows:Record<string,SeedRow[]>={};
 const add=(table:string,row:SeedRow)=>{(rows[table]||=[]).push({organization_id:org,...row})};
 const reps=base.rows.app_user.filter(u=>String(u.id).includes('sales-'));
 for(const month of ['2026-08','2026-09','2026-10']){
  const start=month+'-01',end=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10),targetPlan=ANALYSIS_DEMO_ID+'-target-'+month,targetVersion=targetPlan+'-v1',plan=ANALYSIS_DEMO_ID+'-incentive-'+month,pv=plan+'-v1';
  const leaves=reps.map((rep,index)=>{const actual=base.rows.invoice.filter(i=>i.rep_id===rep.id&&String(i.invoice_date).startsWith(month)).reduce((n,i)=>n+Number(i.net_minor),0);const ratio=[.85,.95,1.05,1.15][index];const target=Math.max(100000,Math.round(actual/ratio/100000)*100000);return {id:targetPlan+'-'+rep.id,organization_id:org,target_plan_id:targetPlan,target_version_id:targetVersion,user_id:rep.id,outlet_id:null,target_minor:target,baseline_kind:'synthetic_demo',status:'approved',area_id_snapshot:base.rows.customer_assignment.find(a=>a.rep_id===rep.id)!.area_id,rep_id_snapshot:rep.id,channel_snapshot:'field',product_id:null,product_group_id:null,input_reason:'DEMO sintetis: target untuk evaluasi UI, bukan komitmen bisnis.',hierarchy_snapshot_json:'[]'} as SeedRow});
  add('target_plan',{id:targetPlan,name:'Bekasi · DEMO analisis '+month,method:'bottom_up',period_start:start,period_end:end,status:'approved',channel:'field',basis:'invoice_net_idr',created_by:actor,created_at:now});
  // Insert leaves while draft; promote only this new synthetic version afterwards.
  add('target_version',{id:targetVersion,target_plan_id:targetPlan,revision_no:1,status:'draft',version:1,parent_minor:leaves.reduce((n,l)=>n+Number(l.target_minor),0),reserve_minor:0,created_by:actor,created_at:now,submitted_by:actor,approved_by:actor,approved_at:now,reason:'DEMO/SINTETIS: persetujuan fixture untuk uji analitik; bukan approval bisnis nyata.',baseline_json:json({synthetic:true,dataset:ANALYSIS_DEMO_ID})});
  for(const leaf of leaves)add('target_item',leaf);
  add('incentive_plan',{id:plan,name:'Insentif Bekasi · DEMO '+month,role_code:'SALES_REP',channel:'field',model:demoRules.model,basis:'invoice_net',status:'active',created_by:actor,created_at:now});
  add('incentive_plan_version',{id:pv,plan_id:plan,revision_no:1,target_version_id:targetVersion,period_start:start,period_end:end,timezone:'Asia/Jakarta',role_code:'SALES_REP',channel:'field',rules_json:json(demoRules),status:'active',version:1,created_by:actor,submitted_by:actor,approved_by:actor,created_at:now,reason:'DEMO sintetis: bonus Rp500 ribu pada 80%, marginal 1% pada 80–100%, 2% di atas 100%.',preview_json:json({synthetic:true})});
  for(const leaf of leaves){
   const enrollment=pv+'-'+leaf.user_id,run=enrollment+'-run',sources=base.rows.invoice.filter(i=>i.rep_id===leaf.user_id&&String(i.invoice_date).startsWith(month));
   const actual=sources.reduce((n,i)=>n+Number(i.net_minor),0),result=calculateIncentive(demoRules,Number(leaf.target_minor),actual);
   const inputs={synthetic:true,dataset:ANALYSIS_DEMO_ID,engine_version:'nyales-incentive-1',plan_version_id:pv,user_id:leaf.user_id,timezone:'Asia/Jakarta',target_minor:leaf.target_minor,actual_minor:actual,cutoff:end,target_items:[leaf],rules:demoRules,sources:sources.map(s=>({id:s.id,source_system:s.source_system,external_invoice_id:s.external_invoice_id,invoice_date:s.invoice_date,rep_id:s.rep_id,net_minor:s.net_minor,credited_minor:s.net_minor,eligible:true})),review_flags:['SYNTHETIC_DEMO_ONLY']};
   add('incentive_enrollment',{id:enrollment,plan_version_id:pv,user_id:leaf.user_id,role_code:'SALES_REP',channel:'field',period_start:start,period_end:end,area_ids_json:json([leaf.area_id_snapshot]),target_items_json:json([leaf]),status:'active'});
   add('calculation_run',{id:run,enrollment_id:enrollment,plan_version_id:pv,user_id:leaf.user_id,cutoff:end,source_hash:hash(inputs),inputs_json:json(inputs),result_json:json(result),created_by:actor,created_at:now});
   add('incentive_statement',{id:enrollment+'-statement',enrollment_id:enrollment,run_id:run,user_id:leaf.user_id,plan_version_id:pv,period_start:start,period_end:end,revision_no:1,status:'prepared',review_flags_json:json(inputs.review_flags),entitlement_minor:result.payout_minor,payable_delta_minor:result.payout_minor,version:1,created_by:actor,created_at:now,dispute_deadline:'2026-12-01T00:00:00Z'});
  }
 }
 add('master_audit',{id:ANALYSIS_DEMO_ID,actor_id:actor,resource_type:'training_dataset',resource_id:ANALYSIS_DEMO_ID,action:'analysis_demo_applied',before_json:null,after_json:json({synthetic:true,months:3,targets:12,incentive_schemes:3,prepared_statements:12,payment_executed:false}),occurred_at:now});
 return {rows,base};
}
const q=(value:unknown)=>value===null?'NULL':typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
export function analysisSql(dataset:ReturnType<typeof buildBekasiAnalysis>){
 const statements:string[]=[];
 for(const [table,rows] of Object.entries(dataset.rows)){
  for(const row of rows)statements.push(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(q).join(',')});`);
  if(table==='target_item')for(const row of dataset.rows.target_version)statements.push(`UPDATE target_version SET status='approved' WHERE organization_id=${q(row.organization_id)} AND id=${q(row.id)} AND status='draft';`);
 }
 return statements;
}
