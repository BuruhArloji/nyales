# Baseline spesifikasi NYALES aktif

18 Oktober 2026. Menggantikan PRD v1.9, ERD/API/backlog v1.1 pada keputusan pelanggan.

- [PRD v1.10](PRD_Sales_Lapangan_dan_Telesales_v1_10.md)
- [ERD v1.2](ERD_Sales_Operations_Hub_v1_2.md), [JSON](ERD_Sales_Operations_Hub_v1_2.json)
- [Kontrak API v1.2](Kontrak_API_Sales_Operations_v1_2.md), [OpenAPI](Sales_Operations_API_v1_2.openapi.json)
- [Backlog v1.2](Backlog_Pembangunan_Web_v1_2.md), [JSON](Backlog_Pembangunan_Web_v1_2.json)

Dokumen lengkap adalah rancangan produk. Slice `*.web*.openapi.json` dan `finance-map-api.m1.openapi.json` menjelaskan implementasi `/api` saat ini. Full product `/api/v1` adalah kontrak rancangan, belum klaim deployment. Migrations adalah DDL implementasi lokal. Status/gate terbaru ada di [M3_STATUS](../M3_STATUS.md); M1/M2_STATUS adalah hasil tahap sebelumnya.

- [Kontrak aktual M3 /api](m3-api.openapi.json)
- [ERD implementasi M3](ERD_M3_Implementation.md), [inventaris fisik](ERD_M3_Implementation.json)

- [Kontrak aktual M2 /api](m2-api.openapi.json)
- [ERD implementasi M2](ERD_M2_Implementation.md), [inventaris fisik](ERD_M2_Implementation.json)
- Status backlog M2 diperbarui sebagai implemented local pilot, bukan Accepted produksi.

Satu pelanggan/toko = satu lokasi. Tidak ada Account bisnis/legal aktif. Data autentikasi akun pengguna tetap terpisah. Original import dan audit historis dapat memuat field Account lama untuk provenance, tidak dapat menghidupkan kembali relasi tersebut. Batch pelanggan schema1 harus divalidasi ulang menjadi schema2 sebelum commit.

## WEB-056 lokal, 19 Oktober2026

[Status M4](../M4_STATUS.md), [runbook](../WEB056_OPERATIONS.md), [4operasi API aktual](m4-observability-api.openapi.json), [ERD slice](ERD_WEB056_Implementation.md). WEB056 implemented local pilot dengan capacity gates pending; item M4 lain tetap Planned.

## Keputusan 22 Oktober 2026 — batas kelurahan/desa

[Addendum GEO-01–08](GIS_Admin_Kelurahan_v1.md) menetapkan batas administrasi kelurahan/desa untuk pembagian awal area dan sales. PRD CUS-04, ERD rancangan (MD/JSON) dan backlog WEB-063–065 (MD/JSON) sudah diselaraskan. Lima entitas wilayah masih rancangan; migrasi, kontrak API dan UI baru berstatus Planned. Sumber awal sudah dipilih: file batas desa/kelurahan Indonesia di Geoportal Kementerian Pertanian (BIG menurut metadata; acuan Semester 1 Tahun 2025). Validasi namespace/rilis/ketentuan penggunaan dan pengambilan file dikerjakan saat WEB-063; belum ada unduhan/import. Basemap tetap terpisah. 82 skenario UAT lama tidak diubah; acceptance tambahan GEO-A01–08 dicatat di addendum.

## GIS UI/UX dan analitik — 22 Oktober 2026

[Detail GIS-UX-01–03 dan GIS-ANA-01–03](GIS_UX_dan_Analitik_v1.md) menempatkan Peta & Wilayah pada kelompok Pelanggan, ringkasan pada Overview/Monitoring dan pembagian pada Distribusi sales. WEB-064/065 diperinci; WEB-066–068 adalah analitik M4 extension P1, seluruhnya Planned. Jalur staging/login tetap paralel dan pilot tim tidak diblok seluruh analitik.


## Plan Visit Generator - 23 Oktober 2026

[Keputusan komputer pribadi dan spesifikasi PVG](Plan_Visit_Generator_v1.md) diselaraskan dengan PRD FLD-09/bagian 22.6 serta backlog WEB-069–074 (MD/JSON). OSRM + Python OR-Tools pada compute lokal, agent outbound, Workers/D1/R2 tetap; PostGIS/Cloudflare Containers belum diperlukan. Harian → bulanan → multi-sales, review sebelum publish, job offline/retry/stale/cancel dan sepuluh acceptance tambahan. M4 extension P1 Planned; belum ada runtime/migrasi/API baru, bukan gate tambahan pilot web atau Android.


## WEB-063 tersedia lokal - 23 Oktober 2026

[Runbook/evidence](../WEB063_ADMIN_BOUNDARIES.md), [API aktual delapan operasi](admin-boundaries-api.m4.openapi.json), [ERD fisik](ERD_WEB063_Implementation.md) dan [JSON schema inventory](ERD_WEB063_Implementation.json). Master/versioning/import/review aktif lokal; source nyata enam kelurahan tetap draft, menunggu review namespace/metadata/hak penggunaan. WEB-064/065 dan WEB-069–074 tetap Planned; tidak ada cloud deployment atau production acceptance.


## WEB-067 — risiko pelanggan lokal, 24 Oktober 2026

Pengaturan kebijakan berversi dan popup, mode Risiko di Peta & Wilayah, immutable private evidence/history dan scoped customer drill tersedia. 183 tests, 3 browser scenarios, TypeScript/build dan recovery utama 96 tabel + QA 2 risk snapshots lulus. Pilot utama tetap tanpa policy/run risiko dan sumber nyata draft; fakta komersial tetap. Tidak ada cloud/production acceptance. Berikutnya WEB-068 pemerataan/simulasi beban. [Runbook/evidence](../WEB067_RISK_DESIGN.md).


## Implementasi WEB-070 identitas komputer — 25 Oktober 2026

[Runbook pairing/vault/heartbeat/revoke](../WEB070_AGENT_IDENTITY.md), [ERD fisik 0042](ERD_WEB070_Implementation.md), [sembilan operasi API aktual](visit-agent-identity.m4.openapi.json), [bukti progres](../WEB070_PROGRESS.json). Hanya Management/NSM mengatur mesin dan izin 1–10 sales lapangan aktif. Kode sekali pakai 15 menit; credential 30 hari, perubahan izin/issue ulang mengganti generasi dan mencabut akses sebelumnya. Request mesin memakai signature/challenge terpisah dari sesi pengguna; vault Windows DPAPI menyimpan private key dan credential terenkripsi. Heartbeat saat ini manual, laporan kemampuan bukan bukti solver siap. Queue/lease/graph/solver/publish tetap rancangan. WEB-070 keseluruhan masih In progress.

Runtime total 285 operasi, semuanya terkait kontrak implementasi. Migrasi menambah tujuh tabel; 105 aplikasi/107 termasuk metadata D1. Draft SQL 14 tabel WEB-069 tidak boleh diterapkan utuh setelah 0042. Data komersial dan agenda tidak berubah melalui registrasi mesin. Tidak ada deployment cloud atau acceptance produksi.


## WEB-070 antrean diagnostik — 25 Oktober 2026

[Runbook antrean agent](../WEB070_AGENT_QUEUE.md), [kontrak aktual 11 operasi](visit-agent-queue.m4.openapi.json), [ERD fisik 0043](ERD_WEB070_Queue_Implementation.md). Management/NSM dapat mengirim probe koneksi, melihat status/riwayat dan membatalkannya. Agent Windows dapat polling foreground/once, claim, renew, checkpoint, complete, fail dan cancel-ack; expiry/retry/fencing membatasi hak proses lama. Hanya payload probe yang dibuat server, tanpa customer/koordinat/penjualan/agenda. Satu tugas pending per komputer, lease120 detik, tiga percobaan dan deadline15 menit. Polling idle60 detik; unattended quota/retention acceptance belum selesai.

Total runtime296 operasi, 108 tabel aplikasi/110 termasuk metadata D1. WEB-070 tetap In progress: planning snapshot/policy/graph dan penghubung ke transport, OSRM engine/graph nyata serta benchmark belum tersedia. Status completed probe bukan bukti rute atau jadwal. [Bukti progres](../WEB070_PROGRESS.json) membedakan tes lokal dan acceptance produksi. Bagian bertanggal sebelumnya adalah histori.


## WEB-070 kebijakan dan kesiapan — 25 Oktober 2026

[Runbook](../WEB070_PLANNING_READINESS.md), [14 operasi aktual](visit-planning-readiness.m4.openapi.json), [ERD fisik0044](ERD_WEB070_Readiness_Implementation.md), [bukti terkini](../WEB070_PROGRESS.json). Management/NSM dapat menyimpan/meninjau draft kebijakan, mengaktifkan dengan ETag/checksum/expected-active-id, mendaftarkan manifest graph sebagai metadata belum terverifikasi, serta menyimpan snapshot kesiapan privateR2. Snapshot berversi menyebut assignment/kalender/tanggal, observasi invoice/visit, sumber belum lengkap, asumsi dan penghambat. Epoch/source/agenda/policy/graph/date berubah menandai hasil historis; bytes/hash dan histori immutable.

Kesiapan bukan VisitSnapshot solver dan tidak masuk antrean agent. Nilai yang tidak diketahui tetapnull; tidak mengasumsikan histori visit lengkap atau mengonversi frekuensi lama/jam teks menjadi aturan baru. Engine/solver belum aktif, sehingga can_generate=false dan publishable=false. Kebijakan frekuensi/bobot/asumsi/runtime/retensi tidak dipasang default pada pilot utama. Form override khusus hanya menampilkan/mempertahankan/menghapus nilai yang sudah ada; API mendukung penambahan dengan validasi customer. UI pembuatan override customer terstruktur menjadi tindak lanjut.

Total310 operasi runtime semuanya terhubung kontrak, 112 tabel aplikasi/114 termasuk metadata D1. Business planning job/artifact/solver/publish, source operasional yang kurang, engine/graph OSRM nyata dan benchmark tetap pending. Aturan retensi belum menjadi job pembersihan snapshot readiness otomatis. Bagian bertanggal sebelumnya adalah histori slice terdahulu; WEB-070 tetap In progress.


## Status terbaru WEB-070/071 — 26 Oktober 2026

Data operasional berversi tersedia pada Pengaturan → Perencanaan kunjungan → Data operasional: titik awal/akhir sales, istirahat/absen yang ditinjau, durasi dan jam penerimaan pelanggan. Rentang inklusif, revisi immutable pada rentang yang sama, scope/role/calendar/timezone per tanggal dan invalidasi readiness melalui source_epoch. [Runbook](../WEB070_OPERATIONAL_PROFILES.md), [8API aktual](visit-operational-profiles.m4.openapi.json), [ERD0045](ERD_WEB070_Operational_Implementation.md), [evidence](../WEB070_PROGRESS.json). Runtime318operasi,114tabel aplikasi/116 dengan metadataD1. Pilot utama tanpa parameter/profile default; row bisnis lama main/QA tetap identik (QA hanya menambah fixture terpisah).

Pengguna tidak mempunyai akses administrator pada Windows saat ini; routing memakai komputer lain. WSL/Docker tidak dipasang di laptop ini. Paket setup dan CLI disiapkan dengan [petunjuk host](../../tools/visit-compute-kit/README.md); alamat/OS/operator/area graph tujuan belum tersedia. Windows DPAPI agent tetap Windows-only; standalone CLI Linux belum diuji dan bukan agent Linux yang sudah berfungsi.

OR-Tools9.15.6755 benar-benar terpasang di venv lokal dan menghitung daily kernel melalui matrix terkontrol, independent validation, adapter VisitSnapshot dan file/HTTP/solver CLI. [WEB-071](../WEB071_DAILY_KERNEL.md), [progres](../WEB071_PROGRESS.json). Total311tes lulus tanpa skip, typecheck/build dan2browser profile lulus/Axe0. Engine OSRM/road graph nyata belum diuji; builder sumber bisnis, job solver, agenda terlindungi/lintas kanal dan UI/review/publish masih pending. Readiness tetapcan_generatefalse; standalone artifact tetap publishablefalse. WEB-070/071 tetap In progress; bukan PVG end-to-end atau acceptance produksi. Bagian bertanggal sebelumnya adalah histori slice terdahulu.

## Direktori titik — 28 Oktober 2026

[Impor direktori warung dan referensi peta](../POINT_DIRECTORY_IMPORT.md) mencatat keputusan pengguna, deduplikasi, migration0046, perubahan respons peta, batas scope dan prosedur batch sesuai kuota. Status cloud aktual ada pada STAGING_STATUS.json.
