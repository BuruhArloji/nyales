import {z} from 'zod';

const id=z.string().min(1).max(128),channel=z.enum(['field','telesales']);
const count=z.number().int().min(0),money=z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const service=z.object({channel,rep_id:id.nullable(),contacts_per_period:count.max(366).nullable(),duration_minutes:z.number().int().min(1).max(1440).nullable()}).strict();

/** No channel or business assumptions are installed by this schema. */
export const workloadParameters=z.object({
 schema_version:z.literal(1),
 demand_basis:z.literal('explicit_contacts_per_period'),
 capacity_basis:z.literal('service_minutes_excluding_travel_and_overhead'),
 weights:z.object({customers:count.max(10000),service_minutes:count.max(10000),observed_sales:count.max(10000)}).strict(),
}).strict().refine(p=>p.weights.customers+p.weights.service_minutes+p.weights.observed_sales===10000,'Weights must total 10000 basis points.');

export const workloadInput=z.object({
 basis:z.object({dataset_id:id,dataset_version:z.number().int().positive(),input_revision:count,scope_fingerprint:z.string().regex(/^[a-f0-9]{64}$/),mapping_cutoff:z.iso.date(),source_cutoff:z.iso.date().nullable(),cohort_complete:z.boolean()}).strict(),
 period:z.object({start:z.iso.date(),end:z.iso.date()}).strict().refine(p=>p.start<=p.end&&Date.parse(p.end)-Date.parse(p.start)<31*86400000,'Period must be 1 to 31 business dates.'),
 parameters:workloadParameters,
 reps:z.array(z.object({id,channel,capacity_service_minutes:count.max(525600).nullable(),observed_sales_minor:money.nullable(),source_complete:z.boolean()}).strict()).max(200),
 customers:z.array(z.object({id,boundary_id:id.nullable(),services:z.array(service).min(1).max(2).refine(s=>new Set(s.map(x=>x.channel)).size===s.length,'Duplicate customer channel.')} ).strict()).max(2000),
 transfers:z.array(z.object({customer_id:id,channel,to_rep_id:id.nullable()}).strict()).max(2000),
}).strict().superRefine((v,ctx)=>{
 const key=(id:string,ch:string)=>ch+':'+id,reps=new Set<string>(),repIds=new Set<string>(),customers=new Map(v.customers.map(c=>[c.id,c]));
 for(const rep of v.reps){const k=key(rep.id,rep.channel);if(reps.has(k)||(repIds.has(rep.id)&&rep.capacity_service_minutes!==null))ctx.addIssue({code:'custom',message:'Duplicate rep/channel'});reps.add(k);if(rep.capacity_service_minutes!==null)repIds.add(rep.id);if(rep.capacity_service_minutes!==null&&rep.capacity_service_minutes>((Date.parse(v.period.end)-Date.parse(v.period.start))/86400000+1)*1440)ctx.addIssue({code:'custom',message:'Service capacity exceeds elapsed calendar minutes'})}
 if(customers.size!==v.customers.length)ctx.addIssue({code:'custom',message:'Duplicate canonical customer'});
 for(const customer of v.customers)for(const s of customer.services)if(s.rep_id&&!reps.has(key(s.rep_id,s.channel)))ctx.addIssue({code:'custom',message:'Current owner outside input scope/channel'});
 const seen=new Set<string>();for(const t of v.transfers){const k=key(t.customer_id,t.channel);if(seen.has(k))ctx.addIssue({code:'custom',message:'Duplicate customer/channel transfer'});seen.add(k);if(!customers.get(t.customer_id)?.services.some(s=>s.channel===t.channel))ctx.addIssue({code:'custom',message:'Transfer customer/channel absent from source'});if(t.to_rep_id&&!reps.has(key(t.to_rep_id,t.channel)))ctx.addIssue({code:'custom',message:'Recipient outside input scope/channel'})}
});

export type WorkloadInput=z.infer<typeof workloadInput>;
export type WorkloadChannel='field'|'telesales';
