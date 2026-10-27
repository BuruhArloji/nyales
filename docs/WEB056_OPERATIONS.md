# WEB-056 — panduan operasi dan interpretasi metrik

## Menggunakan panel

Management/NSM membuka **Kesehatan sistem**. Muat ulang metrik membaca agregat organisasi sejak jam UTC sekitar24 jam terakhir. Request yang sedang berlangsung serta penyimpanan waitUntil dapat baru terlihat pada pembacaan berikutnya. Panel tidak melakukan polling terus-menerus.

**Atur pilot & owner** menyimpan profil perencanaan dan penerima alert; bukan persetujuan produksi. Owner dipilih dari Management/NSM aktif organisasi. Usulan default25 sales/1.000 customer/10.000 invoice bulanan/5 concurrent/10.000 API harian boleh diubah. Konfigurasi bersifat versioned dengan If-Match dan idempotency.

**Catat kuota provider** hanya untuk organisasi yang mengelola akun deployment. Ambil nilai sebenarnya dari dashboard Cloudflare dan masukkan waktu sampel beserta referensi/alasan. Jangan masukkan API token, key, URL berisi secret atau data customer. Sampel maksimal berumur6 jam dan maksimal60 detik ke depan. Periode harian/bulanan ditentukan UTC dari waktu sampel. Data hari/bulan sebelumnya atau stale tidak dianggap kuota saat ini; nilai nol yang benar tetap nol.

Alert70/85/95 dibuat satu kali untuk kombinasi organisasi/resource/window/threshold, termasuk bila langsung melompat ke95%. Penurunan usage tidak menghapus histori alert; jendela UTC berikutnya dapat menghasilkan alert baru. Notification mengikuti aturan jam tenang saat ditampilkan. Pergantian owner tidak mengirim ulang alert lama. Alert bukan hard spending cap: penggunaan R2 di atas allowance tetap mengikuti billing akun.

## Arti angka

| Angka | Definisi dan batas |
|---|---|
| API calls/status | Hanya request authenticated melalui Worker ini yang berhasil dipersist; anonymous/auth rejection hanya structured log. Bukan total request akun Cloudflare. |
| Wall time | Waktu handler sampai response sebelum persist telemetry; bukan browser end-to-end, CPU, p95 atau tagihan. |
| D1 statements | Percobaan statement termasuk batch element; raw/exec tidak mengklaim meta. first menggunakan all lalu mengambil baris pertama untuk membaca meta. |
| Rows read/written | Subtotal dari meta.rows_read/rows_written yang tersedia. Bila meta0, UI menampilkan belum terukur. Meta tidak lengkap bukan total billing. |
| Overhead ops | Satu upsert ops_hourly tambahan per request authenticated, di luar subtotal query request; satu per job dan satu event-counter untuk setiap event peta. Index writes/meta tetap mengikuti D1. |
| R2 A/B/delete | Percobaan metode binding put/list/createMultipartUpload, get/head, delete. Bukan operasi tertagih atau jumlah byte objek tersimpan. Multipart lanjutan belum diinstrumentasi dan tidak dipakai jalur sekarang. |
| Queue gauges | Jumlah invoice import needs_review, activity needs_review/pending_checkin, evidence pending dalam organisasi. Bukan pending outbox di IndexedDB seluruh perangkat. |
| Sync outcomes | Hasil accepted/review/rejected /api/sync/events yang sempat diterima server; tidak melihat event yang belum berhasil dikirim. |
| Map/Street View | Event deklaratif map_2d/map_3d/street_view_open. Tidak menerima lokasi/key/URL dan tidak menyatakan panorama berhasil atau hitungan tile/billing. |
| Provider usage | Snapshot manual dashboard akun deployment, bukan hasil inferensi dari API metrics. Tidak digabung dengan subtotal aplikasi. |

Log `nyales_api` memuat request_id, route template, status, wall_ms dan counter; tidak memuat path asli/query/body/header/SQL/exception message. Log `nyales_job` memuat checkpoint/outcome dan counter. Simpan request ID ketika melaporkan kendala. Cloudflare observability enabled dengan head_sampling_rate0.1; sampling logs bukan sampling counter D1. Kegagalan persistence hanya menulis fixed warning tanpa secret. Log platform tetap harus ditinjau sesuai kebijakan retensi dan akses operator.

## Job dan deployment owner

Checkpoint terpisah: segmentation, sales-maintenance, notifications, operational-reminders, report-retention. Setiap checkpoint dicoba meskipun sebelumnya gagal; scheduled invocation tetap gagal jika ada checkpoint gagal. Failure notification menuju owner ops aktif, unik per checkpoint/jam. Penulisan alert tidak mengganti error bisnis asli.

Lokal menggunakan org `demo-org` jika tidak ada override. Produksi perlu binding **OBS_OWNER_ORGANIZATION_ID** berisi organisasi yang sah milik operator/akun provider; jangan memakai org dari input request untuk telemetry global. Organisasi lain tidak melihat shared-job metrics atau dapat menulis kuota akun. Metrik API tenant tetap mengikuti identity sendiri. Cron konfigurasi jammenit10 setiap jam sudah ada; menjalankan dev server tidak otomatis menjalankan cron. Tes job WEB056 memakai fixture terisolasi, bukan memaksa job maintenance di data kerja.

Tidak ada Cloudflare token, paid service, akun bersama pribadi, auto-upgrade atau hardcap billing dibuat pada implementasi ini. Provisioning akun organisasi dan deployment merupakan gate berikutnya. Tidak ada kebijakan auto-delete baru; retensi/backup/restore WEB057 masih Planned. Ops aggregates tetap tumbuh dan perlu masuk sizing/retensi.

## Acuan paket Free, diperiksa19 Oktober2026

| Resource | Acuan |
|---|---|
| Workers requests |100.000/hari, reset UTC |
| Workers CPU |10ms per invocation; termasuk Cron pada Free |
| D1 read/write |5.000.000 rows read/hari;100.000 rows written/hari |
| D1 storage |500MB per database;5GB total akun; UI memakai byte desimal konservatif500.000.000/5.000.000.000 |
| D1 query |50 per Worker invocation Free; hitung juga auth/scope/telemetry, bukan hanya query domain |
| R2 Standard |10GB-month storage;1.000.000 Class A;10.000.000 Class B per bulan |
| OpenFreeMap |Layanan publik gratis; cek kebijakan/availability. Tidak memasukkan tiles ke D1/R2. |
| Maps Embed |Pemakaian Embed API gratis menurut Google; key/billing/domain restriction tetap diperlukan. Counter open tidak membuktikan billing. |

Sumber: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [OpenFreeMap](https://openfreemap.org/), [Maps Embed billing](https://developers.google.com/maps/documentation/embed/usage-and-billing). Kuota dapat berubah; verifikasi ulang sebelum rollout. Alert bukan jaminan seluruh aplikasi gratis, apalagi pada akun yang dipakai resource lain.

## Profiling dan tindakan

`npx tsx scripts/profile-capacity.ts` hanya membuat database SQLite in-memory sintetis; output di test-results/web056-capacity.json. Tidak menyentuh database bisnis lokal/remote. Rerun pada mesin stabil tanpa beban build lain untuk perbandingan. Harness Node tidak mengukur CPU Workers atau row billing Cloudflare. Index query-plan dibandingkan hanya pada fixture.

Temuan saat implementasi: target10.000 invoice melampaui guard2.000 record Monitoring organisasi; per-sales berhasil. Overview/map skala1.000 customer masih beberapa detik pada harness Node, belum accepted SLA/CPU. Buat agregasi SQL dan pagination drill-down sebelum memperbesar pilot; jangan menghapus guard lalu mengirim seluruh source ke browser.

Jika alert70%: cek resource/window dan workload, bandingkan dashboardprovider.85%: kurangi refresh/duplikasi/import tak perlu dan evaluasi query/index.95%: owner menahan rollout/import massal nonmendesak sambil merekonsiliasi pemakaian; keputusan kapasitas/paket dilakukan manusia. Jangan menghapus invoice/target/aktivitas untuk mengurangi storage dan jangan mengubah plan otomatis.
