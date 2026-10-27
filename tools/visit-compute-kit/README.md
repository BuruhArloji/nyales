> Baca [START-HERE.md](START-HERE.md) untuk langkah pemasangan ringkas dan `python check-installation.py` untuk pemeriksaan baca-saja. Komputer routing belum tersedia; paket disiapkan dahulu sesuai keputusan pengguna.

# NYALES — paket komputer penghitung

26 Oktober 2026. Paket CLI untuk memeriksa berkas graph dan menghitung **draft harian satu sales**. Tidak berisi customer, snapshot bisnis, credential, database, data jalan, Python/Node atau Docker. Belum menghubungkan permintaan Generate dari web ke solver dan belum mempublish agenda. Manifest SHA256 paket mencatat setiap file.

## Komputer tanpa administrator

Keputusan pengguna: komputer NYALES saat ini tidak mempunyai akses administrator; routing memakai komputer lain. Tidak memasang WSL/Docker atau mengubah fitur Windows di komputer ini.

Dua pilihan pemasangan:

- Windows lain dengan WSL2/Docker yang sudah aktif: OSRM di WSL/container; CLI dan solver bisa di Windows yang sama. Pairing agent yang tersedia saat ini memakai Windows DPAPI CurrentUser.
- Linux dengan OSRM native atau Docker yang sudah dapat dipakai operator: paket CLI/solver ini dapat dipasang di sana, tetapi **belum diuji pada Linux dalam rollout ini**. Penyimpanan credential agent bertanda tangan belum mendukung Linux; paket ini bukan pengganti agent polling. Dukungan vault Linux tetap pekerjaan tersendiri.

Komputer penghitung belum tersedia. Alamat, OS, operator, area extract dan profil kendaraan komputer tujuan ditetapkan ketika perangkat sudah ada. Pemasangan/benchmark di komputer tujuan belum dijalankan. Laptop saat ini tetap dapat digunakan untuk web dan pengaturan sumber perencanaan.

## Menyiapkan solver tanpa mengubah Python global

Dari folder hasil ekstrak, gunakan Node24+ dan Python64-bit yang kompatibel. Paket NPM dikunci lewat package-lock.json; OR-Tools versi9.15.6755 beserta dependency yang diuji dikunci di requirements.lock.txt. Jalankan:

```text
npm ci
python scripts/visit-solver-setup.py
```

Script Python hanya membuat virtual environment `.nyales-agent/solver-python` dan memasang wheel di sana. Tidak memakai sudo, memasang service, mengubah OS atau mengunduh graph. Jika venv/ensurepip/wheel tidak tersedia, operator perlu menyiapkan runtime yang sesuai. Kebutuhan instalasi OS di komputer lain mengikuti izin pemiliknya; paket tidak mencoba melewati pembatasan.

Windows executable solver: `.nyales-agent/solver-python/Scripts/python.exe`. Linux: `.nyales-agent/solver-python/bin/python`. Versi solver telah dipasang dan diuji nyata pada Windows pengembangan; Linux belum diverifikasi.

## Menyiapkan jaringan jalan di komputer routing

Gunakan extract OSM terbatas wilayah pilot beserta jalan penghubung yang diperlukan. Catat URL sumber, tanggal, checksum, batas cakupan, ketentuan penggunaan dan atribusi. Basemap OpenFreeMap berbeda dari graph routing ini. Extract dan graph tidak disertakan.

Ikuti [OSRM resmi](https://github.com/Project-OSRM/osrm-backend) untuk `osrm-extract`, `osrm-partition`, `osrm-customize` dan `osrm-routed --algorithm mld`. Pilih satu image resmi `ghcr.io/project-osrm/osrm-backend@sha256:<digest-64-hex>` dan gunakan digest yang sama pada preprocessing serta runtime; paket tidak memilih atau menarik image otomatis. Profil mobil tidak boleh dilabeli motor tanpa validasi.

Setelah preprocessing MLD selesai dan image sudah tersedia, jalankan di Linux/WSL yang mempunyai akses Docker:

```text
bash start-osrm.sh IMAGE_AT_SHA256 DATA_DIRECTORY GRAPH_BASENAME 5000
```

Contoh nama dasar: `pilot` untuk kumpulan `pilot.osrm.*`. Script membatasi listener ke127.0.0.1 dan memasang graph read-only. Ia belum membuktikan proses tersebut cocok dengan manifest NYALES; pemeriksaan file saja bukan bukti identitas proses. Script belum dijalankan terhadap Docker nyata pada komputer pengembangan yang tidak mempunyai Docker.

Jika diperlukan koneksi antar komputer, gunakan koneksi privat/SSH dengan host key yang diverifikasi operator. Jangan membuka OSRM tanpa autentikasi ke internet. CLI hanya menerima HTTP loopback berport eksplisit; alamat komputer lain harus tetap melalui penghubung privat yang disiapkan operator. SSH client ditemukan pada Windows pengembangan; server, akun, host key dan tunnel belum tersedia. Tidak ada tunnel yang dibuat oleh paket ini.

## Input dan menjalankan draft harian

File yang harus disediakan operator dari sumber yang diizinkan:

1. `snapshot.json`: kontrak penuh `nyales-visit-generator-1`, assignment per tanggal, shift/cuti/istirahat, titik awal/akhir, profil layanan, histori yang lengkap atau unknown eksplisit, priority yang sudah dihitung oleh builder dan versi sumber. **Snapshot kesiapan dari UI (`nyales-visit-readiness-1`) tidak dapat dipakai sebagai input ini. Ekspor/builder dan antrean bisnis dari web masih pending.**
2. `policy.json`: versi kebijakan yang hash-nya tepat sama dengan snapshot; tanpa parameter bisnis bawaan.
3. `installation.json`: kontrak `nyales-osrm-installation-1`, graph yang persis sama dengan snapshot, profil routing, inventaris extract/Lua/seluruh graph dengan bytes dan SHA256. `graph_sha256` adalah digest canonical manifest content menurut `installedGraphContentHash`; operator perlu membentuk manifest dari instalasi nyata.
4. Folder instalasi berisi seluruh file inventory; CLI memeriksa ukuran/hash/path secara streaming sebelum memanggil routing. Bila routing di komputer lain, jalankan CLI di komputer yang mempunyai inventory yang sesuai, atau sediakan salinan terverifikasi; tidak menganggap file lokal sebagai bukti graph remote.

Windows, dari root paket:

```text
npm run daily -- --snapshot snapshot.json --policy policy.json --installation installation.json --graph-directory graph --python .nyales-agent/solver-python/Scripts/python.exe --osrm-origin http://127.0.0.1:5000 --output candidate-new.json
```

Linux memakai `--python .nyales-agent/solver-python/bin/python`. Semua path adalah milik operator; tidak ada perintah executable/URL dari job. Output wajib nama baru. Ctrl+C membatalkan proses; output parsial tidak dipublish. File output berisi koordinat bisnis sehingga disimpan privat oleh operator.

Output mengikat snapshot, policy, graph dan matrix hash, rute berurutan, waktu layanan/jalan/kembali, alasan tidak terjadwal, runtime serta peak working set proses Python yang diukur OS. Null/unreachable tidak diubah menjadi nol atau jarak lurus. Batas awal98 kunjungan/100 node, satu hari, solver maksimal120detik. Bobot priority sudah disiapkan snapshot; travel penalty memakai bobot kebijakan dan normalisasi durasi shift. Required tetap wajib. Kapasitas layanan adalah batas terpisah dari jam kerja.

Janji terkunci, protected agenda yang belum dimodelkan lokasinya, duplikasi customer pada satu hari dan input tanpa jendela dalam shift ditolak. Tidak mengabaikan agenda lama untuk menghasilkan jadwal tampak valid. Tidak mengklaim optimum, traffic real-time atau kebutuhan bulanan terpenuhi. Output selalu `publishable:false`, `osrm_process_identity_verified:false`, `agenda_written:false`, `uploaded:false` sampai verifikasi engine, validasi server dan review/publish sah tersedia.

## Pekerjaan menuju Generate dari web

Verifikasi runtime/graph dan benchmark OSRM nyata pada komputer tujuan → builder snapshot bisnis dan sumber histori/constraint lintas kanal → queue dan transport job solver terpisah dari connection probe → review/publish atomik → bulanan/multi-sales. Paket ini membantu persiapan dan pengujian daily kernel; bukan status seluruh Plan Visit Generator selesai.
