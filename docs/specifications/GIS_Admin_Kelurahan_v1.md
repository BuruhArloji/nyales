# NYALES — pembagian wilayah berbasis kelurahan/desa

> Status terkini 24 Oktober 2026: WEB-063/064/065/066 implemented dan diuji lokal. Sumber nyata tetap draft; WEB-067–074 belum selesai. Keterangan Planned bertanggal 22/23 Oktober di bawah adalah baseline perencanaan. [WEB-065](../WEB065_DISTRIBUTION.md), [WEB-066](../WEB066_REGIONAL_ANALYTICS.md).

22 Oktober 2026. Addendum PRD v1.10 CUS-04, ERD v1.2 dan backlog v1.2. **Keputusan produk disepakati; WEB-063 tersedia lokal sejak 23 Oktober 2026, aktivasi sumber nyata pending review; WEB-064/065 Planned.** Menggantikan frasa umum “daftar outlet serta polygon opsional” untuk pembagian awal wilayah. Tidak mengubah status fitur yang sudah diimplementasikan pada WEB-009/015/016.

## Keputusan terbaru - 7 November 2026

Cakupan penataan ulang adalah **semua wilayah customer yang sudah diimpor**. Satu kelurahan/desa hanya memiliki satu sales lapangan pada tanggal yang sama. Satu sales boleh beberapa kelurahan. Beban berlebih tidak membelah kelurahan; telesales terpisah. Ketentuan ini menggantikan pengecualian lapangan GEO-05 pada baseline di bawah. Perubahan dilakukan melalui preview dan tanggal efektif. Area lama diarsipkan setelah customer/dependensi berpindah, dengan histori transaksi tetap utuh. Detail: [WEB-065](../WEB065_DISTRIBUTION.md).

## Sumber file batas yang dipilih

| Metadata | Keputusan |
| --- | --- |
| Dataset | Batas wilayah administrasi desa/kelurahan Indonesia |
| Layer | ADMINISTRASI_DESAKELURAHAN_AR |
| Penyedia akses | Geoportal Kementerian Pertanian |
| Asal data | BIG menurut metadata layer |
| Referensi layanan | [Layer batas desa/kelurahan Indonesia](https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0) |
| Acuan edisi | Semester 1 Tahun 2025, menurut metadata yang diperiksa pada 22 Oktober 2026; bukan klaim rilis terbaru |
| Format kerja | Snapshot GeoJSON Polygon/MultiPolygon, WGS84, longitude–latitude |
| Nama file rencana | `batas-desa-kelurahan-indonesia-big-2025-s1.geojson` |
| Status | Sampel teknis dari sumber nasional: enam kelurahan Gambir sudah diambil, ber-checksum dan dimuat sebagai draft D1/R2 lokal pada 23 Oktober. Seluruh Indonesia belum diunduh; aktivasi sumber nyata menunggu review |

File ini menjadi sumber geometry untuk pembagian awal wilayah NYALES; basemap OpenFreeMap tetap terpisah. Pengambilan dapat dilakukan bertahap per wilayah operasional, dengan manifest cakupan dan seluruh halaman hasil dicocokkan ke jumlah record sumber. Batas jumlah record per respons tidak boleh menghasilkan file parsial yang dinyatakan lengkap. Simpan URL sumber, metadata rilis, waktu pengambilan, kode/namespace, ketentuan penggunaan, atribusi dan SHA-256 file setelah pengambilan.

Metadata sumber menyebut masih ada wilayah yang belum mempunyai representasi spasial atau kode serta batas indikatif yang dapat saling klaim. Kasus tersebut mengikuti antrean review GEO-03; file tidak diasumsikan mencakup setiap kelurahan/desa secara sempurna. Pilihan sumber ini menggantikan status sumber belum dipilih pada addendum awal. Dataset khusus DKI tidak menjadi sumber awal yang dipilih.

## Aturan produk

**GEO-01 P0 — Unit pembagian awal.** Gunakan batas administrasi kelurahan, atau desa pada wilayah yang menggunakan desa. Pemilihan mengikuti provinsi → kabupaten/kota → kecamatan → kelurahan/desa. Satu area bisnis dapat menggabungkan beberapa kelurahan/desa. Area bisnis tetap memiliki ID internal, cabang dan scope sendiri; nama atau kode kelurahan tidak menggantikan `area_id`. Satu sales dapat melayani beberapa kelurahan. Assignment ke sales tetap disimpan pada pelanggan dan dipisahkan per kanal.

**GEO-02 P0 — Sumber dan versi batas.** Dataset mencatat penyedia, namespace kode, versi/tanggal rilis, tanggal diperoleh, lisensi/atribusi, checksum dan cakupan. Sumber awal dipilih pengguna pada 22 Oktober 2026: dataset Batas wilayah administrasi desa/kelurahan Indonesia, layer ADMINISTRASI_DESAKELURAHAN_AR di Geoportal Kementerian Pertanian, dengan sumber BIG menurut metadata layer dan acuan edisi Semester 1 Tahun 2025. Gunakan snapshot file GeoJSON berversi; verifikasi metadata rilis, namespace kode, cakupan, ketentuan penggunaan dan atribusi sebelum aktivasi. Nama saja tidak menjadi kunci, dan kode dari namespace berbeda tidak disamakan tanpa mapping eksplisit. Polygon/MultiPolygon dan hierarki wilayah diimpor serta divalidasi. Bentuk batas berasal dari dataset tersebut; tidak bergantung pada basemap atau layanan geocoding. Pemekaran/perubahan kode disimpan sebagai versi dan mapping penerus, bukan menimpa fakta lama.

**GEO-03 P0 — Pemetaan pelanggan.** Koordinat pelanggan dicocokkan terhadap batas untuk menghasilkan usulan kelurahan/desa, dengan referensi versi boundary dan metode pencocokan. Kandidat dari kode wilayah sumber dapat dipakai bila namespace diketahui. Management/NSM dapat mengonfirmasi atau mengoreksi dengan alasan dan audit. Pelanggan tanpa koordinat tetap bisa dipetakan dari kode atau review manual. Koordinat belum terverifikasi memberi usulan yang perlu ditinjau. Alamat teks/geocoding tidak otomatis dianggap hasil pasti. Titik tepat di garis batas, tumpang tindih, konflik kode vs koordinat, di luar cakupan, atau tanpa kecocokan masuk antrean review; jangan memilih wilayah terdekat diam-diam. Pelanggan tersebut tetap ada dalam total dan daftar.

**GEO-04 P0 — Pembentukan area.** Management/NSM memilih satu atau beberapa kelurahan/desa untuk area bisnis, beserta tanggal efektif dan alasan. Pada pembagian awal, satu kelurahan/desa mempunyai paling banyak satu area bisnis aktif dalam organisasi pada tanggal yang sama; periode tidak boleh overlap. Kelurahan yang belum dibagi ditandai unassigned. Tidak ada persyaratan menggambar polygon bebas atau membelah kelurahan untuk memulai. Perubahan geografi dan pemetaan area tidak otomatis memperluas izin atau memindahkan pelanggan yang sudah ada. Pemindahan area pelanggan menggunakan proses transfer bertanggal yang sudah ada.

**GEO-05 P0 — Pembagian awal sales.** Setelah wilayah dipilih, sistem menampilkan preview pelanggan menurut kelurahan, jumlah pelanggan, owner/kanal saat ini, kandidat yang belum terpetakan, konflik dan perubahan yang diusulkan. Management/NSM memilih penerima sales lapangan/telesales dan menyetujui assignment massal. Kanal tidak digabung, satu owner aktif per pelanggan/kanal dipertahankan, role/area/hirarki penerima divalidasi. Aturan SR satu SPV dan izin pelanggan dalam area atau assignment tetap berlaku. Pengecualian pelanggan di luar pembagian kelurahan dapat ditetapkan secara eksplisit sesuai scope yang sah, dengan alasan dan tanggal efektif. Pemilihan wilayah pada peta bukan perintah commit. Dry-run, versi/konflik, idempotency dan audit mengikuti aturan assignment yang sudah ada.

**GEO-06 P0 — Tampilan.** Peta menampilkan overlay batas administrasi, nama dan kode, area pemilik serta filter hierarki wilayah/area/sales/kanal. Pilihan wilayah membuka daftar pelanggan dan usulan pembagian. Nilai belum terpetakan dan tanpa koordinat terlihat pada daftar serta ringkasan. Supervisor/AM/SR hanya melihat pelanggan dan agregat dalam scope; filter atau kode polygon tidak memperluas akses. Pengaturan dataset, pemetaan wilayah, dan commit assignment hanya Management/NSM. Coverage tetap pelanggan unik dengan interaksi bermakna, bukan persentase luas polygon. Tidak menambahkan routing, ETA atau optimasi perjalanan.

**GEO-07 P0 — Histori dan pembaruan.** Simpan tanggal efektif membership area–kelurahan, histori pemetaan pelanggan, dataset/boundary yang menjadi dasar dan keputusan override. Pembaruan batas, nama atau kode wilayah menghasilkan preview perubahan dan review; tidak otomatis mengubah customer area, sales owner, invoice, kunjungan, target atau insentif historis. Satu pelanggan tetap satu lokasi dan satu area pada satu tanggal. Boundary lama yang direferensikan tetap dapat ditelusuri.

**GEO-08 P0 — Penyimpanan.** Rancangan Cloudflare: D1 menyimpan kode/hirarki, versi dataset, metadata geometry/bounding box, relasi area–wilayah dan pemetaan pelanggan. Payload geometry berversi disimpan sebagai objek di R2, dikelompokkan sesuai wilayah yang diperlukan pilot. GeoJSON memakai urutan longitude, latitude (WGS84). Geometry penuh tervalidasi dipakai untuk pencocokan; bentuk yang disederhanakan boleh dipakai untuk tampilan, bukan keputusan batas. Batasi ukuran/kompleksitas import dan gunakan bounding box untuk menyaring kandidat sebelum point-in-polygon. Besaran batas dan anggaran kuota ditetapkan setelah profiling dataset; tidak menjanjikan pemuatan seluruh Indonesia atau penyimpanan nasional gratis.

## Alur awal

1. Management/NSM memilih dan mengaktifkan rilis dataset yang telah direview.
2. Pilih kelurahan/desa untuk membentuk area bisnis.
3. Sistem mengusulkan pemetaan pelanggan; tinjau data kosong, titik batas dan konflik.
4. Pilih sales penerima per kanal; tinjau jumlah pelanggan dan seluruh perubahan.
5. Commit bertanggal efektif; peta, daftar dan scope memakai hasil penugasan yang sah.

## Acceptance tambahan

Acceptance ini merupakan tambahan GEO-A01–08; **82 skenario UAT baseline tetap utuh**. Semua status berikut Planned, belum bukti implementasi atau penerimaan.

| ID | Skenario | Hasil wajib |
| --- | --- | --- |
| GEO-A01 | Dua kelurahan bernama sama pada kecamatan berbeda | Kode + namespace + hierarki membedakan pilihan; tidak merge karena nama |
| GEO-A02 | Dua kelurahan digabung ke satu area | Membership tersimpan bertanggal; konflik area kedua pada interval sama ditolak |
| GEO-A03 | Titik di dalam polygon, hole, multipolygon, tepat batas atau overlap | Hasil valid sesuai geometry; kasus ambigu/outside masuk review tanpa fallback diam-diam |
| GEO-A04 | Koordinat kosong atau bertentangan dengan kode sumber | Pelanggan tetap masuk total; review/manual beralasan; belum pasti tidak diberi status confirmed |
| GEO-A05 | Preview pembagian kelurahan ke sales | Preview tidak menulis assignment; commit menjaga kanal, scope, SPV, periode dan owner tunggal; retry tidak menggandakan |
| GEO-A06 | Batas diperbarui/pemekaran atau override pelanggan | Versi lama tetap terlacak; tidak mengubah histori atau memindahkan owner tanpa transfer eksplisit |
| GEO-A07 | AM/SR mencoba konfigurasi atau meminta pelanggan di luar scope melalui filter wilayah | Konfigurasi ditolak; list/detail/aggregate/export tunduk scope backend |
| GEO-A08 | Source R2 gagal, geometry invalid, ukuran berlebih atau versi draft | Gagal dengan pesan yang dapat ditindaklanjuti; versi aktif lama tetap dapat dipakai; checksum/atribusi tersedia |

## Penurunan teknis dan status

- ERD rancangan menambahkan `admin_boundary_dataset`, `admin_unit`, `admin_boundary`, `area_admin_membership` dan `customer_admin_location`. Lima tabel ini dan admin_boundary_chunk sudah diturunkan pada migrasi lokal 0035/WEB-063; write API pemetaan/area masih WEB-064/065.
- WEB-063 menyiapkan master, sumber/versioning dan data model; WEB-064 menyiapkan overlay dan pemetaan pelanggan; WEB-065 menyiapkan area serta preview/commit pembagian sales.
- Kontrak request/response, pengamanan object geometry, batching dan migrasi disusun sebagai deliverable WEB-063–065 sebelum implementasi. Kontrak `/api` yang berjalan belum menyediakan operasi tersebut. API aktual dan ERD fisik yang sudah teruji tidak ditandai berubah oleh addendum ini.
- Sumber boundary nasional telah dipilih sesuai tabel di atas. Cakupan pengambilan pilot, validasi namespace, rilis snapshot, ketentuan penggunaan dan atribusi dikonfirmasi saat WEB-063. Pembaruan 23 Oktober: sampel teknis telah diambil dan dimuat draft lokal; bukan unduhan nasional lengkap atau aktivasi sumber.

## Detail UI/UX dan analisis lanjutan

[GIS UI/UX dan analitik](GIS_UX_dan_Analitik_v1.md) memperinci WEB-064/065 dan menambahkan WEB-066–068 (M4 extension P1). Kinerja/coverage didahulukan, risiko dan simulasi menyusul; staging/login dan pilot tim tidak bergantung pada seluruh analitik. Penambahan ini belum mengubah runtime, kontrak API atau migrasi fisik.

## Implementasi WEB-063 - 23 Oktober 2026

[Runbook dan evidence](../WEB063_ADMIN_BOUNDARIES.md), [API aktual](admin-boundaries-api.m4.openapi.json) dan [ERD fisik](ERD_WEB063_Implementation.md) mencatat import bertahap, full topology validation, checksum/manifest, isolasi organisasi/role, draft resume, review aktivasi, versi immutable dan backup/restore. Overlay/pemetaan, assignment dan acceptance lintas fitur GEO-A01–08 tidak otomatis selesai. Sampel Gambir adalah profiling teknis, bukan penetapan area pilot bisnis. Source metadata tidak memberikan pernyataan hak penggunaan yang cukup; tidak mengarang lisensi atau aktivasi.

## Implementasi lokal WEB-064 — 24 Oktober 2026

Overlay/pencarian, matching geometry penuh, review dengan alasan, revisi immutable dan scoped customer drilldown tersedia. GEO-A03/04/07/08 memiliki bukti otomatis lokal; penerimaan sumber nyata/provider/manusia tetap terpisah. Perubahan koordinat/rilis menandai mapping perlu validasi ulang, tanpa transfer owner/fakta otomatis. Source nyata tetap draft; WEB-065 area/sales assignment belum tersedia. [Runbook](../WEB064_GEOGRAPHY.md), [API](geography-api.m4.openapi.json), [ERD fisik 0036](ERD_WEB064_Implementation.md).
