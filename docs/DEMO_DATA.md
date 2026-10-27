# Data dummy NYALES

Dataset visual lokal bertanggal acuan18Oktober2026, prefix `showcase-v1-`, organisasi `demo-org`. Hanya untuk mencoba UI. Tidak ada integrasi ERP, approval nyata, pembayaran, panggilan atau GPS perangkat nyata. Banner Mode demo diaktifkan oleh manifest audit dan hanya diekspos saat auth lokal aktif.

Berisi20pelanggan di Jakarta/Bekasi/Tangerang,100invoice Mei–Oktober2026,6sales (4lapangan/2telesales), hirarki kedua kanal,3produk/harga,4target approved simulasi untuk September/Oktober, agenda/aktivitas/task, campaign/script,7lead/order,20kontribusi forecast (sales/manager alternatif), exception/coaching/notifikasi,4versi skema dan12statement insentif. Invoice dummy memakai source_system `showcase_synthetic`. Nomor kontak adalah dummy, permission unknown/DNC dan tidak untuk dihubungi.

Nilai statement dihitung memakai engine insentif yang sama. Status approved/finalized di fixture adalah contoh sintetis yang diinsert seeding; bukan bukti workflow approval dua akun Firebase nyata telah dijalankan. Coverage dan history_complete adalah deklarasi simulasi, bukan konfirmasi sumber ERP. Posisi peta dan visit events sepenuhnya sintetis dan diberi alasan demo. Tidak ada file evidence palsu atau URL bukti yang dibuat.

Script generator: scripts/seed-showcase.ts. Script membaca export before-showcase.sql, memvalidasi SQL terhadap salinan SQLite termasuk trigger dan FK, lalu menulis test-results/showcase.sql. Sebelum penggunaan ulang, buat export D1 lokal terbaru ke test-results/before-showcase.sql. Manifest yang sudah ada atau target approved lain menolak generator; jangan menjalankan SQL lama berulang. Prefix dan manifest disimpan untuk mengidentifikasi seluruh tambahan. Dataset tanggal tetap tidak otomatis bergeser ke bulan berikutnya.

Backup sebelum penambahan: test-results/before-showcase.sql. Rekonsiliasi test-results/showcase-reconciliation.json memastikan baris domain lama dipertahankan; finance_epoch berubah karena invoice tambahan dan device_session mengikuti aktivitas login. Jangan restore seluruh database tanpa menyimpan pekerjaan baru setelah backup. Reset selektif belum dibuat; menghapus target/statement immutable perlu prosedur khusus, bukan delete massal.

Semua penambahan hanya D1 lokal. Data/API cloud dan konfigurasi Firebase tidak berubah. Build/client yang baru menampilkan banner; refresh atau login ulang diperlukan agar identity demo_data dimuat.
