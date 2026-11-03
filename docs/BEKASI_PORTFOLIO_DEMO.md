# Simulasi Operasi Lapangan Bekasi · DEMO

Dataset portofolio ini menggambarkan operasi lapangan sintetis selama tiga bulan lengkap, **1 Agustus–31 Oktober 2026**, di dua area terpisah: **Kota Bekasi · DEMO** dan **Kabupaten Bekasi · DEMO**. Seluruh nama, outlet DEMO, penugasan, aktivitas, order, invoice, dan target adalah rekaan untuk demo NYALES; dataset ini bukan rekaman kegiatan atau transaksi nyata.

## Angka skenario

- 1 cabang DEMO, 2 area, 4 sales rekaan (masing-masing dua per area), 1 supervisor rekaan, dan 200 outlet DEMO (50 outlet per sales).
- Kalender berisi 65 hari Senin–Jumat: 21 hari pada Agustus, 22 pada September, dan 22 pada Oktober. Tidak ada pengurangan untuk hari libur nasional. Setiap sales mendapat 20 slot visit per hari, sehingga totalnya **5.200 slot dan percobaan kunjungan**.
- Hasil kunjungan: 3.640 produktif, 780 perlu tindak lanjut, dan 780 tidak bertemu outlet. Dari 780 follow-up, 468 tugas ditandai selesai dan 312 masih terbuka; 312 lead DEMO terkait disiapkan sebagai qualified/proposal.
- **1.274 order DEMO** dibuat. Sebanyak 1.147 memiliki invoice DEMO tervalidasi untuk simulasi pelaporan dengan nilai total **Rp519.250.000**; 127 order lainnya masih berstatus submitted tanpa invoice.
- Tiga target bulanan disiapkan sebagai **draft yang belum disahkan**: Rp50 juta per sales per bulan, setara Rp100 juta per area dan Rp200 juta untuk seluruh Bekasi per bulan (Rp600 juta selama tiga bulan). Target aktif yang sudah ada tidak diubah.

## Batas kejujuran dan isolasi

- Semua entitas skenario memakai label atau ID DEMO dan sumber invoice `bekasi-demo-synthetic`. Status approved/validated pada record demo hanya status simulasi, bukan hasil approval stok/kredit atau validasi dokumen aktual.
- Outlet DEMO tetap tanpa koordinat fisik. Tidak ada koordinat, kontak, GPS, foto, atau bukti kunjungan yang direkayasa. Jika operasi DEMO ditampilkan pada peta, ia menempel sebagai overlay di titik customer direktori yang sudah ada, bukan pin DEMO baru atau lokasi fisik outlet rekaan.
- Seed awal hanya menambah record DEMO. Overlay berikutnya hanya menambah relasi audit; seluruh record customer—termasuk 12.100 customer direktori dan 200 outlet DEMO—tetap identik. Transaksi, penugasan, versi target, serta riwayat asli tidak digabung atau ditulis ulang.
- Workflow `NYALES staging deploy` pada branch `main` memiliki input terpisah `seed_bekasi_demo` dan `map_bekasi_demo_points`, keduanya **default false**. Runner overlay menolak akun/database di luar staging yang telah ditentukan. Tidak ada jalur production.

Aplikasi menampilkan disclosure **DEMO** yang jelas tetapi tidak mengganggu. Selama seed awal pesannya menyebut “sedang dimuat”; setelah jumlah dan rekonsiliasi lulus menjadi “Simulasi operasi Bekasi (Agu–Okt 2026)”. Record operasi tidak pernah diklaim sebagai kegiatan nyata.

## Operasi DEMO tertanam pada titik customer existing

Atas permintaan pengguna, `scripts/map-bekasi-demo-points.ts --apply --remote` memilih **ID titik existing**, bukan membuat atau menyalin koordinat: 100 titik direktori Kota Bekasi dan 100 Kabupaten Bekasi dari dataset `maps-warung-20261028`. Pemilihan deterministik memakai sebaran longitude/latitude per area. Relasi ini adalah penempatan skenario, bukan pencocokan identitas outlet DEMO dengan usaha nyata.

Relasi satu-ke-satu disimpan sebagai sidecar `master_audit` bertipe `demo_operation_point_link`; payload menyimpan ID/versi/koordinat sumber dan before-image customer DEMO. Satu receipt keberhasilan `operation_point_overlay_applied` baru ditulis setelah tepat 200 relasi unik dan seluruh rekonsiliasi cocok. Runner tidak memiliki `UPDATE customer_outlet`: tidak ada salinan koordinat, perubahan alamat/nama/area/assignment, pin baru, atau perubahan riwayat sumber. Pengulangan melengkapi receipt yang belum ada dan menolak pilihan sumber atau baseline yang berubah.

API staging melakukan join baca saja antara relasi tersebut, record DEMO, dan customer sumber yang sama-sama berada dalam scope. Identitas titik peta selalu ID customer sumber; koordinat, nama, alamat, foto dan detail sumber tetap milik titik aslinya. Popup menambahkan kotak **operasi DEMO** yang terpisah: sales skenario, periode, kunjungan, order, invoice dan nilai sintetis, beserta tautan ke record operasi DEMO. Angka tersebut bukan transaksi atau kunjungan milik tempat sumber. Koordinat direktori sendiri belum diverifikasi lapangan.

Overlay dapat ditampilkan/disembunyikan tanpa menghilangkan titik existing. Filter area/sales dapat mencari keterkaitan skenario pada titik tersebut tanpa memindahkan customer sumber atau menambah penugasan pada direktori. Jumlah fitur peta tidak bertambah karena overlay. Pemetaan ini tidak mengesahkan polygon administrasi, GPS, rute, atau bukti kunjungan.

Rekonsiliasi membandingkan SHA-256 **seluruh isi `customer_outlet`** sebelum/sesudah, signature bisnis, 200 relasi dengan sumber unik dan 100 per area. API tidak menampilkan relasi yang belum selesai, di luar scope, tidak valid, atau sudah stale; tidak pernah menggantinya dengan pin salinan.
