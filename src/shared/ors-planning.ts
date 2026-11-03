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
