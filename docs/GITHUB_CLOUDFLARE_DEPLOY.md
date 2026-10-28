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
