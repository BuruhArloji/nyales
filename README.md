# NYALES

NYALES adalah Sales Operations Hub untuk mengelola sales lapangan dan telesales. Implementasi mengikuti PRD v1.10, ERD v1.2, API v1.2, backlog web v1.2, dan Design System v1.1.

## Progres terbaru — 25 Oktober 2026

WEB-070 mencakup identitas komputer, antrean uji koneksi serta kebijakan dan pemeriksaan kesiapan kunjungan. [Runbook kesiapan](docs/WEB070_PLANNING_READINESS.md), [bukti/status](docs/WEB070_PROGRESS.json). [Buka perencanaan kunjungan](http://127.0.0.1:5183/#page=settings&settings_section=planning). Snapshot kesiapan menjelaskan data kurang dan perubahan sumber; belum menjadi input solver, rute atau jadwal. Runtime310operasi dan112tabel aplikasi(114dengan metadata D1). Catatan sebelumnya di bawah adalah histori.

## Tahap saat ini

M1, M2 dan M3 tersedia sebagai pilot lokal. M3 menambah konfigurasi/simulasi/kalkulasi insentif, review/finalisasi/revisi/ekspor serta monitoring empat pilar, exception, coaching, pengingat in-app dan laporan privat. Baca [M3_STATUS.md](docs/M3_STATUS.md) untuk bukti serta gate produksi. Firebase nyata/MFA, integrasi ERP, UAT bisnis, deployment dan Android belum selesai. Tidak ada proses pembayaran otomatis.

## Menjalankan lokal

```powershell
npm install
npm run dev
```

Buka `http://127.0.0.1:5180`. Build dengan `npm run build`. Database lokal dijalankan dengan `npm run db:migrate` lalu `npm run db:seed` setelah Wrangler tersedia.

## Struktur penting

- `src/client/` — React shell dan halaman web.
- `src/server/` — Hono Worker API.
- `migrations/` — schema D1 tahap awal yang diturunkan dari ERD.
- `public/brand/` — mark/logo NYALES dan `public/fonts/` — Poppins lokal.
- `docs/BRAND.md` — aturan penggunaan logo.

Status pekerjaan masih mengikuti backlog; keberadaan preview tidak berarti fitur production sudah accepted.


### WEB-007

Halaman login dan integrasi Firebase telah diimplementasikan. Baca [AUTH_SETUP.md](docs/AUTH_SETUP.md). Jalankan `npm test` untuk auth tests. Login demo hanya tersedia untuk APP_ENV=local dan LOCAL_AUTH=true; domain GET yang sudah dibangun memakai scope WEB-008; operasi dan resource yang belum dibangun tetap ditolak. Belum ada konfigurasi Firebase nyata.


### WEB-009

Menu Pengaturan tersedia bagi Management/NSM: identitas organisasi, cabang, area, kalender kerja dan arsip. Jalankan migrations dan seed terbaru sebelum memakai form. Kalender libur dan jam kerja harus ditetapkan organisasi; contoh seed bukan kebijakan perusahaan. Lihat BUILD_STATUS.md untuk validasi dan batas integrasi SLA.


### WEB-011

Menu Sesi perangkat menampilkan daftar sesi dan popup pencabutan. Semua API domain memerlukan Firebase bearer dan token sesi perangkat. Logout mencabut sesi saat online; sesi lain tetap aktif. Admin nonlocal wajib mempunyai verified second factor; provider/enrollment Firebase belum dikonfigurasi dan tidak ada billing yang diaktifkan. Lihat [AUTH_SETUP.md](docs/AUTH_SETUP.md) untuk gate produksi, batas sesi/replay bootstrap dan perilaku saat jaringan gagal.


### WEB-012

Menu Pelanggan menyediakan master pelanggan/toko dan kontak dengan form popup, tanpa lapisan Account bisnis/legal. Management/NSM dapat membuat/edit/arsip sesuai dependensi; role lain membaca sesuai scope. Outlet tanpa koordinat tetap tercatat, nomor kontak dinormalisasi, dan shared number tidak otomatis merge. Migrasi 0017 menyimpan Account lama sebagai audit dan menghapus dependensi aktifnya. Jalankan migrations sebelum membuka versi baru. Kontrak lokal ada di [customer-api.web012.openapi.json](docs/specifications/customer-api.web012.openapi.json); merge/alias mengikuti WEB-014 dan assignment/transfer mengikuti WEB-015. Lihat BUILD_STATUS.md untuk validasi dan batas.


### WEB-013 / WEB-014

Menu **Import & duplikat** menyediakan template CSV, mapping, dry-run, commit strict/partial, error per baris, katalog produk, review merge dan alias ID. Semua form memakai popup. Import pelanggan memerlukan kode ERP unik, nama, alamat dan area aktif; owner ditetapkan melalui alur distribusi. Format pilot UTF-8 CSV maksimum512KiB/200baris; bukan XLSX.

Original CSV berada pada R2 binding IMPORT_FILES (simulasi lokal melalui Wrangler), dengan checksum dan retention hold sampai kebijakan organisasi ditetapkan. Bucket cloud belum diprovision/deploy. Merge tidak mengubah invoice/assignment historis atau menggabungkan izin kontak. Kontrak aktual ada di [operations-api.web013-014.openapi.json](docs/specifications/operations-api.web013-014.openapi.json). Jalankan seluruh migrations (sampai0017) sebelum membuka versi ini. Lihat BUILD_STATUS.md untuk batas, bukti uji dan gate produksi.


### WEB-015

Menu **Distribusi sales** menampilkan pembagian customer lapangan/telesales, filter assigned/unassigned, area/sales, dan histori. Management/NSM mengatur PIC, tanggal efektif dan area melalui popup. Transfer area mewajibkan review kedua kanal; pilihan PIC kosong berarti unassigned. Sales yang bisa dipilih harus mempunyai role, scope area dan Supervisor yang memenuhi syarat pada tanggal efektif. Data demo belum otomatis mempunyai hirarki yang lengkap.

Jalankan migrations sampai0014 sebelum membuka versi baru. Transfer masa depan berlaku sebelum resolusi scope pada request domain pertama di tanggal efektif; histori invoice/target/aktivitas tetap pada atribusi asal. Pembatalan jadwal dan koreksi retroaktif belum tersedia. Kontrak lokal: [assignment-api.web015.openapi.json](docs/specifications/assignment-api.web015.openapi.json). Lihat [BUILD_STATUS.md](docs/BUILD_STATUS.md) untuk bukti uji dan batas pilot.


### Sisa M1: peta, katalog dan transaksi

Menu **Peta customer**, **Produk & harga**, dan **Invoice & actual** tersedia lokal. Import invoice mempunyai template CSV/mapping/dry-run/commit ketat, credit note/revisi berhistori, atribusi tanggal invoice dan rekonsiliasi. Seluruh form input memakai popup. Jalankan seluruh migrations sampai0032 sebelum memakai versi ini.

Lihat [M1_STATUS.md](docs/M1_STATUS.md), [INVOICE_SOURCE_MAPPING.md](docs/INVOICE_SOURCE_MAPPING.md), dan [kontrak API M1](docs/specifications/finance-map-api.m1.openapi.json). Status implementasi lokal berbeda dari produksi: sumber ERP/Firebase/MFA/provider peta serta acceptance kapasitas masih pending. Tidak ada deployment cloud. MAP_TILE_URL/MAP_ATTRIBUTION dapat mengatur basemap provider; fallback OSM hanya pilot lokal. Jangan memasukkan key provider ke repositori.

## Baseline aktif

Lihat [daftar spesifikasi](docs/specifications/README.md). Versi lama tetap menjadi arsip; aturan pelanggan yang berlaku mengikuti PRD v1.10 dan migrasi 0017.


### Data dummy visual

Dataset showcase lokal menambahkan pelanggan, invoice enam bulan, target, peta, aktivitas, pipeline/forecast dan insentif. Banner Mode demo menandai angka/approval simulasi. Lihat [DEMO_DATA.md](docs/DEMO_DATA.md). Data domain lama dipertahankan; dataset ini bukan bukti transaksi atau persetujuan bisnis nyata.

### Street View (opsional)

Tambahkan `GOOGLE_MAPS_EMBED_API_KEY` di `.dev.vars` lokal (jangan commit). Aktifkan Maps Embed API dan batasi key hanya untuk API tersebut serta HTTP referrer aplikasi. Preview lokal menggunakan `http://127.0.0.1:5181/*` atau `http://localhost:5181/*`; domain deployment perlu didaftarkan tersendiri. Konfigurasi ini tidak mengganti OpenFreeMap. Iframe Google baru dimuat ketika pengguna membuka Street View customer. Panorama terdekat bisa berbeda dari posisi/fasad customer; ketersediaan dan tanggal foto mengikuti Google.

## Paket pilot dummy dan training WEB-060/061

[Paket 10 sales](pilot/demo-10-sales/README.md) menyediakan sumber JSON terpisah, CSV customer/invoice, snapshot independen dan hasil rekonsiliasi. `npm run pilot:demo -- --out test-results/demo-run-baru` memakai SQLite in-memory, tanpa mengubah preview/produksi atau membuat akun login. [Panduan training](docs/WEB061_TRAINING.md), [SOP](docs/WEB061_SOP.md), [support](docs/WEB061_SUPPORT.md) dan [handover](docs/WEB061_HANDOVER.md) tersedia. `npm run training:check` memeriksa materi serta gate yang belum diterima; bukan bukti training manusia atau go-live.

## Pilot lokal yang dapat dicoba

[Pilot Oktober 2026](docs/WEB062_LOCAL_PILOT.md) berjalan pada **http://127.0.0.1:5183/** dengan D1/R2 lokal terpisah. Klik **Masuk demo lokal**. Dataset `pilot/local-20261021-v3/source-data.json` adalah turunan sintetis berisi 10 sales dan 20 pelanggan. Restart memakai `npm run pilot:local -- pilot/local-20261021-v3`; file LOCAL-STATE mempertahankan perubahan latihan pada mesin yang sama. Untuk instalasi baru gunakan `npm run pilot:local:prepare -- --out pilot/folder-baru`, lalu jalankan folder tersebut. Jangan menyalin LOCAL-STATE antar mesin. Uji browser mutatif hanya pada fixture lokal ini: `npm run test:pilot`.

Pilot juga memuat aktivitas/posisi dan rehearsal role sintetis. Full restore lokal D1/R2 telah diverifikasi; lihat [evidence stabilisasi](docs/WEB062_STABILIZATION.json). `npm run pilot:restore -- pilot/local-20261021-v3 test-results/folder-restore-baru` memulihkan snapshot ke namespace baru. Cakupan sumber tidak otomatis maju ketika tanggal berganti; provisional tetap ditampilkan sesuai tanggal konfirmasi.

### WEB-064 · 24 Oktober 2026

Peta & Wilayah dan review pemetaan pelanggan tersedia lokal di http://127.0.0.1:5183/#page=map. Pilih rilis draft untuk pratinjau enam kelurahan; aktivasi sumber nyata tetap memerlukan review penggunaan/namespace. 149 tests dan dua browser flows lulus, commercial rows dan full restore terjaga. Berikutnya WEB-065. [Runbook](docs/WEB064_GEOGRAPHY.md), [kontrak](docs/specifications/geography-api.m4.openapi.json).

## 24 Oktober 2026 — WEB-065 pembagian kelurahan dan sales

Membership area dan preview/commit assignment bertanggal tersedia lokal di Distribusi sales, hanya Management/NSM. Epoch/hash/ETag/idempotency, konflik, role/area/SPV, satu owner per kanal dan audit diperiksa; transfer area meninjau kedua kanal. 156 tests, dua browser flows, regresi peta dan restore 94 tabel/1 PDF/1 chunk lulus. Data komersial pilot tetap, sumber nyata masih draft. [Runbook](docs/WEB065_DISTRIBUTION.md), [evidence](docs/WEB065_EVIDENCE.json). Berikutnya WEB-066; acceptance provider/cloud/human tetap terbuka.

## 24 Oktober 2026 — WEB-066 kinerja dan coverage wilayah

Mode Kinerja/Coverage, choropleth teal/unknown berpola, bucket belum terpetakan, sumber customer/invoice/aktivitas/target/kinerja sales dan CSV snapshot tersedia lokal. Ringkasan Overview/Monitoring dan back navigation mempertahankan filter. Basis mapping read-cutoff konsisten untuk dua periode; target sales/area tidak diprorata. 164 unit/integration tests, 2 browser analytics + 4 regresi, TypeScript/build dan restore 94 tabel/1 PDF/1 chunk lulus. Pilot komersial tetap, sumber nyata masih draft. [Runbook](docs/WEB066_REGIONAL_ANALYTICS.md), [evidence](docs/WEB066_EVIDENCE.json). Berikutnya WEB-067; cloud/provider/human acceptance pending.


## WEB-067 — risiko pelanggan lokal, 24 Oktober 2026

Pengaturan kebijakan berversi dan popup, mode Risiko di Peta & Wilayah, immutable private evidence/history dan scoped customer drill tersedia. 183 tests, 3 browser scenarios, TypeScript/build dan recovery utama 96 tabel + QA 2 risk snapshots lulus. Pilot utama tetap tanpa policy/run risiko dan sumber nyata draft; fakta komersial tetap. Tidak ada cloud/production acceptance. Berikutnya WEB-068 pemerataan/simulasi beban. [Runbook/evidence](docs/WEB067_RISK_DESIGN.md).

## WEB-068 — beban layanan dan simulasi wilayah lokal, 24 Oktober 2026

Pengaturan → Beban & kapasitas dan Distribusi sales → Beban & simulasi tersedia lokal. Policy bulanan eksplisit per kanal, seluruh portfolio sesuai scope, customer/kontak/menit/kapasitas terpisah, unknown/partial tidak menjadi spare capacity. Preview/save/history immutable/revisi dan apply satu batch WEB-065 lalu revalidate sisa, dengan tanggal efektif, scope/SPV/hash/epoch/ETag/idempotency/audit. 0041 menambah empat tabel; private R2 menyimpan bukti, tidak menduplikasi geometry. 276 operasi runtime terhubung kontrak. Histori fakta komersial tetap; pilot utama tanpa default policy/scenario dan sumber nyata draft. Recovery database/R2 serta browser diverifikasi lokal. Provider/cloud/human acceptance tetap pending. [Runbook](docs/WEB068_WORKLOAD_DESIGN.md), [evidence](docs/WEB068_EVIDENCE.json). Berikutnya WEB-069 kontrak dan model Plan Visit Generator.


## WEB-069 baseline desain dan persiapan WEB-070

37 operasi API desain dan 14 tabel draft, validator input/result/policy, state machine lease/fence/cancel/retry dan RBAC telah diverifikasi dengan 21 contract/model tests. Tidak ada endpoint/migrasi runtime generator. WEB-070 mulai readiness komputer; Windows 11/i7/RAM 15,7 GB, available 6,9 GB dan free C 21,3 GB saat diperiksa. Docker tidak tersedia; wsl.exe ada tetapi WSL belum terpasang. OSRM/solver belum dipasang; kapasitas graph belum terbukti. [Detail desain](docs/WEB069_PLAN_VISIT_CONTRACT.md), [evidence](docs/WEB069_EVIDENCE.json).


## WEB-070 progres kernel, 24 Oktober 2026

Doctor baca-saja, signed request P-256, challenge/jti atomik D1 prototype, transport loopback HTTP, graph-file verification dan adaptor OSRM table/cache/snap/cancel tersedia sebagai prototipe. 23 tes kernel/doctor dan 21 tes kontrak/model generator tercakup dalam 255 tes lulus. Tidak ada endpoint/migrasi generator, daemon agent, pairing nyata, graph atau OSRM/solver terpasang. WSL/Docker dan headroom disk masih perlu disiapkan sebelum preprocess nyata. [Detail dan sisa pekerjaan](docs/WEB070_AGENT_PREPARATION.md), [evidence](docs/WEB070_PROGRESS.json).
