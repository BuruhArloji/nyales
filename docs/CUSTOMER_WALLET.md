# Customer hierarchy dan Wallet Size

Migration `0053_customer_wallet_profile.sql` menambahkan tabel estimate terpisah. Tidak mengubah kolom imported customer, koordinat, invoice, assignment atau target. Satu profil per organisasi/customer: hierarchy1 `retail`, `wholesale`, `agen_grosir`, nilai bulanan dalam rupiah penuh, sumber dan metadata pembaruan. Perubahan profil menaikkan geo epoch agar cache tidak membawa profil lama.

Preset dummy bulanan: Retail Rp5 juta, Wholesale Rp25 juta, Agen/Grosir Rp100 juta. Jika `outlet_type` mempunyai arti yang cocok, kategorinya digunakan. Selain itu kategori sintetis ditentukan dari hash ID (80% retail, 15% wholesale, 5% agen/grosir), sehingga hasil reproducible; ini tidak mengklaim klasifikasi toko asli. Sumber tetap `synthetic_category_preset`. Preset bisa dikonfigurasi melalui fitur pengaturan kemudian; belum ada editor kategori/preset pada rilis ini.

`scripts/customer-wallet-data.ts` membuat SQL insert profil yang belum ada. Tidak menimpa estimate manual/imported atau profil dummy terdahulu. Runner `scripts/apply-customer-wallet.ts --remote` memerlukan `WALLET_APPLY=false` untuk dry-run atau `true` untuk apply, serta config/account/database staging yang tepat. Migration 0053 harus diterapkan terpisah terlebih dahulu. Target dibatasi customer aktif yang mempunyai invoice sumber sintetis (`%demo%`, `training-staging-v1-%`, `showcase_synthetic`), bukan seluruh imported directory. Query memakai keyset 250 customer per batch. Runner tidak menjalankan migrasi ataupun mengubah data bisnis dan master sumber; receipt agregat tersimpan di `test-results/customer-wallet-receipt.json`.

## API popup on-demand

`GET /api/customers/:id/wallet?period=2026-11&channel=field`

- `period` opsional, default bulan berjalan dari timezone organisasi; channel opsional, default kanal akun; management/NSM tanpa filter kanal memakai penjualan gabungan kedua kanal. Peak dihitung dari total gabungan tiap bulan, bukan menjumlahkan peak masing-masing kanal.
- Customer alias diselesaikan ke ID canonical, kemudian diperiksa terhadap scope. Akun rep tidak dapat meminta kanal lain. Customer di luar scope menghasilkan 404.
- Hasil `data`: `customer_id`, `channel`, `hierarchy1`, `wallet_size_minor`, `wallet_size_source`, `comparison_period`, `current_month_actual_minor`, `highest_month_actual_minor`, `highest_month_period`, `highest_month_history_start`, `highest_month_history_end`.
- Actual adalah net invoice validated/current di bulan pilihan. Peak adalah jumlah net **bulan kalender tertinggi dari 12 bulan selesai sebelum bulan pilihan**, dengan filter historis scope, rep/channel dan currency yang sama. Current month tidak dimasukkan ke peak. Jika peak seri, bulan terbaru dipilih.
- Wallet/history tanpa data memakai null; actual tanpa invoice memakai 0. Ketiadaan history bukan angka transaksi nol yang diketahui. Data di endpoint ini adalah observasi invoice yang tersedia, bukan klaim kelengkapan histori ERP.
- Profil wallet berlaku pada customer, sementara pembelian dibatasi kanal/scope pengguna. Wallet potential keseluruhan customer tidak otomatis dijumlah atau dibagi kanal.

Endpoint hanya dimuat saat popup satu customer dibuka. Peta utama tidak menambahkan query wallet atau scan histori 12 bulan untuk puluhan ribu pin. `readMapMetrics(..., includeWallet=false)` mempertahankan jalur peta ringan; endpoint menggunakan `true` untuk satu ID. Header respons `private, no-store` mencegah cache bersama melewatkan scope.

## Satu bar berlapis

Skala bersama adalah `max(wallet, peak, actual, 1)`. Abu-abu wallet sebagai background, peak gelap menimpa dari titik awal yang sama, actual hijau menimpa di atasnya. Peak yang lebih besar daripada wallet boleh menutup lapisan abu-abu sepenuhnya; nilai wallet tidak dinaikkan agar terlihat lebih besar. Helper `walletComparison()` memberikan persentase 0–100; label nilai tetap memakai angka rupiah asli, termasuk actual net negatif jika ada. Nilai negatif hanya membuat lebar lapisan 0, bukan mengubah nilai bisnis.

Tes lokal memeriksa FK, insert idempotent dan master customer tetap identik, profil manual dipertahankan, scope antar organisasi/kanal, histori di luar 12 bulan dan invoice superseded/cancelled dikecualikan, current month tidak menjadi peak, tie bulan terbaru, serta null vs zero dan batas persentase. Pengguna melakukan pengujian UI; tidak ada mutasi staging atau browser test oleh subagent.
