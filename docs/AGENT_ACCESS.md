# Memberi akses NYALES ke agent lain

Dokumen ini menjelaskan apa yang harus diserahkan, apa yang **tidak boleh**, dan
batas operasional yang harus dipatuhi agent penerima.

## 1. Pilih tingkat akses

Jangan berikan akses penuh kalau agent hanya perlu membaca atau mengusulkan perubahan.

| Tingkat | Yang bisa dilakukan | Yang diberikan |
|---|---|---|
| **A. Review** | baca kode, jalankan test lokal, usulkan patch | repo read-only + kode lokal |
| **B. Build** | semua di atas + jalankan app lokal, verifikasi UI | + Node/Python, browser Playwright |
| **C. Deploy** | semua di atas + deploy staging | + token Cloudflare staging |

Mulai dari **A**. Naik ke **B** hanya kalau agent perlu membuktikan perubahannya.
Naik ke **C** hanya kalau agent dipercaya menjalankan deploy.

## 2. Akses repositori

Repo: `github.com/BuruhArloji/nyales` (private)

- **Read-only:** invite sebagai collaborator dengan role **Read**, atau berikan fine-grained PAT
  dengan scope `Contents: Read` untuk repo ini saja.
- **Write (usulan patch):** collaborator role **Write**, atau PAT `Contents: Read and write`.
- Jangan gunakan token klasik dengan scope `repo` penuh — terlalu luas untuk satu repo.

Yang ikut terbaca dari repo: `docs/specifications/` (PRD, ERD, kontrak API, backlog),
`docs/PERFORMANCE_QUOTA_PLAN_20261031.md`, `docs/AGENT_ACCESS.md`, dan seluruh `src/`.

## 3. Toolchain lokal

| Alat | Versi | Dipakai untuk |
|---|---|---|
| Node.js | **24.x** | build, test, wrangler |
| npm | 11.x | `npm ci` |
| Python | **3.13** | `scripts/visit-solver-setup.py` (wajib di CI) |
| Git | terbaru | clone/push |
| Chrome | terbaru | Playwright untuk verifikasi UI lokal |

Langkah pertama agent:

```bash
git clone https://github.com/BuruhArloji/nyales.git
cd nyales
npm ci
npm run check      # tsc --noEmit
npm test           # 350+ test
npm run build
```

Semua harus lolos sebelum agent menyentuh kode.

## 4. Variabel lingkungan

### Lokal (`.dev.vars` / `.env.local`)

```
APP_ENV=local
LOCAL_AUTH=true
FIREBASE_PROJECT_ID=nyales-staging
```

Untuk prototype UI lokal, tidak perlu kredensial apa pun — `npm run ui:prototype`
memakai D1 + seed sintetis di `.wrangler/ui-prototype-v1`.

### Deploy staging (referensi: `.github/workflows/deploy-staging.yml`)

Secrets:

| Nama | Isi |
|---|---|
| `CF_API_TOKEN` | token Cloudflare **scoped**, bukan Global API Key |
| `CF_ACCOUNT_ID` | 32 hex, akun `didikpriyoutomo05@gmail.com` (bukan akun ERP) |
| `CF_D1_DATABASE_ID` | `6fc9dcea-c6a9-446c-a2f4-44ec3a12bdfe` |

Variables:

| Nama | Isi |
|---|---|
| `CF_R2_BUCKET` | `nyales-staging-files` |
| `FIREBASE_PROJECT_ID` | `nyales-staging` |
| `VITE_FIREBASE_API_KEY` | config web publik Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | `nyales-staging.firebaseapp.com` |
| `FIRST_ADMIN_EMAIL` | opsional, hanya bootstrap |
| `FIRST_ADMIN_ORGANIZATION_NAME` | opsional, hanya bootstrap |

### Scope minimum untuk token Cloudflare (tingkat C)

```
Account   → Workers Scripts:Edit
Account   → D1:Edit
Account   → R2:Edit
Account   → Account Settings:Read
Account   → Workers Tail:Read      (untuk debugging via wrangler tail)
```

Batasi token ke **satu akun** dan **resource nyales-staging saja**.
Jangan berikan: Global API Key, akses akun ERP, atau token dengan izin DNS/zone.

## 5. Yang TIDAK boleh diserahkan

| Item | Alasan |
|---|---|
| Firebase service account / admin key | memberi kontrol penuh atas auth & user |
| Password akun Cloudflare / OAuth pribadi | tidak bisa dibatasi per-resource |
| Isi `.nyales-agent/` | berisi token OAuth wrangler & state lokal (gitignored) |
| Akses database produksi | belum ada; staging satu-satunya target |
| Kredensial ERP (akun `indonesiasuke`) | akun berbeda, tidak dipakai NYALES |

Agent penerima harus membuat sesi wrangler sendiri di folder terisolasi:

```powershell
$env:XDG_CONFIG_HOME = "<repo>\.nyales-agent\cloudflare-auth"
npx wrangler login
npx wrangler whoami        # harus menampilkan didikpriyoutomo05@gmail.com
```

Jangan memakai sesi global `~/.wrangler` — itu milik akun lain.

## 6. Jalur deploy yang benar

**Utamakan GitHub Actions**, bukan deploy lokal:

```
Actions → "NYALES staging deploy" → Run workflow (branch main)
input staging_url: https://nyales-staging.azaracourse.workers.dev
```

Workflow itu sudah menjalankan: validasi konfigurasi, `npm run check`, `npm test`,
build, dry-run bundle, migrasi D1 staging, deploy, lalu smoke test.

Deploy lokal hanya untuk darurat, dan wajib:

```powershell
$env:XDG_CONFIG_HOME = "<repo>\.nyales-agent\cloudflare-auth"
npx wrangler deploy --config wrangler.staging.generated.json
```

Setelah deploy, selalu jalankan:

```bash
npm run staging:smoke -- https://nyales-staging.azaracourse.workers.dev test-results/smoke-$(date +%s).json
```

## 7. Batas operasional

### Kuota D1 (free tier: 5 juta reads/hari)

1 sesi pengguna = 10 putaran × 3 halaman ≈ **1,8 juta baris** sebelum optimasi.
Artinya **maksimal ~2 sesi uji per hari**. Sebelum menjalankan uji beban:

```powershell
powershell -File .nyales-agent/quota-report.ps1
```

- `STATUS: OK` → aman
- `WARNING` (>60%) → hentikan pengujian
- `BLOCKED` → D1 menolak semua query sampai 00:00 UTC

### Migrasi

- Hanya ke **staging**, tidak pernah ke produksi.
- Sebelum menerapkan: `npx wrangler d1 migrations list nyales-staging --remote --config wrangler.staging.generated.json`
- Jangan pernah menjalankan seed ke staging.
- Migrasi baru harus punya nomor urut berikutnya (`0049_...`).

### Data

- Jangan mengubah data pelanggan/invoice staging tanpa persetujuan.
- Uji UI memakai prototype lokal (`npm run ui:prototype`), bukan staging.

### Aturan perubahan

1. Satu perubahan = satu commit dengan pesan yang menjelaskan alasannya.
2. Jalankan `npm run check` + `npm test` sebelum commit.
3. Untuk perubahan yang menyentuh query: ukur `rows_read` sebelum/sesudah.
4. Jangan mengubah angka bisnis tanpa test rekonsiliasi.

## 8. Verifikasi wajib sebelum menyentuh kode

```
[ ] npm ci sukses
[ ] npm run check bersih
[ ] npm test lulus (kecuali flaky yang diketahui, lihat bagian 9)
[ ] npm run build sukses
[ ] npm run ui:prototype berjalan dan halaman terbuka
[ ] wrangler whoami menunjukkan akun yang benar (kalau punya akses C)
```

## 9. Kondisi yang diketahui saat handover

| Hal | Status |
|---|---|
| Branch | `main`, commit terakhir berisi cache + paging + index migration |
| Deploy staging | versi `b06e29fd…` + patch cache dashboard & migrasi `0048` **belum diterapkan** |
| Kuota D1 | habis sampai 00:00 UTC (07:00 WIB) |
| Test flaky | `tests/m2-foundation.test.ts` ("customer merge cannot duplicate achievement") gagal pada pergantian bulan; bukan regresi |
| Migrasi tertunda | `0048_read_path_indexes.sql` — terapkan sebelum mengukur performa |

## 10. Ringkasan yang bisa dikirim ke agent

> Repo: `github.com/BuruhArloji/nyales` (private). Stack: Cloudflare Workers + D1 + R2,
> TypeScript, Hono, React/Vite. Node 24 + Python 3.13. Jalankan `npm ci`, `npm run check`,
> `npm test`, `npm run build` sebelum menyentuh apa pun. Uji UI hanya lewat
> `npm run ui:prototype` (lokal, seed sintetis). Deploy hanya staging, lewat GitHub Actions
> `deploy-staging.yml`, dengan input `https://nyales-staging.azaracourse.workers.dev`.
> Kuota D1 free tier 5 juta reads/hari — cek `.nyales-agent/quota-report.ps1` sebelum
> pengujian beban; satu sesi uji bisa menghabiskan 1,8 juta. Jangan pernah seed staging,
> jangan migrasi produksi, jangan pakai sesi wrangler global.