# Kesiapan Area Territory Management — demo nasional

**Status:** demo Area berhasil di-deploy ke [NYALES staging](https://nyales-staging.azaracourse.workers.dev/) lewat [workflow 41551873169](https://github.com/BuruhArloji/nyales/actions/runs/41551873169), commit `9f78f87`. Workflow, smoke test, endpoint asset, dan tampilan peta terverifikasi. Tidak ada deployment produksi.

## Data yang dipakai

GeoPackage `/workspace/indonesia_desa_pop_2026.gpkg`, layer `desa_pop_2026`, berisi **83.486** polygon desa/kelurahan. Batasnya bersumber dari geodatabase BIG edisi 2022; atribut populasi adalah estimasi WorldPop 2026 (R2025A), bukan hasil sensus. Rilis batas BIG Juni 2026 tidak dipakai sebagai input demo ini.

Hak redistribusi batas BIG belum diverifikasi. Paket ini dilabeli portofolio DEMO; label portofolio/nonkomersial tidak menggantikan pemeriksaan lisensi sebelum data dipakai atau didistribusikan lebih luas.

## Area dan exception

Kode PUM cocok persis untuk **83.399** unit unik. **87** polygon tidak memiliki PUM dan tetap tanpa owner; daftar berisi **88** isu review karena ada unit dengan lebih dari satu masalah atribut. Tidak ada crosswalk otomatis dari nama/lokasi.

Untuk menunjukkan Area, wilayah dibagi secara sintetis menjadi empat kelompok provinsi: Sumatra, Jawa–Bali, Kalimantan–Sulawesi, dan Nusa Tenggara–Maluku–Papua, dengan owner placeholder `DEMO-PIC-01` hingga `DEMO-PIC-04`. Aturan ini bukan hasil optimasi outlet, workload, jarak, waktu, rute, atau urutan kunjungan. Di kartu DEMO, pengguna dapat mengunduh CSV berisi kode/nama sumber dan alasan review untuk seluruh exception.

Validasi menyatakan PUM unik, seluruh assignment bertanda synthetic, 87 exception tidak memiliki owner, tanggal efektif demo `2026-11-03` valid, dan seluruh 83.486 polygon masuk ke tileset tanpa dropping. **Assignment DEMO tidak ditulis ke D1 dan tidak diaktifkan sebagai kepemilikan sales operasional.**

## Distribusi dan verifikasi staging

Geometri disajikan dalam PMTiles berukuran **194.656.425 byte**, max zoom 12. Viewer membaca tiles lewat byte-range dari R2, bukan memuat semua poligon sebagai GeoJSON ke browser atau D1. Route `/demo/*` hanya aktif saat `APP_ENV=staging`, membatasi akses pada asset portofolio yang diizinkan, dan membatasi setiap range PMTiles hingga 8 MB.

Run staging mengunduh paket privat, memvalidasi checksum, mengirim hanya folder paket DEMO ke job deploy, lalu mengunggah PMTiles, manifest, ringkasan Area, dan exception CSV ke prefix `portfolio-demo/` di bucket staging. Job pengambilan paket memiliki `contents:write` agar dapat membaca draft release; job itu tidak menerima secret Cloudflare/Firebase. Job deploy tetap `contents:read` dan menerima secret staging saja.

Workflow memeriksa migrasi D1 sebelum deployment dan melaporkan **“No migrations to apply”**; karena itu tidak ada migrasi yang diterapkan pada run ini. Worker staging kemudian berhasil di-deploy dan smoke test autentikasi/boundary lulus. Tidak ada seed dan tidak ada data assignment/geometri demo yang ditulis ke D1.

Pemeriksaan live setelah deploy: homepage `200`; manifest dan ringkasan empat Area `200`; exception CSV `200` dengan **88** baris isu; PMTiles byte-range `206` dengan `Content-Range`; route asset yang tidak diizinkan `404`. Kartu peta berhasil dibuka sebagai Management di `Peta & Wilayah`; canvas peta tampil tanpa error MapLibre.

## Batas berikutnya

Data ini hanya demo portofolio. Sebelum Area dipakai untuk operasi nyata, konfirmasi hak redistribusi dan edisi batas, ganti owner DEMO dengan ownership yang disetujui (kode PUM, tim/PIC, tanggal efektif), tinjau semua exception, lalu uji coverability/workload. Route, sequence, waktu kunjungan, serta optimasi jarak bukan bagian dari demo ini.
