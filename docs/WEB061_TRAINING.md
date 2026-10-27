# WEB-061 — panduan pengguna dan latihan NYALES

21 Oktober 2026. Paket materi siap dipakai pada **data dummy terisolasi**. Latihan manusia, penunjukan petugas bantuan dan serah terima operasional dicatat tersendiri; dokumen dan test otomatis tidak menandakan seseorang sudah dilatih.

Koordinator pilot: Rizky Aditya. Peserta awal: Novely, Didik, Mursal. Kapasitas 10 sales. Tujuh nama `Sales Demo 04–10` adalah karakter latihan. Pembagian kanal/role/area pada [sumber dummy](../pilot/demo-10-sales/source-data.json) hanya asumsi simulasi dan tidak menetapkan role peserta nyata.

Mulai dari [SOP](WEB061_SOP.md), [bantuan dan insiden](WEB061_SUPPORT.md), serta [register training/handover](WEB061_REGISTER.json). Alur impor mengikuti [WEB-060](WEB060_PILOT.md); skenario aplikasi lengkap tetap mengikuti [register UAT WEB-059](WEB059_UAT_REGISTER.json).

## Peta menu dan batas akses

Menu samping membuka kelompok; navigasi atas menampilkan teks pada halaman aktif, ikon pada halaman lain. Arahkan mouse atau fokus keyboard untuk mengetahui nama ikon. Tab menuju kontrol, Enter/Space untuk tombol, panah kiri/kanan pada tab halaman, Escape menutup popup bila tidak sedang menyimpan. Perangkat yang memilih reduced motion mendapat gerakan minimal. Tabel lebar dapat digeser di dalam kotaknya.

| Peran | Pekerjaan utama dan scope | Pengaturan |
| --- | --- | --- |
| Sales Rep | Customer dalam area atau assignment field; actual invoice milik sendiri; rencana/kunjungan/task dan draft order | Tidak mengubah konfigurasi organisasi, distribusi, target atau skema insentif |
| Telesales | Customer assigned kanal telesales, antrean, izin kontak, script, hasil manual dan callback | Terpisah dari lapangan; tidak mendapat seluruh customer hanya karena satu area |
| Supervisor | Tim dalam hirarki efektif dan batas area/kanal; review exception dan coaching sesuai izin | Kewajiban visit bukan default; tidak memiliki hak setting nasional |
| Area Manager | Area yang diberikan dan kanal sesuai identitas; monitoring tenaga sales dan tindak lanjut | Tidak melihat area lain; visit opsional, bukan kewajiban |
| Management/NSM | Scope organisasi; master, role/hirarki, distribusi, target, skema, approval dan audit | Seluruh pengaturan di luar kunjungan; approval tertentu wajib aktor berbeda |

Hak final selalu ditentukan server. Tombol tidak terlihat, 403, scope kosong atau data kosong tidak boleh diatasi dengan mengubah role di browser. Field dan telesales tetap dua kanal, satu invoice primer tidak dihitung dua kali.

## 1. Memulai dan menutup hari

1. Masuk menggunakan identitas yang diberikan administrator. Login demo lokal hanya untuk mencoba UI, bukan akun produksi Novely/Didik/Mursal. Jangan menggunakan satu akun untuk bergantian peserta.
2. Periksa nama, role, scope, tanggal bisnis dan banner sumber. `Belum tersedia`, `Belum lengkap` serta status Unknown berbeda dari angka nol.
3. Sales lapangan memulai sesi kerja sebelum check-in. Tinjau agenda, customer dan titik lokasi; koordinat belum diverifikasi bukan bukti posisi toko benar.
4. Ketika selesai, periksa hasil kunjungan, next action/callback, order dan antrean sinkron. Tunggu status server; `tersimpan di perangkat` belum berarti tersimpan di server.
5. Tutup kunjungan aktif sebelum mengakhiri sesi. Logout ketika jaringan tersedia. Jika muncul pesan pencabutan server belum terkonfirmasi, laporkan dan minta admin meninjau sesi perangkat; browser keluar tidak menjamin token server telah dicabut.

## 2. Sales lapangan

1. Buka **Aktivitas → Aktivitas lapangan**; buat/pilih aktivitas untuk customer yang benar. Cocokkan nama, kode dan alamat.
2. Mulai sesi, lalu check-in dan pilih **Ambil lokasi saat ini**. Izinkan GPS bila sesuai. Jika izin ditolak/akurasi buruk, isi alasan pengecualian; jangan mengarang koordinat.
3. Catat hasil: produktif, perlu follow-up, toko tutup, PIC tidak tersedia atau belum ada kebutuhan. Isi next action dan tenggat ketika diminta.
4. Upload bukti sesuai kebijakan yang disetujui. JPEG/PNG/PDF maksimal 5 MB; upload membutuhkan jaringan. File dipilih belum berarti finalisasi/checksum server selesai.
5. Check-out; bila needs_review, kirim ke reviewer yang berwenang. Jangan menghapus atau mengulang visit untuk menyembunyikan exception.
6. Buat order di **Penjualan → Pipeline & order** bila diperlukan. Periksa produk, unit, harga/diskon dan alasan. Approval order terpisah; order confirmed/Won belum menjadi actual penjualan. Actual berasal dari invoice tervalidasi.

Peta menunjukkan titik terakhir beserta timestamp/akurasi. Web ini belum memberikan tracking latar belakang Android. Garis GPS Android, rute, ETA atau Street View bukan bukti kehadiran.

## 3. Telesales

1. Buka **Aktivitas → Telesales** dan periksa customer assigned, izin kontak, campaign aktif serta callback.
2. **Ambil antrean** hanya untuk PIC berizin dengan preferred channel yang sesuai. Server memeriksa assignment, jam kerja/campaign, batas attempt, lease dan kunjungan aktif.
3. Pilih script. Lease menyimpan versi script; perubahan script baru tidak mengubah pertanyaan lease yang sudah dimulai.
4. Buka dialer bila diperlukan; jika lease hampir habis perpanjang melalui tombol. Dialer terbuka tidak membuktikan panggilan tersambung.
5. Catat hasil yang benar: tersambung PIC (manual), non-PIC, tidak dijawab, sibuk, nomor salah, callback, belum berminat atau DNC. Isi qualification dan waktu callback ketika diminta.
6. DNC berarti jangan dihubungi lagi. Jangan mengganti nomor/izin atau membuka customer lain untuk melewati batas attempt atau lease.

Hasil `connected_pic` tetap laporan manual. Verifikasi provider belum aktif. Callback dan handoff tidak otomatis membuat invoice/actual.

## 4. Supervisor dan Area Manager

1. Buka **Analitik → Monitoring**. Pastikan periode, cutoff, area, sales dan kanal sebelum membandingkan.
2. Coverage memakai customer unik dengan aktivitas bermakna; visit berulang tidak menambah customer unik. Toko tutup/tanpa PIC belum menambah meaningful coverage.
3. Buka sumber angka untuk meninjau record berpaginasi, lalu telusuri exception dan coaching yang sesuai scope. Bandingkan sumber lengkap, bukan preview dashboard saja.
4. Bedakan actual, target, forecast dan order. Forecast adalah perkiraan; retur/revisi invoice dapat mengubah actual dan achievement.
5. Review exception berdasarkan bukti; reviewer tidak boleh menyetujui tindakannya sendiri. Coaching memiliki penerima, langkah dan tenggat yang jelas; jangan menyelesaikannya hanya agar notifikasi hilang.

## 5. Management/NSM dan operator data

1. Siapkan organisasi/cabang/area/kalender, user, role dan hirarki. Satu SR memiliki satu SPV pada waktu yang sama; kanal dan tanggal berlaku harus cocok. Perubahan area/owner menggunakan workflow, bukan edit histori invoice.
2. Buka **Pelanggan → Distribusi sales** untuk assignment field/telesales dan tanggal efektif. Satu customer satu lokasi; tidak ada lapisan Account bisnis.
3. Impor master/invoice dari sumber privat, mapping, dry-run, review error dan commit terotorisasi; lihat SOP. Mengedit CSV asli atau mengganti cutoff setelah review membutuhkan validasi ulang.
4. Buka **Penjualan → Target & pencapaian**: bottom-up customer/rep atau top-down berbasis histori. Periksa leaf, reserve, parent, periode/kanal dan baseline. Submit dan approval oleh aktor berbeda.
5. **Analitik → Insentif**: tentukan model/tier/ambang, simulasikan batas, submit/review, lalu kalkulasi dengan cutoff lengkap. Review flag sebelum finalisasi manual. Contoh 80% + bonus, marginal 1%, di atas 100% marginal 2% harus diverifikasi melalui simulasi. Ini tidak memberi 2% ke seluruh omzet secara otomatis.
6. Perubahan setelah statement final dibuat melalui revision/delta dan alasan. Settlement merupakan pencatatan konfirmasi finance; NYALES tidak mentransfer uang/payroll otomatis.
7. Gunakan audit untuk actor, timestamp, resource, versi dan alasan. Sesi perangkat, kesehatan sistem dan recovery hanya untuk pengelola yang diberi akses; provider quota unknown tidak boleh diisi angka karangan.

## Agenda fasilitator

Durasi usulan total 150 menit, dapat dibagi per peran: orientasi/scope 15; customer/owner/target dan dummy 25; lapangan/offline/GPS 30; telesales/DNC/callback 25; invoice/retur/insentif 30; incident/handover dan evaluasi 25. Ini agenda latihan, bukan SLA atau kewajiban visit manajer.

Sebelum sesi, fasilitator menyiapkan lingkungan uji, identitas uji terpisah, versi build, file dummy, kasus latihan dan cara merekam evidence. Jangan mengunggah dummy ke organisasi bisnis tanpa lingkungan latihan yang jelas. Dataset JSON dibuat otomatis pada SQLite in-memory melalui `npm run pilot:demo`; tidak muncul otomatis di preview utama.

Jalankan kasus di register dengan peserta sesuai role. Setiap kasus harus mencatat pelaksana, evaluator, waktu, hasil dan tautan evidence. Kegagalan dicatat sebagai defect, diperbaiki lalu retest. Jangan menyalin hasil API dummy sebagai hasil peserta.

## Angka kontrol latihan

20 customer, 20 assignment, 10 sales (8 field/2 telesales), 80 invoice Juni–September, 4 credit. September: 18 invoice eligible dan 2 excluded, actual **Rp36.520.000** (field Rp30.840.000; telesales Rp5.680.000). Total net histori Rp163.720.000; credit Rp200.000. Target leaf approved Rp80.000.000 dan reserve Rp200.000; reserve tidak menambah leaf achievement. Angka dapat diperiksa di `SUMMARY.json` hasil rehearsal. Semua adalah simulasi, termasuk persetujuan oleh dua aktor dummy.

## Syarat training selesai

Seluruh kasus wajib memiliki hasil pass dan evidence sesuai peserta/role; defect kritis data/akses selesai; petugas L1/L2/Finance ditunjuk dan menerima tugas; pengelola menerima source/config/provider ownership serta prosedur recovery melalui saluran aman. Evaluator dan PIC mencatat persetujuan sendiri. Materi siap bukan berarti syarat ini sudah terlaksana.
