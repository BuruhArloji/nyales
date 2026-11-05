export const offVisitReasons={annual_leave:'Cuti tahunan',sick:'Sakit',permit:'Izin pribadi',training:'Pelatihan / tugas kantor',other:'Izin lainnya',alpha:'Alfa / tanpa izin'} as const;
export const offVisitStatuses={pending:'Menunggu persetujuan',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan'} as const;
export type VisitDay={date:string;working:boolean;visits:number;off?:{status:string;reason_code:string}};
/** Daily capping prevents extra visits on one day hiding another day's shortfall. */
export function summarizeVisitDays(days:VisitDay[],dailyTarget:number|null){
 const work=days.filter(d=>d.working),excused=work.filter(d=>d.off?.status==='approved'&&d.off.reason_code!=='alpha'),alpha=work.filter(d=>d.off?.status==='approved'&&d.off.reason_code==='alpha');
 const eligible=work.filter(d=>!excused.includes(d)),visits=days.reduce((n,d)=>n+d.visits,0),target=dailyTarget===null?null:eligible.length*dailyTarget;
 const credit=dailyTarget===null?null:eligible.reduce((n,d)=>n+Math.min(dailyTarget,d.visits),0);
 return{working_days:work.length,off_permitted_days:excused.length,off_alpha_days:alpha.length,pending_off_days:work.filter(d=>d.off?.status==='pending').length,target_visit:target,visit_count:visits,compliant_visit_count:credit,visit_compliance_percent:target===null||target===0?null:100*credit!/target};
}
