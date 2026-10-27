# NYALES — repository GitHub dan staging Cloudflare

28 Oktober 2026. Repository baru disiapkan dengan nama lokal `nyales`; remote GitHub belum dibuat karena terminal ini belum memiliki operasi GitHub authenticated. Workflow tidak deploy dari laptop dan tidak memakai `LOCAL_AUTH`.

## Repository

Target yang diminta: akun GitHub `buruharloji`, repository baru `nyales` (disarankan private). Setelah repository dibuat pada GitHub, tambahkan sebagai remote dan push branch `main`:

```text
git remote add origin https://github.com/buruharloji/nyales.git
git push -u origin main
```

Jangan memasukkan `.dev.vars`, `.env.local`, credential, `.wrangler`, `.nyales-agent`, database lokal, hasil test, atau data pilot ke repository.

## Actions secrets/variables

Environment GitHub `staging` harus memiliki:

- Secret `CF_API_TOKEN`: token Cloudflare terbatas untuk Workers Scripts, D1 edit, R2 read/write pada resource staging.
- Secret `CF_ACCOUNT_ID`: account ID 32 hex.
- Secret `CF_D1_DATABASE_ID`: UUID database D1 staging.
- Secret `CF_R2_BUCKET`: nama bucket R2 staging, bukan bucket produksi.
- Variable `FIREBASE_PROJECT_ID`: project Firebase staging. API key frontend staging masih perlu dikelola lewat environment build sesuai kebijakan Firebase; jangan commit `.env`.

Buat D1 dan R2 staging di Cloudflare terlebih dahulu. Workflow menjalankan CI, membuat konfigurasi Wrangler sementara dari secrets, menerapkan seluruh migration pada D1 staging, lalu deploy Worker/assets. Config sementara tidak disimpan sebagai artifact.

## Guard staging

- `APP_ENV=staging` dan `LOCAL_AUTH=false`.
- Workflow hanya mendorong branch `main` ke environment `staging`.
- Tidak ada seed demo otomatis dan tidak ada data produksi.
- CI menjalankan full tests, typecheck, build dan release-gate checker sebelum deploy.
- Cloudflare deployment belum dijalankan dalam sesi ini; remote repository, Cloudflare account, D1/R2 staging dan Firebase staging masih memerlukan konfigurasi.
