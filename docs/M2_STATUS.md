# NYALES M2 — status implementasi lokal

18 Oktober 2026. **23 item M2 tersedia sebagai pilot lokal, belum Accepted produksi.** Data contoh tidak menggantikan UAT pengguna nyata. Tidak ada deployment cloud atau perubahan database remote.

## Kemampuan yang tersedia

| Backlog | Implementasi dan batas |
|---|---|
| WEB-017 | Rolling 90 hari tanggal invoice, revisi/retur current, status Unknown bila sumber belum lengkap; New memerlukan bukti histori lengkap. |
| WEB-018 | Nominal/percentile/custom rentang angka; rule versi approved, scope area override dan snapshot immutable. Custom bukan kode bebas. |
| WEB-025 | Periode, kanal dan versi plan; basis leaf customer/rep dengan revenue/produk/group. Satu approved plan per kanal pada periode beririsan adalah batas pilot. |
| WEB-026 | Bottom-up customer atau rep, mencegah leaf/basis beririsan; snapshot area/rep/hirarki dan reserve terpisah. |
| WEB-027 | Tiga bulan kalender selesai, normalisasi bulan 1/2/3, onboarding tetap, largest remainder. Zero history/unknown age membutuhkan input/review. |
| WEB-028 | Submit/approve independen, ETag, approved lock dan revisi berhistori; UAT dua akun Firebase nyata masih pending. |
| WEB-029 | Actual invoice current dan retur sesuai basis; ambigu produk/merge ditahan review. Reserve tidak mengarang actual atau achievement. |
| WEB-030 | Agenda, usulan/approval, recurrence 1-12 minggu, snapshot jadwal asli dan reschedule reason; slot collision tetap 30 menit pada pilot. |
| WEB-031 | Sesi work/leave/training, waktu server dan larangan end saat visit aktif. Bukan payroll atau pembuktian kehadiran otomatis. |
| WEB-032 | Check-in/out berpasangan, GPS browser + accuracy/client/server time; denied/out-of-order review, last position monotonic. Bukan GPS background. |
| WEB-033 | Outcome, catatan dan next action; visit productive bukan order atau actual invoice. |
| WEB-034 | Intent/upload/finalize/private download R2, checksum/magic/size/scope. Implementasi memakai authenticated proxy, belum signed URL desain produk. |
| WEB-035 | Draft IndexedDB dan outbox per owner, stable client event, satu event/request, retry/review. Satu sampel ack bukan bukti P95/mobile SLA. |
| WEB-036 | Campaign/script create/edit/archive, qualification dan script snapshot saat claim, workbench berprioritas. Ranking masih formula pilot tetap. |
| WEB-037 | Lease unik per customer, renew/expiry, DNC/permission/attempt/callback/active visit holds. Multi-tab race diuji di route fixture, UAT device nyata pending. |
| WEB-038 | Tel link hanya sesudah renew; disposition manual_unverified, qualification dan callback kalender. Tidak ada CTI/provider call verification. |
| WEB-039 | Task start/complete/cancel/reschedule dan handoff accept/decline/complete/cancel; jadwal asli dipertahankan. Reassign task antar PIC belum tersedia; gunakan cancel + create/handoff. |
| WEB-040 | Customer 360 menambah timeline aktivitas/task/handoff/order/forecast menurut scope. Data sumber tetap invoice; order diberi label bukan actual. |
| WEB-041 | Lead/opportunity tujuh stage, proposal/qualified/won/lost gates dan reopen. SLA berdasarkan kalender dan aktivitas bermakna. |
| WEB-042 | Order draft snapshot SKU/unit/harga/diskon/pajak, integer rupiah, 50 lines dan client order id; tidak otomatis dikirim ERP. |
| WEB-043 | Policy diskon/harga, review stok/kredit manual independen, approval/reject/revisi/konfirmasi backoffice. Data stok/kredit provider belum tersambung. |
| WEB-044 | Forecast sales dan alternatif manager terpisah, actual + residual, canonical basket dan revisi/merge review; committed wajib evidence. |
| WEB-045 | Review kategori/gap/next action membuat task, tidak menambah forecast otomatis. Gap hanya target approved dengan basis sebanding. |

## Aturan data dan keamanan

- Management/NSM mengatur konfigurasi. AM hanya area sendiri, SPV subtree dalam area, SR area/assignment lapangan, telesales assignment kanalnya. Identitas tidak dapat dipilih melalui parameter browser. Semua mutation memakai otorisasi resource serta audit. Cache retry memeriksa ulang scope saat replay.
- Invoice validated/current menjadi actual. Order approved/confirmed dan stage Won tidak menghasilkan actual. Retur mengikuti aturan finansial M1. Snapshot atribusi/hirarki target tidak mengikuti perubahan owner saat ini.
- Setelah merge pelanggan atau revisi atribusi invoice, target/forecast ambigu diberi review dan angka terkait ditahan; tidak dihitung ganda dan tidak membocorkan invoice sales baru. Visit aktif masih dapat ditutup oleh pemiliknya setelah scope berpindah tanpa membuka kembali customer.
- Source coverage adalah pernyataan Management, bukan bukti bahwa koneksi ERP telah tersedia. New dan normalisasi umur customer memerlukan history_complete, bukan hanya tiga bulan yang pernah diimport.
- GPS hanya saat interaksi browser dan selama izin tersedia. Titik terakhir diberi waktu/sumber/akurasi; tidak dianggap posisi live yang selalu aktif. Android dan tracking background mengikuti tahap berikutnya.
- Target disahkan oleh pihak berbeda dari creator/submitter. Draft/revisi tidak dipakai KPI sampai approved. Hierarki, kalender dan periode transaksi memakai data efektif, bukan owner customer terbaru.

## Kontrak implementasi

[OpenAPI M2](specifications/m2-api.openapi.json) mencatat 91 operasi aktual pada 71 path `/api`, dengan schema request dari validator Zod. Cross-field, kalender, scope dan state machine tetap divalidasi server serta tes. Response memakai envelope dinamis sesuai proyeksi role, belum kontrak SDK response bertipe lengkap. Full `/api/v1` v1.2 tetap rancangan produk, bukan daftar endpoint yang seluruhnya sudah tersedia.

[ERD implementasi M2](specifications/ERD_M2_Implementation.md) dan [inventaris fisik JSON](specifications/ERD_M2_Implementation.json) diturunkan dari migrations. Relasi logis dibedakan dari FK fisik. Tidak ada Account bisnis/legal aktif. Migrations 0018–0030 diterapkan **lokal saja**, setelah backup sebelum M2.

Perbedaan pilot yang disengaja: plan target memakai versi + leaf datar; satu approved plan organisasi/kanal pada periode beririsan; satu basket forecast aktif customer/kanal/view/bulan; evidence melalui API autentikasi sebagai proxy R2 privat (bukan signed URL); custom tier adalah DSL rentang angka; reassign task belum berupa aksi terpisah. Persyaratan produk yang lebih luas tetap tercatat dan tidak dinyatakan Accepted.

## Batas pilot

Target/allocation 200 pelanggan, order 50 line, forecast 100 referensi invoice, evidence 5 MiB JPEG/PNG/PDF, recurrence 1–12 minggu, collision slot 30 menit, lease maksimal 300 detik, GPS kualitas pilot 100 meter, sinkronisasi satu event per request. Beberapa daftar komersial dibatasi 200 item; pagination skala produksi belum dibuktikan.

Evidence pending kedaluwarsa 1 jam; maintenance membersihkan orphan upload dan lease serta mencatat SLA/overdue. Cron `10 * * * *` hanya konfigurasi, perlu deployment agar otomatis. Retensi sumber impor, lampiran ready, audit dan outbox final harus ditetapkan sebelum produksi; pembersihan demo tidak menghapus sumber transaksi asli.

Offline menyimpan data operasional di IndexedDB per org:user, bukan bearer/session token. Perangkat harus milik pengguna yang sah. Draft/outbox tidak setara enkripsi perangkat; prosedur logout, perangkat bersama, retensi dan recovery perlu UAT. UI memperlihatkan pending/review/rejected/synced. Satu sampel ack lokal bukan bukti P95 atau SLA Android.

## Validasi

- 72 tes otomatis lulus, TypeScript lulus, production build lokal lulus. Peringatan bundle besar MapLibre/client masih ada.
- Tes route memakai identitas/role fixture dan SQLite/R2 memory; tes browser memakai Worker/D1/R2 lokal dengan Management demo. Ini belum login multi-user Firebase nyata.
- Form browser: target draft, coverage opt-in, tier, save/reload/restore IndexedDB, offline → online event stabil, namespace owner, pembatalan order contoh tanpa actual, campaign/script, Customer 360, bar chart dan logout. Bukti `test-results/m2-forms.json`.
- Lima halaman M2 lulus navigasi/responsif 320/390/768/1440 px tanpa page error. Overflow filter target pada tablet sudah diperbaiki. Bukti `test-results/m2-navigation.json`.
- Rekonsiliasi seluruh 30 tabel asal yang tidak berubah dan tujuh tabel dengan penambahan terkontrol lulus; baris audit/master lama tetap ada. Session activity/revoke dan finance_epoch memang mutable. Foreign key check bersih; integrity_check ok. Bukti `test-results/m2-reconciliation.json`. Backup/export test-results lokal dapat memuat sesi dan bukan artefak publik.
- Tes batas 200 leaf target dan 50 line order lulus dengan jumlah statement database dibatasi, bukan satu query per baris. Scheduled handler dipanggil manual lokal HTTP 200; tes maintenance membuktikan expiry/cleanup tidak menghapus lampiran ready/sumber impor dan tidak menggandakan exception/snapshot. Cron cloud belum dideploy.

## Gate sebelum produksi

Firebase nyata/MFA dan dua approver independen; sinkron transaksi ERP serta coverage; UAT lapangan/telesales pada perangkat nyata; uji mobile offline/P95 dan load/capacity D1; kebijakan stok/kredit manual dan signed-URL/reassign follow-up; retensi/backup-restore; provisioning/deployment Cloudflare dan cron. Tidak ada layanan berbayar yang diaktifkan. Kalkulasi/finalisasi insentif M3 dan pembangunan Android belum termasuk M2.
