# NYALES Android — fondasi pengembangan

Proyek React Native / Expo ini masih dalam pengembangan, terpisah dari web. Build Android yang dikonfigurasi Firebase menyediakan login Google, daftar dan rincian pelanggan, ringkasan, agenda, aktivitas, tugas, invoice, target periode berjalan dan statement insentif yang membaca API staging. Daftar pelanggan dan daftar operasional dimuat bertahap. Endpoint target dan insentif staging saat ini mengembalikan seluruh hasil sesuai cakupan; pembagian 50 baris pada layar belum mengurangi data yang dikirim server. Pagination server untuk insentif dan indeksnya disiapkan secara lokal, tetapi belum diterapkan di staging atau dihubungkan pada klien. Integrasi ini masih perlu diuji pada perangkat. Halaman pratinjau tetap memakai data contoh; alur lokasi kunjungan, generator, penyimpanan offline, dan tracking GPS latar belakang belum terhubung ke antarmuka operasional.

```powershell
cd mobile
npm ci
npx expo start
```

Untuk build Android native diperlukan Android SDK dan JDK yang kompatibel. Sebelum memakai Firebase/Google Sign-In, tetapkan package ID dan SHA signing yang sesuai untuk setiap lingkungan. Package ID saat ini hanya untuk pengembangan. Jangan menambahkan kredensial, API key rahasia, atau mengarahkan uji tulis ke staging. Android 10+ adalah asumsi perencanaan; konfigurasi minimum SDK dan kompatibilitas perangkat masih perlu dibuktikan.

Lihat [rencana Android](../docs/specifications/Rencana_Android_React_Native_v0_1.md) dan [backlog](../docs/specifications/Backlog_Android_React_Native_v0_1.md). Fitur native di tahap berikutnya membutuhkan development build; Expo Go tidak membuktikan dukungan tracking latar belakang.

## Preview di browser

Jalankan `npm run web -- --host localhost --port 5198`, lalu buka http://localhost:5198. Preview ini memakai komponen React Native yang sama melalui React Native Web; perilaku Android seperti GPS, notifikasi, background service, dan izin tetap harus diperiksa pada HP.

## Build APK pengembangan lewat GitHub Actions

Workflow `Android development APK` menghasilkan APK debug sebagai artifact selama tujuh hari. Build ini untuk pengembangan dan bukan penandatanganan rilis. GitHub Actions dan artifact memiliki kuota sesuai akun. Periksa hasil workflow terbaru untuk status serta fitur yang termasuk pada setiap build.

Konfigurasi Google native disiapkan per lingkungan dengan `NYALES_GOOGLE_SERVICES_FILE` menunjuk ke berkas konfigurasi aplikasi Android yang terdaftar di Firebase. Berkas tersebut harus cocok dengan package dan SHA penandatanganan APK. Tanpa konfigurasi ini preview masih dapat berjalan, tetapi login native belum dapat digunakan. Jangan gunakan service-account private key sebagai berkas konfigurasi aplikasi.
