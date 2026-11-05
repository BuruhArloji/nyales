import {z} from 'zod';
/** Intentional prototype bounds, not a declaration of the provider's plan quota. */
export const orsLimits={customers:10,reps:3,matrix_nodes:15,previews_per_utc_day:20,timeout_ms:25000} as const;
export const orsPreviewInput=z.object({preflight_id:z.string().min(1).max(128),date:z.iso.date(),customer_ids:z.array(z.string().min(1).max(128)).min(1).max(orsLimits.customers),confirmed_external_processing:z.literal(true)}).strict().refine(v=>new Set(v.customer_ids).size===v.customer_ids.length);
export const orsMessages:Record<string,string>={
 ORS_NOT_CONFIGURED:'Koneksi ORS belum dikonfigurasi di server.',ORS_INVALID_INPUT:'Pilih pemeriksaan, tanggal, dan 1–10 pelanggan.',
 ORS_PREFLIGHT_STALE:'Data pemeriksaan berubah. Buat pemeriksaan kesiapan baru.',ORS_FUTURE_SHIFT_REQUIRED:'Pilih hari kerja dengan jam mulai yang belum terlewati.',
 ORS_REVIEWED_PROFILES_REQUIRED:'Lengkapi profil operasional sales dan pelanggan pada tanggal tersebut.',ORS_CUSTOMER_COORDINATES_REQUIRED:'Koordinat pelanggan harus terverifikasi.',
 ORS_ASSIGNMENT_CHANGED:'Kepemilikan pelanggan pada tanggal tersebut belum valid.',ORS_EXISTING_AGENDA:'Sales sudah memiliki agenda pada hari tersebut. Pratinjau ini belum dapat menggabungkannya.',
 ORS_REP_LIMIT:'Pratinjau mendukung maksimal 3 sales.',ORS_MATRIX_NODE_LIMIT:'Titik pelanggan serta pangkal/akhir sales melebihi 15 titik unik. Persempit pilihan.',
 ORS_DAILY_BUDGET:'Batas internal 20 pratinjau per hari UTC tercapai.',ORS_BUSY:'Perhitungan lain sedang berjalan. Tunggu sebentar.',
 ORS_PROVIDER_RATE_LIMIT:'Kuota atau laju permintaan ORS dibatasi. Coba lagi nanti.',ORS_PROVIDER_AUTH:'Key ORS tidak diterima atau belum memiliki akses layanan ini.',
 ORS_PROVIDER_UNAVAILABLE:'Layanan ORS belum merespons. Tidak ada agenda yang berubah.',ORS_PROVIDER_TIMEOUT:'Perhitungan ORS melewati batas waktu.',
 ORS_UNREACHABLE:'Ada titik yang tidak terjangkau jaringan jalan ORS. Periksa koordinat dan pangkal sales.',ORS_INVALID_RESULT:'Hasil ORS belum memenuhi kontrak pratinjau.',
 ORS_SOURCE_CHANGED:'Sumber atau agenda berubah saat perhitungan. Buat pemeriksaan baru.',ORS_PREVIEW_NOT_FOUND:'Pratinjau tidak ditemukan.',ORS_PREVIEW_IN_PROGRESS:'Pratinjau masih dihitung.',
 ORS_STORAGE_UNAVAILABLE:'Penyimpanan pratinjau belum tersedia.',ORS_IDEMPOTENCY_CONFLICT:'Permintaan yang sama memiliki isi berbeda.',
};

/** Stage and HTTP status are non-sensitive diagnostics, retained in failed runs. */
export function orsErrorMessage(code:string):string|undefined{
 if(orsMessages[code])return orsMessages[code];
 const match=/^ORS_(MATRIX|OPTIMIZATION|DIRECTIONS)_(HTTP_([1-5][0-9]{2})|TIMEOUT|NETWORK|INVALID_RESULT)(?:_CODE_[0-9]{1,5})?$/.exec(code);if(!match)return;
 const stage=({MATRIX:'matriks perjalanan',OPTIMIZATION:'optimasi rute',DIRECTIONS:'garis rute'} as Record<string,string>)[match[1]],status=Number(match[3]);
 const reason=match[2]==='TIMEOUT'?'Perhitungan melewati batas waktu':match[2]==='NETWORK'?'Koneksi ke ORS gagal':match[2]==='INVALID_RESULT'?'Respons ORS tidak valid':status===429?'Batas permintaan ORS tercapai':status===401||status===403?'ORS menolak akses; periksa API key dan batas pemakaian':status===404?'Endpoint ORS tidak ditemukan':status>=500?'Layanan ORS mengalami kesalahan':'ORS menolak data perhitungan';
 return `${reason} pada tahap ${stage}${status?' (HTTP '+status+')':''}. Agenda tidak berubah.`;
}
