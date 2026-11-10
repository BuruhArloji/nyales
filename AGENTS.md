# AGENTS.md — NYALES

Instruksi untuk agent yang bekerja pada repo ini. Baca sebelum menyentuh kode.

## Proyek

NYALES — aplikasi sales lapangan & telesales (customer, peta, target, insentif, kunjungan).
Stack: **Cloudflare Workers + D1 (SQLite) + R2**, TypeScript, Hono, React/Vite.
Repo: `github.com/BuruhArloji/nyales` (private). Branch kerja: `main`.

## Perintah wajib

```bash
npm ci                # install
npm run check         # tsc --noEmit
npm test              # 350+ test kontrak & domain
npm run build         # tsc + vite build
npm run ui:prototype  # app lokal: Vite :5190, worker :5191, D1 lokal + seed sintetis
```

Semua harus lolos sebelum dan sesudah perubahan.

## Aturan lingkungan

- Node **24**, Python **3.13**, Chrome terbaru (Playwright), Git.
- Uji UI **hanya** lewat `npm run ui:prototype`. Prototype memakai D1 lokal di
  `.wrangler/ui-prototype-v1` dengan data sintetis — tidak menyentuh staging.
- Jangan memakai sesi wrangler global `~/.wrangler`. Kalau perlu akses Cloudflare:

  ```powershell
  $env:XDG_CONFIG_HOME = "<repo>\.nyales-agent\cloudflare-auth"
  npx wrangler whoami   # harus: didikpriyoutomo05@gmail.com
  ```

- Jangan pernah meminta atau menyimpan secret di chat/commit. Kredensial hanya lewat
  environment atau GitHub Actions secrets.

## Deploy

- **Utamakan GitHub Actions**: workflow `NYALES staging deploy` (workflow_dispatch, branch `main`),
  input `staging_url: https://nyales-staging.azaracourse.workers.dev`.
- Deploy lokal hanya darurat:

  ```powershell
  $env:XDG_CONFIG_HOME = "<repo>\.nyales-agent\cloudflare-auth"
  npx wrangler deploy --config wrangler.staging.generated.json
  ```

- Setelah deploy selalu jalankan smoke test:

  ```bash
  npm run staging:smoke -- https://nyales-staging.azaracourse.workers.dev test-results/smoke-$(date +%s).json
  ```

- **Tidak ada produksi.** Hanya staging. Migrasi tidak pernah dijalankan ke produksi.

## Kuota D1 — ikuti plan akun yang benar

- Workers Free: **5 juta rows read/hari** dan **100.000 rows written/hari**, reset 00:00 UTC.
- Workers Paid: **25 miliar rows read/bulan** dan **50 juta rows written/bulan** sudah termasuk; pemakaian lebih dihitung sesuai tarif. Batas harian Free tidak berlaku setelah akun beralih ke Paid.
- DDL (termasuk pembuatan indeks) dapat ikut memakai rows read/written. Periksa target akun melalui `CF_ACCOUNT_ID` sebelum aksi remote; database staging bernama `nyales-staging` dan tidak memiliki switch plan terpisah.
- Operator mengonfirmasi Workers Paid aktif pada akun staging per 3 Nov 2026. Jangan menunggu reset Free jika workflow memakai akun Paid tersebut.

Sebelum uji beban (butuh token dengan scope **Account Analytics: Read**):

```bash
CLOUDFLARE_API_TOKEN=... node scripts/quota-report.mjs
# atau
npm run quota:report
```

- `OK` → aman
- `WARNING` (>60%) → hentikan pengujian
- `BLOCKED` → D1 menolak semua query; tunggu reset

Kalau D1 menolak: jangan retry berulang, jangan ubah kode untuk "mengakali" — kuota, bukan bug.

## Data

- **Jangan seed staging.** Data staging adalah data pilot nyata.
- Jangan mengubah customer/invoice staging tanpa persetujuan eksplisit.
- Migrasi baru: nomor urut berikutnya setelah nomor tertinggi di `migrations/`, hanya ke staging.
- Periksa migrasi tertunda dulu:
  `npx wrangler d1 migrations list nyales-staging --remote --config wrangler.staging.generated.json`

## Aturan perubahan

1. Satu perubahan = satu commit; pesan menjelaskan alasan, bukan hanya "update".
2. `npm run check` + `npm test` sebelum commit.
3. Perubahan query/agregasi: ukur `rows_read` sebelum/sesudah (`wrangler tail` mencatat
   `rows_read` per request dalam log `nyales_api`).
4. Angka bisnis tidak boleh berubah tanpa **test rekonsiliasi** (hasil baru harus identik
   dengan query lama untuk dataset fixture).
5. Jangan mengubah perilaku UI yang tidak diminta. Perubahan visual harus disertai verifikasi
   screenshot atau test browser.

## Peta dokumen

| File | Isi |
|---|---|
| `docs/specifications/PRD_*.md` | PRD, ruang lingkup, aturan bisnis |
| `docs/specifications/ERD_*.md` | model data |
| `docs/specifications/Kontrak_API_*.md` | kontrak API |
| `docs/specifications/Backlog_*.md` | backlog WEB-xxx |
| `docs/PERFORMANCE_QUOTA_PLAN_*.md` | rencana performa & kuota |
| `docs/AGENT_ACCESS.md` | apa yang boleh/tidak boleh diserahkan ke agent lain |
| `docs/AUTH_SETUP.md` | auth, Firebase, MFA |

## Status rilis dan pekerjaan lama

- Checkpoint terverifikasi 10 Nov 2026: rilis `a40b4c6`, CI `42557779629` dan deployment `42558108739` berhasil; migrasi sampai `0063` diterapkan. Ini checkpoint historis, bukan pernyataan HEAD selalu sama.
- Untuk status terkini, cocokkan HEAD dengan CI/deploy GitHub dan jalankan migrations list; jangan memakai snapshot lama sebagai alasan seed atau migrasi ulang.
- Generator kunjungan harian adalah jalur operasional utama. OSRM lokal, kebijakan/preflight generasi lama, dan pengaturan risiko lama berada di bagian Eksperimental yang tidak terbuka secara default.
- Endpoint kompatibilitas dan tabel histori tidak boleh dihapus hanya karena UI lama sudah tidak dipakai. Periksa telemetry dan kontrak/tooling sebelum penghentian.
- Staging menggunakan config hasil `scripts/prepare-staging-wrangler.mjs`. Cron di config tersebut tetap nonaktif; handler scheduled yang tersedia bukan bukti job otomatis berjalan.
- Panduan perapihan dan batas perubahan: `docs/LEGACY_CLEANUP.md`.
