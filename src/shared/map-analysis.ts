export type MapAnalysisMode='scatter'|'performance'|'coverage'|'risk';
export const mapColors={neutral:'#a5b8b3',low:'#a9d8cb',mid:'#489d8b',high:'#08685f',covered:'#137f72',uncovered:'#c5ceca',risk:'#b8793f',unknown:'#9ca4a1'};
export function pointFacts(customer:any){
 const overlay=customer.demo_operation_overlay;
 return overlay?{...overlay,meaningful_count:Number(overlay.productive_count||0)+Number(overlay.follow_up_count||0),synthetic:true}:customer.metrics||null;
}
export function mapPointStyle(customer:any,mode:MapAnalysisMode){
 const facts=pointFacts(customer),actual=Number(facts?.actual_minor||0),visits=Number(facts?.meaningful_count||0);
 if(mode==='performance')return {color:!facts||!facts.invoice_count?mapColors.neutral:actual<=0?mapColors.risk:actual<1e6?mapColors.low:actual<5e6?mapColors.mid:mapColors.high,radius:!facts?.invoice_count?5:Math.min(18,6+Math.sqrt(Math.max(0,actual)/1e6)*2)};
 if(mode==='coverage')return {color:visits>0?mapColors.covered:mapColors.uncovered,radius:visits>0?8:5};
 if(mode==='risk')return {color:customer.status==='Churn'?mapColors.risk:customer.status==='Unknown'?mapColors.unknown:mapColors.covered,radius:customer.status==='Churn'?9:6};
 return {color:mapColors.covered,radius:6};
}
export function mapSummary(customers:any[]){
 // Canonical facts only: the location overlay must never duplicate invoice or visit totals.
 return customers.reduce((sum,c)=>({customers:sum.customers+1,actual:sum.actual+Number(c.metrics?.actual_minor||0),invoices:sum.invoices+Number(c.metrics?.invoice_count||0),activities:sum.activities+Number(c.metrics?.activity_count||0),covered:sum.covered+(Number(c.metrics?.meaningful_count||0)>0?1:0),churn:sum.churn+(c.status==='Churn'?1:0)}),{customers:0,actual:0,invoices:0,activities:0,covered:0,churn:0});
}
