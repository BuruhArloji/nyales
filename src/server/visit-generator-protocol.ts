import {VISIT_CONTRACT,visitSnapshot,visitResult,type VisitSnapshot,type VisitResult} from '../shared/visit-generator';

/** Pure transitions shared by the WEB-069 specification and WEB-070 diagnostic delivery adapter. Business planning endpoints remain unregistered. */
export type VisitJob={id:string;organization_id:string;environment:string;state:'queued'|'running'|'cancel_requested'|'completed'|'failed'|'cancelled'|'expired';version:number;attempt_no:number;fence:number;max_attempts:number;expires_at:number;snapshot_sha256:string;lease:{agent_id:string;credential_version:number;until:number}|null;result_sha256:string|null;failure_code:string|null};
type Context={organization_id:string;environment:string;now:number;expected_version:number;agent?:{id:string;credential_version:number;active:boolean;authorized_job_ids:readonly string[]}};
type Proof={attempt_no:number;fence:number;snapshot_sha256:string};
type Event={type:'claim';lease_seconds:number}|{type:'renew';lease_seconds:number;proof:Proof}|{type:'complete';proof:Proof;result_sha256:string}|{type:'attempt_failed';proof:Proof;retryable:boolean;code:string}|{type:'cancel'}|{type:'cancel_ack';proof:Proof}|{type:'reap'}|{type:'agent_revoked';agent_id:string};
function deny(code:string):never{throw Error(code)}
const terminal=(state:VisitJob['state'])=>['completed','failed','cancelled','expired'].includes(state);
export type PlanningScope={organization_id:string;actor_id:string;role:'MANAGEMENT'|'NSM'|'REGIONAL_MANAGER'|'AREA_MANAGER'|'SUPERVISOR'|'SALES_REP'|'TELESALES';channel:'field'|'telesales'|null;allowed_rep_ids:readonly string[]};
/** allowed_rep_ids must be derived server-side from current hierarchy, area and dated field assignments. */
export function authorizeVisitOperation(scope:PlanningScope,operation:'configure'|'generate'|'read'|'cancel'|'review'|'publish',organization:string,repIds:readonly string[]=[],requester?:string){
 if(scope.organization_id!==organization)deny('PLANNING_SCOPE_DENIED');
 const national=['MANAGEMENT','NSM'].includes(scope.role);
 if(operation==='configure'){if(!national)deny('PLANNING_SETTINGS_DENIED');return}
 if(scope.role==='TELESALES'||scope.channel==='telesales')deny('FIELD_PLANNING_ONLY');
 if(!repIds.length||repIds.length>10||new Set(repIds).size!==repIds.length||repIds.some(id=>!scope.allowed_rep_ids.includes(id)))deny('PLANNING_SCOPE_DENIED');
 if(scope.role==='SALES_REP'){
  if(repIds.length!==1||repIds[0]!==scope.actor_id)deny('PLANNING_SELF_ONLY');
  if(operation==='review'||operation==='publish')deny('PLANNING_REVIEWER_REQUIRED');
  if(operation==='cancel'&&requester!==scope.actor_id)deny('PLANNING_REQUESTER_REQUIRED');
 }
}
export function transitionVisitJob(job:VisitJob,event:Event,c:Context):VisitJob{
 if(job.organization_id!==c.organization_id||job.environment!==c.environment)deny('JOB_NOT_FOUND');
 if(job.version!==c.expected_version)deny('JOB_VERSION_CHANGED');
 if(!Number.isSafeInteger(c.now)||c.now<0)deny('INVALID_SERVER_CLOCK');
 if(terminal(job.state))deny('JOB_TERMINAL');
 const next:VisitJob=structuredClone(job);next.version++;
 const release=(state:VisitJob['state'],code:string|null=null)=>{next.state=state;next.lease=null;next.failure_code=code;return next};
 const actor=()=>{const a=c.agent;if(!a?.active||!a.authorized_job_ids.includes(job.id))deny('AGENT_SCOPE_DENIED');return a!};
 const ownership=(proof:Proof)=>{const a=actor();if(!job.lease||job.lease.agent_id!==a.id||job.lease.credential_version!==a.credential_version||proof.attempt_no!==job.attempt_no||proof.fence!==job.fence)deny('LEASE_FENCED');if(proof.snapshot_sha256!==job.snapshot_sha256)deny('SNAPSHOT_CHANGED');if(c.now>=job.lease!.until)deny('LEASE_EXPIRED');if(c.now>=job.expires_at)deny('JOB_DEADLINE_EXPIRED')};
 const leaseUntil=(seconds:number)=>{if(!Number.isInteger(seconds)||seconds<30||seconds>600)deny('INVALID_LEASE_DURATION');return Math.min(job.expires_at,c.now+seconds*1000)};
 if(event.type==='cancel'){if(job.state==='queued')return release('cancelled');if(job.state==='running'){next.state='cancel_requested';return next}deny('CANCEL_ALREADY_REQUESTED')}
 if(event.type==='reap'){if(c.now>=job.expires_at)return release(job.state==='cancel_requested'?'cancelled':'expired','deadline_expired');if(job.lease&&c.now>=job.lease.until){next.fence++;return release(job.state==='cancel_requested'?'cancelled':job.attempt_no>=job.max_attempts?'failed':'queued',job.state==='cancel_requested'?null:'lease_expired')}deny('JOB_NOT_EXPIRED')}
 if(event.type==='agent_revoked'){if(!job.lease||job.lease.agent_id!==event.agent_id)deny('AGENT_NOT_JOB_OWNER');next.fence++;return release(job.state==='cancel_requested'?'cancelled':job.attempt_no>=job.max_attempts?'failed':'queued','agent_revoked')}
 if(event.type==='claim'){const a=actor();if(job.state!=='queued'||job.lease)deny('JOB_NOT_QUEUED');if(c.now>=job.expires_at)deny('JOB_DEADLINE_EXPIRED');if(job.attempt_no>=job.max_attempts)deny('ATTEMPTS_EXHAUSTED');next.state='running';next.attempt_no++;next.fence++;next.failure_code=null;next.lease={agent_id:a.id,credential_version:a.credential_version,until:leaseUntil(event.lease_seconds)};return next}
 ownership(event.proof);
 if(event.type==='cancel_ack'){if(job.state!=='cancel_requested')deny('CANCEL_NOT_REQUESTED');return release('cancelled')}
 if(job.state!=='running')deny('JOB_CANCEL_PENDING');
 if(event.type==='renew'){next.lease!.until=leaseUntil(event.lease_seconds);return next}
 if(event.type==='attempt_failed'){if(!event.code)deny('FAILURE_CODE_REQUIRED');return release(event.retryable&&job.attempt_no<job.max_attempts?'queued':'failed',event.code)}
 if(!/^[a-f0-9]{64}$/.test(event.result_sha256))deny('INVALID_RESULT_HASH');next.result_sha256=event.result_sha256;return release('completed');
}

export type CandidateIssue={code:string;occurrence_id?:string;rep_day_id?:string};
/** Candidate validation is structural/time/assignment validation, never proof of a road matrix. */
export function inspectVisitCandidate(input:VisitSnapshot,raw:VisitResult,expectedSnapshotSha256:string){
 const source=visitSnapshot.parse(input),result=visitResult.parse(raw),issues:CandidateIssue[]=[],add=(code:string,occurrence_id?:string,rep_day_id?:string)=>issues.push({code,...(occurrence_id?{occurrence_id}:{}),...(rep_day_id?{rep_day_id}:{})});
 if(!/^[a-f0-9]{64}$/.test(expectedSnapshotSha256))deny('INVALID_EXPECTED_SNAPSHOT_HASH');
 if(result.snapshot_sha256!==expectedSnapshotSha256||result.job_id!==source.job_id||result.graph_sha256!==source.graph.graph_sha256||result.policy_sha256!==source.policy_sha256)add('RESULT_REFERENCE_MISMATCH');
 const occurrences=new Map(source.occurrences.map(o=>[o.id,o])),days=new Map(source.rep_days.map(d=>[d.id,d])),seen=new Set<string>(),routes=new Set<string>(),scheduled=new Map<string,{occurrence_id:string;date:string}[]>();
 for(const route of result.routes){const day=days.get(route.rep_day_id);if(!day){add('UNKNOWN_REP_DAY',undefined,route.rep_day_id);continue}if(routes.has(day.id))add('DUPLICATE_REP_DAY',undefined,day.id);routes.add(day.id);
  if(route.ordered_occurrence_ids.length!==route.visits.length||route.ordered_occurrence_ids.some((id,i)=>id!==route.visits[i].occurrence_id))add('ROUTE_ORDER_MISMATCH',undefined,day.id);
  let last=Date.parse(day.shift.from);for(const visit of route.visits){const o=occurrences.get(visit.occurrence_id),depart=Date.parse(visit.travel_departure_at),arrival=Date.parse(visit.arrival_at),start=Date.parse(visit.service_start_at),end=Date.parse(visit.departure_at);
   if(!o){add('UNKNOWN_OCCURRENCE',visit.occurrence_id,day.id);continue}if(seen.has(o.id))add('DUPLICATE_OCCURRENCE',o.id,day.id);seen.add(o.id);
   if(!o.eligible_rep_day_ids.includes(day.id))add('ASSIGNMENT_DATE_MISMATCH',o.id,day.id);
   if(o.point===null||o.service_seconds===null||!o.windows.length||o.missing_fields.length)add('MISSING_REQUIRED_INPUT',o.id,day.id);
   if(depart<last||arrival!==depart+visit.travel_from_previous_seconds*1000||start<arrival||end<start||o.service_seconds!==null&&end-start!==o.service_seconds*1000)add('TIME_OR_SERVICE_MISMATCH',o.id,day.id);
   if(start<Date.parse(day.shift.from)||end>Date.parse(day.shift.until)||!o.windows.some(w=>start>=Date.parse(w.from)&&end<=Date.parse(w.until)))add('WINDOW_VIOLATION',o.id,day.id);
   if(day.breaks.some(b=>depart<Date.parse(b.until)&&arrival>Date.parse(b.from)||start<Date.parse(b.until)&&end>Date.parse(b.from)))add('BREAK_OVERLAP_TRAVEL_OR_SERVICE',o.id,day.id);
   if(o.locked_appointment&&(o.locked_appointment.rep_day_id!==day.id||Date.parse(o.locked_appointment.arrival_at)!==arrival))add('LOCKED_APPOINTMENT_MOVED',o.id,day.id);
   if(source.protected_agenda.some(p=>p.rep_id===day.rep_id&&p.work_plan_id!==o.locked_appointment?.work_plan_id&&(depart<Date.parse(p.reserved_until)&&arrival>Date.parse(p.scheduled_at)||start<Date.parse(p.reserved_until)&&end>Date.parse(p.scheduled_at))))add('PROTECTED_AGENDA_OVERLAP',o.id,day.id);
   if(o.last_completed_date&&Date.parse(day.date)-Date.parse(o.last_completed_date)<o.minimum_gap_days*86400000)add('MINIMUM_GAP_VIOLATION',o.id,day.id);
   if(!scheduled.has(o.customer_id))scheduled.set(o.customer_id,[]);scheduled.get(o.customer_id)!.push({occurrence_id:o.id,date:day.date});last=end;
  }
  const returnDepart=Date.parse(route.return_departure_at),returning=Date.parse(route.return_at);if(returnDepart<last||returning!==returnDepart+route.return_travel_seconds*1000||returning>Date.parse(day.shift.until))add('RETURN_OUTSIDE_SHIFT',undefined,day.id);
  if(day.breaks.some(b=>returnDepart<Date.parse(b.until)&&returning>Date.parse(b.from)))add('BREAK_OVERLAP_RETURN',undefined,day.id);
  if(source.protected_agenda.some(p=>p.rep_id===day.rep_id&&returnDepart<Date.parse(p.reserved_until)&&returning>Date.parse(p.scheduled_at)))add('PROTECTED_AGENDA_OVERLAP_RETURN',undefined,day.id);
  const service=route.visits.reduce((n,v)=>n+(Date.parse(v.departure_at)-Date.parse(v.service_start_at))/1000,0);if(service>day.capacity_service_seconds)add('SERVICE_CAPACITY_EXCEEDED',undefined,day.id);
 }
 for(const rows of scheduled.values()){rows.sort((a,b)=>a.date.localeCompare(b.date));for(let i=1;i<rows.length;i++){const a=occurrences.get(rows[i-1].occurrence_id)!,b=occurrences.get(rows[i].occurrence_id)!;if(Date.parse(rows[i].date)-Date.parse(rows[i-1].date)<Math.max(a.minimum_gap_days,b.minimum_gap_days)*86400000)add('MINIMUM_GAP_VIOLATION',b.id)}}
 for(const row of result.unscheduled){if(!occurrences.has(row.occurrence_id))add('UNKNOWN_UNSCHEDULED_OCCURRENCE',row.occurrence_id);if(seen.has(row.occurrence_id))add('DUPLICATE_OCCURRENCE',row.occurrence_id);seen.add(row.occurrence_id)}
 for(const id of occurrences.keys())if(!seen.has(id))add('OCCURRENCE_SILENTLY_DROPPED',id);
 for(const o of occurrences.values())for(const assumption of o.assumptions)if(!result.assumptions_disclosed.some(a=>a.occurrence_id===o.id&&a.field===assumption.field&&a.reason===assumption.reason))add('ASSUMPTION_NOT_DISCLOSED',o.id);
 if(result.hard_violations.length)add('REPORTED_HARD_VIOLATIONS');
 if(result.unscheduled.some(row=>occurrences.get(row.occurrence_id)?.obligation==='required'))add('MINIMUM_FREQUENCY_NOT_MET');
 if(!['feasible','timeout_with_candidate'].includes(result.solver_outcome))add('NO_FEASIBLE_CANDIDATE');
 return{contract_version:VISIT_CONTRACT,issues,structurally_valid:issues.length===0,publishable:false as const,requires_server_matrix_verification:true as const,requires_current_scope_source_and_agenda_review:true as const};
}
