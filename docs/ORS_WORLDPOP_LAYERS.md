# WorldPop, jalan, dan pratinjau ORS — 4 November 2026

## Peta

Layer **WorldPop · raster 2026** terpisah dari rata-rata penduduk per kelurahan.
Sumber publik resmi: [IDN constrained 100m R2025A v1, 2026](https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2026/IDN/v1/100m/constrained/idn_pop_2026_CN_100m_R2025A_v1.tif).
Lisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); atribusi tetap pada peta.
Ini estimasi model penduduk, bukan sensus atau pergerakan orang secara langsung.

- Sumber berisi jumlah orang per piksel WGS84 3 arc-second. Builder membagi jumlah
  tersebut dengan luas piksel pada ellipsoid WGS84 agar unit menjadi jiwa/km².
- Rata-rata raster dipakai saat memperkecil. Kelas: <100, 100–1.000, 1.000–5.000,
  5.000–10.000, ≥10.000. Nol/NoData transparan. Raster tidak menentukan assignment.
- PNG PMTiles z0–11, overzoom di atas z11; resolusi sumber sekitar 100 m.
  Hasil saat ini 9.960 tile, 52.052.117 byte, SHA256
  `66b7c4db432dbfce890695fd5a881803e037b685e1e00270c009cc44dcb1a302`.
- Objek R2: `public-maps/worldpop-idn-2026-density.pmtiles`; endpoint staging
  `/demo/worldpop-idn-2026-density.pmtiles` hanya melayani GET/HEAD byte range
  terbatas. Tidak membaca D1 dan tidak membawa data pelanggan.
- Sumber SHA256 `444f70196f96cc2ddd91480a0d12267104f85dd2a9d985a5077e8b9cc5dd9df7`;
  jumlah populasi dari piksel valid 286.820.251,57 (nilai pecahan model).
- Toggle **Jalan** memakai layer transportation / transportation_name dari
  basemap vektor OpenFreeMap/OSM, terpisah dari raster dan pin. Tidak mengunduh
  graph routing dan tidak menambah provider berbayar. Tidak tersedia pada basemap
  gambar raster yang jalan dan latarnya sudah menyatu.

Rebuild: pasang `rasterio`, `numpy`, `pillow`, `mercantile`, `pmtiles` di venv terisolasi,
lalu `python scripts/build-worldpop-raster.py INPUT_TIFF OUTPUT_DIRECTORY`.
GeoTIFF, output PMTiles dan manifest disimpan pada direktori privat operator,
tidak di Git. Upload ke bucket staging yang tepat; jangan mengubah paket wilayah
atau data bisnis. Deployment kode melalui workflow GitHub staging.

## ORS: kontrak prototipe harian

Secret `ORS_API_KEY` berada di GitHub environment **staging** dan dikirim ke secret
Worker oleh workflow. Tidak ada variabel VITE untuk key ini. Status configured
hanya membuktikan keberadaan konfigurasi, bukan keberhasilan panggilan provider.

Endpoint resmi sesuai [migrasi HeiGIT](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912):

- Matrix: `https://api.heigit.org/openrouteservice/v2/matrix/driving-car`.
- Optimization: `https://api.heigit.org/vroom/v0`.
- Geometry: `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`.

Alur UI: Pengaturan → Perencanaan kunjungan → Rute ORS → pilih pemeriksaan kesiapan,
tanggal dan 1–10 pelanggan → setujui pemrosesan eksternal → hitung pratinjau.
Management/NSM saja. Profil operasional sales dan pelanggan wajib ditinjau untuk
tanggal tersebut: pangkal/akhir, kalender, istirahat, absensi, durasi layanan dan
jendela penerimaan. Koordinat terverifikasi dan assignment bertanggal digunakan
dari snapshot, bukan koordinat arbitrer yang dikirim browser.

API baru (seluruhnya membutuhkan sesi dan scope organisasi):

| Metode | Path | Hasil |
|---|---|---|
| GET | `/api/visit-generator/ors/status` | Konfigurasi boolean, batas internal; tanpa key |
| GET | `/api/visit-generator/ors/previews` | 20 metadata terbaru |
| GET | `/api/visit-generator/ors/previews/:id` | Bukti tersimpan, current/stale |
| POST | `/api/visit-generator/ors/previews` | Pratinjau immutable; Idempotency-Key wajib |

Body POST: `preflight_id`, `date`, `customer_ids` (unik, 1–10),
`confirmed_external_processing: true`. Browser tidak mengirim URL provider/key.
Nama pelanggan, nama sales dan invoice tidak dikirim ke provider. Koordinat dan
jam kerja/layanan/istirahat dikirim; server memakai ID angka sementara.

Batas internal: 3 sales, 15 titik unik termasuk pangkal/akhir (225 elemen matrix),
20 percobaan per hari UTC untuk seluruh instalasi; satu permintaan aktif dengan
lease 180 detik. Ini pagar biaya internal, **bukan** jaminan kuota paket Basic.
Satu pratinjau memakai satu matrix, satu optimization dan hingga tiga directions.
Tidak ada polling, retry otomatis atau pemanggilan provider ketika layer peta
diubah. Timeout per panggilan 25 detik, respons maksimal 2 MB.

Hasil mematuhi owner melalui skills, batas shift, service windows serta break;
pelanggan tidak terjadwal ditampilkan. Ada agenda yang sudah terisi pada hari
terpilih → diblok sampai integrasi reserved intervals tersedia. Sumber/agenda
berubah selama kalkulasi → hasil gagal dan tidak dipakai. Kegagalan geometry
ditandai jelas; urutan dari optimization tetap bisa dibaca.

Metadata/idempotency/budget berada di D1 `visit_ors_preview` (0050); bukti privat
dan checksum di R2 `<organization>/ors-previews/<id>.json`. Audit menyimpan ID,
tanggal, jumlah pelanggan dan persetujuan pemrosesan; tidak menyimpan key.
Snapshot kesiapan dan epoch lama tetap dipertahankan; `can_generate:false`
pada kontrak readiness lama tidak diubah.

**Belum termasuk:** publish agenda, PJP bulanan (frekuensi/gap lintas hari),
penetapan pelanggan otomatis multivariabel, traffic langsung, profil motor,
atau penggantian kernel lokal OSRM/OR-Tools. WEB-070–074 tidak dinyatakan selesai.
Perhitungan ORS pertama dan acceptance UI dilakukan pengguna; build/CI/deploy
tidak berarti provider telah berhasil menghasilkan rute dengan data pilot.
