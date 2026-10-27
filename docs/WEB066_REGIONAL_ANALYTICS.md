# WEB-066 — kinerja dan coverage kelurahan/desa

24 Oktober 2026. Implementasi lokal. [Kontrak tiga endpoint](specifications/regional-analytics-api.m4.openapi.json), [evidence](WEB066_EVIDENCE.json). Engineering berikutnya WEB-067; real-source/provider/human acceptance tetap terpisah.

## Alur pengguna

**Pelanggan → Peta & Wilayah → Kinerja / Coverage**. Sebaran tetap ada; tidak menambah kelompok sidebar. Pilih periode, area, sales dan kanal (termasuk Gabungan). Filter cabang/tim dari Monitoring ikut diteruskan dan dapat dihapus secara eksplisit. Rilis harus aktif; draft hanya Sebaran. Overview/Monitoring mempunyai ringkasan tiga wilayah dengan coverage diterima terendah serta tombol Lihat wilayah; tidak menggandakan seluruh analisis.

Pilih polygon atau daftar wilayah. Panel menunjukkan actual dikonfirmasi, observed invoice, pertumbuhan, target eksplisit/actual eligible/achievement, coverage, status customer, PIC dan frekuensi layanan. Sumber Customer/Invoice/Aktivitas/Target/Kinerja sales membuka popup read-only dengan pagination. Lihat pelanggan untuk tindak lanjut membawa konteks ke workflow customer yang sudah ada; kembali mempertahankan mode/periode/kanal/wilayah/camera. Pemilihan GIS tidak menelepon, membuat queue, mengubah owner atau mengirim pesan otomatis.

Warna teal bertingkat mempunyai legend dan angka; unknown memakai abu-abu berpola. Coverage memakai skala tetap 0–100%, achievement dapat melampaui 100%, pertumbuhan mempunyai rentang bertanda. Tooltip hitam-putih, daftar keyboard, panel scroll, peta tetap dan fullscreen/reduced motion mengikuti komponen NYALES. Tabel sempit scroll horizontal. Source/CSV memakai scope server, bukan filter browser saja.

## Kontrak metrik nyales-geo-kpi-1

**Basis geography:** mapping confirmed yang masih valid pada tanggal bisnis saat laporan dibaca (`mapping_cutoff`), dengan satu rilis aktif. Snapshot itu diterapkan sama pada invoice periode berjalan dan pembanding. Bukan rekonstruksi boundary/mapping as-of transaksi. Semua hasil membawa basis, versi rilis, namespace, timezone, tanggal, revision dan snapshot. Invoice/target/aktivitas/insentif historis tidak ditulis ulang. Mapping stale/unresolved/kosong masuk bucket belum terpetakan.

**Scope dan cohort:** hak akses berlaku saat request. Customer canonical dengan master aktif menjadi denominator coverage; assignment filter periode memakai cutoff laporan, selaras Monitoring. Customer alias digabung sekali. Finance memakai invoice historical area/rep/channel yang memang boleh dibaca. Invoice yang sah tetapi customer/geography terkini tidak boleh dibaca atau tidak masuk cohort filter ditempatkan pada bucket tanpa lokasi; nama/current-area baru tidak dibocorkan. Jumlah invoice dan rupiah seluruh wilayah + bucket harus cocok dengan total finance scope. Bucket ini dapat berisi nilai invoice tanpa customer denominator aktif.

**Actual:** hanya current validated IDR invoice, net tersimpan sudah memperhitungkan retur. Tidak mengurangi credit lagi. Jumlah integer rupiah aman; overflow ditolak. `observed_actual_net_minor` tetap observasi; `actual_net_minor` null jika customer_source_coverage belum meliputi seluruh periode sampai cutoff. Metadata kelengkapan ini berasal dari deklarasi sumber manual, bukan verifikasi otomatis provider.

**Pertumbuhan:** bulan penuh dibanding bulan penuh sebelumnya; MTD dibanding hari ordinal sama pada bulan sebelumnya, dijepit pada hari terakhir bulan sebelumnya. Keduanya menggunakan pemetaan/read-cutoff yang sama. Hanya dikonfirmasi bila kedua rentang sumber lengkap dan baseline >0. Baseline nol/negatif atau sumber parsial menghasilkan null/status, bukan 0% atau infinity. Nilai observasi kedua periode tersedia terpisah.

**Coverage:** customer aktif unik dengan sekurang-kurangnya satu aktivitas done bermakna (`metadata.meaningful=true` atau connected_pic) yang diterima dalam rentang tanggal bisnis organisasi. Aktivitas ulang dan lintas kanal tidak menambah numerator customer kedua kali; activity_count tetap menghitung record. Tanpa denominator menghasilkan null. Coverage ini observasi catatan lokal, bukan jumlah visit dan bukan kelengkapan/verified connection provider. Monitoring summary/source/export kini memakai window timezone yang sama, termasuk tengah malam dan DST.

**Aktif/churn/new:** helper status monitoring yang sudah berlaku, rolling 90 hari tanggal invoice. Kelengkapan window dan histori sumber diperlukan; kekurangan menghasilkan Unknown. Tidak ada invoice terakhir dan histori lengkap berarti New. Alias canonical dihitung sekali; tier/risk policy tidak diubah.

**Target:** hanya leaf target customer eksplisit yang boleh dipetakan ke kelurahan. Target rep, customer tidak terpetakan, leaf invalid/overlap/dimensi perlu review, periode yang tidak cocok atau reserve pada approved plan yang terkait menahan achievement regional. Tidak ada prorata target sales/area. Actual numerator achievement adalah actual eligible leaf yang sah, bukan semua invoice di wilayah. Denominator target nol menghasilkan null. Reserve dicek pada plan leaf dalam scope; jumlahnya disembunyikan di luar Management/NSM. Pool target belum teralokasi tetap berlabel dan masuk metadata export.

**Celah layanan:** PIC dibaca per kanal pada cutoff, unassigned gabungan berarti tidak ada owner pada kanal yang dipilih atau tidak ada di kedua kanal untuk Gabungan. Per kanal juga disediakan. Frekuensi layanan memakai `service_frequency_days` customer dan tanggal aktivitas bermakna terakhir yang diterima/diizinkan. Lewat frekuensi jika selisih hari >frekuensi. Tanpa frekuensi atau histori tetap belum cukup data, bukan overdue atau aman. Ini pemeriksaan layanan tercatat; bukan model risiko repeat-order WEB-067 dan bukan estimasi pasar kosong/pangsa pasar.

## Snapshot, export dan penyimpanan

GET `/api/geo/analytics`, `/api/geo/analytics/sources`, `/api/geo/analytics/export`. Query strict: period/area/rep/channel/branch/team/dataset dan boundary_id **atau** mapping_bucket=unmapped. Sources/export membutuhkan snapshot exact. Fingerprint mengikat organisasi, actor, role dan scope. Perubahan input ketika membaca atau setelah snapshot menghasilkan 412; muat ulang. Pagination offset hanya berlaku pada snapshot itu. CSV UTF-8 membawa filter, scope fingerprint melalui snapshot, sumber/cutoff/status, basis/alokasi, rilis, perbandingan, observed dan unknown. Formula injection di-escape. Export adalah ringkasan wilayah, bukan template import.

Tidak ada tabel analisis/materialized geometry baru. Migrasi 0039 memperluas input revision yang sudah ada ke activity, target_plan/version/item dan source_coverage. Query analytics read-only; tidak menciptakan segmentation run atau mengganti snapshot segmentasi historis. Logical backup body/response/manifest sekarang schema 0039. File export hasil pembacaan langsung; bukan laporan immutable jangka panjang. Snapshot lama tidak dapat dipakai sesudah input berubah. Jika laporan tersimpan permanen dibutuhkan, harus melalui desain retensi/audit report tambahan.

Batas request fail-closed: 2.000 canonical customer dalam cohort filter, 50.000 invoice gabungan dua periode, 10.000 aktivitas periode, 2.000 leaf target, maksimal 50 polygon display (batas geometry WEB-064 tetap). Lebih besar harus dipersempit. Agregasi memakai indeks Map/Set per grup, bukan memindai semua invoice untuk setiap kelurahan. Batas ini diuji fungsional lokal, bukan jaminan kapasitas maksimum CPU/Free D1/provider; profil cloud belum diterima.

## Verifikasi dan batas bukti

164 unit/integration tests lulus: delapan tambahan analytics dan response contract/CSV alignment mencakup rekonsiliasi, lintas kanal/alias, zero denominator, source incomplete, target eksplisit vs rep/reserve, historical transfer privacy, snapshot/actor/export, concurrent read dan Indonesia/DST. Backup logical juga menyertakan run distribusi nonkosong dan epoch persis. TypeScript/build lulus; existing large-client-chunk warning masih ada.

Dua browser analytics flows dan regresi Sebaran/Distribusi diuji terpisah pada QA: observed Rp180 juta mapped + Rp95 juta bucket = Rp275 juta. Popup sumber, CSV, reload, keyboard/Esc, customer drill/back, 390/768/1440 dan axe tanpa pelanggaran. Basemap kosong dipakai untuk determinisme browser, renderer polygon MapLibre nyata. Full provider basemap WEB-064 pernah diperiksa terpisah; tidak dianggap SLA produksi.

Restore penuh lokal schema/rows/guards: 94 tabel, 1 PDF dan 1 chunk batas cocok. Pilot utama tetap 20 customer/80 invoice/12 aktivitas/net Oktober Rp36.520.000; enam kelurahan nyata masih draft. Belum ada rilis nasional aktif, deploy cloud, Firebase/physical device atau human sign-off. Baseline 82 UAT tetap. WEB-067–074 menyusul menurut dependensi.
