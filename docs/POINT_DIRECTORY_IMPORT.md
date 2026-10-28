# Direktori warung Jakarta Pusat dan Bekasi

Keputusan pengguna: hanya warung masuk master customer; titik lain menjadi referensi peta. Sumber tetap utuh di Google Drive. Artefak mentah, kontak, SQL berisi customer, backup, dan hasil bersih disimpan lokal pada direktori terabaikan `.nyales-agent/customer-source-20261028/`, tidak dimasukkan Git.

## Rekonsiliasi sumber

Enam file (tiga CSV dan pasangan JSON) mewakili 16.387 baris CSV. Pasangan JSON diverifikasi menurut Google Place ID, bukan urutan baris. Deduplikasi menghapus 313 pengulangan Place ID, menghasilkan 16.074 titik unik.

| Tujuan | Jumlah |
| --- | ---: |
| Master customer siap impor | 12.624 |
| Referensi peta siap impor | 2.638 |
| Ditahan untuk pemeriksaan | 812 |

Titik yang berbeda Place ID tetapi berdekatan dan bernama sama hanya ditandai sebagai kandidat duplikat. Konflik kota, klasifikasi sasaran, alamat di luar wilayah sumber, koordinat mencurigakan, atau nama/alamat yang tidak memenuhi validasi ditahan; tidak dihapus dari hasil bersih. Penyebab pemeriksaan dapat bertumpang tindih.

## Perilaku aplikasi dan ERD

Migration `0046_point_directory.sql` menambahkan `point_directory_dataset` sebagai metadata sumber milik organisasi. `customer_outlet.directory_dataset_id` menunjuk dataset dalam organisasi yang sama, dijaga trigger database. `transaction_history_unverified=1` berarti riwayat belum dibuktikan lengkap; customer tersebut mendapat segmentasi Unknown/provisional dan tidak memakai kelengkapan transaksi data latihan.

Master impor belum memiliki penugasan sales, invoice, izin kontak, atau akun Firebase baru. Tiga area awal hanya penempatan berdasarkan label kota/alamat sumber. Label pencarian kelurahan bukan hasil verifikasi polygon administrasi. Koordinat tetap unverified. Penempatan ini perlu ditinjau sebelum digunakan untuk penugasan operasional.

Referensi non-warung disimpan pada objek JSON privat R2; D1 hanya menyimpan metadata, SHA-256 dan jumlahnya. Referensi tidak masuk hitungan customer, coverage, target, transaksi, atau penugasan. Akses referensi tersedia untuk Management/NSM dalam scope organisasi tanpa filter area/sales/status customer. Berkas diverifikasi namespace, ukuran, organisasi, dataset, jumlah dan hash sebelum ditampilkan.

Kontrak respons yang bertambah: `/api/me` memiliki `directory_data`; payload peta memiliki `reference_points`, `reference_point_count` dan keterangan scope. Tidak ada endpoint publik impor baru. Peta besar menggunakan GeoJSON/WebGL clusters; daftar customer memiliki paginasi tampilan 100 baris. API customer masih mengirim semua customer dalam scope, sehingga paginasi server menjadi pekerjaan lanjutan bila volume/payload meningkat.

## Penerapan dan pemulihan

1. Jalankan `scripts/warung-deduplicate.py` ke folder output baru, lalu `scripts/warung-import-prepare.py` dengan konteks staging yang telah diperiksa.
2. Ekspor D1 sebelum impor dan uji seluruh SQL pada salinan lokal backup. Periksa foreign key serta preservasi user, sesi, invoice, target dan penugasan sebelumnya.
3. Deploy kode/migration lewat workflow GitHub staging, tanpa seed otomatis. Unggah objek referensi privat R2 dan cocokkan hash sebelum mendaftarkan metadata.
4. Impor SQL per batch 200 customer. Cocokkan checksum file sebelum eksekusi; setiap batch memiliki receipt audit immutable. Bila respons ambigu, baca receipt dan jumlah aktual sebelum retry. Jangan menjalankan ulang INSERT secara buta.
5. Batasi tulisan menurut kuota D1 yang tersedia dan sisakan cadangan untuk aplikasi. Index/trigger ikut memakai kuota; gunakan metadata rows_written aktual. Bila kuota mendekati batas, hentikan pada batas batch dan lanjutkan receipt berikutnya setelah reset. Tidak mengubah paket berbayar otomatis.
6. Rekonsiliasi jumlah master, referensi, area, external code unik, flag riwayat, dan data bisnis lama. Simpan progres lokal untuk kelanjutan; data yang ditahan tidak ikut diimpor.

## Bukti pengujian lokal

Seluruh suite: 327 passed, 8 skipped, 0 failed. Typecheck dan build passed. Uji browser fixture besar passed; toggle, rendered clusters, pergantian data dan fullscreen diperiksa. Restore backup penuh dengan 12.624 customer dan 2.638 referensi mempertahankan data bisnis/sesi sebelumnya, tanpa pelanggaran foreign key. Pengujian tersebut memakai harness lokal, tidak menggantikan konfirmasi tampilan login staging oleh pengguna.
