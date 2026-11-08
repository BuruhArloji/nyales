export type AttentionRegion={key:string;boundary_id:string|null;customer_count:number;coverage_percent:number|null;achievement_percent:number|null;growth_percent:number|null;target_status?:string;growth_status?:string};
/** Transparent ordering: financial warning count first, then largest percentage
 * shortfall, then coverage. Missing financial inputs are never treated as zero. */
export function regionalAttention<T extends AttentionRegion>(rows:T[],limit=3){
 return rows.filter(r=>r.boundary_id&&r.customer_count>0).map(row=>{
  const target=row.target_status==='available'&&row.achievement_percent!==null?Math.max(0,100-row.achievement_percent):0;
  const decline=row.growth_status==='available'&&row.growth_percent!==null?Math.max(0,-row.growth_percent):0;
  const coverage=row.coverage_percent===null?0:Math.max(0,100-row.coverage_percent);
  return {row,target,decline,coverage,financialSignals:Number(target>0)+Number(decline>0)};
 }).filter(r=>r.financialSignals||r.coverage>0)
 .sort((a,b)=>b.financialSignals-a.financialSignals||Math.max(b.target,b.decline)-Math.max(a.target,a.decline)||b.coverage-a.coverage||a.row.key.localeCompare(b.row.key)).slice(0,limit);
}
