import {workloadInput,type WorkloadInput,type WorkloadChannel} from '../shared/workload';

type Service=WorkloadInput['customers'][number]['services'][number];
type CustomerService={customer_id:string;boundary_id:string|null;service:Service};
const sum=(values:number[])=>{const total=values.reduce((n,v)=>n+BigInt(v),0n);if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))throw Error('AMOUNT_OVERFLOW');return Number(total)};
const share=(value:number,total:number)=>total>0?Number(BigInt(value)*10000n/BigInt(total)):null;

function demand(services:CustomerService[]){
 const unknownFrequency=services.filter(x=>x.service.contacts_per_period===null).length;
 const unknownDuration=services.filter(x=>x.service.contacts_per_period!==0&&x.service.duration_minutes===null).length;
 const knownContacts=sum(services.map(x=>x.service.contacts_per_period??0));
 const knownMinutes=sum(services.map(({service:s})=>s.contacts_per_period!==null&&s.duration_minutes!==null?s.contacts_per_period*s.duration_minutes:0));
 const complete=unknownFrequency===0&&unknownDuration===0;
 return{customer_count:services.length,known_contacts_per_period:knownContacts,contacts_per_period:unknownFrequency?null:knownContacts,known_service_minutes:knownMinutes,service_minutes:complete?knownMinutes:null,unknown_frequency_customers:unknownFrequency,unknown_duration_customers:unknownDuration,demand_complete:complete};
}

/** Comparison only. No optimizer, persistence, territory authorization or scheduling. */
export function simulateWorkload(raw:WorkloadInput){
 const input=workloadInput.parse(raw),customersById=new Map(input.customers.map(c=>[c.id,c])),transfers=new Map(input.transfers.map(t=>[t.channel+':'+t.customer_id,t.to_rep_id]));
 function snapshot(after:boolean){
  const channels=(['field','telesales'] as const).map(channel=>{
   const services:CustomerService[]=input.customers.flatMap(c=>c.services.filter(s=>s.channel===channel).map(s=>({customer_id:c.id,boundary_id:c.boundary_id,service:{...s,rep_id:after&&transfers.has(channel+':'+c.id)?transfers.get(channel+':'+c.id)!:s.rep_id}})));
   const representatives=input.reps.filter(r=>r.channel===channel).sort((a,b)=>a.id.localeCompare(b.id));
   const perRep=new Map<string|null,CustomerService[]>();for(const row of services){const k=row.service.rep_id;if(!perRep.has(k))perRep.set(k,[]);perRep.get(k)!.push(row)}
   const total=demand(services),salesComplete=representatives.every(r=>r.source_complete&&r.observed_sales_minor!==null),salesNet=salesComplete?sum(representatives.map(r=>r.observed_sales_minor!)):null;
   const salesScoreAvailable=salesComplete&&salesNet!==null&&salesNet>0&&representatives.every(r=>r.observed_sales_minor!>=0),w=input.parameters.weights;
   const scoreUnavailable=!input.basis.cohort_complete?'partial_cohort':w.customers>0&&!total.customer_count?'no_customer_baseline':w.service_minutes>0&&(total.service_minutes===null||total.service_minutes<=0)?'service_baseline_unknown_or_zero':w.observed_sales>0&&!salesScoreAvailable?'sales_baseline_incomplete_nonpositive_or_negative':null;
   const rows=representatives.map(rep=>{
    const d=demand(perRep.get(rep.id)||[]),capacity=rep.capacity_service_minutes;
    const state=!input.basis.cohort_complete?'partial_cohort':!d.demand_complete||capacity===null?'insufficient_data':capacity===0?(d.service_minutes!>0?'over_capacity':'no_service_demand'):d.service_minutes!>capacity?'over_capacity':'within_observed_service_capacity';
    const lowerBoundExceeds=capacity!==null&&d.known_service_minutes>capacity;
    const terms=[{weight:w.customers,value:d.customer_count,total:total.customer_count},{weight:w.service_minutes,value:d.service_minutes,total:total.service_minutes},{weight:w.observed_sales,value:rep.observed_sales_minor,total:salesNet}].filter(t=>t.weight>0);
    // Explicit normalized shares, expressed as basis points. Never a capacity or market-potential score.
    const weighted=scoreUnavailable?null:Number(terms.reduce((n,t)=>n+BigInt(t.weight)*BigInt(share(t.value!,t.total!)!),0n)/10000n);
    return{rep_id:rep.id,channel,...d,capacity_service_minutes:capacity,utilization_percent:input.basis.cohort_complete&&d.demand_complete&&capacity!==null&&capacity>0?d.service_minutes!/capacity*100:null,utilization_state:state,known_demand_exceeds_capacity:lowerBoundExceeds,observed_historical_sales_minor:rep.observed_sales_minor,historical_sales_source_complete:rep.source_complete,weighted_share_basis_points:weighted,weighted_share_status:scoreUnavailable||'available'};
   });
   const unassigned=demand(perRep.get(null)||[]),boundaries=new Map<string|null,CustomerService[]>();for(const row of services){if(!boundaries.has(row.boundary_id))boundaries.set(row.boundary_id,[]);boundaries.get(row.boundary_id)!.push(row)}
   return{channel,...total,cohort_complete:input.basis.cohort_complete,assigned_customer_count:services.length-unassigned.customer_count,unassigned,boundaries:[...boundaries].sort(([a],[b])=>(a||'').localeCompare(b||'')).map(([boundary_id,items])=>({boundary_id,...demand(items)})),known_observed_historical_sales_minor:sum(representatives.filter(r=>r.observed_sales_minor!==null).map(r=>r.observed_sales_minor!)),observed_historical_sales_minor:salesNet,historical_sales_source_complete:salesComplete,reps:rows,weighting:{...input.parameters.weights,unit:'basis_points_of_explicit_metric_shares',status:scoreUnavailable||'available',unassigned_customers_excluded_from_rep_scores:unassigned.customer_count>0}};
  });
  return{unique_customer_count:input.customers.length,customer_channel_relationships:channels.reduce((n,c)=>n+c.customer_count,0),channels};
 }
 const before=snapshot(false),after=snapshot(true),diff=input.transfers.map(t=>{const from=customersById.get(t.customer_id)!.services.find(s=>s.channel===t.channel)!.rep_id;return{...t,from_rep_id:from,changed:from!==t.to_rep_id}}).sort((a,b)=>(a.channel+':'+a.customer_id).localeCompare(b.channel+':'+b.customer_id));
 return{definition_version:'nyales-workload-1' as const,basis:input.basis,period:input.period,parameters:input.parameters,before,after,transfers:diff,changed_customer_channels:diff.filter(t=>t.changed).length,unknown_capacity_rep_channels:input.reps.filter(r=>r.capacity_service_minutes===null).length,historical_attribution_unchanged:true,preview_writes_business_data:false,includes_travel_time:false,routing_used:false,notes:['Capacity is explicitly available service time, not total shift time or routing capacity.','Unknown demand/capacity never becomes a zero or a feasible schedule. Known demand may still prove over-capacity.','Field and telesales remain separate. One customer in both channels is one unique customer and two service relationships.','Historical invoice attribution stays with its original rep; a territory simulation never transfers invoice history.','Weighted shares require explicit weights and complete positive baselines; they do not recommend a transfer or estimate market potential.']};
}
