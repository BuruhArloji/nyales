# Penghematan read — implementasi awal, 2 November 2026

Pekerjaan pertama membatasi `GET /api/customers/:id` ke satu customer yang berhak dilihat. Jalur sebelumnya membangun seluruh directory lalu mencari satu ID di JavaScript. Perubahan ini lokal; belum dideploy dan belum diukur pada D1 staging.

## Hasil pengukuran lokal

Fixture sintetis: 1.000 customer, 1.000 assignment lapangan, 1.000 invoice, 20 customer dengan riwayat terverifikasi. Semua migrasi repository, termasuk 0048, diterapkan **hanya pada SQLite lokal**. Snapshot segmentasi disiapkan sebelum pengukuran. Scope server ikut dihitung; Firebase, device-session gate, observability persistence, dan cache Cloudflare tidak disimulasikan.

| Journey | Baris hasil query sebelum | Sesudah | Instruksi SQLite sebelum | Sesudah |
|---|---:|---:|---:|---:|
| Directory penuh | 2.023 | 2.023 | 8.249.662 | 8.249.662 |
| Detail satu customer | 2.023 | 7 | 8.249.481 | 902 |
| Directory halaman 100 | 324 | 324 | 124.679 | 124.679 |
| ID tidak ditemukan | 2.023 | 1 | 8.249.481 | 64 |

Baris pada tabel merupakan jumlah baris hasil seluruh statement dalam satu request, bukan jumlah customer di respons. Baris hasil dan instruksi VM **bukan `rows_read` D1**. Sampel tunggal ini menunjukkan berkurangnya pekerjaan query; belum membuktikan persentase penghematan kuota, latency p95, atau pemakaian harian. Nilai `d1_rows_read` tetap `null`.

Baseline diambil dari source sebelum perubahan (HEAD `444937165ee375d16b08ea781207a087094f3c90`). Artefak lokal ada di `test-results/read-efficiency/before-1000/` dan `after-1000/`: `report.json`, trace SQL/binding sintetis, dan database sintetis untuk replay. Artefak tersebut diabaikan Git. Report berikutnya mencatat hash source dan daftar migrasi lokal.

Uji lanjutan 2.000 customer (`scale-2000/report.json`) mempertahankan hasil detail pada 7 baris pendukung dan 902 instruksi VM; ID tidak ditemukan tetap 1 baris pendukung dan 64 instruksi. Ini menguji pertumbuhan customer yang tidak berkaitan, bukan membuktikan performa keluarga merge atau riwayat invoice yang terus bertambah.

Percobaan fixture 12.000 dibatalkan sebelum menghasilkan laporan karena biaya persiapan/pengukuran awal terlalu tinggi untuk iterasi ini. Tidak ada angka hasil atau klaim validasi skala 12.000 dari percobaan tersebut.

## Perubahan dan batasnya

- Periksa customer berdasarkan tenant, ID, area join, dan scope yang berlaku sebelum mengambil fakta bisnis. ID asing, tidak ada, dan di luar scope tetap `404 NOT_FOUND`.
- Query invoice dan pemilik hanya membaca keluarga canonical customer beserta sumber merge. `UNION` memungkinkan indeks identity dan keluarga merge digunakan secara terpisah.
- Segmentasi yang dibaca hanya satu customer. Assignment diambil berdasarkan customer dan sumber alias yang relevan.
- Tetap gunakan rumus MTD, cutoff, validasi/current invoice, atribusi historis, pemilik, dan proyeksi respons yang sama. ETag dan metadata alias dipertahankan.
- Tidak menambah cache detail lintas request. Pencabutan assignment diperiksa kembali pada request berikutnya.
- Tidak mengubah UI, daftar penuh, pagination, schema database, atau konfigurasi billing.

`EXPLAIN QUERY PLAN` lokal menunjukkan seek melalui `invoice_outlet_facts`, `customer_org_identity`, `customer_family`, `idx_customer_assignment_active`, dan `alias_canonical`. Hasil tersebut bergantung pada indeks yang diterapkan; status migrasi 0048 di staging belum diperiksa pada pekerjaan ini.

**Batas yang belum dioptimalkan:** ketika snapshot segmentasi untuk tanggal/epoch tersebut belum tersedia, `segmentationSnapshot` masih dapat membangun snapshot organisasi. Tidak ada klaim bahwa semua cold request sudah mempunyai biaya konstan. Customer dengan keluarga merge/riwayat invoice yang besar tetap memerlukan lebih banyak pekerjaan sesuai ukuran keluarganya.

## Validasi

- Baseline sebelum perubahan: `npm ci`, `npm run check`, `npm test`, `npm run build` lulus. Suite awal: 355 test, 347 lulus, 8 dilewati, 0 gagal.
- Rekonsiliasi detail terhadap directory untuk enam role: Management, NSM, Area Manager, Supervisor, Sales Rep, Telesales.
- Fixture merge/alias: invoice bulan lalu dan bulan berjalan, lintas kanal, future, cancelled, draft, superseded; metadata alias dan ETag tetap sesuai.
- Pencabutan akses Telesales langsung menghasilkan 404. Detail tidak ditemukan tidak membangun snapshot segmentasi.
- Pemeriksaan akhir `npm run check`, `npm test`, dan `npm run build` lulus. Total 357 test: 349 lulus, 8 dilewati, 0 gagal. Tidak ada perubahan visual sehingga tidak diperlukan pengujian screenshot pada slice ini.

## Status backlog dan langkah berikutnya

| Item | Status yang dapat dibuktikan |
|---|---|
| READ-001 | Baseline lokal parsial tersedia. Inventaris seluruh journey, workload representatif, dan metadata/provider D1 belum lengkap. |
| READ-002 | Implementasi detail dan rekonsiliasi lokal tersedia. Verifikasi D1 staging/deployment masih tertunda. |
| READ-003 | Belum dimulai: pemilih customer dengan pencarian terbatas agar form tidak memuat seluruh master. |
| READ-006 | Belum dimulai: deduplikasi request browser setelah caller pemilih customer ditata. |

Prioritas berikutnya adalah READ-003, kemudian pengambilan ulang browser. Saat memverifikasi D1 staging nanti, periksa identitas akun dan sisa kuota terlebih dahulu, gunakan sampel kecil, dan catat `rows_read` sebelum/sesudah dengan workload sama. Jangan menganggap proxy lokal sebagai penerimaan akhir provider.

## Menjalankan ulang secara offline

```powershell
node node_modules/tsx/dist/cli.mjs scripts/read-efficiency-local.ts after 1000
```

Python dipakai untuk replay query SELECT pada database sintetis dengan mode read-only dan menghitung instruksi SQLite. Runner tidak membaca kredensial Cloudflare, tidak memakai Wrangler, dan tidak menghubungi D1 remote. Gunakan label berbeda untuk mempertahankan beberapa hasil. Membuat baseline baru dari source yang sudah dioptimalkan tidak menggantikan baseline sebelum perubahan.
