# NYALES — GitHub dan staging Cloudflare

28 Oktober2026. Target terverifikasi: repository Private `BuruhArloji/nyales`. Checkout mandiri ini terpisah dari ERP-Suke. Remote Git HTTPS memakai credential account BuruhArloji; konektor GitHub yang terhubung ke akun lain tidak dipakai.

## GitHub Actions

`ci.yml`: pushmain/PR → Node24 + Python3.13 → npmci → venv solver terisolasi → regresi/typecheck/build → artifact laporan kesiapan. Rencana kunjungan masih ditunda; instalasi solver hanya untuk menjalankan tes kernel yang sudah ada di CI, bukan provisioning OSRM. Tes DPAPI hanya berlaku Windows. `blocked` pada release-gate adalah laporan blocker produksi dan bukan kegagalan build staging.

`deploy-staging.yml`: dijalankan melalui Run workflow dari main, GitHub Environment `staging`. Validasi binding/Firebase dahulu, regresi dan build, dry-run bundle, migrasi D1 staging tanpa seed, deploy Worker/assets. Tidak otomatis memigrasi database saat push awal. Cron staging dimatikan selama bootstrap; akun tidak diberi default Management, dan LOCAL_AUTH tetapfalse.

Config root `wrangler.staging.generated.json` mengarah ke hasil Vite `dist/nyales/index.js`, aset `dist/client` dan folder `migrations`. Config generated diabaikan Git dan tidak diunggah sebagai artifact. IDplaceholder/D1zero, bucket selain namespace nyales-staging, Firebase frontend/backend tidak sama dan domain invalid ditolak sebelum migrasi.

## GitHub Environment staging

Secrets:

- `CF_API_TOKEN`: token Cloudflare scope resource staging, Workers deploy/D1 migrate; tidak perlu key akun global.
- `CF_ACCOUNT_ID`: accountID32hex.
- `CF_D1_DATABASE_ID`: UUIDdatabase khusus staging, bukan produksi.

Variables:

- `CF_R2_BUCKET`: nama bucket privat `nyales-staging-files` atau namespace nyales-staging lain.
- `FIREBASE_PROJECT_ID`: Firebaseproject NYALES yang dipilih untuk staging.
- `VITE_FIREBASE_API_KEY`: konfigurasi publik webapp Firebase, sesuai restriction projekt/domain.
- `VITE_FIREBASE_AUTH_DOMAIN`: authdomain webapp yang sama.

ProjectIDFrontend diteruskan dari FIREBASE_PROJECT_ID agar sama. Workflow menyiapkan semua variable build sebelum npmrunbuild, bukan sesudahnya. Token Cloudflare tidak dimasukkan variable VITE, kode atau artifact. Jangan mengirim token/password/OTP ke chat; masukkan lewat GitHub environment secret atau login resmi provider.

## Sebelum deployment

Buat database D1 `nyales-staging` dan bucket privat khususstaging (jangan mengaktifkan akses publik). Tetapkan Firebasewebapp/project yang benar, authorized domain hoststaging dan MFAadmin yang diperlukan. Resource/account nyata tidak ditentukan dari credential proyek lain.

Setelah deploy, verifikasi health APP_ENVstaging, loginconfig Firebase benar, tanpa bearer API401 dan token demoditolak. Provision organisasi/user/role/UID melalui langkah bootstrap yang direview; backend tidak menganggap userFirebase otomatis punya akses. Domain, Firebase/MFA, realroleUAT, backup/providerRPO/RTO dan go-live tetap membutuhkan penerimaan terpisah.

Tidak ada seed dummy otomatis, sumbertransaksi produksi atau graph routing dalam deployment. Empat fixture training sintetis yang dipakai regresi disertakan di repository; hasiltes/localDB/.env/.dev.vars/privatevault/build diabaikan Git.

Referensi konfigurasi relatif path/binding: https://developers.cloudflare.com/workers/wrangler/configuration/ . Deployment Firebase/Cloudflare belum boleh dilaporkan berhasil sebelum workflow dan smoke cloud nyata selesai.


## Pemeriksaan setelah deploy

Run workflow meminta origin Workers staging yang tepat, misalnya `https://nyales-staging.<subdomain-akun>.workers.dev`. Script `staging-smoke.mjs` hanya menerima origin HTTPS tersebut, menolak redirect dan membatasi ukuran/responsetime. Pemeriksaan baca-saja meliputi HTML/assetsentry, healthenvironmentstaging, authmodeFirebase, API tanpa login401 dan tokenlocaldemo401. Status sukses belum membuktikan loginUID/MFA/role, koneksi D1/R2 beserta isinya atau production acceptance.

Perintah: `npm run staging:smoke -- https://nyales-staging.<subdomain-akun>.workers.dev test-results/staging-smoke-new.json`. File tujuan wajib baru. Workflow menjalankan pemeriksaan setelah deploy; kegagalan smoke membuat runfailed tanpa menghapus data atau melakukan rollback otomatis.

28 Oktober 2026: CI remote commit `172ab26` sukses (run 40667351473). Dry-run lokal bundle 22 aset sebelumnya memakai binding fixture. Pemeriksaan akun lama dan error R2 sebelumnya tidak berlaku untuk akun NYALES yang dipilih di bawah ini. Worker staging belum dideploy.

## Koreksi akun Cloudflare dari pengguna

Akun NYALES yang dipilih adalah **didikpriyoutomo05@gmail.com**. SesiCloudflareindonesiasuke@gmail.com adalah akun lain dan tidak dipakai untuk provisioning NYALES. DaftarD1ERP dan errorR2 pada pemeriksaan sebelumnya hanya berlaku akunlama; belum menjelaskan kondisi akunterpilih. Login baru memakai XDG_CONFIG_HOME task-local `.nyales-agent/cloudflare-auth` (diabaikanGit) agar credential konfigERP global tidak diganti. `whoami` harus cocok dengan email terpilih sebelum memakai accountID atau membuat resource. Tidak menyalin credential ERP ke GitHub.


## Resource staging terverifikasi — 28 Oktober 2026

Login OAuth terisolasi berhasil dan `whoami` cocok dengan didikpriyoutomo05@gmail.com, account ID `54386b392928d9dcd226ad9e7fff5d79`.

- D1 `nyales-staging`: `6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe`, APAC. Seluruh 45 migrasi diterapkan lewat konfigurasi resource-only pada `.nyales-agent/staging/wrangler-resources.json`, tanpa placeholder Firebase dan tanpa deploy Worker.
- Verifikasi remote: 114 tabel aplikasi, `PRAGMA quick_check=ok`, `foreign_key_check` kosong. Organization, app_user, customer_outlet, invoice masing-masing 0 baris; tidak menjalankan seed dummy.
- R2 `nyales-staging-files` dibuat; akses publik r2.dev terverifikasi disabled.
- Resource Azara yang sudah ada tidak digunakan atau dimodifikasi. Credential OAuth tidak disalin ke GitHub.

Bukti lokal provider dan log migrasi tersimpan di `.nyales-agent/staging/` yang diabaikan Git. `docs/STAGING_STATUS.json` menyimpan ringkasan tanpa credential. Ini membuktikan provisioning/schema, belum membuktikan koneksi Worker ke binding atau login end-to-end.

## Bootstrap Firebase yang masih diperlukan

Pengguna awalnya belum memiliki proyek Firebase NYALES; kemudian memberikan Project ID `nyales-staging`. Project ID tersebut sudah disimpan sebagai variable GitHub Environment staging melalui API dan dibaca ulang, tetapi konfigurasi Firebase provider/web app belum diverifikasi. Pembuatan proyek baru tidak perlu diulangi. Panduan pembuatan proyek sebagai referensi: [Firebase Console](https://console.firebase.google.com/): nama `NYALES Staging`, paket Spark, Analytics opsional boleh dimatikan. Catat Project ID final yang dihasilkan; jangan mengasumsikan ID sama dengan nama proyek. Panduan resmi: [setup web](https://firebase.google.com/docs/web/setup), [paket biaya](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).

Di [pengaturan proyek nyales-staging](https://console.firebase.google.com/project/nyales-staging/settings/general), daftarkan web app `NYALES Staging Web`, ambil public web config untuk environment variables workflow, aktifkan provider Email/Password dan Google yang dipakai UI, lalu tambahkan host staging yang benar ke Authentication authorized domains. Tidak perlu Firebase Hosting/Firestore/Storage untuk stack saat ini; data aplikasi tetap pada D1/R2. API token Cloudflare dan private service-account key tidak boleh dimasukkan ke konfigurasi frontend.

Akses otomatis browser dinonaktifkan di pengaturan Work saat langkah ini dijalankan, sehingga pembuatan proyek belum dapat diverifikasi otomatis. Project ID sudah diterima. Pengguna diminta mendaftarkan web app dan memberikan public firebaseConfig, tanpa private key, token akses, atau password.

Akun Management/NSM tetap memerlukan klaim MFA Firebase. UI login saat ini belum menangani enrollment/challenge MFA; public web config saja belum menyelesaikan login admin. TOTP memerlukan Firebase Authentication with Identity Platform; verifikasi konfigurasi/ketersediaan paket dan implementasikan flow sebelum rollout akun privileged. Tidak melemahkan `MFA_REQUIRED` untuk meloloskan staging. Referensi: [TOTP MFA web](https://firebase.google.com/docs/auth/web/totp-mfa), [batas Authentication](https://firebase.google.com/docs/auth/limits).

GitHub Environment `staging` ID `25571255770` sudah tersedia. Variable `FIREBASE_PROJECT_ID=nyales-staging` dan `CF_R2_BUCKET=nyales-staging-files` diverifikasi melalui read-back API. Secret deployment dan variable Firebase web app lainnya masih belum lengkap; workflow deploy belum dijalankan.


## Firebase web config diterima — 28 Oktober 2026

Public web config dari pengguna sudah diterima untuk project `nyales-staging`, app ID `1:82528400427:web:40a5b9e672270687eca66e`. `VITE_FIREBASE_API_KEY` dan `VITE_FIREBASE_AUTH_DOMAIN=nyales-staging.firebaseapp.com` sudah disimpan ke GitHub Environment `staging` dan diverifikasi read-back. Nilai API key tidak dicetak dalam status atau dicommit ke source. Worker tetap menggunakan Firebase SDK yang sudah terpasang; tidak menambahkan Firebase Hosting/Firestore/Storage.

Pemeriksaan baca-saja public Identity Toolkit config (dengan app ID) merespons HTTP 400 `CONFIGURATION_NOT_FOUND`. Ini belum membuktikan provider login siap; pengguna diminta membuka Authentication > Get started, lalu mengaktifkan Email/Password dan Google. Tidak melakukan signup atau membuat akun pengguna melalui pemeriksaan ini.

Subdomain Workers akun terpilih dibaca lewat API: `azaracourse`. Origin yang disiapkan untuk workflow adalah `https://nyales-staging.azaracourse.workers.dev`, belum URL deployment yang sudah hidup. Nama subdomain adalah pengaturan tingkat akun yang sudah ada; tidak diubah demi NYALES. Tambahkan host `nyales-staging.azaracourse.workers.dev` pada Firebase authorized domains sebelum UAT login.


## Validasi konfigurasi aktual — 28 Oktober 2026

Generator staging config, 5 tes staging, typecheck/build dengan public Firebase config NYALES dan `wrangler deploy --dry-run` lulus. Simulasi bundle membaca 22 aset dan melaporkan binding D1 `nyales-staging`, R2 `nyales-staging-files`, `APP_ENV=staging`, `LOCAL_AUTH=false`, `FIREBASE_PROJECT_ID=nyales-staging`. Tidak mempublikasikan Worker dan tidak membuktikan login nyata.

GitHub secret `CF_ACCOUNT_ID` dan `CF_D1_DATABASE_ID` sudah diisi melalui public-key/sealed-box encryption resmi API GitHub. Read-back hanya memverifikasi metadata nama secret (GitHub tidak mengembalikan plaintext). OAuth Wrangler lokal tidak disalin ke GitHub. Secret `CF_API_TOKEN` masih belum tersedia.

Untuk CI/CD, pemilik akun Cloudflare NYALES perlu membuat token deployment khusus lewat [API Tokens](https://dash.cloudflare.com/profile/api-tokens), lalu menyimpannya langsung pada GitHub Environment `staging` sebagai `CF_API_TOKEN` melalui [pengaturan environments](https://github.com/BuruhArloji/nyales/settings/environments). Gunakan scope akun `54386b392928d9dcd226ad9e7fff5d79` dengan Account Settings Read, Workers Scripts Edit, D1 Edit, dan Workers R2 Storage Edit yang diperlukan workflow. Batasi resource sesuai granularitas yang tersedia; jangan menganggap permission account-wide otomatis terbatas hanya ke resource NYALES. Jangan memakai global API key atau mengirim token ke chat. Referensi: [GitHub Actions Cloudflare](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
