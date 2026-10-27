# Mulai di sini — komputer penghitung NYALES

Paket persiapan pemasangan, revisi2 · 26 Oktober2026.

Komputer penghitung belum tersedia. Simpan ZIP ini dahulu; tidak perlu memasang WSL/Docker pada laptop kantor sekarang.

## Saat komputer tujuan sudah ada

1. Pilih Windows yang sudah mempunyai WSL2/Docker aktif, atau Linux yang dapat menjalankan OSRM. Izin pemasangan fitur OS mengikuti pemilik komputer tersebut. Linux belum diuji pada paket ini; agent login otomatisnya juga masih Windows-only.
2. Siapkan Node24+ dan Python3.13 64-bit. Itu konfigurasi solver yang telah diuji di Windows; kebutuhan RAM/disk graph harus diukur menggunakan wilayah pilot, bukan diasumsikan cukup.
3. Ekstrak ZIP ke folder milik pengguna. Buka terminal di folder hasil ekstrak, bukan di dalam ZIP.
4. Periksa paket dahulu:

```text
python check-installation.py
```

`package.status: passed` berarti file cocok dengan checksum manifest. Dependensi boleh masih belum tersedia; pemeriksaan ini tidak memasang software. Checksum bukan tanda tangan pembuat. Status `ready_for_real_planning` tetapfalse sampai engine dan integrasi web terbukti.

5. Pasang dependensi CLI dan solver lokal:

```text
npm ci
python scripts/visit-solver-setup.py
python check-installation.py
```

Solver dipasang pada folder `.nyales-agent/solver-python`, bukan Python global. Ketika `solver_version_matches` dan `node_24_or_newer` true, dependensi dasar sudah terdeteksi. Itu belum membuktikan routing atau Generate dari web sudah berfungsi.

6. Setelah area dan profil kendaraan pilot ditetapkan, ikuti [README lengkap](README.md) untuk menyiapkan extract/graph OSRM, manifest instalasi dan menjalankan draft harian.

## Yang disiapkan paket

CLI perhitungan harian, installer dependensi Python lokal, pemeriksa paket/runtime, launcher OSRM yang dibatasi loopback, dependency lockfile dan manifest checksum. Versi solver yang diuji: OR-Tools9.15.6755.

Data jalan/graph, aplikasi Node/Python/Docker, credential dan data pelanggan tidak disertakan. Dibutuhkan koneksi internet untuk mengunduh dependensi saat pemasangan; paket bukan installer offline lengkap. Tidak ada biaya langganan yang dibeli oleh paket ini.

## Ketika pemeriksaan belum lulus

- `package.status: failed`: jangan lanjutkan instalasi dari salinan yang rusak. Ekstrak ulang ZIP asli ke folder baru; jangan menonaktifkan checksum.
- `node_24_or_newer: false` atau `npm_command_found: false`: siapkan runtime Node beserta npm pada komputer tujuan.
- `solver_version_matches: false`: jalankan installer Python lokal; jika wheel/venv tidak tersedia, gunakan konfigurasi Python64-bit yang sesuai. Jangan menghapus Python sistem.
- `PARTIAL_SOLVER_ENVIRONMENT_REQUIRES_OPERATOR_REVIEW`: pemasangan sebelumnya belum selesai; minta operator memeriksa folder venv, jangan menghapus folder yang belum dipastikan kepemilikannya.
- Belum ada Docker/OSRM/graph: lanjutkan persiapan host sesuai README; jangan menafsirkan hasil solver dummy sebagai rute jalan nyata.

## Status saat paket diserahkan

Solver Windows dan alur CLI teruji menggunakan matriks sintetis. Komputer routing, OSRM/graph nyata, input bisnis lengkap, antrean job serta review/publish web belum siap. Paket tidak mengubah database atau agenda NYALES dan tidak melakukan pairing otomatis.
