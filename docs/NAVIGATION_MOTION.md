# Kontinuitas animasi navigasi — 28 Oktober 2026

Perubahan URL sebelumnya memasang `key={route}` pada seluruh `Shell`. React membuat ulang sidebar dan navigasi, sehingga transisi horizontal tombol aktif kehilangan posisi awalnya. Key sekarang hanya dipasang pada fragment konten: kerangka navigasi tetap hidup, sedangkan halaman dan filter URL tetap mendapat state/data baru.

Bentuk, warna, ukuran dan timing animasi yang sudah disetujui tetap digunakan. Tombol sebelumnya menutup horizontal bersamaan dengan tombol tujuan membuka; subnavigasi pada kelompok yang sama juga mempertahankan node saat berpindah halaman.

Uji menggunakan entry aplikasi sebenarnya dengan autentikasi fixture dan panel data tidak tersedia; bukan sesi Firebase nyata. Sebelum perbaikan, pemeriksaan identitas node gagal. Sesudah perbaikan, tiga browser test lulus: lebar intermediate saat kedua tombol bertransisi, kontinuitas node dan browser Back, klik cepat pada mobile/reduced-motion, serta pemuatan ulang panel ketika filter URL pada halaman sama berubah. Typecheck/build lulus.

Jalankan: `node node_modules/@playwright/test/cli.js test --config playwright.navigation.config.cjs`.
