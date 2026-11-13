# NYALES Android — fondasi pengembangan

Proyek React Native / Expo ini masih berupa pratinjau, terpisah dari web. Kode dasar login, akses API, dan lokasi kunjungan tersedia tetapi belum terhubung ke antarmuka operasional. Generator, penyimpanan offline, dan tracking GPS latar belakang belum siap digunakan.

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

Workflow `Android development APK` menghasilkan APK debug sebagai artifact selama tujuh hari. Build pratinjau telah berhasil; ini hanya build internal untuk mencoba tampilan, belum mengaktifkan login, GPS, data, offline, atau penandatanganan rilis. GitHub Actions dan artifact memiliki kuota sesuai akun. Periksa hasil workflow terbaru untuk status setiap build.

Konfigurasi Google native disiapkan per lingkungan dengan `NYALES_GOOGLE_SERVICES_FILE` menunjuk ke berkas konfigurasi aplikasi Android yang terdaftar di Firebase. Berkas tersebut harus cocok dengan package dan SHA penandatanganan APK. Tanpa konfigurasi ini preview masih dapat berjalan, tetapi login native belum dapat digunakan. Jangan gunakan service-account private key sebagai berkas konfigurasi aplikasi.
