# WEB-063 — master dan versi batas administrasi

23 Oktober 2026. **Implemented local; activation of the real-source extract pending metadata/namespace/usage-rights review.** Tidak ada deployment cloud atau acceptance produksi. WEB-064 overlay/matching dan WEB-065 pembagian sales tetap Planned.

## Hasil dan alur pengguna

Management/NSM membuka **Kelola → Pengaturan → Batas wilayah → Import paket wilayah**. Form berada pada popup, tombol di kanan atas. Paket divalidasi lalu disimpan sebagai draft, dengan progres bagian/feature dan rincian rilis. Paket yang sama dapat dilanjutkan setelah retry/reload tanpa membuat rilis lain; metadata berbeda untuk identitas manifest yang sama ditolak. Review aktivasi memerlukan referensi ketentuan penggunaan, hasil review, atribusi, alasan serta konfirmasi namespace/cakupan/sumber. Data publik tidak otomatis dinyatakan bebas digunakan.

Rilis aktif lama dipertahankan sampai seluruh bagian rilis baru lengkap dan checksum benar. If-Match/expected_active_id, transaksi, audit dan idempotency melindungi pergantian rilis. Aktif lama menjadi retired, geometry dan referensi histori tetap tersedia. Semua API administrasi, termasuk download geometry, hanya Management/NSM organisasi yang bersangkutan. Hak operational overlay untuk role lain akan diturunkan pada WEB-064; kode polygon tidak memperluas scope customer.

Geometry lengkap berada pada R2 privat; D1 hanya metadata/index, hierarchy snapshot, bbox dan checksum. Validasi geometry menggunakan JSTS 2.12.1, termasuk hole, MultiPolygon dan self-intersection. [ERD fisik lokal](specifications/ERD_WEB063_Implementation.md), [OpenAPI implementasi](specifications/admin-boundaries-api.m4.openapi.json). Input/geometry tidak diambil server dari URL user, sehingga source_reference bukan jalur fetch bebas.

## Sumber dan pengambilan terbatas

Sumber nasional yang telah dipilih tetap [Geoportal Kementerian Pertanian, ADMINISTRASI_DESAKELURAHAN_AR](https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0), dengan asal BIG dan referensi Semester 1 Tahun 2025 menurut metadata. Pada pemeriksaan 23 Oktober, layer melaporkan 84.080 feature nasional. Ini jumlah objek sumber saat pemeriksaan, bukan jaminan kelengkapan setiap desa/kode atau rilis terbaru. Metadata sumber dapat berubah.

Untuk profiling teknis diambil **Kecamatan Gambir, kode PUM 31.71.01, enam kelurahan**, dengan filter eksplisit. Ini bukan keputusan area pilot bisnis dan bukan dataset khusus DKI yang menggantikan sumber nasional. Source count, enumeration ID, setiap halaman dan ID setelah pengambilan cocok; geometry tidak disederhanakan. Snapshot sumber 46.139 byte; normalized canonical geometry chunk 46.343 byte. Tanggal publikasi harian tidak tersedia sehingga released_at=null, acuan semester tetap disimpan. Namespace PUM tidak disamakan dengan kode BPS. Mapping tipe desa/kelurahan dicatat sebagai konvensi teknis yang perlu review sebelum aktivasi.

copyrightText pada metadata layer/service kosong. Metadata item portal publik c4c0adda710c4193a9940440a517f57d juga diperiksa: licenseInfo dan accessInformation kosong; tidak ditemukan pernyataan hak penggunaan yang memadai pada metadata tersebut. Karena itu **enam kelurahan nyata tetap draft**, belum dipakai untuk area, assignment atau keputusan customer. Pengambilan berikutnya membutuhkan cakupan eksplisit dan anggaran/profiling; seluruh Indonesia belum diunduh.

Artefak lokal berada pada `test-results/boundaries-20261023-gambir-v2/`: metadata.json, source.geojson, input.json, ACQUISITION.json dan package.json. Folder test-results diabaikan Git; data sumber tidak disalin ke spesifikasi/repo untuk redistribusi. Manifest dan metadata ringkas tercatat pada [evidence](WEB063_EVIDENCE.json).

## Pengulangan dan operasi lokal

Gunakan nama folder/file BARU; script tidak menimpa sumber/hasil sebelumnya:

```powershell
python scripts/acquire-boundaries.py --district-code 31.71.01 --output test-results/boundary-extract-new
npx tsx scripts/pack-boundaries.ts test-results/boundary-extract-new/input.json test-results/boundary-extract-new/package.json
```

Script enumerasi ID dan query per halaman memverifikasi transfer limit, count dan ID sebelum/sesudah; missing kode/nama/geometry atau tipe tak dikenal dicatat unresolved dan paket tidak dinyatakan siap. Packer memakai canonical serializer yang sama dengan server, memvalidasi topology penuh dan menghitung ordered manifest. Source checksum untuk snapshot sumber dibedakan dari checksum tiap geometry/chunk/manifest.

Pilot bounded: 1.000 feature/rilis, 100 chunk/rilis, 32 feature/chunk, 1,5 MiB canonical/chunk, 8 MiB canonical/rilis, 40.000 posisi/chunk dan 20.000 posisi/feature. HTTP body global tetap dibatasi. Ini batas awal implementasi, bukan bukti seluruh kuota Worker Free/CPU cukup pada ukuran maksimum. Profiling sampel kecil belum membuktikan skala nasional atau biaya Rp0.

**Koreksi 3 November 2026:** 1.000 feature, 100 chunk, dan 8 MiB adalah guardrail pilot NYALES, bukan batas jumlah fitur Cloudflare. Operator mengonfirmasi Workers Paid aktif pada akun staging. Menurut [pricing D1 resmi](https://developers.cloudflare.com/d1/platform/pricing/), Workers Paid mencakup 25 miliar rows read/bulan dan 50 juta rows written/bulan; pemakaian lebih ditagih, dan batas harian Workers Free tidak berlaku setelah upgrade. DDL/index dapat ikut memakai reads/writes. Batas teknis Worker/CPU serta biaya tetap perlu diprofilkan. Karena importer, migrasi CHECK/chunk, peta/API/pencarian, review dan restore masih dirancang untuk pilot, kenaikan angka saja tidak cukup. Geometri penuh di R2/PMTiles dan D1 secukupnya (manifest serta assignment yang diperlukan) tetap menjadi desain yang lebih hemat; pilot yang sudah aktif tidak diubah.

Chunk tersimpan immutable sebelum manifest D1 dipublish atomik. Jika acknowledgement DB tidak pasti, jangan menghapus objek yang mungkin sudah direferensikan. Objek orphan dari transaksi gagal dapat tertinggal privat; housekeeping harus mencocokkan manifest D1, umur dan backup sebelum penghapusan, bukan langsung menghapus file berdasarkan kegagalan HTTP. Tidak ada auto-delete dataset/boundary lama.

Metadata masuk backup logis yang sudah ada; payload geometry R2 tetap dibackup terpisah. Full drill lokal dapat diulang pada output BARU:

```powershell
node scripts/pilot-local-restore.cjs pilot/local-20261021-v3 test-results/boundary-restore-new
```

Drill memakai SQLite online backup, namespace restore baru dan perbandingan inventory seluruh D1, lalu copy/download/checksum byte lampiran dan chunk batas melalui Wrangler R2 lokal. Tidak menimpa source database. Hasil saat WEB-063: 92 tabel aplikasi/metadata, satu lampiran dan satu chunk batas cocok; 80 invoice, 12 aktivitas dan actual Oktober Rp36.520.000 tetap. Cloud restore dan SLA belum diterima. Backup pre-migration ada pada test-results/web063-before.sqlite.

## Validasi dan batas penerimaan

Browser Chrome menguji alur import → review → activate → reload pada **geometry sintetis** di namespace terisolasi port 5193. Preview utama port 5183 menguji import/reload sumber nyata sebagai draft, termasuk import ulang tanpa duplikasi dan tanpa perubahan customer/invoice. Uji 390/768/1440px, keyboard/Esc/fokus, reduced motion, axe form/halaman dan pageerror dicatat. [Evidence terstruktur](WEB063_EVIDENCE.json).

Test bisnis mencakup geometry invalid/kompleksitas, hierarchy/code, ETag, idempotency, resume draft, file berubah, storage offline, manifest tidak lengkap, pergantian rilis atomik, isolasi organisasi/role, ketidakpastian acknowledgement, constraint interval dan backup metadata. Inventaris 240 API aktual seluruhnya memiliki tautan kontrak; delapan operasi baru tidak dapat diakses tanpa bearer/session.

Yang belum diterima: hak penggunaan/namespace/metadata sumber nyata, sumber kode successor saat pemekaran, kapasitas maksimum/provider Free, role Firebase nyata, cloud deployment/restore dan business acceptance. Runtime tidak melakukan matching point-in-polygon, overlay operasional, transfer customer/sales atau Plan Visit Generator. Pekerjaan engineering berikutnya **WEB-064**. Delapan acceptance GEO dan 82 UAT baseline tetap memiliki gate sendiri; hasil otomatis tidak diubah menjadi sign-off manusia.
