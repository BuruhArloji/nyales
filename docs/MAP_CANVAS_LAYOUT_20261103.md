# Peta wilayah: kontrol di dalam kanvas

Permintaan ini memperbaiki peta nasional DEMO yang sudah tersedia di staging, bukan mengganti data hasil impor. Source staging terbaru disinkronkan melalui fast-forward ke `0fa4099` sebelum perubahan.

- Kanvas mengisi seluruh kartu; kolom informasi di samping dihapus.
- Judul dan pilihan Area/Kepadatan menjadi kontrol mengambang di kiri atas.
- Legenda dan detail polygon berada pada panel lipat di dalam peta. Ringkasan empat area juga dapat dilipat.
- Klik polygon membuka kembali panel detail. Atribut, warna layer, kuantil, sumber, disclaimer DEMO, dan CSV exception tetap dipertahankan.
- Ringkasan jumlah, catatan sumber, dan unduh exception berada di panel Informasi & sumber di bawah peta.
- Fullscreen memakai seluruh workspace peta, sehingga kontrol dan legenda tetap ikut tampil. Panel tidak menutupi zoom/fullscreen.
- Mobile memulai panel legenda dalam keadaan tertutup; panel yang terbuka dibatasi tingginya dan dapat di-scroll. Material memiliki fallback solid untuk increased contrast/reduced transparency.

Tidak ada perubahan schema, data customer, invoice, assignment, endpoint, file PMTiles atau kebijakan sumber. Tidak menambah pembacaan D1. Deployment tetap memakai workflow resmi dengan input seed/mapping opsional dibiarkan false.

Validasi: TypeScript, 371 test aplikasi (363 lulus, 8 dilewati), dan build. Dua browser check menguji desktop/mobile, containment kontrol, pergantian layer, disclosure sumber/CSV, serta masuk/keluar fullscreen. Pengujian UI memakai `npm run ui:prototype` dengan D1 sintetis lokal dan read-only range dari aset peta R2 yang sudah dipublikasikan, tanpa panggilan business API staging. Artefak berada di `test-results/map-overlay/`. Browser layout checks tidak merupakan validasi ulang 83.486 geometri.

Saat baseline Windows, satu test workflow lama gagal karena mencari newline LF pada checkout CRLF. Test sekarang menormalisasi CRLF sebelum pemeriksaan string; isi dan aturan keamanan workflow tidak berubah.

Untuk mengulang browser check, sediakan file penanda lokal `.nyales-agent/map-overlay-fixture/territories-demo.pmtiles`, lalu jalankan `node node_modules/@playwright/test/cli.js test --config playwright.map-overlay.config.cjs`. Config menyalakan prototipe dengan URL demo lokal; test mem-proxy hanya nama aset demo yang dibutuhkan ke endpoint statis staging. Bukti deployment dan inspeksi staging disimpan terpisah dari hasil lokal.
