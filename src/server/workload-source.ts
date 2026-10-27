import {z} from 'zod';
import {workloadPolicyConfig,type WorkloadQuery} from '../shared/workload-policy';
import {workloadInput,type WorkloadChannel} from '../shared/workload';
import {regionalReport} from './geography-analytics';
import {activeWorkloadPolicy} from './workload-policies';
import {canonicalJson} from '../shared/boundaries';
import {digest,fail,riskScopeFingerprint} from './operations';
import {simulateWorkload} from './workload-engine';
import type {Scope} from './scope';

const calendarSchema=z.object({weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7),holidays:z.array(z.iso.date()),start_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).refine(c=>c.start_time<c.end_time);
export function plannedCalendarCapacity(start:string,end:string,timezone:string,raw:unknown,share:number){
 const parsed=calendarSchema.safeParse(raw);if(!parsed.success)return{minutes:null,code:'calendar_invalid'};
 const c=parsed.data,first=Date.parse(start+'T00:00:00Z'),last=Date.parse(end+'T00:00:00Z');
 if(!Number.isFinite(first)||last<first||last-first>=31*86400000||!Number.isInteger(share)||share<0||share>10000)throw Error('INVALID_CAPACITY_WINDOW');
 // Nominal planning hours. A clock transition is not silently treated as a normal shift.
 try{const f=new Intl.DateTimeFormat('en',{timeZone:timezone,timeZoneName:'longOffset'}),offset=(ms:number)=>f.formatToParts(new Date(ms)).find(x=>x.type==='timeZoneName')!.value,initial=offset(first-86400000);for(let day=first;day<=last+86400000;day+=86400000)if(offset(day)!==initial)return{minutes:null,code:'clock_transition_requires_explicit_capacity'}}catch{return{minutes:null,code:'calendar_timezone_invalid'}}
 const minute=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));let nominal=0,days=0;
 for(let day=first;day<=last;day+=86400000){const date=new Date(day),value=date.toISOString().slice(0,10);if(c.weekdays.includes(date.getUTCDay()||7)&&!c.holidays.includes(value)){nominal+=minute(c.end_time)-minute(c.start_time);days++}}
 return{minutes:Number(BigInt(nominal)*BigInt(share)/10000n),code:'nominal_calendar_share',working_days:days,nominal_minutes:nominal,service_share_basis_points:share};
}
export async function workloadEpoch(c:any){const row=await(c.env.DB as D1Database).prepare('SELECT epoch FROM geo_distribution_epoch WHERE organization_id=?').bind(c.get('identity').organization_id).first<any>();if(!row)fail(503,'WORKLOAD_REVISION_UNAVAILABLE');return Number(row.epoch)}

/** Browser filters never establish completeness or override the source/actor predicates. */
export async function prepareWorkload(c:any,q:WorkloadQuery,transfers:{customer_id:string;channel:WorkloadChannel;to_rep_id:string|null}[]=[]){
 const db=c.env.DB as D1Database,s=c.get('scope') as Scope,organization=s.identity.organization_id;
 if(q.effective_date<s.date)fail(422,'PAST_DATE_NOT_ALLOWED');
 const policy=await activeWorkloadPolicy(c);if(!policy)fail(409,'WORKLOAD_POLICY_NOT_CONFIGURED');const config=workloadPolicyConfig.parse(JSON.parse(policy.config_json));if(await digest(canonicalJson(config))!==policy.config_sha256)fail(409,'WORKLOAD_POLICY_CHECKSUM_MISMATCH');
 const report=await regionalReport(c,{period:q.sales_period,...(q.dataset_id?{dataset_id:q.dataset_id}:{})}),epoch=report.data.basis.revision;
 const start=q.period+'-01',end=new Date(Date.UTC(Number(q.period.slice(0,4)),Number(q.period.slice(5,7)),0)).toISOString().slice(0,10),cohort=report.sources.customers,customerIds=new Set(cohort.map(x=>x.id));
 const active=(await db.prepare("SELECT u.id,u.name,r.role_code,r.channel FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=? AND u.status='active' AND r.role_code IN('SALES_REP','TELESALES') AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?) ORDER BY u.id,r.channel LIMIT 201").bind(organization,q.effective_date,q.effective_date).all<any>()).results;if(active.length>200)fail(422,'WORKLOAD_REP_LIMIT_NARROW_ORGANIZATION');
 const areaScopes=(await db.prepare('SELECT ua.user_id,ua.area_id,a.branch_id,b.timezone FROM user_area_scope ua JOIN area a ON a.organization_id=ua.organization_id AND a.id=ua.area_id JOIN branch b ON b.organization_id=a.organization_id AND b.id=a.branch_id WHERE ua.organization_id=? AND ua.effective_from_date<=? AND(ua.effective_to_date IS NULL OR ua.effective_to_date>?)').bind(organization,q.effective_date,q.effective_date).all<any>()).results;
 const readable=active.filter(r=>(!s.channel||r.channel===s.channel)&&(s.orgWide||s.repIds.includes(r.id)||s.allRepsInArea&&areaScopes.some(a=>a.user_id===r.id&&s.areaIds.includes(a.area_id)))),readableKeys=new Set(readable.map(r=>r.channel+':'+r.id));
 const owners=(await db.prepare('SELECT ca.*,COALESCE(co.merged_into_id,co.id) canonical_id FROM customer_assignment ca JOIN customer_outlet co ON co.organization_id=ca.organization_id AND co.id=ca.outlet_id WHERE ca.organization_id=? AND ca.effective_from_date<=? AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?) AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) ORDER BY ca.id LIMIT 4001').bind(organization,q.effective_date,q.effective_date,JSON.stringify([...customerIds])).all<any>()).results;if(owners.length>4000)fail(422,'WORKLOAD_ASSIGNMENT_LIMIT');
 const ownerByKey=new Map<string,any>();for(const r of owners.filter(r=>!s.channel||r.channel===s.channel)){const key=r.channel+':'+r.canonical_id;if(ownerByKey.has(key))fail(422,'WORKLOAD_ASSIGNMENT_OVERLAP_NEEDS_REVIEW');ownerByKey.set(key,r)}
 const calendars=(await db.prepare("SELECT * FROM work_calendar WHERE organization_id=? AND status='active'").bind(organization).all<any>()).results;
 const sales=new Map(report.sources.sales.filter(r=>r.rep_id).map(r=>[r.channel+':'+r.rep_id,r.observed_actual_net_minor]));
 const representatives=new Map<string,any>(readable.map(r=>[r.channel+':'+r.id,{...r,eligible_recipient:true}]));
 for(const owner of owners.filter(r=>!s.channel||r.channel===s.channel))if(!representatives.has(owner.channel+':'+owner.rep_id))representatives.set(owner.channel+':'+owner.rep_id,{id:owner.rep_id,name:'PIC di luar role / struktur yang dapat dibaca',channel:owner.channel,eligible_recipient:false});
 if(s.orgWide)for(const row of report.sources.sales)if(row.rep_id&&!representatives.has(row.channel+':'+row.rep_id))representatives.set(row.channel+':'+row.rep_id,{id:row.rep_id,name:'Sales historis tanpa role aktif',channel:row.channel,eligible_recipient:false});
 if(representatives.size>200)fail(422,'WORKLOAD_REP_LIMIT_NARROW_ORGANIZATION');
 const knownActive=new Set(active.map(r=>r.channel+':'+r.id));if(s.orgWide&&(config.customer_overrides.some(x=>!customerIds.has(x.customer_id))||config.rep_overrides.some(x=>!knownActive.has(x.channel+':'+x.rep_id))))fail(422,'WORKLOAD_POLICY_REFERENCE_NEEDS_REVIEW');
 const capacityEvidence:any[]=[],customerOverrides=new Map(config.customer_overrides.map(r=>[r.channel+':'+r.customer_id,r])),repOverrides=new Map(config.rep_overrides.map(r=>[r.channel+':'+r.rep_id,r]));
 const reps=[...representatives].map(([key,rep])=>{
  const override=repOverrides.get(key),rule=config.channels[rep.channel as WorkloadChannel].capacity,branches=[...new Map(areaScopes.filter(a=>a.user_id===rep.id).map(a=>[a.branch_id,a])).values()];let capacity:number|null=null,evidence:any={code:'capacity_not_configured'};
  if(rep.eligible_recipient){if(override){capacity=override.capacity_service_minutes;evidence={code:'explicit_rep_override',reason:override.reason}}else if(rule.mode==='fixed_service_minutes'){capacity=rule.minutes;evidence={code:'explicit_channel_service_minutes'}}else if(rule.mode==='calendar_share'){const branch=branches.length===1?branches[0]:null,calendar=branch?calendars.find(c=>c.branch_id===branch.branch_id):null;evidence=!branch?{code:'single_branch_calendar_required'}:!calendar?{code:'calendar_missing'}:plannedCalendarCapacity(start,end,branch.timezone,{weekdays:JSON.parse(calendar.weekdays_json),holidays:JSON.parse(calendar.holidays_json),start_time:calendar.start_time,end_time:calendar.end_time},rule.service_share_basis_points);capacity=evidence.minutes??null;if(calendar)evidence={...evidence,calendar_id:calendar.id,calendar_version:calendar.version,timezone:branch.timezone}}}
  else evidence={code:'owner_without_readable_active_role'};
  if(capacity!==null&&capacity>(Date.parse(end)-Date.parse(start)+86400000)/60000)fail(422,'WORKLOAD_CAPACITY_EXCEEDS_PERIOD');capacityEvidence.push({rep_id:rep.id,channel:rep.channel,...evidence});
  return{id:rep.id,channel:rep.channel as WorkloadChannel,capacity_service_minutes:capacity,observed_sales_minor:readableKeys.has(key)||s.orgWide?sales.get(key)||0:null,source_complete:(readableKeys.has(key)||s.orgWide)&&report.data.freshness.source_complete};
 });
 const proposedChannels=new Set(transfers.map(t=>t.channel+':'+t.customer_id));
 const customerRows=cohort.map(customer=>({id:customer.id,boundary_id:customer.boundary_id,services:(['field','telesales'] as const).filter(ch=>(!s.channel||ch===s.channel)&&(config.channels[ch].cohort==='all_active_customers'||ownerByKey.has(ch+':'+customer.id)||proposedChannels.has(ch+':'+customer.id))).map(ch=>{const rule=config.channels[ch],override=customerOverrides.get(ch+':'+customer.id);return{channel:ch,rep_id:ownerByKey.get(ch+':'+customer.id)?.rep_id||null,contacts_per_period:override?override.contacts_per_period:rule.contacts_per_period,duration_minutes:override?override.duration_minutes:rule.duration_minutes}})})).filter(c=>c.services.length>0);
 const input=workloadInput.safeParse({basis:{dataset_id:report.data.basis.boundary_dataset.id,dataset_version:report.data.basis.boundary_dataset.version,input_revision:epoch,scope_fingerprint:await riskScopeFingerprint(s),mapping_cutoff:s.date,source_cutoff:report.data.freshness.source_cutoff,cohort_complete:s.orgWide},period:{start,end},parameters:config.parameters,reps,customers:customerRows,transfers});if(!input.success)fail(422,'WORKLOAD_SOURCE_OR_PROPOSAL_NEEDS_REVIEW');
 let result:ReturnType<typeof simulateWorkload>;try{result=simulateWorkload(input.data)}catch(e){if((e as Error).message==='AMOUNT_OVERFLOW')fail(422,'AMOUNT_OVERFLOW');throw e}
 if(await workloadEpoch(c)!==epoch)fail(412,'WORKLOAD_INPUT_CHANGED_RETRY');
 const data={result,basis:{...report.data.basis,service_period:{start,end},effective_date:q.effective_date,cohort:'current_active_canonical_customers_entire_authorized_scope',cohort_complete:s.orgWide,capacity_basis:'explicit service allocation; nominal calendars do not include an individual leave/attendance feed'},policy:{id:policy.id,name:policy.name,revision_no:policy.revision_no,config_sha256:policy.config_sha256},customers:cohort.map(x=>({id:x.id,name:x.name,boundary_id:x.boundary_id})),reps:[...representatives.values()].map(r=>({id:r.id,name:r.name,channel:r.channel,eligible_recipient:r.eligible_recipient})),capacity_evidence:capacityEvidence,freshness:report.data.freshness,limits:{customers:2000,reps:200,snapshot_bytes:4194304}};
 return{data,input:input.data,config,policy,epoch,source_snapshot:report.data.snapshot};
}
