# WEB-070 — profil operasional untuk perencanaan

26 Oktober 2026. Migrasi0045 tersedia lokal pada pilot utama5183 dan QA5193. Management/NSM: Pengaturan → Perencanaan kunjungan → Data operasional. Dua pill: Operasional sales dan Layanan pelanggan; tambah/revisi/hentikan memakai tombol dan popup. [Kontrak8 operasi](specifications/visit-operational-profiles.m4.openapi.json), [ERD fisik](specifications/ERD_WEB070_Operational_Implementation.md), [progres](WEB070_PROGRESS.json).

## Input yang dinyatakan pengguna

Sales: pilih sales lapangan aktif dan cabang kalender yang benar, isi rentang tanggal inklusif, titik awal/akhir, interval istirahat serta tanggal absen. Checklist menegaskan seluruh istirahat dan absen periode itu telah ditinjau; daftar kosong sesudah review berarti tidak ada, bukan feed HR yang otomatis lengkap. Tidak memasukkan angka atau lokasi default pada pilot.

Pelanggan: durasi dalam detik atau kosong bila belum diketahui; interval penerimaan per weekday dan konfirmasi peninjauan. Hari tanpa interval berarti tutup menurut sumber yang ditinjau. Tanpa profil berarti unknown. Sumber manual dan alasan wajib dicatat, tidak membaca free-text visit_window lama sebagai jam yang terstruktur.

Rentang maksimal366hari. Periode current satu target tidak boleh overlap. Revisi hanya untuk target dan rentang yang sama, memakai If-Match dan previous_id; histori/config hash lama tetap. Untuk menghentikan profil, isi alasan dan konfirmasi di popup. Profile baru periode lain tidak mengubah periode lama diam-diam. Role, scope branch, status target dan masa berlaku diperiksa di transaksi.

## Pemakaian pada kesiapan

Setiap tanggal mengambil profil yang menutup tanggal tersebut. Sales harus mempunyai role lapangan, scope/area/cabang aktif serta kalender yang sesuai pada tanggal itu. Konversi jam memakai timezone cabang; jam ambigu/tidak ada akibat DST tetap ditolak. Absen/hari nonkerja bukan hari eligible; interval break di luar shift menjadi penghambat.

Penerimaan pelanggan dipotong ke shift yang sah, durasi harus diketahui dan muat di jendela. Profile parsial tidak disebut lengkap untuk seluruh periode. Readiness menyimpan operational_days/operational_dates dan provenance, menaikkan epoch pada perubahan, serta hanya menghapus penghambat yang benar-benar dipenuhi sumber. Tidak mengasumsikan histori visit lengkap, remaining demand nol, koordinat GPS atau assignment berubah.

Readiness tetap `can_generate:false`, `publishable:false`. Ia bukan input solver. Engine/routing nyata, histori layanan lengkap, interval/lokasi agenda terlindungi dan constraint lintas kanal masih diperlukan untuk builder bisnis. Daily kernel yang diuji terpisah dijelaskan pada [WEB-071](WEB071_DAILY_KERNEL.md).

## Bukti lokal

Enam tes profil mencakup CAS/idempotency/overlap/history, role/tenant, absen/null/closed days, timezone dan readiness yang memakai sumber. Total suite setelah penambahan kernel harian311tes lulus tanpa skip. Browser profil dua skenario lulus, Axe0, viewport390/768/1440 tanpa overflow; tambah dan exact-range revision mempertahankan detail lama, invoice tetap. Typecheck dan build lulus; warning bundle besar existing tetap.

Main seluruh18 tabel bisnis identik dengan online backup sebelum0045, tanpa profile default. QA menambah fixture terpisah (customer1, assignment1, user4); semua row bisnis sebelumnya tetap identik, integrityok/FK0. Backup SQLite dilakukan secara online sebelum migrasi. Verifikasi hash/count logical backup bukan bukti restore bytesR2/acceptance produksi. Tidak ada deployment cloud.

Komputer pengguna tidak mempunyai akses admin. Routing akan memakai komputer lain; WSL/Docker tidak dipasang pada laptop ini. Paket sumber untuk host lain ada pada `tools/visit-compute-kit/README.md`.
