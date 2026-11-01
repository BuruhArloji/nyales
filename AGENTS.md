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

## Kuota D1 — batas paling mudah dilanggar

Free tier: **5 juta rows read/hari**, reset 00:00 UTC (07:00 WIB).
Satu sesi uji (10 putaran × 3 halaman) bisa menghabiskan **±1,8 juta**.

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
- Migrasi baru: nomor urut berikutnya (`0049_...`), hanya ke staging.
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

## Kondisi saat ini (per 1 Nov 2026)

- `main` memuat: cache read-model, pagination customer di SQLite, migrasi `0048` (index).
- Migrasi `0048` **belum diterapkan** ke staging.
- Test `tests/m2-foundation.test.ts` ("customer merge cannot duplicate achievement") gagal
  pada pergantian bulan karena fixture bergantung tanggal berjalan — bukan regresi.
- Kuota D1 habis sampai 00:00 UTC.