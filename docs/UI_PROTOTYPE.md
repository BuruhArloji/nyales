# Studio UI lokal NYALES

Buka **http://127.0.0.1:5190/** dan pilih **Masuk sebagai Management**. Studio memakai komponen aplikasi dan API domain yang sebenarnya, dengan dataset sintetis dan penyimpanan lokal terpisah. Tidak ada deployment atau akses D1/R2 remote dalam launcher ini.

Jalankan ulang dari root repository:

```powershell
npm run ui:prototype
```

Frontend Vite berada di port 5190; API emulator di port 5191. Keduanya hanya mendengarkan `127.0.0.1`. Perubahan pada `src/client` langsung terlihat melalui hot reload. Toolbar bawah menandai prototipe dan menyediakan perbandingan kepadatan Nyaman/Ringkas; perubahan kepadatan berlaku untuk tampilan prototipe saja. Konfigurasi build staging tetap memakai `vite.config.ts`, tanpa injeksi toolbar.

Dataset: 10 sales, 20 pelanggan, 80 invoice, 4 retur, dan dua target yang disahkan sebagai bagian skenario latihan. Periode contoh adalah Oktober 2026. Reserve pada target, status kelengkapan sumber, serta GIS yang belum mempunyai rilis administrasi aktif tetap mengikuti aturan aplikasi: state review/kosong bukan dipaksa menjadi angka. Data ini terpisah dari direktori warung hasil Google Drive.

Sumber seed dan status inisialisasi berada di `.nyales-agent/ui-prototype/`; D1/R2 emulator berada di `.wrangler/ui-prototype-v1`. Keduanya diabaikan Git. Restart mempertahankan perubahan dummy yang dicoba melalui UI dan tidak mengimpor seed dua kali. Jangan menyalakan penulis lain pada persistence yang sama, menghapus lock milik proses berjalan, atau menyalin data staging ke profil ini. Hentikan launcher dengan Ctrl+C sebelum mengelola state lokal.

Peta menggunakan basemap OpenFreeMap sehingga gambar petanya membutuhkan internet. Pin dan data bisnis berasal dari database lokal. Tidak ada kunci Street View pada konfigurasi prototipe.

Verifikasi awal: login lokal dan binding sesi; overview; pelanggan; monitoring; target; telesales; kontrol kepadatan; layar 390 px tanpa overflow horizontal; 20 pin peta dan popup. Tidak ada error JavaScript atau kegagalan API bisnis dalam alur tersebut. API analisis GIS mengembalikan 409 yang ditangani UI karena rilis batas administrasi belum disiapkan pada fixture ini. Hasil pemeriksaan dan screenshot disimpan lokal pada `.nyales-agent/ui-prototype/VERIFIED.json` dan `test-results/prototype-*.png`.

Dropdown tunggal memakai `src/client/select.css` melalui customizable select pada browser yang mendukung `appearance: base-select`. Popup mengikuti gaya rounded/glass/teal, tetap native untuk event, validasi form dan keyboard. Browser yang belum mendukung mempertahankan select bawaan. Select multiple tetap listbox dengan warna senada. Perubahan sudah diperiksa pada grafik, form modal (Escape menutup dropdown terlebih dahulu), dan viewport 390 px.

Perapian copy: breadcrumb Workspace/Scope dan footer D1 dihapus. Pengantar halaman yang hanya mengulang fungsi menu dikurangi di seluruh workspace; periode, label simulasi, status sumber tidak lengkap, dasar retur, serta nilai insentif bruto tetap terlihat seperlunya. Definisi coverage tersedia pada disclosure Cara hitung coverage. Pemeriksaan browser mencakup 12 halaman dan viewport 390 px tanpa error JavaScript atau overflow horizontal. Bukti lokal: COPY_REVIEW.json dan prototype-clean-*.png.


Hirarki organisasi: tab Hirarki menampilkan bagan interaktif atas ke bawah dengan React Flow dan layout Dagre, dimuat secara lazy hanya saat dipakai. Tim supervisor terlipat pada tampilan awal; tombol anggota membuka tim, sedangkan Lihat seluruh struktur / Ringkas tim mengatur tingkat detail. Pencarian memusatkan kartu anggota dan membuka panel detail. Filter kanal, area, serta tanggal menggunakan relasi pelaporan efektif yang sudah tersimpan, tanpa membuat hubungan dari urutan jabatan. Tanggal akhir relasi bersifat eksklusif. Jabatan dan status pada kartu/detail tetap mengikuti profil saat ini; filter tanggal bukan rekonstruksi histori jabatan atau scope akses.

Anggota tanpa relasi ditampilkan terpisah. Filter area hanya menggunakan endpoint relasi pada area tersebut; area anggota yang belum terhubung tidak ditebak. Histori tersedia sebagai tampilan sekunder. Pengaturan user, atasan dan transfer membuka form yang ada; pan/zoom atau klik bagan tidak mengubah database. Posisi bagan menyesuaikan perubahan ukuran canvas. Tidak ada perubahan skema database/API atau deployment dari pekerjaan UI ini.

Verifikasi hirarki: 6 uji model (tanggal transfer, filter, collapse, relasi ganda, profil hilang dan siklus), 4 uji browser navigasi/hirarki, serta production build lulus. Browser dengan API lokal juga memeriksa pencarian Novely, panel detail, pembukaan form tanpa menyimpan, kanal, histori dan viewport 1440/1024/768/390 px. Bukti screenshot: test-results/hierarchy-desktop.png, hierarchy-detail.png dan hierarchy-mobile.png.

Pilihan Bagan/Histori kini berupa dropdown di toolbar dalam canvas yang sama, bukan tab di luar canvas. Halaman selalu dimulai pada Bagan saat dibuka ulang; pilihan tampilan tidak disimpan. Uji browser memeriksa dropdown di dalam canvas, pergantian histori, dan reset ke Bagan setelah reload.
