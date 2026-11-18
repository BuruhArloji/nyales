export const OFF_REASONS={annual_leave:'Cuti tahunan',sick:'Sakit',permit:'Izin pribadi',training:'Pelatihan / tugas kantor',other:'Izin lainnya',alpha:'Alfa / tanpa izin'} as const;
export const OFF_STATUS:Record<string,string>={pending:'Menunggu persetujuan',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan'};
export type OffReason=keyof typeof OFF_REASONS;
export function offVisitBody(userId:string,date:string,reasonCode:OffReason,note:string,manager:boolean){
 if(!userId||userId.length>128)throw Error('Pilih sales lapangan.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Tanggal harus valid, format YYYY-MM-DD.');
 if(!(reasonCode in OFF_REASONS)||(!manager&&reasonCode==='alpha'))throw Error('Alasan tidak tersedia.');
 const reason=note.trim();if(!reason||reason.length>1000)throw Error('Isi catatan maksimal 1.000 karakter.');
 return {user_id:userId,service_date:date,reason_code:reasonCode,reason};
}
export function offReviewBody(status:'approved'|'rejected'|'cancelled',reason:string){const note=reason.trim();if(!note||note.length>1000)throw Error('Isi catatan maksimal 1.000 karakter.');return {status,reason:note}}
