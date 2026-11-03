# Distribusi sales — perbaikan lag

## Diagnosis staging

Inspeksi browser sebelum perubahan menemukan **12.321 baris tabel** (termasuk baris kosong tabel wilayah) dan **12.334 tombol** pada halaman Distribusi sales. Seluruh 12.320 customer dirender sekaligus. Dua request `/api/customers` berasal dari daftar penugasan serta persiapan form pembagian wilayah. Waktu tunggu header yang diamati sekitar **4.589 ms dan 5.125 ms**; ini sampel tunggal request staging, bukan p95 atau pengukuran CPU server.

## Perubahan

- Daftar penugasan menggunakan pagination server, maksimum 100 customer per halaman. Pencarian/filter berlaku pada seluruh cohort, bukan hanya hasil halaman pertama.
- Endpoint customer menerima `projection=assignment` dengan pagination wajib. Respons berisi identitas customer, area, record status, versi dan PIC saat ini; tidak menghitung invoice atau membangun snapshot segmentasi. Respons normal tetap tersedia untuk caller yang memerlukan angka penjualan/status transaksi.
- Jumlah customer total tetap berasal dari filter server. Jumlah ditugaskan/belum ditugaskan pada ringkasan diberi label **Pada halaman ini**, sehingga tidak disalahartikan sebagai total organisasi.
- Pencarian diberi debounce 250 ms, perubahan filter kembali ke halaman pertama, dan request lama dibatalkan/diabaikan agar tidak menimpa hasil terbaru.
- Referensi area/user digunakan kembali dalam komponen yang sama. Membuka tab Beban langsung tidak memuat directory penugasan yang tidak terlihat.
- Form pembagian wilayah tidak lagi mengambil semua customer saat halaman dibuka. Pilihan PIC dimuat ketika form dibuka; pencarian pelanggan pengecualian berjalan ketika bagiannya diperluas, dibatasi 100 hasil. Pilihan pelanggan sebelumnya dipertahankan saat kata pencarian diganti, maksimum 25 pengecualian sesuai aturan server.
- Predicate penugasan memakai UNION pada pencarian keluarga merge agar indeks customer dan merged family dapat digunakan terpisah. Tenant, scope role, effective date dan kanal tetap diperiksa sebelum pagination.

Tidak ada perubahan customer, invoice, nilai target, assignment operasional, schema atau data peta. Riwayat penugasan dan validasi mutasi tetap memakai endpoint lama.

## Bukti lokal

- TypeScript dan build lulus. Suite aplikasi: **374 test, 366 lulus, 8 dilewati, 0 gagal**.
- Unit/kontrak mencakup pagination, pencarian melewati halaman pertama, count seluruh cohort, enam role, tenant lain, filter kanal/PIC, merge alias, dan tidak adanya query invoice/segmentation pada projection penugasan.
- Empat browser check melalui `npm run ui:prototype`: dataset respons sintetis 12.320 customer dengan 100 baris maksimum; halaman berikut dan pencarian customer terakhir; respons terlambat; peralihan kanal; mobile tanpa overflow; histori melalui API/D1 lokal; pilihan pengecualian bertahap dan retensi pilihan; tab Beban tidak meminta directory tersembunyi. Tidak ada perubahan business data staging untuk pengujian.
- Screenshot desktop/mobile ada pada `test-results/assignment-performance/`. Dataset 12.320 pada uji browser adalah fixture respons sintetis, bukan hasil import ke D1 lokal.

Pembandingan telemetry emulator D1 pada **fixture lokal 20 customer**, snapshot siap, masing-masing satu sampel:

| Jalur | Cache | Statement | Rows read lokal | Rows written |
|---|---|---:|---:|---:|
| Full directory lama | HIT | 4 | 3 | 0 |
| Customer page biasa | Tanpa cache | 13 | 696 | 0 |
| Assignment page | Tanpa cache | 7 | 282 | 0 |

Cache full directory yang HIT dapat memakai read lebih sedikit daripada pagination uncached pada fixture kecil; hasil tersebut tetap dicatat. Cache tersebut tetap mengirim seluruh customer ke browser, sehingga tidak mengatasi pembengkakan DOM. Pengukuran ini tidak menjadi klaim persentase penghematan read staging atau harian. Artefak `local-query-comparison.json` mencocokkan request ID dengan log `nyales_api`; tidak menyimpan token sesi.

## Batas dan penerimaan

Offset pagination dan exact count masih bekerja sesuai ukuran scope/filter. Pengujian 12.320 customer memverifikasi batas render dan request frontend, bukan SLA query D1 pada seluruh ukuran data. Query status penugasan tetap berbeda dari segmentasi status transaksi. Preview cohort pembagian wilayah dan analisis Beban mempunyai alur serta batasnya sendiri.

Deployment mengikuti GitHub Actions, seed dan mapping tidak diaktifkan. Pemeriksaan staging sesudah deploy harus memastikan maksimal 100 baris penugasan, metadata total konsisten, tidak ada request customer tanpa pagination pada awal halaman, dan pencarian/kanal tetap berfungsi. Bukti CI, deploy, smoke dan inspeksi disimpan terpisah dari bukti lokal.
