import {z} from 'zod';
import {workloadParameters} from './workload';
import {distributionInput} from './distribution';
const id=z.string().min(1).max(128),reason=z.string().trim().min(8).max(500),channel=z.enum(['field','telesales']);
const contacts=z.number().int().min(0).max(366).nullable(),duration=z.number().int().min(1).max(1440).nullable(),minutes=z.number().int().min(0).max(44640).nullable();
const capacity=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('unknown')}).strict(),
 z.object({mode:z.literal('fixed_service_minutes'),minutes:minutes.unwrap()}).strict(),
 z.object({mode:z.literal('calendar_share'),service_share_basis_points:z.number().int().min(0).max(10000)}).strict(),
]);
const rule=z.object({cohort:z.enum(['all_active_customers','assigned_or_proposed']),contacts_per_period:contacts,duration_minutes:duration,capacity}).strict();
export const workloadPolicyConfig=z.object({
 schema_version:z.literal(1),period_basis:z.literal('calendar_month'),parameters:workloadParameters,
 channels:z.object({field:rule,telesales:rule}).strict(),
 customer_overrides:z.array(z.object({customer_id:id,channel,contacts_per_period:contacts,duration_minutes:duration,reason}).strict()).max(2000),
 rep_overrides:z.array(z.object({rep_id:id,channel,capacity_service_minutes:minutes,reason}).strict()).max(200),
}).strict().superRefine((v,c)=>{for(const [rows,key]of [[v.customer_overrides,'customer_id'],[v.rep_overrides,'rep_id']]as const){const keys=rows.map((r:any)=>r.channel+':'+r[key]);if(new Set(keys).size!==keys.length)c.addIssue({code:'custom',message:'Duplicate channel override'})}});
export const workloadQuery=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),sales_period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),effective_date:z.iso.date(),dataset_id:id.optional()}).strict();
export const scenarioPreviewInput=z.object({basis:workloadQuery,batches:z.array(z.object({key:id,input:distributionInput}).strict()).max(10)}).strict().superRefine((v,c)=>{if(new Set(v.batches.map(b=>b.key)).size!==v.batches.length)c.addIssue({code:'custom',message:'Duplicate batch key'});const ids=v.batches.flatMap(b=>[...(b.input.customer_ids||[]),...(b.input.exception_customer_ids||[])]);if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Each customer belongs to one reviewed batch; use both channels in that batch'});for(const b of v.batches){if(b.input.effective_from_date!==v.basis.effective_date)c.addIssue({code:'custom',message:'Batch effective date must match analysis basis'});if(b.input.assignment_mode!=='none'&&b.input.customer_ids===undefined)c.addIssue({code:'custom',message:'Explicit customer subset required; never expand a saved scenario cohort'})}});
export const scenarioSaveInput=scenarioPreviewInput.safeExtend({name:z.string().trim().min(1).max(160),reason,preview_hash:z.string().regex(/^[a-f0-9]{64}$/),basis_epoch:z.number().int().nonnegative()});
export const scenarioApplyInput=z.object({revision_id:id,batch_key:id,preview_hash:z.string().regex(/^[a-f0-9]{64}$/),basis_epoch:z.number().int().nonnegative(),reason,confirmed:z.literal(true)}).strict();
export type WorkloadPolicyConfig=z.infer<typeof workloadPolicyConfig>;
export type WorkloadQuery=z.infer<typeof workloadQuery>;
