# WEB-062 — pilot dummy lokal, 21 Oktober 2026

Pilot teknis dapat dicoba di **http://127.0.0.1:5183/** melalui **Masuk demo lokal**. Akses hanya dari komputer ini. D1/R2 berada pada `.wrangler/pilot-1792594970726`, terpisah dari `.wrangler/state` dan preview sebelumnya. Tidak ada deployment cloud.

PIC tetap Rizky Aditya. Novely, Didik dan Mursal tetap peserta awal yang diberikan pengguna. Tujuh nama tambahan adalah Sales Demo 04–10. Pembagian 8 lapangan dan 2 telesales, seluruh area/hirarki dan koordinat Jakarta merupakan simulasi; tidak menetapkan jabatan atau lokasi kerja nyata. Operator login lokal tetap Dina Pratiwi (Management demo), terpisah dari PIC. Sepuluh data sales bukan sepuluh akun Firebase.

## Data dan angka yang dapat dicocokkan

Sumber awal `pilot/demo-10-sales/source-data.json` tidak diubah. Turunan pada `pilot/local-20261021-v3/source-data.json` menggeser Juni–September menjadi Juli–Oktober agar overview Oktober terisi. Cutoff turunan dicatat saat persiapan. Dua puluh koordinat peta sintetis diberikan untuk memeriksa distribusi pin, bukan hasil GPS pelanggan. Kalender Senin–Sabtu 08:00–18:00 Asia/Jakarta dan satu produk Kopi Simulasi Rp10.000 melengkapi latihan order.

| Pemeriksaan | Hasil |
| --- | ---: |
| Tenaga sales | 10: 8 lapangan, 2 telesales |
| Pelanggan / owner | 20 / 20 |
| Invoice Juli–Oktober | 80 |
| Invoice Oktober | 20: 18 eligible, 1 cancelled, 1 draft |
| Retur tervalidasi | 4, total Rp200.000 |
| Actual Oktober | Rp36.520.000 |
| Actual lapangan / telesales | Rp30.840.000 / Rp5.680.000 |
| Target teralokasi | Rp80.000.000 |
| Cadangan belum dialokasikan | Rp200.000 |
| Target organisasi termasuk cadangan | Rp80.200.000 |
| Achievement monitoring atas leaf | 45,65% |

Overview organisasi mempertahankan status target perlu review karena masih ada cadangan. Monitoring leaf/channel tetap menampilkan pencapaian target yang sudah dialokasikan. Tidak menghilangkan cadangan agar angka terlihat lengkap. Sales bertransaksi pada overview berjumlah 9; workforce 10 karena dua invoice sales terakhir berstatus cancelled/draft.

Pada peluncuran 21 Oktober, coverage aktivitas masih 0 dan posisi sales kosong. Pembaruan 22 Oktober di bawah menambahkan rehearsal operasional sintetis: 12 aktivitas, coverage 40%, dan 8 posisi. Peta tetap menampilkan 20 pin pelanggan simulasi. Insentif dan pipeline historis tambahan tidak diisi oleh paket ini; order latihan dibuat dan dibatalkan selama pemeriksaan.

## Yang telah diuji

Alur: browser Chrome → login demo lokal dan sesi perangkat → API → D1 pilot → tampilan. Tanpa bearer mendapat 401. Banner data simulasi tampil. Dua belas halaman dimuat tanpa page error; layout overview diperiksa pada lebar 390/768/1440. Peta 2D beserta pin terlihat pada screenshot.

Konfirmasi cakupan **sumber sintetis** disimpan melalui popup Status & tier untuk 1 Juli–21 Oktober, lalu Monitoring dibaca kembali. Filter kanal menghasilkan 8/2 sales serta Rp30,84/Rp5,68 juta. Order draft dibuat melalui UI, terbaca kembali setelah reload, kemudian dibatalkan melalui UI. Seluruh ID, nilai dan status 80 invoice tetap sama. Tidak ada persetujuan bisnis atau telepon nyata.

Seed berasal dari domain rehearsal yang melewati route finance/target. Ekspor fixture memecah JSON import besar menjadi perintah di bawah batas D1, memulihkan target melalui draft → items → approved, dan mempertahankan semua trigger. Tes membuktikan foreign key bersih, JSON import utuh, perubahan langsung invoice/target approved ditolak. Tidak menonaktifkan constraint. Dua percobaan persiapan awal gagal sebelum pilot aktif; folder v3 merupakan run yang digunakan.

Evidence: [ringkasan](WEB062_PILOT_EVIDENCE.json), `test-results/pilot-local/verified.json`, `test-results/pilot-local/results.json`, screenshot overview/monitoring di `test-results/pilot-local/artifacts`, serta `pilot/local-20261021-v3/rehearsal/reconciliation`. TypeScript dan 134/134 unit/integration tests PASS; satu skenario browser lengkap PASS. Bundle aplikasi yang telah dibangun sebelumnya digunakan karena tidak ada perubahan kode UI/server runtime.

## Menjalankan kembali

Jalankan dari folder `sales-operations`:

```powershell
npm run pilot:local -- pilot/local-20261021-v3
```

State yang sudah dimuat dipakai kembali, tanpa reseed atau menghapus hasil latihan. LOCAL-STATE bersifat lokal per mesin dan diabaikan Git. Untuk mesin/fixture baru:

```powershell
npm ci
npm run build
npm run pilot:local:prepare -- --out pilot/pilot-lokal-baru
npm run pilot:local -- pilot/pilot-lokal-baru
```

Turunan tanggal sengaja tetap Oktober 2026. Konfirmasi cakupan sumber latihan dilakukan lewat UI, tidak otomatis mengklaim data lengkap pada hari berikutnya. Scheduled job tidak otomatis berjalan di Wrangler lokal. Google Street View membutuhkan referrer port 5183 yang diizinkan pada key; tidak diuji pada run ini. Jangan memakai suite pilot mutatif terhadap lingkungan perusahaan.

## Register tindak lanjut dan gate

| ID | Kondisi | Status |
| --- | --- | --- |
| PILOT-01 | Data latihan terisolasi, jumlah/net/kanal/target direkonsiliasi | Selesai untuk dummy |
| PILOT-02 | UI/API simpan cakupan sumber dan order, reload, invoice tetap | Lulus otomatis lokal |
| PILOT-03 | Cakupan kunjungan, lokasi sales, telepon dan workflow per-role | Rehearsal domain dan tampilan lokal lulus; perangkat/login tiap role belum dilakukan manusia |
| PILOT-04 | 15 kasus training, evaluator, dukungan dan handover bernama | Pending register WEB-061 |
| PILOT-05 | Data perusahaan, role/area peserta, provisioning Firebase/MFA dan provider | Ditunda sesuai pilihan dummy |
| PILOT-06 | Backup/full restore beserta attachment, kapasitas provider dan keputusan go-live | Full restore D1/R2 lokal lulus; cloud, kapasitas provider dan go-live pending |

Tidak ditemukan kegagalan data kritis pada skenario lokal yang diuji. Hal ini tidak menutup pengujian keamanan/perangkat/provider di luar cakupan. WEB-062 berstatus pilot dummy lokal aktif; stabilisasi pemakaian nyata dan keputusan go-live belum diterima. `human_training_completed=false`, `production_accepted=false`.

## Pembaruan 22 Oktober — operasional dan pemulihan lokal

`pilot/operations-20261022-v2` memuat delta dari rehearsal route aplikasi. Skenario memakai jam bisnis simulasi **21 Oktober 2026 pukul 10:00 Asia/Jakarta** dalam proses terpisah. Jam server pilot tidak diubah. Identitas tiap role diinjeksi hanya pada harness, tanpa menambah bypass login pada aplikasi.

- Delapan sales lapangan menjalankan sesi kerja, draft kunjungan, check-in, check-out dan akhir sesi. Replay check-in kembali ke event yang sama; sesi tidak dapat ditutup ketika kunjungan aktif. Enam kunjungan produktif dan dua toko tutup dengan tugas kunjungan ulang.
- Empat hasil telesales: dua koneksi PIC manual, satu callback dan satu DNC. Lease ganda ditolak, qualification wajib untuk koneksi PIC, DNC memblokir claim berikutnya. Tidak ada panggilan provider; kontak dan izin semuanya sintetis.
- Coverage **8 dari 20 pelanggan / 40%**, **8 aktivitas bermakna dari 12**, **8 posisi terakhir**. Tiga task follow-up terbuka. Koordinat adalah simulasi bertimestamp 21 Oktober, sehingga usia posisi mengikuti waktu saat halaman dibuka.
- Management/NSM membaca 20 pelanggan; SR dapat melihat 20 pada area tetapi hanya dapat menjalankan visit pada assignment sendiri; telesales membaca 2 assignment; SPV lapangan/telesales membaca 16/4 pelanggan; AM membaca 20 pada area. Kontrol pelanggan area lain ditolak untuk AM, konfigurasi ditolak untuk role operasional. Kontrol negatif tidak dimuat ke pilot.
- Delta hanya menambahkan record operasional baru. Invoice, target dan master sumber tidak diubah. Marker stabil mencegah pemuatan ulang delta yang sama; cache segmentasi tidak ikut disalin.

Route lampiran menguji intent → upload → finalize pada rehearsal, kemudian byte dummy yang sama ditempatkan di R2 lokal pilot. Browser mengunduh melalui endpoint berotorisasi dan checksum cocok. Lampiran 73 byte merupakan fixture signature PDF, bukan dokumen yang divalidasi tampil di PDF viewer atau bukti kunjungan nyata.

Full restore memakai **SQLite online backup dari D1 pilot yang sedang aktif**, bukan seed ulang. Snapshot mencakup seluruh **86 tabel**, histori, indeks dan trigger. Snapshot dipulihkan ke `.wrangler/pilot-restore-1792606480574`; hash per tabel dan schema identik, integrity/foreign key check lulus. Query melalui Wrangler D1 hasil restore membaca **80 invoice, 12 aktivitas dan actual Oktober Rp36.520.000**. Satu object R2 disalin ke namespace restore lalu diunduh kembali; hash/ukuran/byte cocok. Waktu prosedur lokal tercatat sekitar **25,2 detik**, bukan penerimaan SLA RTO/RPO cloud.

Artefak snapshot penuh bersifat lokal di `test-results/pilot-restore-20261022`, yang diabaikan Git. Pemeriksaan hanya membuka sumber D1 read-only dan menulis ke direktori snapshot/restore baru. Ringkasan yang dapat direview: [evidence stabilisasi](WEB062_STABILIZATION.json), `pilot/operations-20261022-v2/SUMMARY.json`, `test-results/pilot-local/operations-verified.json`, `test-results/pilot-restore-20261022/SUMMARY.json`. Browser Monitoring/peta/lampiran lulus tanpa page error; **135/135 unit/integration tests dan TypeScript lulus**. Tidak ada perubahan kode UI/server runtime sehingga bundle sebelumnya dipakai.

Untuk mengulang full restore tanpa menimpa evidence, gunakan folder output baru:

```powershell
npm run pilot:restore -- pilot/local-20261021-v3 test-results/pilot-restore-run-baru
```

Delta operasional sudah diterapkan pada pilot ini. `npm run pilot:operations -- pilot/folder-operasional-baru` hanya membuat rehearsal dan file delta baru; tidak otomatis memuat data ke preview. Pemakaian nyata per role, Firebase/MFA, perangkat GPS, telepon provider, backup cloud, penerima dukungan dan sign-off bisnis tetap mengikuti register sebelumnya.
