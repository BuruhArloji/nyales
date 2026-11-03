export type MapLayers={customers:boolean;references:boolean;sales:boolean;boundary:boolean;density:boolean;populationRaster:boolean;roads:boolean;operational:boolean};
export const defaultMapLayers:MapLayers={customers:true,references:true,sales:true,boundary:true,density:false,populationRaster:false,roads:true,operational:true};
export type MapAnalysisMode='scatter'|'performance'|'coverage'|'risk';
export const mapColors={neutral:'#c6d0cb',low:'#49a894',mid:'#489d8b',high:'#08685f',covered:'#137f72',uncovered:'#c5ceca',risk:'#b8793f',unknown:'#9ca4a1'};
export function pointFacts(customer:any){
 const overlay=customer.demo_operation_overlay;
 return overlay?{...overlay,meaningful_count:Number(overlay.productive_count||0)+Number(overlay.follow_up_count||0),synthetic:true}:customer.metrics||null;
}
export function mapPointStyle(customer:any,mode:MapAnalysisMode){
 const facts=pointFacts(customer),actual=Number(facts?.actual_minor||0),visits=Number(facts?.meaningful_count||0);
 if(mode==='performance')return {color:!facts||!facts.invoice_count?mapColors.neutral:actual<=0?mapColors.risk:actual<1e6?mapColors.low:actual<5e6?mapColors.mid:mapColors.high,radius:!facts?.invoice_count?5:Math.min(18,6+Math.sqrt(Math.max(0,actual)/1e6)*2)};
 if(mode==='coverage')return {color:visits>0?mapColors.covered:mapColors.uncovered,radius:visits>0?8:5};
 if(mode==='risk')return {color:customer.status==='Churn'?mapColors.risk:customer.status==='Unknown'?mapColors.unknown:mapColors.covered,radius:customer.status==='Churn'?9:6};
 return {color:Number(facts?.invoice_count||0)>0?mapColors.high:mapColors.neutral,radius:Number(facts?.invoice_count||0)>0?8:5};
}
/** One location stays one feature; DEMO is attached metadata, never another pin. */
export function mapFeatureFacts(customer:any,reference=false){
 const facts=reference?null:pointFacts(customer);
 return {sales_total:Number(facts?.actual_minor||0),invoice_total:Number(facts?.invoice_count||0),activity_total:Number(facts?.activity_count||0),covered_total:!reference&&Number(facts?.meaningful_count||0)>0?1:0,churn_total:!reference&&customer.status==='Churn'?1:0,unknown_total:!reference&&(!customer.status||customer.status==='Unknown')?1:0,customer_total:reference?0:1,reference_total:reference?1:0,synthetic_total:facts?.synthetic?1:0};
}
export const mapClusterProperties=Object.fromEntries(Object.keys(mapFeatureFacts({})).map(key=>[key,['+',['get',key]]]));
export function mapClusterStyle(mode:string){
 const get=(key:string):any=>['coalesce',['get',key],0],format=(value:any):any=>['number-format',value,{'max-fraction-digits':1}];
 const sales=get('sales_total'),customers=get('customer_total'),references=get('reference_total');
 const color:any=mode==='performance'?['case',['==',get('invoice_total'),0],mapColors.neutral,['<=',sales,0],mapColors.risk,['step',sales,mapColors.low,1e6,mapColors.mid,5e6,mapColors.high]]:mode==='coverage'?['case',['>',get('covered_total'),0],mapColors.covered,mapColors.uncovered]:mode==='risk'?['case',['>',get('churn_total'),0],mapColors.risk,['==',get('unknown_total'),customers],mapColors.unknown,mapColors.covered]:['case',['>',get('invoice_total'),0],mapColors.high,mapColors.neutral];
 const label:any=mode==='performance'?['case',['==',get('invoice_total'),0],'0',['>=',['abs',sales],1e9],['concat',format(['/',sales,1e9]),' M'],['>=',['abs',sales],1e6],['concat',format(['/',sales,1e6]),' jt'],['>=',['abs',sales],1000],['concat',format(['/',sales,1000]),' rb'],format(sales)]:mode==='coverage'?['concat',format(get('activity_total')),' akt']:mode==='risk'?['case',['>',get('churn_total'),0],['concat',format(get('churn_total')),' churn'],['>',get('unknown_total'),0],['concat',format(get('unknown_total')),' ?'],'0 churn']:['get','point_count_abbreviated'];
 return {color:['case',['==',customers,0],'#777c80',color] as any,label:['case',['==',customers,0],['concat',format(references),' ref'],label] as any,radius:mode==='performance'?['interpolate',['linear'],['abs',sales],0,19,1e7,25,1e8,34,1e9,42] as any:['step',['get','point_count'],20,100,26,1000,34] as any};
}
export function mapSummary(customers:any[]){
 // Canonical facts only: the location overlay must never duplicate invoice or visit totals.
 return customers.reduce((sum,c)=>({customers:sum.customers+1,actual:sum.actual+Number(c.metrics?.actual_minor||0),invoices:sum.invoices+Number(c.metrics?.invoice_count||0),activities:sum.activities+Number(c.metrics?.activity_count||0),covered:sum.covered+(Number(c.metrics?.meaningful_count||0)>0?1:0),churn:sum.churn+(c.status==='Churn'?1:0)}),{customers:0,actual:0,invoices:0,activities:0,covered:0,churn:0});
}
