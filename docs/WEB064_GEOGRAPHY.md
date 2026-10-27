# WEB-064 — Peta & Wilayah dan review pemetaan pelanggan

24 Oktober 2026. Implementasi lokal pada NYALES, melanjutkan dataset berversi WEB-063. Preview pilot sintetis: http://127.0.0.1:5183/#page=map. Belum deployment atau acceptance produksi.

## Alur penggunaan

Pelanggan → **Peta & Wilayah** menampilkan mode Sebaran. Filter area, sales, kanal dan status memakai scope backend yang sama dengan master pelanggan. Periode adalah konteks navigasi; pemetaan, posisi dan jumlah pelanggan memakai tanggal efektif saat ini. Analitik historis wilayah, kinerja/coverage dan risiko mengikuti WEB-066/067.

Rilis aktif menjadi default. Management/NSM dapat memilih draft lengkap untuk pratinjau, dengan label draft dan jumlah terkonfirmasi yang belum tersedia. Draft tidak boleh dipakai untuk daftar operasional per wilayah atau menerapkan pemetaan. Enam kelurahan Gambir dari sumber nasional tetap draft; cakupan teknis ini belum menentukan area bisnis pilot.

Cari nama/kode atau pilih provinsi → kabupaten/kota → kecamatan → desa/kelurahan. Klik polygon atau pilih tombol wilayah dengan keyboard untuk membuka rincian. Pelanggan terkonfirmasi mengikuti filter saat ini. Tombol **Lihat pelanggan wilayah** membuka daftar scoped; **Kembali ke peta**, browser Back, reload dan fullscreen mempertahankan konteks filter, pilihan dan kamera. Fullscreen memiliki badge wilayah terpilih. Peta desktop memiliki tinggi tetap dan panel kanan bergulir; panel berada di bawah pada mobile.

Legend membedakan batas, pelanggan terpetakan dan pelanggan abu-abu berpola yang belum terpetakan/perlu review. Tooltip polygon hitam-putih. Nol pelanggan terkonfirmasi berbeda dari jumlah draft yang belum tersedia. Pelanggan tanpa koordinat tetap masuk total dan daftar. Poligon penuh dikirim untuk display saat ini; tidak ada simplifikasi untuk matching. Maksimum 50 polygon / 2 MiB respons per pilihan; persempit filter bila perlu. Metadata rilis dibatasi 1.000 feature sesuai WEB-063.

## Review yang dapat diaudit

Kelola → Pengaturan → Batas wilayah → **Review pemetaan pelanggan**. Pilih pelanggan dan rilis, masukkan namespace/kode sumber bila tersedia, lalu **Cocokkan lokasi**. Preview tidak menyimpan pemetaan.

Matching memakai JSTS IndexedPointInAreaLocator pada geometry penuh yang diverifikasi SHA-256 dari R2 privat. Bbox D1 hanya menyaring kandidat. Hole, MultiPolygon, garis batas dan overlap diperiksa. Titik di garis, polygon bertumpuk, koordinat belum diverifikasi, konflik kode/namespace atau kode tidak dikenal memerlukan review. Tidak ada fallback ke polygon terdekat. Koordinat kosong dapat memakai kode eksplisit pada namespace yang cocok; tanpa keduanya tetap unresolved. Di luar cakupan harus dikonfirmasi reviewer, bukan dipublikasikan otomatis.

Hanya Management/NSM dapat menyimpan: konfirmasi kandidat, koreksi manual dengan alasan, tetap perlu review, atau di luar cakupan yang terbukti. Publikasi harus memakai rilis aktif, preview hash, versi customer dan revisi pemetaan yang sama; If-Match termasuk `"0"` untuk mapping baru. Idempotency-Key melindungi retry. Perubahan sumber/koordinat/versi/revisi menolak preview lama. Geometry hilang/berubah gagal tertutup tanpa menulis mapping parsial.

Penyimpanan menambahkan revisi dan audit, bukan mengedit master lokasi atau assignment. Revisi lama ditutup pada tanggal berlaku; koreksi pada hari sama menandai `superseded_at` tanpa interval tanggal kosong. Histori tidak dihapus. Perubahan koordinat/status koordinat atau pergantian rilis membuat hasil lama **perlu validasi ulang**. Data area, owner, invoice, retur, target, kunjungan dan insentif tidak ditulis oleh endpoint ini. Riwayat API/UI menampilkan 50 revisi terakhir; seluruh revisi tetap tersimpan.

## Hak akses dan kontrak

Lima operasi pada [kontrak aktual](specifications/geography-api.m4.openapi.json): peta, geometry subset, histori customer, preview dan review. Seluruh operasi memerlukan bearer dan sesi perangkat. Geometry hanya memuat feature yang diizinkan; tidak mengirim key R2 atau seluruh chunk ke user berscope. AM mengikuti area sendiri; SR mengikuti area atau assignment; supervisor mengikuti tim+area; telesales mengikuti pelanggan yang diassign. Endpoint admin WEB-063 tetap Management/NSM. Tidak ada ekspor GIS baru; drilldown scoped menggunakan `/api/customers` dengan `geo_boundary_id` atau `geo_bucket`, dan `geo_dataset_id` aktif.

[Migrasi 0036 dan ERD fisik](specifications/ERD_WEB064_Implementation.md) menambah revisi/supersession pada `customer_admin_location`, unique revision, current index dan guard histori. Metadata mapping masuk logical backup schema 0036; geometry tetap di R2 dan perlu salinan byte terpisah. Tidak ada tabel polygon besar pada D1.

## Bukti dan batas penerimaan

Lihat [evidence](WEB064_EVIDENCE.json). Regresi mencakup topology matching, konflik, review, idempotency/stale preview, perubahan koordinat/rilis, source offline/tamper, scope dan drilldown. Browser menguji synthetic QA terisolasi port 5193; sumber nyata pada pilot utama hanya dibaca sebagai draft. Basemap kosong pada pengujian browser deterministik adalah fixture; renderer polygon tetap MapLibre. Itu tidak membuktikan ketersediaan tile provider produksi.

Rilis nasional aktif, review hak penggunaan/namespace sumber, kapasitas Workers Free pada beban maksimum, login Firebase tiap role, cloud restore dan sign-off manusia tetap pending. Batas ukuran lokal bukan jaminan skala nasional atau biaya nol. Pembagian kelurahan ke area/sales bertanggal adalah **WEB-065**; tidak ada routing, ETA atau Plan Visit Generator pada WEB-064.
