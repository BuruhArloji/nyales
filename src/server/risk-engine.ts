import {z} from 'zod';
import {riskPolicyConfig,type RiskMetric,type RiskResult} from '../shared/customer-risk';

const date=z.iso.date(),id=z.string().min(1).max(128);
const inputSchema=z.object({
 customer_id:id,cutoff:date,customer_status:z.enum(['Aktif','Churn','New','Unknown']),
 company_history_authorized:z.boolean(),company_last_invoice_date:date.nullable(),
 source:z.object({complete_from:date,complete_through:date,history_complete:z.boolean()}).nullable(),
 invoices:z.array(z.object({id,source_invoice_id:z.string().min(1).max(512),customer_id:id,invoice_date:date,net_minor:z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),is_current:z.boolean(),status:z.enum(['validated','cancelled','draft']),validation_state:z.enum(['validated','pending','invalid']),currency:z.string().max(8)}).strict()).max(50000),
}).strict();
export type RiskInput=z.infer<typeof inputSchema>;
const DAY=86400000,shift=(value:string,days:number)=>new Date(Date.parse(value+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
const days=(a:string,b:string)=>Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY);
const metric=(state:RiskMetric['state'],code:string,evidence:Record<string,unknown>={}):RiskMetric=>({state,code,evidence});
const integer=(n:bigint)=>{if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))throw Error('AMOUNT_OVERFLOW');return Number(n)};
export function riskComparison(cutoff:string,mode:'completed_months'|'comparable_mtd'){
 const currentStart=cutoff.slice(0,7)+'-01',priorEnd=shift(currentStart,-1),priorStart=priorEnd.slice(0,7)+'-01';
 if(mode==='completed_months'){const baselineEnd=shift(priorStart,-1);return{current_start:priorStart,current_end:priorEnd,baseline_start:baselineEnd.slice(0,7)+'-01',baseline_end:baselineEnd,mode}}
 // Both MTD windows contain exactly the same number of local business dates.
 const day=Math.min(Number(cutoff.slice(8)),Number(priorEnd.slice(8)));
 return{current_start:currentStart,current_end:currentStart.slice(0,8)+String(day).padStart(2,'0'),baseline_start:priorStart,baseline_end:priorStart.slice(0,8)+String(day).padStart(2,'0'),mode};
}

/** Pure computation only. It neither saves policies nor publishes customer risk. */
export function evaluateCustomerRisk(rawInput:RiskInput,rawPolicy:unknown):RiskResult{
 const input=inputSchema.parse(rawInput),policy=riskPolicyConfig.parse(rawPolicy),{cutoff,source}=input;
 const complete=(start:string,end:string)=>Boolean(source&&source.complete_from<=start&&source.complete_through>=end);
 const eligible=input.invoices.filter(i=>i.customer_id===input.customer_id&&i.is_current&&i.status==='validated'&&i.validation_state==='validated'&&i.currency==='IDR'&&i.invoice_date<=cutoff);
 const ids=new Set<string>(),businessIds=new Set<string>();for(const row of eligible){if(ids.has(row.id)||businessIds.has(row.source_invoice_id))throw Error('DUPLICATE_CURRENT_INVOICE_INPUT');ids.add(row.id);businessIds.add(row.source_invoice_id)}
 const daily=new Map<string,bigint>();for(const row of eligible)daily.set(row.invoice_date,(daily.get(row.invoice_date)||0n)+BigInt(row.net_minor));
 for(const total of daily.values())integer(total);
 const purchaseDates=[...daily].filter(([,net])=>net>0n).map(([d])=>d).sort();
 let near:RiskMetric=metric('disabled','indicator_disabled');
 if(policy.near_churn.enabled){
  const start=shift(cutoff,-90),last=input.company_last_invoice_date;
  if(!input.company_history_authorized)near=metric('insufficient_data','company_history_not_authorized');
  else if(!complete(start,cutoff))near=metric('insufficient_data','rolling_window_incomplete',{start,cutoff});
  else if(last&&last>cutoff)throw Error('FUTURE_COMPANY_LAST_INVOICE');
  else if(!last||input.customer_status==='New')near=metric('insufficient_data','no_company_invoice_history');
  else if(input.customer_status==='Unknown')near=metric('insufficient_data','customer_status_unknown');
  else{const elapsed=days(last,cutoff),evidence={company_last_invoice_date:last,days_since:elapsed,threshold_days:policy.near_churn.after_days,active_window_days:90};near=(input.customer_status==='Churn'&&elapsed<=90)||(input.customer_status==='Aktif'&&elapsed>90)?metric('insufficient_data','company_status_date_conflict',evidence):input.customer_status==='Churn'?metric('not_applicable','already_churn',evidence):metric(elapsed>=policy.near_churn.after_days?'flag':'no_flag',elapsed>=policy.near_churn.after_days?'approaching_churn_window':'below_near_churn_threshold',evidence)}
 }
 let repeat:RiskMetric=metric('disabled','indicator_disabled');
 if(policy.repeat_order.enabled){
  const rule=policy.repeat_order,start=shift(cutoff,-rule.lookback_days),dates=purchaseDates.filter(d=>d>=start),base={window_start:start,window_end:cutoff,order_dates:dates,minimum_order_dates:rule.minimum_order_dates,overdue_multiplier_milli:rule.overdue_multiplier_milli,basis:'authorized current net-positive invoice dates; same-day invoices are one purchase date'};
  if(!complete(start,cutoff))repeat=metric('insufficient_data','repeat_window_incomplete',base);
  else if(dates.length<rule.minimum_order_dates)repeat=metric('insufficient_data','too_few_purchase_dates',base);
  else{const intervals=dates.slice(1).map((date,index)=>days(dates[index],date)),ordered=[...intervals].sort((a,b)=>a-b),middle=Math.floor(ordered.length/2),medianTwice=ordered.length%2?2*ordered[middle]:ordered[middle-1]+ordered[middle],elapsed=days(dates.at(-1)!,cutoff),flag=BigInt(elapsed)*2000n>BigInt(medianTwice)*BigInt(rule.overdue_multiplier_milli);repeat=metric(flag?'flag':'no_flag',flag?'repeat_order_overdue':'within_repeat_observation',{...base,intervals_days:intervals,median_interval_days:medianTwice/2,last_purchase_date:dates.at(-1),days_since:elapsed,overdue_after_days:medianTwice*rule.overdue_multiplier_milli/2000})}
 }
 let decline:RiskMetric=metric('disabled','indicator_disabled');
 if(policy.sales_decline.enabled){
  const rule=policy.sales_decline,range=riskComparison(cutoff,rule.comparison),total=(from:string,to:string)=>integer([...daily].filter(([d])=>d>=from&&d<=to).reduce((n,[,v])=>n+v,0n)),baseline=total(range.baseline_start,range.baseline_end),current=total(range.current_start,range.current_end),baselineDates=purchaseDates.filter(d=>d>=range.baseline_start&&d<=range.baseline_end),base={...range,observed_baseline_minor:baseline,observed_current_minor:current,baseline_order_dates:baselineDates.length,minimum_baseline_order_dates:rule.minimum_baseline_order_dates,minimum_baseline_minor:rule.minimum_baseline_minor,threshold_drop_basis_points:rule.drop_basis_points};
  if(!complete(range.baseline_start,range.baseline_end)||!complete(range.current_start,range.current_end))decline=metric('insufficient_data','comparison_source_incomplete',base);
  else if(baseline<=0||baseline<rule.minimum_baseline_minor||baselineDates.length<rule.minimum_baseline_order_dates)decline=metric('insufficient_data','baseline_insufficient',base);
  else{const numerator=(BigInt(baseline)-BigInt(current))*10000n,threshold=BigInt(baseline)*BigInt(rule.drop_basis_points),bps=numerator/BigInt(baseline),safe=bps<=BigInt(Number.MAX_SAFE_INTEGER)&&bps>=BigInt(Number.MIN_SAFE_INTEGER);decline=metric(numerator>=threshold?'flag':'no_flag',numerator>=threshold?'sales_decline_threshold_met':'below_decline_threshold',{...base,observed_drop_basis_points:safe?Number(bps):null,exact_drop_numerator:numerator.toString(),exact_drop_denominator:baseline.toString()})}
 }
 const metrics={near_churn:near,repeat_order:repeat,sales_decline:decline},values=Object.values(metrics),flags=values.filter(v=>v.state==='flag').length,unknown=values.filter(v=>v.state==='insufficient_data').length;
 return{customer_id:input.customer_id,customer_status:input.customer_status,definition_version:'nyales-risk-1',cutoff,state:flags?unknown?'attention_with_gaps':'attention':unknown?'insufficient_data':'no_flag_observed',flag_count:flags,unknown_count:unknown,metrics};
}
