# Simulasi Operasi Lapangan Bekasi · DEMO

Dataset portofolio ini menggambarkan operasi lapangan sintetis selama tiga bulan lengkap, **1 Agustus–31 Oktober 2026**, di dua area terpisah: **Kota Bekasi · DEMO** dan **Kabupaten Bekasi · DEMO**. Seluruh nama, outlet, penugasan, aktivitas, order, invoice, dan target adalah rekaan untuk demo NYALES; dataset ini bukan rekaman kegiatan atau transaksi nyata.

## Angka skenario

- 1 cabang DEMO, 2 area, 4 sales rekaan (masing-masing dua per area), 1 supervisor rekaan, dan 200 outlet DEMO (50 outlet per sales).
- Kalender berisi 65 hari Senin–Jumat: 21 hari pada Agustus, 22 pada September, dan 22 pada Oktober. Tidak ada pengurangan untuk hari libur nasional. Setiap sales mendapat 20 slot visit per hari, sehingga totalnya **5.200 slot dan percobaan kunjungan**.
- Hasil kunjungan: 3.640 produktif, 780 perlu tindak lanjut, dan 780 tidak bertemu outlet. Dari 780 follow-up, 468 tugas ditandai selesai dan 312 masih terbuka; 312 lead DEMO terkait disiapkan sebagai qualified/proposal.
- **1.274 order DEMO** dibuat. Sebanyak 1.147 memiliki invoice DEMO tervalidasi untuk simulasi pelaporan dengan nilai total **Rp519.250.000**; 127 order lainnya masih berstatus submitted tanpa invoice.
- Tiga target bulanan disiapkan sebagai **draft yang belum disahkan**: Rp50 juta per sales per bulan, setara Rp100 juta per area dan Rp200 juta untuk seluruh Bekasi per bulan (Rp600 juta selama tiga bulan). Target aktif yang sudah ada tidak diubah.

## Batas kejujuran dan isolasi

- Semua entitas baru memakai label atau ID DEMO dan sumber invoice `bekasi-demo-synthetic`. Status approved/validated pada record demo hanya status simulasi, bukan hasil approval stok/kredit atau validasi dokumen aktual.
- Outlet hanya ditempatkan pada level area. Tidak ada koordinat, kontak, GPS, foto, atau bukti kunjungan yang direkayasa. Karena itu, titik outlet DEMO tidak ditampilkan sebagai lokasi pada peta.
- Seed menambahkan record baru saja. Sebelum dan sesudah import, runner membandingkan jumlah pelanggan direktori, invoice non-DEMO, dan versi target aktif; jika salah satunya berubah, run dinyatakan gagal.
- Dataset ditulis hanya melalui workflow `NYALES staging deploy` pada branch `main`, dengan input `seed_bekasi_demo` yang **default-nya false**. Runner menolak konfigurasi selain `nyales-staging` dengan `APP_ENV=staging`, menulis secara idempotent, dan memverifikasi jumlah record setelah import. Tidak ada jalur production.

Aplikasi menampilkan disclosure **DEMO** segera setelah marker pengisian awal tersimpan; selama import pesannya menyebut “sedang dimuat”, lalu setelah seluruh jumlah dan rekonsiliasi lulus berubah menjadi “Simulasi operasi Bekasi (Agu–Okt 2026)”. Import dibagi menjadi batch SQL kecil yang dapat dilanjutkan: jika satu batch gagal, retry melewati ID yang sudah ada, bukan memperbarui record lama.
