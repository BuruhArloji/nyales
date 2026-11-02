# Kesiapan Area Territory Management — demo nasional

**Status:** paket lokal dan implementasi staging telah siap; deployment staging dan smoke test masih menunggu run workflow. Tidak ada perubahan produksi.

## Data yang dipakai

GeoPackage `/workspace/indonesia_desa_pop_2026.gpkg`, layer `desa_pop_2026`, berisi **83.486** polygon desa/kelurahan. Batasnya bersumber dari geodatabase BIG edisi 2022, sedangkan atribut populasi adalah estimasi WorldPop 2026 (R2025A), bukan hasil sensus. Rilis batas BIG Juni 2026 belum menjadi input pada demo ini.

Hak redistribusi batas BIG belum diverifikasi. Karena itu paket dilabeli sebagai portofolio DEMO; label nonkomersial tidak dianggap menggantikan pemeriksaan lisensi apabila produk dipakai secara komersial.

## Area dan exception

Kode PUM cocok persis untuk **83.399** unit unik. **87** polygon tidak memiliki PUM dan tetap tanpa owner; daftar berisi **88** isu review karena ada unit dengan lebih dari satu masalah atribut. Tidak ada crosswalk otomatis dari nama/lokasi.

Untuk menunjukkan Area, wilayah dibagi secara sintetis menjadi empat kelompok provinsi: Sumatra, Jawa–Bali, Kalimantan–Sulawesi, dan Nusa Tenggara–Maluku–Papua, dengan owner placeholder `DEMO-PIC-01` hingga `DEMO-PIC-04`. Aturan ini bukan hasil optimasi outlet, workload, jarak, waktu, rute, atau urutan kunjungan. Di kartu DEMO, pengguna dapat mengunduh CSV berisi kode/nama sumber dan alasan review untuk semua exception.

Validasi lokal menyatakan PUM unik, seluruh assignment ditandai synthetic, 87 exception tidak memiliki owner, interval efektif demo `2026-11-03` valid, dan seluruh 83.486 polygon masuk ke tileset tanpa dropping. **Data assignment demo tidak ditulis ke D1 dan tidak diaktifkan sebagai kepemilikan sales operasional.**

## Distribusi peta

Geometri dikemas dalam PMTiles berukuran **194.656.425 byte**, max zoom 12. Viewer membaca tiles lewat byte-range dari R2, bukan memuat 83 ribu GeoJSON ke browser atau D1. Endpoint `/demo/*` hanya aktif saat `APP_ENV=staging`, mengizinkan empat asset portofolio, dan membatasi setiap range PMTiles menjadi 8 MB. Staging menyajikan PMTiles, manifest, ringkasan Area, dan exception CSV dari prefix R2 `portfolio-demo/`.

Workflow staging mengunduh arsip demo privat, memvalidasi checksum, mengunggah empat asset ke R2 staging, meninjau lalu menerapkan migrasi D1 tertunda `0048` (indeks saja), men-deploy Worker staging, kemudian menjalankan smoke test tanpa seed. Konfigurasi D1 memakai akun Cloudflare Paid yang sama dengan `CF_ACCOUNT_ID` menurut konfirmasi operator; kuota harian Workers Free tidak dipakai sebagai alasan menunda. D1 tetap hanya memuat metadata/fitur aplikasi yang sudah ada, bukan geometry maupun ownership DEMO.

## Status dan batas berikutnya

Typecheck, seluruh test aplikasi, build lokal, test tools GIS, validasi bundle nasional, dan test endpoint CSV/range lulus. Smoke test cloud baru dapat dinyatakan selesai setelah workflow staging berhasil.

Sebelum memakai Area ini untuk operasi nyata, ganti owner DEMO dengan daftar ownership yang disetujui (kode PUM, tim/PIC, tanggal efektif), tinjau semua exception, konfirmasi edisi batas terkini dan hak redistribusinya, lalu uji coverability/workload. Route, sequence, waktu kunjungan, serta optimasi jarak bukan bagian dari demo ini.
