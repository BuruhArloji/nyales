# Paket data latihan NYALES

Paket ini mengisi alur bisnis yang saling terhubung di **database lokal khusus**. Tidak mengubah atau mengimpor apa pun ke staging. Organisasi `demo-org` dan operator `demo-management` sengaja mengikuti identitas auth lokal; isolasi berada pada direktori database, bukan tenant baru dalam database pilot.

## Hasil audit seed dan penyebab halaman kosong

| Sumber | Yang sudah ada | Kesenjangan |
| --- | --- | --- |
| `scripts/pilot-local-prepare.ts` | Sepuluh sales, transaksi dan target pilot lokal | Launcher default mengisi sekali berdasarkan `INITIALIZED.json`; perubahan generator tidak otomatis menyegarkan database yang sudah dibuat. |
| `scripts/seed-showcase.ts` | Banyak contoh fitur, dua kanal, insentif | Terikat 18 Oktober 2026 dan berkas `test-results/before-showcase.sql`. Juga menulis koordinat visit dan posisi sales sintetis seolah kualitas GPS baik; jangan gunakan sebagai bukti lokasi. |
| `scripts/bekasi-portfolio-data.ts` | 200 customer, 5.200 kegiatan Agustus–Oktober | Hanya lapangan, katalog lama; periode berbeda dari default UI November. |
| `scripts/beverage-demo-data.ts` | SKU singkat, struktur brand/flavour/ukuran, invoice/order/visit November, insentif | Hanya lapangan. Customer operasi terhubung ke titik directory lewat overlay; bukan customer imported yang otomatis mempunyai invoice. |
| `scripts/bekasi-analysis-data.ts` | Target dan insentif beberapa bulan | Mengikuti cohort field pada seed portfolio; belum menyediakan telesales yang koheren. |

Halaman juga dapat kosong akibat scope akun/area/kanal, tanggal efektif role/reporting/assignment, periode filter, dan status sumber yang belum lengkap. Menambahkan baris saja tidak memperbaiki prasyarat itu. Paket baru menyamakan seluruh referensi dan tanggal efektif untuk tiga bulan hingga bulan pilihan.

Perbedaan API peta: `/api/map` merupakan proyeksi legacy yang tidak membawa seluruh angka finansial. Halaman peta utama memakai `/api/geo/map`, yang menambahkan `metrics` berdasarkan periode, kanal dan scope melalui `readMapMetrics()`. Validasi simbol penjualan/kunjungan harus menguji endpoint utama itu; tidak membutuhkan overlay operasi tambahan untuk customer biasa.

## Cakupan paket

Contoh November 2026, 200 customer:

| Fitur | Data yang disediakan |
| --- | --- |
| Organisasi | Management, NSM Rizky Aditya, manager dan supervisor terpisah per area/kanal; sepuluh sales: delapan lapangan, dua telesales. Satu rep mempunyai satu supervisor. |
| Customer dan lokasi | 100 titik Kota Bekasi dan 100 Kabupaten Bekasi dari snapshot imported lokal, nama/alamat/koordinat dipertahankan. Copy fixture memiliki ID baru dengan provenance ke ID asli. Area penjualan mengikuti area sumber. Tidak mengubah titik asli. |
| Produk | 29 varian minuman plesetan; SKU numerik empat digit, brand, flavour, ukuran ml, kemasan dan harga. |
| Penugasan | Satu primary rep dan kanal per customer, scope efektif sejak awal histori. Lima assignment diakhiri pada cutoff agar filter belum ditugaskan mempunyai contoh tanpa merusak atribusi invoice historis. |
| Penjualan | 472 invoice, 1.396 baris SKU, 43 retur; jumlah baris bersih = invoice bersih, bruto minus retur = bersih. Nomor lazim `INV/202611/00001`, `SO/202611/00001`, `CN/202611/00001`. Sepuluh customer dormant hanya punya invoice Juli dan tidak mempunyai transaksi tiga bulan terakhir, sehingga status Churn dapat dihitung dari histori. |
| Aktivitas | 540 activity, 864 check-in/out sintetis tanpa koordinat GPS, 108 hasil telesales manual, 550 agenda termasuk rencana mendatang, 540 task. Status selesai dan terbuka dibedakan. |
| Pipeline dan order | Tahap new/contacted/qualified/proposal/negotiation/won/lost; order confirmed serta draft/submitted/approved/pending_confirmation/rejected. Order pending tidak diberi invoice fiktif. |
| Target | Enam versi approved untuk tiga bulan × dua kanal; 30 alokasi rep. Dua rencana top-down draft untuk bulan berikutnya. |
| Insentif | Enam skema, 30 enrollment/run/statement. Bonus Rp500.000 ketika mencapai 80%; lapisan 80–100% dikenai 1% dan >100% 2%. Mesin kalkulasi aplikasi digunakan; retur sudah mengurangi basis net. Statement prepared/under_review/finalized, tanpa pembayaran nyata. |
| Forecast | Kontribusi sales dan manager, kategori committed/best_case/pipeline, terkait customer/kanal. Ini proyeksi latihan; bukan bukti penjualan tambahan. |
| Monitoring | Sepuluh coaching, sepuluh exception, 20 notifikasi tersimpan, sumber coverage dan aturan tier. Notifikasi tersimpan tidak berarti scheduler/provider telah berjalan. |

Jumlah persis disimpan pada `manifest.json`; data berukuran lain dihitung ulang, bukan menyalin angka contoh. Alur return menggunakan `credit_note` + `invoice_revision_credit`; invoice net sudah memasukkan retur sehingga tidak dikurangi dua kali. Snapshot kalkulasi mengacu sumber invoice yang sama.

## Batas yang sengaja tidak dipalsukan

| Fitur | Prasyarat yang masih dibutuhkan |
| --- | --- |
| Live GPS, posisi terakhir, bukti foto kunjungan | Perangkat, izin lokasi dan event nyata. Paket tidak mengisi `sales_last_position`, track, attachment R2 atau provider verified. |
| Street View/foto directory | Konfigurasi provider serta objek detail/foto R2 yang sesuai. Snapshot lokasi saja tidak membawa objek R2. |
| Polygon administrasi, WorldPop raster, GIS risk/materialisasi | Dataset batas/raster, file tiles, kebijakan dan run analisis nyata. Tidak membuat polygon/raster/hasil analisis rekaan. |
| Route/PJP generator | ORS credentials atau compute agent aktif, kebijakan planning, matrix dan hasil routing. Tidak membuat hasil jalan atau rute palsu. |
| Pengiriman notifikasi/panggilan | Scheduler/provider dan izin kontak. Contact fixture memakai nomor kosong dan permission unknown. Hasil telepon hanya simulasi manual. |
| Autentikasi dan pembayaran | Identitas lokal dipakai untuk latihan; tidak membuat akun/password Firebase ataupun konfirmasi transfer. |
| Data perusahaan | Invoice, target dan aktivitas seluruhnya sintetis, walau titik customer bersumber dari imported directory. Rekonsiliasi ERP belum dilakukan. |

## Membuat paket dari titik imported lokal

Jalankan dari root repo. Tidak ada akses jaringan/Cloudflare pada generator ini.

```powershell
npx tsx scripts/training-data-package.ts --month 2026-11 --as-of 2026-11-04 --count 200 --source-sqlite .nyales-agent/customer-source-20261104/preflight.sqlite --out .nyales-agent/training-package-imported
```

Snapshot dibuka dengan `DatabaseSync(..., {readOnly:true})`; query hanya memilih customer directory aktif dengan pasangan koordinat lengkap pada area Bekasi yang dikenal. Snapshot lokal tersebut berisi 3.681 titik Kota Bekasi dan 6.830 Kabupaten Bekasi ketika diperiksa; snapshot dapat tertinggal dari staging dan tidak dianggap readback terkini.

Alternatif: `--customers path/to/points.json`, berupa array `{id,name,address,latitude_e7,longitude_e7,coordinate_status,area_name,directory_dataset_id}`. Jangan masukkan secret atau kontak pribadi. Saat `area_name` diisi, paket ini hanya menerima Kota/Kabupaten Bekasi; sumber wilayah lain memerlukan perluasan area eksplisit. Tanpa sumber, generator menyediakan nama customer latihan dengan koordinat kosong, sehingga peta memang tidak menampilkan pin.

`--month` default bulan berjalan. `--as-of` default hari ini pada bulan berjalan, atau akhir bulan untuk bulan historis; tanggal itu ikut fingerprint paket. Sumber invoice dan coverage menggunakan cutoff yang sama. Untuk mengulang hasil persis, isi kedua argumen. ID dataset juga bergantung fingerprint titik dan jumlah customer.

Hasil pada folder lokal yang diabaikan Git:

- `seed.local.sql`: hanya insert terjaga serta promosi versi target milik paket; tidak menghapus/mengganti sumber.
- `manifest.json`: klasifikasi sintetis/lokal, jumlah tabel, cutoff, hasil validasi dan SHA-256 SQL.
- `source-points.json`: titik input terpilih untuk reproduksi lokal.
- `point-links.json`: pemetaan ID customer latihan ke titik asli.

Generator menolak `--apply` dan `--remote`. Tidak memiliki operasi deploy atau seed jarak jauh.

## Membuka melalui prototipe resmi

Hentikan server prototipe lama terlebih dahulu bila port 5190/5191 masih digunakan. Launcher tidak mematikan proses yang tidak dimilikinya.

```powershell
npm run ui:prototype -- --training-package .nyales-agent/training-package-imported
```

Buka `http://127.0.0.1:5190/`. Launcher memeriksa manifest lokal dan checksum SQL, membuat database khusus `.wrangler/ui-training-v1-<fingerprint>` beserta marker tersendiri, menerapkan migrasi lokal lalu paket ini. Seed sepuluh sales lama dilewati. Database default `.wrangler/ui-prototype-v1` dan staging tidak diubah. Auth lokal otomatis memakai Dina Pratiwi sebagai Management di `demo-org`, sehingga data langsung berada dalam scope akun.

Memulai ulang paket identik memakai database khusus yang sama tanpa seed ulang. Database yang sudah berisi data tetapi tidak mempunyai marker inisialisasi ditolak; jangan mengarahkannya ke database pilot. Paket yang berubah setelah inisialisasi juga ditolak. Buat paket baru dengan cutoff/sumber yang ditinjau bila membutuhkan snapshot baru; tidak ada pembersihan database otomatis.

Launcher tanpa argumen mempertahankan perilaku prototipe lama. Gunakan periode paket dan kanal yang sesuai pada filter; data historis tetap dapat diperiksa melalui filter periode. Ini petunjuk menjalankan lokal, bukan klaim bahwa UI sudah diuji atau staging sudah mendapat data baru.

## Validasi

`npx tsx --test tests/training-data-package.test.ts` memeriksa:

- determinisme, foreign key, eksekusi SQL dua kali, jumlah tiap tabel tetap;
- rekonsiliasi invoice dengan baris produk dan credit note;
- assignment customer/rep/kanal dan invoice pada seluruh rep;
- titik input tidak berubah, koordinat identik dan provenance dipertahankan;
- SKU singkat, data dua kanal dan variasi status workflow;
- local API invoice/order/pipeline/agenda/task/target/coaching/insentif tidak kosong;
- summary dua kanal, coverage dan target, scope rep telesales, serta pin peta;
- launcher menolak paket remote/tidak tervalidasi atau SQL yang checksum-nya berubah.

Tidak ada browser test, request staging atau perubahan data remote dalam pemeriksaan ini. Pengguna melakukan pemeriksaan visual dan alur UI.

## Integrasi staging kemudian

Paket ini **tidak boleh dijalankan langsung pada staging**. Sebelum porting data, tetapkan organisasi pilot dan mapping imported customer yang sebenarnya, salin hash snapshot, daftar ID sumber yang dipertahankan, aturan sumber sintetis terpisah, serta baseline total perusahaan. Siapkan rencana additive yang mereferensikan master customer existing tanpa mengganti nama/koordinat/record imported atau menduplikasi titik. Memasukkan dummy ke data pilot memerlukan instruksi eksplisit dan paket staging yang ditinjau terpisah sesuai `AGENTS.md`.
