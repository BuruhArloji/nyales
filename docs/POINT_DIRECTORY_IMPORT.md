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

Objek R2 yang sama juga menyimpan detail sumber ringkas untuk 16.074 titik unik: kategori, alamat, telepon sumber, rating, jumlah ulasan, status/jam buka, wilayah label, URL Google Maps, dan URL foto bila tersedia. Detail tidak dimuat ke payload peta besar; popup mengambilnya saat titik diklik melalui endpoint yang tetap mengikuti scope. Foto memakai URL sumber dan dapat hilang/berubah mengikuti ketersediaan Google; NYALES tidak mengklaim foto sebagai bukti kunjungan atau kepemilikan. Telepon sumber belum menjadi contact/izin menghubungi sampai ditinjau dan dibuat melalui workflow kontak resmi.

Kontrak respons yang bertambah: `/api/me` memiliki `directory_data`; payload peta memiliki `reference_points`, `reference_point_count` dan keterangan scope. Detail popup tersedia pada `/api/customers/:id/directory-details` dan `/api/point-directory/:dataset/details/:external_code`; keduanya memerlukan bearer + device session dan pemeriksaan scope. Tidak ada endpoint publik impor baru. Peta besar menggunakan GeoJSON/WebGL clusters; daftar customer memiliki paginasi tampilan 100 baris. API customer masih mengirim semua customer dalam scope, sehingga paginasi server menjadi pekerjaan lanjutan bila volume/payload meningkat.

## Penerapan dan pemulihan

1. Jalankan `scripts/warung-deduplicate.py` ke folder output baru, lalu `scripts/warung-import-prepare.py` dengan konteks staging yang telah diperiksa.
2. Ekspor D1 sebelum impor dan uji seluruh SQL pada salinan lokal backup. Periksa foreign key serta preservasi user, sesi, invoice, target dan penugasan sebelumnya.
3. Deploy kode/migration lewat workflow GitHub staging, tanpa seed otomatis. Unggah objek referensi privat R2 dan cocokkan hash sebelum mendaftarkan metadata.
4. Impor SQL per batch 200 customer. Cocokkan checksum file sebelum eksekusi; setiap batch memiliki receipt audit immutable. Bila respons ambigu, baca receipt dan jumlah aktual sebelum retry. Jangan menjalankan ulang INSERT secara buta.
5. Batasi tulisan menurut kuota D1 yang tersedia dan sisakan cadangan untuk aplikasi. Index/trigger ikut memakai kuota; gunakan metadata rows_written aktual. Bila kuota mendekati batas, hentikan pada batas batch dan lanjutkan receipt berikutnya setelah reset. Tidak mengubah paket berbayar otomatis.
6. Rekonsiliasi jumlah master, referensi, area, external code unik, flag riwayat, dan data bisnis lama. Simpan progres lokal untuk kelanjutan; data yang ditahan tidak ikut diimpor.

## Bukti pengujian lokal

Seluruh suite: 327 passed, 8 skipped, 0 failed. Typecheck dan build passed. Uji browser fixture besar passed; toggle, rendered clusters, pergantian data dan fullscreen diperiksa. Restore backup penuh dengan 12.624 customer dan 2.638 referensi mempertahankan data bisnis/sesi sebelumnya, tanpa pelanggaran foreign key. Pengujian tersebut memakai harness lokal, tidak menggantikan konfirmasi tampilan login staging oleh pengguna.

## Perbaikan lanjutan 29 Oktober 2026 — belum deploy

Detail customer pada pin DOM kecil kini baru diminta saat popup dibuka, sama seperti titik canvas. Popup menampilkan keterangan jika URL foto tidak ada/gagal dimuat; rating tidak mengarang jumlah ulasan. Status adalah status saat pendataan sumber. Popup mengikuti ruang peta, dapat digulir dengan keyboard, dan menjadi kartu di dalam peta pada layar sempit. Endpoint referensi memeriksa keanggotaan pada daftar referensi; kode master/held tidak dapat dibaca melalui endpoint tersebut. Cache privat dibatasi satu objek per isolate selama lima menit, dipisahkan oleh organisasi/manifest; kegagalan storage dapat dicoba lagi dan metadata D1 tetap diperiksa setiap permintaan.

Pencarian duplikat sebelumnya melakukan perbandingan berpasangan pada nilai yang dinormalisasi. Migration `0047_duplicate_lookup_indexes.sql` menambahkan indeks ekspresi kode, nama/alamat, nama/latitude, dan nomor kontak aktif. Query memakai probe indeks dan rentang latitude; aturan kandidat/konfirmasi merge tidak berubah. DataTools memuat hanya data tab aktif sehingga membuka Import master tidak menjalankan pencarian duplikat. Dalam profil SQLite lokal sintetis 7.400 customer unik: query lama belum selesai pada batas 5.001.000 langkah VM, query baru selesai pada sekitar 525.000 langkah VM. Ini ukuran kerja SQLite lokal, bukan pengukuran rows_read Cloudflare atau bukti penyebab seluruh kuota staging.

Lima pengujian browser fixture memeriksa cluster besar, detail hanya saat dibuka, foto berhasil/gagal, batas popup mobile, endpoint referensi dan pemuatan tab. Pengujian backend mencakup membership referensi, cache/retry, matching duplikat pada 7.400 customer dan rencana query indeks. Foto sumber nyata dan login staging belum diverifikasi secara visual pada revisi ini.

Impor cloud tetap 7.400 dari 12.624 customer, referensi 2.638, held 812. Upaya melanjutkan pada 29 Oktober diblokir layanan Cloudflare: pemeriksa analytics terkena rate limit, lalu D1 mengembalikan daily row read limit (7500). Tidak ada batch tambahan dijalankan. Kuota berikut reset 30 Oktober 2026 pukul 07.00 WIB; tidak ada resume otomatis atau perubahan paket. Deploy perbaikan beserta migration 0047 melalui workflow resmi setelah kuota pulih, lalu lanjut batch 038–064 menggunakan manifest detail terbaru yang telah diverifikasi. Receipt dan checksum SQL batch tetap sama; jangan unggah ulang objek R2 lama karena akan menghapus detail foto yang sudah disiapkan.


## Kelanjutan30 Oktober2026

Workflow resmi40987647438 men-deploycf61f49 dan migration0047; tes/build/deploy dan enam public smoke lulus. Backup cloud baru diuji restore lokal sebelum kelanjutan. Batch038-058 menambah4.200 customer: total11.600 dari12.624, tersisa1.024 pada batch059-064. Sebanyak2.638 referensi privat tetap cocok SHA-256 objek detail15.220.158byte;812 titik tetap ditahan.

Impor berhenti pada anggaran tulis harian konservatif80.000. Akuntansi77.884 meliputi54.684 rows_written dari metadata batch serta reservasi23.200 untuk indeks migrasi saat analytics provider tertunda; ini bukan bukti kuota provider habis. Tidak menaikkan paket. Reset berikut31 Oktober2026 pukul07.00WIB, tanpa resume otomatis. Rekonsiliasi cloud memeriksa seluruh external code unik, riwayat/koordinat tetap unverified, assignment baru0, preservasi tabel bisnis/sesi serta7.400 customer terdahulu, dan foreign key0. UI terbaru/hirarki tetap lokal; deployment ini hanya memakai commitcf61f49 yang sudah ada di GitHub. WEB-060 integrasi invoice nyata dan acceptance produksi tetap terbuka.


## Redesign popup lokasi30 Oktober2026

Popup desktop diperlebar menjadi360px (container maksimum400px dan tetap dibatasi ruang peta); mobile mengikuti lebar peta. Header hanya jenis titik/nama; status pelanggan dan Sales/PIC menyatu dalam definition list informasi lokasi bersama kategori/rating/status tempat/alamat/jam buka/wilayah/telepon. Foto sumber berada di atas informasi; teks Salin jam buka dari hasil scrape tidak ditampilkan. Tombol Street View dan Google Maps berikon berada pada footer di luar scroll detail. Link Google Maps selalu tersedia memakai koordinat, lalu memakai URL sumber jika detail tersedia; tab eksternal memakai noopener noreferrer. Data sumber tidak diubah.

Enam uji browser fixture lulus: cluster15k, fetch detail saat dibuka, foto berhasil/gagal, pemisahan metadata dan header, callback Street View, URL sumber, referensi, batas mobile serta footer tetap terlihat pada peta300px dengan detail panjang. Build lulus.

Deployment redesign40995040761 ditolak provider pada pemeriksaan migration karena D1 daily row read limit7500. Belum online; live tetap168317d. Reset berikut31 Oktober07.00WIB, tidak ada retry otomatis atau bypass migrasi. Pemeriksaan fixture lokal bukan bukti visual staging dengan foto sumber nyata.


### 31 Oktober 2026 — popup staging terverifikasi

Deployment resmi 41182304003 sukses setelah reset kuota, commit `07449ad`. Enam smoke checks lulus. Popup pada titik nyata diuji desktop 360px/mobile 390px: metadata terpadu, footer aksi tetap tersedia dan tidak overflow; sesi uji dicabut. Tidak ada penulisan bisnis atau batch impor pada langkah ini; 1.024 customer masih menunggu. Artefak privat `popup-browser-20261030.json` memiliki timestamp pemeriksaan 31 Oktober; screenshot `test-results/staging-popup-redesign-{desktop,mobile}.png`.


## 31 Oktober 2026 — impor dibatasi tepat 500 customer

Atas instruksi pengguna, hanya 500 customer tambahan dimasukkan: batch59/60 masing-masing200 dan 100pertama batch61. Total direktori12.100, sisa524. Batch61 tersisa100; receipt parsial menyimpan offset0/count100 dan runner melanjutkan dari offset100, tanpa mengulang impor. Jangan memakai runner lama yang menganggap setiap receipt selalu satu batch penuh. File SQL asli dan hash manifest tetap utuh; uji lokal membuktikan dua potongan100 identik dengan200 sumber kecuali timestamp otomatis, serta menolak receipt overlap.

Backup sebelum impor11.217.058byte diuji restore: quick_check ok, FK0. Rekonsiliasi sesudah impor membuktikan organisasi, user/role, invoice/retur, target, assignment, sesi, customer asli serta11.600 customer direktori sebelumnya tidak berubah; kode12.100 unik dan tidak ada assignment baru, FK0. Metadata eksekusi tiga file melaporkan3.006 reads dan6.512 writes. Ini pemakaian batch saja, di luar backup/verifikasi/operasi lain. Analytics sebelum impor2.597.649 reads/150 writes; sesudah impor masih menunjukkan angka sama karena lag, sehingga bukan bukti total akhir harian. Kuota tidak habis dan impor berhenti pada batas pengguna. Referensi peta2.638 dan review812 tidak berubah; tidak ada deploy kode/seed/penugasan baru.

Bukti privat: BEFORE_500_BACKUP_20261031.json, CLOUD_500_RECONCILED_20261031.json, IMPORT_500_USAGE_20261031.json dan PARTIAL_BATCH_VALIDATION_20261031.json pada folder customer-source-20261028. Tidak ada resume otomatis. Runner privat terbaru `.git/directory-cloud.py` mendukung `--max-customers`; salinannya disimpan sebagai bounded-import-runner-20261031.py di folder bukti privat.


## Tambahan folder Drive — 4 November 2026

Sumber tambahan diproses secara incremental menurut Google Place ID; seluruh identitas pada sumber lama dikecualikan, termasuk titik yang masih ditahan. CSV dan JSON dicocokkan pada identitas serta atribut inti, dengan dukungan baris Place ID berulang dan serialisasi list yang berbeda. Konflik inti dan kandidat nama sama dalam jarak 25 meter ditahan. Label wilayah tetap belum terverifikasi polygon.

Format objek privat `nyales-reference-points-2` memisahkan indeks pin dari detail ke 32 partisi berdasarkan byte pertama hash external code modulo 32. Tiap partisi memiliki checksum, jumlah, ukuran, namespace organisasi/dataset, serta identitas internal sendiri; endpoint detail hanya membaca partisi yang diperlukan dan tetap memeriksa scope/membership. Format lama tetap didukung. Tidak ada pembukaan endpoint publik atau penyalinan data pelanggan ke Git.
