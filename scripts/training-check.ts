import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
const text=z.string().trim().min(1),when=z.iso.datetime();
const evidence=z.array(text).min(1);
const execution=z.object({participant:text,role:text,evaluator:text,performed_at:when,result:z.enum(['pass','fail']),evidence}).strict();
export const trainingRegister=z.object({format:z.literal('nyales-training-register-1'),date:z.iso.date(),materials_status:z.literal('prepared_for_dummy_training'),human_training_completed:z.boolean(),production_accepted:z.literal(false),coordinator:z.object({name:text,responsibility:text}),named_participants:z.array(text).min(1),capacity:z.number().int().min(1).max(10),materials:z.array(text).min(4),support:z.record(text,text.nullable()),cases:z.array(z.object({id:text,title:text,roles:z.array(text).min(1),sop:text,steps:z.array(text).min(3),expected:text,required_evidence:z.array(text).min(1),status:z.enum(['pending','pass','fail']),executions:z.array(execution)}).strict()).min(15),handover:z.array(z.object({id:text,deliverable:text,owner_role:text,status:z.enum(['pending','accepted']),recipient:text.nullable(),accepted_at:when.nullable(),evidence:z.array(text)}).strict()).min(7),defects:z.array(z.object({id:text,severity:z.enum(['P0','P1','P2','P3']),status:z.enum(['open','closed']),description:text,evidence:z.array(text)}).strict()),signoffs:z.array(z.object({function:text,reviewer:text.nullable(),reviewed_at:when.nullable(),decision:z.enum(['pending','accepted','rejected']),evidence:z.array(text)}).strict()).min(4)}).strict();
export function checkTraining(input:unknown,root=process.cwd()){
 const r=trainingRegister.parse(input),issues:string[]=[];
 const file=(path:string)=>existsSync(resolve(root,path));
 if(r.named_participants.length>r.capacity)issues.push('PARTICIPANT_CAPACITY');
 for(const path of r.materials)if(!file(path))issues.push('MISSING_MATERIAL:'+path);
 if(new Set(r.cases.map(c=>c.id)).size!==r.cases.length)issues.push('DUPLICATE_CASE_ID');
 const must=['l1_owner','l1_backup','l2_owner','l2_backup','finance_reviewer','support_channel','service_hours','response_policy'];
 for(const key of must)if(!r.support[key])issues.push('SUPPORT_PENDING:'+key);
 for(const c of r.cases){if(c.status!=='pass'){issues.push('CASE_PENDING_OR_FAILED:'+c.id);continue;}
  if(!c.executions.length||c.executions.some(e=>e.result!=='pass'))issues.push('CASE_EXECUTION_NOT_PASSED:'+c.id);
  for(const e of c.executions){if(!c.roles.includes(e.role)||e.participant===e.evaluator)issues.push('CASE_ROLE_OR_SELF_REVIEW:'+c.id);for(const p of e.evidence)if(!file(p))issues.push('MISSING_EVIDENCE:'+c.id+':'+p);}
 }
 for(const name of r.named_participants)if(!r.cases.some(c=>c.executions.some(e=>e.participant===name)))issues.push('PARTICIPANT_NOT_EVALUATED:'+name);
 for(const h of r.handover){if(h.status!=='accepted'||!h.recipient||!h.accepted_at||!h.evidence.length)issues.push('HANDOVER_PENDING:'+h.id);for(const p of h.evidence)if(!file(p))issues.push('MISSING_HANDOVER_EVIDENCE:'+h.id);}
 for(const s of r.signoffs){if(s.decision!=='accepted'||!s.reviewer||!s.reviewed_at||!s.evidence.length)issues.push('SIGNOFF_PENDING:'+s.function);for(const p of s.evidence)if(!file(p))issues.push('MISSING_SIGNOFF_EVIDENCE:'+s.function);}
 for(const d of r.defects)if(d.status==='open'&&['P0','P1'].includes(d.severity))issues.push('CRITICAL_DEFECT:'+d.id);
 if(r.human_training_completed&&issues.length)throw Error('Training completion claimed with unresolved evidence: '+issues.join(', '));
 return{format:'nyales-training-readiness-1',materials_ready:r.materials.every(file),cases:r.cases.length,cases_passed:r.cases.filter(c=>c.status==='pass').length,handover_accepted:r.handover.filter(h=>h.status==='accepted').length,human_training_completed:r.human_training_completed&&issues.length===0,operational_handover_accepted:r.human_training_completed&&issues.length===0,production_accepted:false,issues};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=checkTraining(JSON.parse(readFileSync('docs/WEB061_REGISTER.json','utf8')));console.log(JSON.stringify(r,null,2));process.exitCode=r.materials_ready?0:2}catch(e){console.error((e as Error).message);process.exitCode=1}}
