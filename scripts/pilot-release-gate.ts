import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

type Gate={id:string;status:'passed'|'blocked'|'not_applicable';evidence?:string;detail:string};
async function json(path:string){return JSON.parse(await readFile(resolve(path),'utf8'))}
export async function evaluatePilotReleaseGate(root=process.cwd()){
 const [stabilization,recovery,backlog]=await Promise.all([
  json(resolve(root,'docs/WEB062_STABILIZATION.json')),
  json(resolve(root,'docs/WEB057_OBJECT_EVIDENCE.json')),
  json(resolve(root,'docs/specifications/Backlog_Pembangunan_Web_v1_2.json')),
 ]);
 const item=(id:string)=>backlog.items.find((x:any)=>x.id===id);
 const gates:Gate[]=[
  {id:'LOCAL_TESTS',status:recovery.full_suite?.passed===318&&recovery.full_suite?.failed===0?'passed':'blocked',evidence:recovery.full_suite?.log,detail:'Full local regression must pass without failures.'},
  {id:'RECOVERY_OBJECT_DRILL',status:recovery.browser?.passed>=3&&recovery.browser?.proof_main?.object_report?.verified_count>=1?'passed':'blocked',evidence:'docs/WEB057_OBJECT_EVIDENCE.json',detail:'At least one existing pilot object must pass bounded checksum verification.'},
  {id:'BUSINESS_DATA_PRESERVED',status:Object.values(recovery.business_preservation||{}).every((x:any)=>x.all_preexisting_business_rows_unchanged===true)?'passed':'blocked',evidence:'docs/WEB057_OBJECT_EVIDENCE.json',detail:'Preexisting business rows must remain unchanged.'},
  {id:'REAL_ROLE_UAT',status:'blocked',evidence:'docs/WEB059_UAT_REGISTER.json',detail:'Named role/device reviewers have not signed the web scenarios.'},
  {id:'REAL_SOURCE_MIGRATION',status:item('WEB-060')?.status?.includes('real-data migration deferred')?'blocked':'passed',evidence:'pilot/demo-10-sales/README.md',detail:'Production source migration is still deferred.'},
  {id:'CLOUD_PROVIDER_ACCEPTANCE',status:'blocked',evidence:'docs/WEB062_STABILIZATION.json',detail:'Cloud restore, provider capacity, RPO/RTO and durability are not accepted.'},
  {id:'HUMAN_TRAINING_HANDOVER',status:stabilization.human_training_completed===true?'passed':'blocked',evidence:'docs/WEB061_REGISTER.json',detail:'Training and support handover sign-off is pending.'},
  {id:'PRODUCTION_APPROVAL',status:stabilization.production_accepted===true?'passed':'blocked',evidence:'docs/WEB062_STABILIZATION.json',detail:'Production go-live approval is pending.'},
 ];
 const blockers=gates.filter(g=>g.status==='blocked').map(g=>g.id);
 return {format:'nyales-pilot-release-gate-1',date:'2026-10-28',classification:'synthetic-local-review',decision:blockers.length===0?'eligible_for_human_go_live_review':'blocked',gates,blockers,production_accepted:false,cloud_deployed:false,mutated_data:false};
}
if(process.argv[1]&&process.argv[1].replaceAll('\\','/').endsWith('/pilot-release-gate.ts')){const output=process.argv[2];const report=await evaluatePilotReleaseGate();console.log(JSON.stringify(report,null,2));if(output){const {writeFile}=await import('node:fs/promises');await writeFile(resolve(output),JSON.stringify(report,null,2)+'\n',{flag:'wx'})}}
