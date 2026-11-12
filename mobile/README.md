# NYALES Android — fondasi pengembangan

Proyek React Native / Expo ini adalah prototipe awal, terpisah dari web. Belum ada login, akses data, generator, penyimpanan offline, tracking GPS, maupun APK yang siap digunakan.

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

Workflow `Android development APK` dijalankan manual dan menghasilkan APK debug sebagai artifact selama tujuh hari. Ini hanya build internal untuk mencoba tampilan; belum mengaktifkan login, GPS, data, offline, atau penandatanganan rilis. GitHub Actions dan artifact memiliki kuota sesuai akun. Workflow ini belum dijalankan dan belum menghasilkan APK sampai kode tersedia di GitHub dan workflow berhasil.

Konfigurasi Google native disiapkan per lingkungan dengan `NYALES_GOOGLE_SERVICES_FILE` menunjuk ke berkas konfigurasi aplikasi Android yang terdaftar di Firebase. Berkas tersebut harus cocok dengan package dan SHA penandatanganan APK. Tanpa konfigurasi ini preview masih dapat berjalan, tetapi login native belum dapat digunakan. Jangan gunakan service-account private key sebagai berkas konfigurasi aplikasi.
