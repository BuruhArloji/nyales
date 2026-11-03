# PRD Aplikasi Pengelolaan Sales Lapangan dan Telesales

Versi 1.10 | 18 Oktober 2026 | Bahasa Indonesia

Pembaruan versi 1.10 menyelaraskan aturan bisnis, ERD v1.2, kontrak API v1.2 dan backlog v1.2 setelah audit lintas dokumen. Keputusan yang sudah disepakati menjadi acuan tunggal; default teknis dan parameter pilot diberi label, serta implementasi belum dinyatakan selesai. Scope web pertama, arah stack Cloudflare, dan rancangan data tetap menjadi dasar pembangunan. Android dibangun setelah web stabil; prioritas biaya free tier tetap berlaku. Batas tanpa routing berlaku untuk rilis web awal dan GIS WEB-063–068; perluasan Plan Visit Generator disepakati 23 Oktober 2026 pada bagian 22.6 dan WEB-069–074, masih Planned.

Dokumen kebutuhan produk untuk product owner, sales manager, tim desain, engineering, QA, dan tim implementasi. Nama produk: **NYALES**.

## Perubahan arsitektur pelanggan

Keputusan 18 Oktober 2026: pelanggan/toko adalah entitas utama, satu pelanggan = satu lokasi. Lapisan Account bisnis/legal dihapus dari schema aktif, UI, API dan import. Kontak, assignment kanal, transaksi, target dan histori mengacu langsung ke pelanggan. Kode ERP opsional pada input manual, wajib dan unik dalam organisasi untuk import pelanggan. Pengaturan tetap hanya Management/NSM. Istilah account untuk identitas login, kuota provider atau Android developer tidak berarti entitas pelanggan.

Migrasi lokal 0017 menyimpan master dan relasi Account lama sebagai snapshot audit, menghapus tabel account/kolom account_id, dan mewajibkan validasi ulang batch import pelanggan lama. Dokumen ini menggantikan baseline sebelumnya untuk arsitektur pelanggan; status produksi tetap terpisah.

## 1 Keputusan produk

Bangun satu aplikasi untuk merencanakan pekerjaan sales, mencatat interaksi pelanggan, mengendalikan follow-up, dan mengukur hasil penjualan dari sales lapangan maupun telesales. Supervisor harus dapat mengetahui pelanggan mana yang belum disentuh, pekerjaan mana yang tertunda, kualitas aktivitas yang dilakukan, serta tindakan yang diperlukan agar peluang bergerak menjadi order.

Pusat produk adalah **pelanggan, pekerjaan berikutnya, dan hasilnya**. Lokasi dan jumlah panggilan menjadi bukti pendukung. Keduanya tidak cukup untuk menyimpulkan kualitas kerja atau keberhasilan penjualan.

Keputusan utama:

- Satu customer master dan timeline untuk seluruh kanal, dengan owner pelanggan dan penanggung jawab aktivitas yang dapat berbeda.
- Pekerjaan harian berasal dari territory, jadwal kunjungan, campaign, callback, dan follow-up yang jatuh tempo.
- Sales wajib mencatat outcome yang terstruktur dan next action ketika tindak lanjut masih diperlukan.
- Aktivitas manual, bukti perangkat, dan transaksi ERP mempunyai status verifikasi yang berbeda dan terlihat jelas.
- MVP mengutamakan coverage, kunjungan, telesales, follow-up, pipeline, order sederhana, dan penanganan exception.
- Model insentif dikaitkan dengan target dan realisasi yang tervalidasi. Tarif, jenjang, basis hitung, serta ketentuan dipilih pengguna berwenang melalui konfigurasi dan simulasi sebelum aktivasi.
- Android native dan tracking sesi kerja dibangun setelah web serta API stabil. Perekaman panggilan dan AI tetap tahap lanjutan. Perhitungan rute jalan, ETA, map matching, dan optimasi urutan kunjungan tidak masuk scope saat ini.

### 1.1 Fokus pengelolaan kedua tim

Setiap fitur harus membantu sales lapangan melayani outlet, membantu telesales mengelola kontak dan callback, atau membantu supervisor mengarahkan kedua tim. Forecast harus berakhir pada daftar tindakan dengan pelanggan, PIC, dan tenggat. Dashboard tanpa penelusuran ke pekerjaan sales belum memenuhi kebutuhan ini.

Stok, invoice, kredit, dan status tagihan merupakan konteks untuk menjual dan melayani pelanggan. Pengadaan, operasional gudang, akuntansi, payroll, dan perencanaan produksi tidak dibangun dalam produk ini. Kontrol komersial tambahan pada bagian 30 tetap bersifat pendukung dan tidak memperluas aplikasi menjadi ERP.

### 1.2 Posisi terhadap referensi Lystloc dan Zoho

Lystloc menjadi referensi untuk penggabungan tracking, CRM, aktivitas, dan laporan. Pemeriksaan langsung mengonfirmasi menu utama pada halaman home dan pemisahan aplikasi web lama dengan halaman login v3. Dokumentasi resmi menjadi referensi untuk konsep attendance, kunjungan, task, dan route history. Rincian cara kerja backend Lystloc tidak digunakan sebagai fakta implementasi produk ini.

Zoho menjadi referensi tambahan untuk cara supervisor membaca aktivitas, peluang, target, serta forecast. Pada sesi Chrome yang ditunjuk pengguna, menu Deals, Forecasts, Reports, Analytics, Tasks, Meetings, dan Calls terlihat. Isi modul tidak dapat diperiksa karena halaman mengalami error pemuatan; konfigurasi serta angka forecast akun tersebut belum terverifikasi. Referensi forecast menggunakan dokumentasi resmi Zoho [6–8], sementara aturan operasional dan formula di bagian 16 merupakan rancangan produk kita.

Fitur dan aturan dalam PRD ini adalah rancangan produk yang diusulkan. Antrean telesales, handoff antar kanal, definisi KPI, dan tahapan implementasi merupakan keputusan desain untuk kebutuhan pengelolaan sales.

## 2 Masalah yang diselesaikan

1. Rencana kunjungan, daftar pelanggan, percakapan, dan order tersebar sehingga supervisor sulit melihat progres yang sebenarnya.
2. Jumlah kunjungan atau panggilan tinggi belum tentu menghasilkan coverage, peluang berkualitas, atau repeat order.
3. Follow-up sering hilang karena tidak ada tanggal, penanggung jawab, dan pengingat yang jelas.
4. Pelanggan dihubungi berulang oleh sales lapangan dan telesales tanpa koordinasi.
5. Catatan aktivitas tidak lengkap dan status seperti sudah dihubungi, berminat, serta berhasil order digunakan secara tidak konsisten.
6. Order yang masih berupa permintaan sales dianggap sudah menjadi penjualan, padahal mungkin belum disetujui, diterima ERP, atau ditagihkan.
7. Supervisor terlambat mengetahui kunjungan bermasalah, pelanggan dorman, callback terlewat, dan pipeline yang berhenti.
8. Area tanpa sinyal mengakibatkan pencatatan tertunda dan laporan tidak menggambarkan waktu kejadian sebenarnya.

## 3 Tujuan dan ukuran keberhasilan

### 3.1 Tujuan bisnis

Meningkatkan coverage pelanggan yang relevan, ketepatan follow-up, kualitas pipeline, serta konversi menjadi transaksi yang tervalidasi. Mengurangi pekerjaan administratif dan membuat coaching supervisor berdasarkan konteks.

### 3.2 Target pilot yang diusulkan

Target berikut merupakan kriteria awal produk, bukan hasil yang sudah dicapai. Baseline dikumpulkan selama dua minggu sebelum pilot; evaluasi dilakukan setelah empat minggu pemakaian stabil. Bila volume kecil, tampilkan jumlah absolut bersama persentase.

| Ukuran | Target pilot | Cara evaluasi |
| --- | --- | --- |
| Pengguna aktif mingguan | Minimal 85% pengguna yang dijadwalkan bekerja | Aktivitas kerja bermakna, bukan sekadar membuka aplikasi |
| Follow-up selesai tepat waktu | Minimal 90% | Task jatuh tempo yang tidak dibatalkan secara sah |
| Kelengkapan outcome | Minimal 95% aktivitas selesai | Field wajib sesuai jenis aktivitas |
| Coverage pelanggan jatuh tempo | Naik 10 poin persentase dari baseline | Customer unik dengan interaksi yang memenuhi syarat |
| Waktu administrasi sales | Turun minimal 25% dari baseline | Sampel time study dengan metode yang sama |
| Duplikasi order dari retry | Nol | Uji jaringan buruk dan audit transaksi pilot |
| Rekonsiliasi order terintegrasi | 100% memiliki status yang dapat ditelusuri | Diterima, ditolak, atau masih menunggu; tidak ada status hilang |
| Efek samping operasional | Keluhan kontak berulang tidak meningkat | Complaint rate dan suppression log |

Revenue menjadi ukuran bisnis lanjutan, tetapi belum dipakai sebagai satu-satunya ukuran sukses pilot karena dipengaruhi harga, stok, musim, dan komposisi pelanggan.

## 4 Asumsi dan batas produk

Rancangan awal ditujukan untuk perusahaan distribusi atau penjualan B2B dengan beberapa cabang, territory, dan supervisor. Produk tetap dapat disesuaikan untuk industri lain melalui konfigurasi field dan pipeline.

- Pelanggan/toko adalah entitas utama; satu record mewakili satu lokasi dan dapat mempunyai beberapa contact person. Tidak ada entitas induk Account bisnis/legal.
- Web responsif dibangun terlebih dahulu untuk supervisor, telesales, serta alur lapangan dasar. Setelah web dan API stabil, sales lapangan memakai aplikasi Android native. Antarmuka mobile wajib nyaman dipakai satu tangan; tracking kontinu tidak dijanjikan pada tahap web.
- Satu organisasi merupakan batas isolasi data. Cabang, team, territory, dan role membatasi akses di dalam organisasi.
- Bahasa utama Indonesia, mata uang awal IDR, tanggal ditampilkan sesuai zona waktu cabang. Waktu disimpan dalam UTC beserta zona waktu kejadian.
- Skala desain awal bisnis: sampai 500 pengguna aktif harian, 100.000 pelanggan, dan 50.000 event aktivitas per hari per organisasi. GPS dihitung terpisah dari event bisnis. Angka tersebut merupakan target pengujian setelah capacity planning, bukan janji seluruh skala dapat berjalan pada paket gratis.
- Sumber ERP, telephony dan WhatsApp Business belum ditetapkan. Baseline peta Geoapify/MapLibre telah dipilih pada bagian 22.3. Produk harus tetap berfungsi untuk alur inti saat integrasi opsional belum tersedia.
- Integrasi ERP SUKE dapat dipertimbangkan, tetapi PRD ini tidak mengasumsikan perubahan pada ERP atau proyek yang sudah ada.

## 5 Pengguna dan hak akses

| Peran | Pekerjaan utama | Batas akses default |
| --- | --- | --- |
| Sales lapangan | Kunjungan, prospecting, order, follow-up | Pelanggan dan task yang ditugaskan; histori relevan sesuai izin |
| Telesales | Antrean kontak, callback, qualification, order jarak jauh | Campaign dan pelanggan yang ditugaskan |
| Supervisor lapangan | Coverage, rencana, exception, coaching | Team dan territory bawahannya |
| Supervisor telesales | Queue, kualitas panggilan, workload | Team dan campaign bawahannya |
| Area Manager | Target, pipeline, distribusi customer, dan kinerja beberapa team/area | Area dan team yang menjadi tanggung jawabnya |
| Management | Pengaturan organisasi, target, actual, insentif, akses, dan laporan lintas area | Seluruh organisasi sesuai kebijakan |
| Sales operations | Menyiapkan data dan review rekonsiliasi | Read/review sesuai scope; tidak otomatis mendapat hak konfigurasi bisnis |
| Finance | Review sumber invoice, retur dan hasil insentif | Read/review sesuai scope; final approval bisnis tetap Management/NSM |
| Administrator | Pengguna, role, konfigurasi dan integrasi | Administrasi teknis sesuai organisasi; pengaturan bisnis sensitif tetap berizin |
| Auditor | Pemeriksaan histori dan kontrol | Read-only, periode dan ruang lingkup tertentu |

Izin dipisahkan menjadi lihat, tambah, ubah, ajukan, setujui, ekspor, dan konfigurasi. Semua pengaturan di luar pencatatan kunjungan—termasuk master customer, assignment, target, actual, insentif, role, integrasi, dan parameter laporan—hanya dapat diubah oleh Management/national sales manager tanpa perluasan hak konfigurasi otomatis ke role operasional. Supervisor dan Area Manager bekerja melalui scope hirarkinya; Area Manager hanya melihat area sendiri; Sales Rep hanya mencatat pekerjaan, outcome, dan data yang ditugaskan. Telesales merupakan kanal terpisah dari sales lapangan dan memiliki assignment, queue, KPI, serta target kanal sendiri. Akses lintas area dan seluruh pengaturan organisasi hanya tersedia bagi Management/national sales manager. Izin ekspor pelanggan, melihat koordinat rinci, serta mendengar rekaman tidak otomatis mengikuti izin melihat dashboard.

**RBAC-01:** backend memeriksa organisasi dan scope setiap request, termasuk pencarian, laporan, attachment, ekspor, dan webhook. Menyembunyikan menu di frontend tidak dianggap kontrol akses.

**RBAC-02:** approver tidak boleh menyetujui pengajuannya sendiri. Bila jumlah orang terbatas, eskalasi ke approver alternatif yang ditetapkan organisasi dan tercatat di audit log.

**RBAC-03:** perpindahan team atau territory mempunyai tanggal efektif. Hak akses aktif mengikuti penugasan baru; histori atribusi aktivitas tidak diubah secara diam-diam.

## 6 Ruang lingkup dan prioritas

P0 berarti wajib sebelum pilot web operasional. P1 berarti pengembangan setelah fondasi web stabil. P2 berarti optimasi lanjutan. Kebutuhan Android berkode AND pada bagian 27 menjadi syarat rilis Android, bukan syarat memulai pilot web. Pengembangan Android dimulai setelah exit gate web dipenuhi.

| Area | P0 | P1 | P2 |
| --- | --- | --- | --- |
| Master pelanggan | Pelanggan/toko, kontak, owner, territory, deduplikasi | Enrichment pelanggan | Skoring potensi adaptif |
| Sales lapangan | Web responsif, rencana, check-in/out dan form hasil | Android native, offline serta visualisasi GPS | Penyempurnaan kualitas dan efisiensi tracking |
| Telesales | Queue, click-to-call, outcome, callback, suppression | CTI terverifikasi dan QA rekaman | Coaching bantuan AI |
| Koordinasi kanal | Shared timeline, handoff, contact cooldown | Cadence lintas kanal | Rekomendasi kanal berikutnya |
| Penjualan | Lead, opportunity, draft order, approval | Quotation, integrasi ERP otomatis, repeat order | Forecast lebih lanjut |
| Supervisor | Exception inbox, coverage, target, forecast dasar, coaching task | Snapshot forecast, review mingguan, analisis cohort | Rekomendasi tindakan |
| Operasional | Audit, import, rekonsiliasi, monitoring | Klaim pendukung | Optimasi biaya |
| Insentif sales | Konfigurasi target-linked, flat, tier seluruh basis, tier progresif, bonus milestone, simulasi dan review | Per unit, scorecard, pool team, integrasi payroll | Bantuan analisis efektivitas skema |

Di luar scope awal: penggajian penuh, pengelolaan gudang, akuntansi, predictive dialer, penyadapan panggilan, pelacakan di luar jam kerja, keputusan disipliner otomatis, dan pengiriman broadcast tanpa pengaturan izin kontak.

### 6.1 Scope minimum rilis web pertama yang disepakati

Keputusan pengguna pada 16 Oktober 2026: web pertama harus dapat dipakai untuk memantau distribusi customer, penjualan, target, serta tenaga sales lapangan dan telesales. Keempat area ini merupakan satu rilis operasional yang saling terhubung. Bagian ini memperjelas hasil minimum rilis, bukan menghapus kebutuhan P0 pada tabel di atas. Pemecahan implementasi internal diperbolehkan; rilis pertama baru diterima setelah keempat area berfungsi dari data sumber sampai dashboard.

Distribusi customer pada scope ini berarti persebaran geografis, pembagian owner/territory, dan pemerataan beban layanan pelanggan. Ini tidak berarti pengiriman barang atau optimasi rute logistik.

| Area wajib | Kemampuan web pertama | Bukti penerimaan |
| --- | --- | --- |
| Distribusi customer | Import/input pelanggan/toko dan kontak; pengaturan cabang, territory, owner utama serta pelaksana kanal; tabel dan peta pelanggan; filter assigned/unassigned dan histori reassignment | Supervisor dapat menemukan pelanggan tanpa PIC, melihat pembagian dan mengajukan kebutuhan perubahan; Management/NSM menetapkan atau memindahkan assignment dengan histori efektif |
| Penjualan | Input atau import transaksi terkontrol, draft order dan konfirmasi backoffice, detail produk/nilai/tanggal/sales/customer, pembatalan dan retur sebagai revisi/penyesuaian | Total dashboard dapat ditelusuri ke transaksi valid; draft tidak tercampur actual; import ulang tidak menggandakan realisasi |
| Target | Input target per periode, sales, team, territory atau kelompok produk; validasi dan pengesahan; achievement, gap dan forecast dasar | Target tersahkan dibandingkan actual dengan unit, basis transaksi dan periode yang sama; agregasi parent/child tidak dihitung ganda |
| Tenaga sales | Administrasi user, role, team, supervisor, assignment; agenda/visit/outcome lapangan; antrean/outcome/callback telesales; handoff, task dan exception | Supervisor dapat melihat beban, pelanggan yang ditangani, aktivitas, penjualan, target, serta pekerjaan tertunda tiap sales sesuai scope akses |

Layar wajib: dashboard supervisor, daftar/peta pelanggan, customer detail dan timeline, distribusi assignment, master sales/team, agenda lapangan, workbench telesales, transaksi dan import penjualan, pengaturan target, realisasi/forecast, konfigurasi/simulasi insentif P0, serta audit/exception. Filter bersama minimal periode, cabang, team, sales, territory, dan kanal bila relevan. Tampilkan sumber serta waktu pembaruan data, dan bedakan nilai kosong dari nol.

Web dapat berjalan sebelum integrasi ERP otomatis tersedia. Management/NSM memasukkan atau mengimpor realisasi; backoffice menyiapkan dan memeriksa file dengan referensi sumber unik, tanggal bisnis, basis transaksi, dan status validasi. Transaksi dari ERP dan input manual tidak boleh dihitung bersamaan untuk kejadian yang sama. Source mapping dan rekonsiliasi dilakukan sebelum beralih ke integrasi otomatis.

Peta pelanggan dan lokasi check-in/out tersedia pada web pertama. Marker posisi sales menunjukkan lokasi terakhir yang benar-benar diterima, dengan waktu dan akurasi; label sumber membedakan check-in web dari tracking Android. Pelanggan tanpa koordinat tetap muncul pada daftar dan antrean perbaikan, tidak dihilangkan dari total. Tracking latar belakang dan garis GPS kontinu baru diaktifkan setelah tahap Android. Web tidak menyimpulkan posisi saat ini hanya dari assignment atau agenda.

Gate penerimaan rilis web: data pilot telah diimport dan direkonsiliasi; supervisor dapat menjalankan keempat skenario di atas; sales lapangan dan telesales dapat mencatat pekerjaan melalui web; angka target/actual dapat ditelusuri ke sumber; uji akses lintas scope lulus; serta UAT P0 dan gate web pada bagian 26 dipenuhi. Mock data atau dashboard statis belum memenuhi gate ini.

## 7 Alur kerja utama

### 7.1 Hari kerja sales lapangan

1. Sales membuka agenda dan melihat pelanggan prioritas, callback hasil handoff, urutan agenda manual, stok informatif, serta target.
2. Sales memulai sesi kerja. Aplikasi menjelaskan status izin lokasi dan status sinkronisasi.
3. Sales menuju outlet, membuka konteks pelanggan, lalu check-in. Sistem menyimpan koordinat, akurasi, waktu perangkat, dan waktu terima server.
4. Sales memilih tujuan kunjungan, mencatat hasil, kebutuhan produk, keberatan, foto bila relevan, serta order atau peluang.
5. Saat checkout, sistem memvalidasi field wajib dan meminta next action jika proses belum selesai.
6. Jika sinyal terputus, aktivitas disimpan lokal dengan status menunggu sinkronisasi. Sales tetap dapat melanjutkan pekerjaan yang didukung offline.
7. Akhir hari, sales melihat pekerjaan yang belum selesai dan menutup sesi. Supervisor menerima exception yang perlu ditindaklanjuti.

### 7.2 Hari kerja telesales

1. Agent masuk ke workbench dan melihat callback jatuh tempo, customer prioritas, serta campaign aktif.
2. Sistem mengambil satu pelanggan yang eligible dan memberi assignment sementara agar tidak dikerjakan agent lain pada waktu yang sama.
3. Agent membaca histori kunjungan, order, keluhan, preferensi kontak, dan script yang berlaku.
4. Agent memulai panggilan melalui click-to-call atau integrasi telephony bila tersedia.
5. Setelah panggilan, agent mencatat disposition, ringkasan, hasil qualification, dan next action.
6. Jika diperlukan kunjungan fisik, agent membuat handoff kepada sales lapangan dengan konteks dan tenggat.
7. Supervisor melihat antrean menua, callback terlambat, kualitas outcome, dan konversi; bukan hanya banyaknya dial.

### 7.3 Handoff telesales ke lapangan

Telesales menemukan kebutuhan atau memperoleh janji kunjungan. Handoff membawa pelanggan, contact person, kebutuhan, produk, waktu yang disepakati, catatan, dan alasan kunjungan. Sales penerima menerima atau menolak dengan alasan. Setelah diterima, task kunjungan terbentuk dan timeline pelanggan diperbarui. Owner pelanggan tidak berpindah otomatis.

### 7.4 Follow-up setelah kunjungan

Sales lapangan menandai kebutuhan follow-up jarak jauh, misalnya konfirmasi stok atau pengiriman quotation. Telesales menerima task dengan tenggat dan konteks. Task selesai setelah outcome dicatat; bila pelanggan meminta tidak dihubungi, suppression berlaku lintas kanal sesuai cakupannya.

### 7.5 Penanganan exception supervisor

Supervisor membuka exception inbox, melihat konteks, memberi penanggung jawab dan batas waktu, lalu memilih tindakan: klarifikasi, perbaikan data, penjadwalan ulang, approval, atau coaching. Menutup exception harus mencatat hasil. Aktivitas sumber tetap disimpan.

### 7.6 Alur target sampai insentif

Manager menetapkan dan membagi target. Sales ops memilih model insentif, mengisi tarif/jenjang, mengatur sumber realisasi serta penerima, dan menjalankan simulasi. Approver meninjau target dan skema sebelum aktivasi. Sales lapangan dan telesales menjalankan rencana serta melihat progres target dan estimasi insentif mereka.

Pada cutoff periode, sales ops/finance mereview realisasi; Management/NSM menjalankan kalkulasi serta finalisasi manual. Sales dapat mengajukan keberatan; supervisor dan finance meninjau hasil. Statement yang disetujui dikunci dan dapat diekspor untuk proses pembayaran. Status dibayar hanya berubah setelah ada konfirmasi dari proses pembayaran terkait. Koreksi berikutnya berupa adjustment yang dapat ditelusuri.

## 8 Customer master dan territory

**CUS-01 P0 — Struktur pelanggan.** Gunakan pelanggan/toko sebagai entitas utama satu lokasi dan pisahkan contact person. Tidak ada tabel atau relasi induk Account bisnis/legal. Field inti pelanggan: ID internal, kode ERP opsional, nama, tipe/channel, alamat, koordinat, status koordinat, territory, segmentasi, owner, frekuensi layanan, jam menerima kunjungan, dan status aktif. Kontak memiliki nomor ternormalisasi, peran, preferensi kanal, dan status izin kontak.

**CUS-02 P0 — Deduplikasi.** Exact match kode ERP di dalam organisasi harus unik. Nomor telepon yang sama tidak otomatis berarti pelanggan sama karena beberapa outlet dapat berbagi nomor. Kandidat duplikat ditampilkan berdasarkan kombinasi nama, alamat, nomor, dan kedekatan lokasi; merge membutuhkan review. Merge mempertahankan alias ID dan hubungan histori, tidak menghapus transaksi.

**CUS-03 P0 — Ownership.** Simpan area, Supervisor, customer owner, activity assignee, dan supporting telesales sebagai relasi terpisah. Sales Rep dapat melihat pelanggan dalam area atau yang diassign; pencatatan aktivitas dan atribusi transaksi tetap mengikuti scope pribadi serta kanal. Setiap Sales Rep memiliki tepat satu Supervisor aktif pada satu assignment efektif. Setiap customer/outlet terikat ke satu lokasi dan area. Customer baru dapat unassigned dan masuk exception; jika owner primer sudah ditetapkan, hanya satu owner aktif pada satu waktu. Penugasan bantuan tidak menggandakan target pelanggan. Transfer owner atau area menyimpan tanggal efektif, alasan, dan pihak yang melakukan perubahan. Sales Rep memperoleh kredit kinerja dari customer yang diassign atau invoice yang secara eksplisit membawa Sales Rep pada areanya; telesales tidak menjadi owner lapangan dan kontribusinya dicatat pada kanal telesales terpisah; Supervisor dan Area Manager tidak wajib visit dan hanya memiliki aktivitas lapangan bila ditugaskan atau dipilih sebagai opsional.

**CUS-04 P0 — Territory dan coverage.** Keputusan 22 Oktober 2026: pembagian awal wilayah menggunakan batas administrasi **kelurahan**, atau **desa** pada wilayah yang menggunakan desa. Area sales dapat mencakup satu atau beberapa kelurahan/desa; area bisnis tetap berbeda dari kode wilayah administrasi. Polygon berasal dari dataset batas administrasi berversi, bukan gambar bebas sebagai syarat awal. Management/NSM memilih wilayah, meninjau usulan pemetaan pelanggan dan membagi assignment sales dengan tanggal efektif. Daftar outlet tetap tersedia untuk review dan pengecualian beralasan. Frekuensi kunjungan disetel per segmen atau outlet. Jadwal mempertimbangkan hari kerja, jam buka, kapasitas sales, dan pelanggan yang meminta tidak dikunjungi pada periode tertentu. Rincian kebutuhan dan acceptance ada pada [addendum wilayah administrasi](GIS_Admin_Kelurahan_v1.md). Pembaruan 23 Oktober: fondasi master/versioning WEB-063 tersedia lokal; overlay/pemetaan dan pembagian WEB-064/065 tetap Planned. Sumber nyata sampel tetap draft sampai metadata/namespace/hak penggunaan direview.

Sumber awal batas administrasi yang dipilih pada 22 Oktober 2026 adalah **file batas desa/kelurahan Indonesia**, dari layer [ADMINISTRASI_DESAKELURAHAN_AR di Geoportal Kementerian Pertanian](https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0), dengan sumber BIG dan acuan Semester 1 Tahun 2025 menurut metadata. Gunakan snapshot GeoJSON berversi untuk overlay dan pemetaan pelanggan; simpan provenance, cakupan dan checksum. Metadata/namespace/lisensi divalidasi sebelum aktivasi. Sumber sudah dipilih, tetapi file belum diunduh atau diimpor; detail pada addendum GEO-02.

Pembaruan UI/UX dan analitik 22 Oktober 2026: GIS disematkan pada Peta & Wilayah (kelompok Pelanggan), ringkasan Overview/Monitoring serta Distribusi sales, tanpa kelompok sidebar GIS baru. WEB-064/065 mencakup overlay, panel/filter/drill-down dan preview pembagian awal. WEB-066 menambahkan kinerja/coverage per kelurahan; WEB-067 risiko pelanggan; WEB-068 pemerataan beban dan simulasi. Analitik M4 extension P1 ini tidak menjadi gate otomatis staging/login atau pilot tim. Definisi metrik/target, histori, data unknown, UX mobile/aksesibilitas dan acceptance tambahan mengikuti [GIS UI/UX dan analitik](GIS_UX_dan_Analitik_v1.md). Semua perluasan masih Planned.

**CUS-05 P0 — Customer 360.** Satu halaman menampilkan interaksi lintas kanal, next action, peluang, order, histori transaksi yang tersedia, keluhan, serta status tagihan informatif bila terintegrasi. Setiap informasi menampilkan sumber dan waktu pembaruan.

**CUS-06 P0 — Status aktivitas customer.** Pada cut-off tanggal bisnis D, customer aktif bila ada invoice eligible dengan umur 0–90 hari (tanggal invoice >= D minus 90 hari dan <= D). Umur 91 hari menjadi Churn jika pernah invoice. Customer belum pernah invoice berstatus New; data sumber belum lengkap berstatus Unknown/provisional, bukan otomatis Churn. Invoice cancelled dikecualikan. Retur mengurangi nilai sales; invoice sah yang kemudian diretur tetap bukti pernah bertransaksi kecuali sumber membatalkan invoice. High/Mid/Low adalah dimensi terpisah berbasis nilai invoice net pada window sama, dengan metode nominal/percentile/custom rule yang dapat dikonfigurasi Management. Metode, parameter, cutoff, cakupan cohort dan rule version dibekukan dalam snapshot.

Acceptance: import dua baris dengan kode ERP sama menghasilkan satu record valid dan satu error yang dapat diperbaiki; dua outlet dengan nomor bersama tetap dapat dibuat setelah review; perubahan owner tidak mengubah nama sales pada order historis; fixture menunjukkan customer aktif tepat umur 90 hari, Churn umur 91 hari, dan New bila belum pernah invoice; tier High/Mid/Low dapat ditelusuri ke versi aturan.

## 9 Perencanaan dan kontrol sales lapangan

**FLD-01 P0 — Agenda dan beat plan.** Supervisor membuat rencana mingguan atau berulang. Sales dapat mengusulkan tambahan, penggantian, atau reschedule dengan alasan. Sistem menyimpan versi rencana yang disetujui dan perubahan selanjutnya. Rencana yang telah jatuh tempo tidak boleh diubah untuk memperbaiki KPI secara retroaktif.

**FLD-02 P0 — Check-in dan checkout.** Satu visit mempunyai satu outlet, sales, waktu mulai, waktu selesai, tujuan, dan outcome. Default satu visit aktif per sales. Kunjungan tidak terencana diizinkan dengan alasan. Status kunjungan dan status validasi bukti disimpan terpisah.

**FLD-03 P0 — Validasi lokasi.** Parameter awal yang dapat dikonfigurasi: radius outlet 150 meter, akurasi GPS maksimum 100 meter, dan flag waktu perangkat bila selisih dari server lebih dari lima menit. Parameter adalah default pilot, bukan jaminan akurasi GPS. Koordinat outlet yang belum diverifikasi menghasilkan kebutuhan review.

Check-in di dalam radius dengan akurasi memadai dapat diberi status lokasi sesuai. GPS buruk, izin ditolak, atau lokasi di luar radius menghasilkan exception dengan alasan dan bukti alternatif; tidak langsung diberi label curang. Validasi server mempertimbangkan jarak dan ketidakpastian akurasi. Bila kebijakan hard block diterapkan, sales dapat menyimpan percobaan dan meminta override supervisor.

**FLD-04 P0 — Form hasil.** Outcome minimal: bertemu dan berminat, bertemu belum berminat, order dibuat, follow-up diperlukan, toko tutup, PIC tidak ada, alamat salah, pelanggan menolak, atau batal. Field wajib menyesuaikan outcome. Foto, stok outlet, display, kompetitor, dan survey adalah template opsional sesuai jenis kunjungan.

**FLD-05 P0 — Check-out terlupa.** Reminder muncul setelah durasi yang dikonfigurasi. Penutupan sesi kerja meminta penyelesaian atau pengajuan koreksi visit aktif. Penutupan oleh supervisor menjadi koreksi yang dapat diaudit; waktu otomatis tidak dianggap durasi yang teramati.

**FLD-06 P0 — Kehadiran sederhana.** Mulai dan akhir sesi kerja ditampilkan terpisah dari durasi kunjungan dan hasil penjualan. Cuti, training, dan tugas non-sales dikecualikan dari beban layanan sesuai kode aktivitas yang disetujui. Produk tidak menghitung payroll pada MVP.

**FLD-07 P1 — Live location.** Tracking native hanya berjalan pada sesi kerja dan izin yang sesuai. Tampilkan last seen, akurasi, sumber, dan status stale; titik terakhir tidak diberi label live bila sudah kedaluwarsa. Tidak ada pengumpulan lokasi di luar sesi kerja oleh desain produk. Berhenti tracking harus dapat diverifikasi di sisi perangkat dan server.

**FLD-08 P1 — Jejak GPS.** Tampilkan garis yang menghubungkan titik GPS terekam sesuai waktunya, beserta gap dan status kualitas. Jangan mengklaim garis tersebut mengikuti jalan atau mewakili perjalanan lengkap. Tidak ada routing, ETA, map matching, atau optimasi perjalanan dalam scope jejak GPS/rilis awal ini; Plan Visit Generator merupakan perluasan terpisah pada bagian 22.6. Jarak untuk klaim memerlukan kebijakan terpisah dan tidak otomatis berasal dari panjang garis GPS.

Acceptance: visit offline dapat dicatat dan ditutup; sinkronisasi tidak menggandakan visit. GPS buruk menghasilkan pending review. Foto lama dari galeri diberi label sumber galeri jika diizinkan. Durasi kunjungan tanpa checkout tidak dianggap final.

**FLD-09 P1 - Plan Visit Generator.** Keputusan 23 Oktober 2026: tambahkan usulan agenda harian/bulanan berbasis jaringan jalan, histori penjualan, prioritas/frekuensi layanan, kalender, durasi, jam customer dan kapasitas sales. Routing OSRM dan solver Python OR-Tools berjalan di komputer pribadi melalui agent outbound; hasil wajib direview sebelum publish ke agenda. Rincian PVG-01 sampai PVG-07 pada [addendum generator](Plan_Visit_Generator_v1.md), arsitektur bagian 22.6 dan backlog WEB-069–074. Tidak mengubah batas rilis awal/GIS lama, owner customer atau fakta historis. Status Planned, bukan gate pilot web atau Android.

## 10 Workbench telesales

**TEL-01 P0 — Antrean prioritas.** Urutan default: callback yang dijanjikan, follow-up overdue, lead baru mendekati SLA, pelanggan jatuh tempo reorder, lalu campaign reguler. Tie-breaker menggunakan waktu jatuh tempo dan urutan masuk. Supervisor dapat mengatur prioritas dengan audit; agent tidak bebas memilih hanya lead mudah.

**TEL-02 P0 — Eligibility.** Pelanggan dapat masuk queue bila assigned, berada pada jam kontak yang diizinkan, tidak terkena suppression, tidak sedang dikunci agent lain, dan tidak mempunyai next action yang bertabrakan. Jika syarat gagal, tampilkan alasan. Satu pelanggan dapat memiliki beberapa kontak, tetapi batas frekuensi tetap diperiksa pada level kontak dan pelanggan.

**TEL-03 P0 — Assignment sementara.** Ambil item membuat lease default 15 menit dan diperpanjang selama agent aktif. Saat expired, item hanya dilepas bila tidak ada panggilan terverifikasi yang masih berjalan. Refresh dan double-click tidak membuat assignment ganda. Supervisor dapat melepaskan item dengan alasan.

**TEL-04 P0 — Panggilan manual.** Click-to-call membuka dialer atau aplikasi yang didukung. Aktivitas berstatus manual dan outcome merupakan deklarasi agent. Membuka dialer tidak membuktikan panggilan tersambung. Durasi yang dimasukkan manual tidak masuk metrik talk time terverifikasi.

**TEL-05 P0 — Disposition.** Pilihan minimal: tidak diangkat, sibuk, nomor tidak valid, tersambung dengan non-PIC, tersambung dengan PIC, callback diminta, tertarik, tidak tertarik, minta kunjungan, order dibuat, keluhan, dan jangan hubungi lagi. Pisahkan status koneksi dari hasil bisnis agar satu panggilan tersambung dapat memiliki outcome callback atau order.

**TEL-06 P0 — Callback.** Callback menyimpan waktu, zona waktu pelanggan, penanggung jawab, alasan, dan kontak. Default toleransi tepat waktu 15 menit dari waktu janji. Reschedule menyimpan histori; reschedule setelah overdue tidak menghapus keterlambatan awal. Agent harus memilih slot alternatif saat waktu janji berada di luar jam layanan.

**TEL-07 P0 — Cadence dan batas kontak.** Default pilot maksimal tiga attempt telepon per kontak per hari dan cooldown dua jam setelah tidak diangkat. Callback yang diminta pelanggan dapat menjadi pengecualian dengan alasan. Kebijakan berlaku lintas campaign; kontak berstatus jangan hubungi lagi dikeluarkan dari queue berikutnya. Pesan layanan dan keluhan memiliki tujuan serta aturan terpisah dari penjualan.

**TEL-08 P0 — Script dan qualification.** Script membantu pembukaan, verifikasi PIC, kebutuhan, produk, keberatan, dan penutupan. Qualification minimum mencatat kebutuhan, potensi, waktu pembelian, serta next action. Data yang belum diketahui diisi tidak diketahui, tidak dipaksa menjadi jawaban palsu.

**TEL-09 P1 — CTI.** Integrasi provider mengirim call ID, agent, tujuan, direction, status, waktu ring, connect, end, dan status final. Event provider menjadi sumber status teknis. Webhook harus tervalidasi, deduplikatif, dan tahan terhadap urutan event yang terbalik.

**TEL-10 P1 — Rekaman dan QA.** Rekaman hanya tersedia bila kebijakan dan mekanisme persetujuan yang ditetapkan organisasi terpenuhi. Tampilkan indikator perekaman, role akses, masa simpan, serta audit play/download. Form QA mencakup akurasi informasi, eksplorasi kebutuhan, kesepakatan next action, dan kepatuhan preferensi kontak. Rekaman tidak wajib untuk menjalankan MVP.

Acceptance: dua agent mengambil pelanggan bersamaan menghasilkan satu lease aktif; nomor DNC tidak dapat dihubungi melalui queue; status tersambung manual tidak tampil sebagai provider verified; webhook duplikat tidak menambah attempt; callback terlambat tetap tercatat setelah dijadwal ulang.

## 11 Koordinasi lapangan dan telesales

**COO-01 P0 — Timeline bersama.** Aktivitas menampilkan siapa, kanal, kapan, outcome, bukti, dan next action. Catatan sensitif dapat dibatasi. Tidak semua field pribadi pelanggan perlu ditampilkan lintas team.

**COO-02 P0 — Pencegahan tabrakan.** Tampilkan kunjungan aktif dan callback terjadwal sebelum agent menghubungi pelanggan. Default campaign sales ditahan selama kunjungan aktif dan 60 menit setelahnya, kecuali pelanggan meminta follow-up atau ada kebutuhan layanan yang tercatat.

**COO-03 P0 — Handoff.** Status: draft, submitted, accepted, declined, completed, cancelled. Default SLA menerima handoff empat jam kerja dan melaksanakan sesuai janji pelanggan. Bila ditolak, pengirim mendapat alasan dan item kembali ke supervisor; pekerjaan tidak boleh hilang.

**COO-04 P0 — Atribusi.** Simpan originator, owner saat kejadian, pelaksana, assisting agent, dan sumber order. Nilai order dihitung satu kali pada total organisasi. Kredit kontribusi antar kanal ditampilkan terpisah dari nilai penjualan; pembagian kredit insentif ditetapkan dalam versi skema pada bagian 16.5 dan tidak otomatis mengikuti atribusi pelaporan.

**COO-05 P0 — Kalender pelanggan.** Jadwal kunjungan dan callback dapat dilihat bersama sesuai izin. Perubahan janji memperbarui task terkait melalui workflow yang dapat ditelusuri, bukan membuat task duplikat.

## 12 Lead pipeline dan follow up

**CRM-01 P0 — Lead.** Lead masuk dari input sales, import terkontrol, atau integrasi. Field minimum: sumber, nama pelanggan atau kontak, wilayah, kebutuhan, owner, created_at, dan deadline respons. Lead tidak memenuhi syarat dapat ditutup dengan alasan; data tidak dihapus hanya karena belum berpotensi.

**CRM-02 P0 — Pipeline.** Stage default: New, Contacted, Qualified, Proposal, Negotiation, Won, Lost. Qualified mensyaratkan kebutuhan dan next action; Proposal mensyaratkan nilai dan penawaran atau ringkasannya; Won mensyaratkan referensi order sesuai definisi perusahaan. Lost memerlukan alasan. Pembukaan ulang menyimpan histori.

**CRM-03 P0 — Task.** Task mempunyai jenis, customer, assignee, due_at, prioritas, dan status. Status: open, in progress, completed, cancelled. Completed memerlukan outcome; cancelled memerlukan alasan. Task overdue diturunkan dari due_at, bukan status yang dapat diedit bebas.

**CRM-04 P0 — SLA.** Default pilot respons lead baru empat jam kerja; handoff empat jam kerja; follow-up sesuai janji pelanggan. Kalender SLA mengikuti cabang penanggung jawab dengan hari libur yang ditetapkan. Urgensi dapat dikonfigurasi menurut segmen.

**CRM-05 P0 — Stagnasi.** Opportunity tanpa aktivitas bermakna selama tujuh hari kerja masuk exception. Threshold dapat berbeda per stage. Mengedit judul atau membuka record tidak mereset waktu aktivitas bermakna.

**CRM-06 P0 — Forecast dasar.** Tampilkan estimasi penjualan periode berjalan, basis nilainya, kategori keyakinan, tanggal yang relevan, serta next action per pelanggan. Target, actual, dan forecast dibedakan. Spesifikasi di bagian 16; snapshot formal dan evaluasi akurasi masuk P1.

## 13 Order harga stok dan kredit

**ORD-01 P0 — Draft order.** Sales lapangan maupun telesales dapat membuat order untuk pelanggan/lokasi yang sama. Item menyimpan SKU, quantity, unit, harga satuan, diskon, pajak bila berlaku, dan sumber harga. Quantity harus positif sesuai presisi SKU. Satuan wajib eksplisit; konversi memakai master conversion yang disetujui, bukan asumsi nama unit.

**ORD-02 P0 — Status transaksi.** Status: draft, submitted, pending approval, approved, pending external confirmation, accepted by ERP, rejected, cancelled. Fulfillment, invoice, payment, dan retur disimpan pada dimensi status terpisah. Draft order bukan penjualan aktual.

**ORD-03 P0 — Approval.** Aturan diskon, harga khusus, dan limit kredit dikonfigurasi per perusahaan. Snapshot harga dan versi kebijakan dikunci saat submit. Perubahan komersial setelah approval harus menjadi revisi dan menjalankan approval ulang yang relevan. Status pending tidak boleh dianggap approved saat timeout.

**ORD-04 P0 — Stok dan kredit informatif.** Tampilkan sumber, timestamp, serta freshness. Bila integrasi belum ada, produk tidak menjanjikan stok tersedia atau kredit lolos. Supervisor dapat memutuskan proses pengecualian sesuai izin; tidak ada override tanpa jejak.

**ORD-05 P0 — Idempotensi.** Order memakai client_order_id dan idempotency key. Pengiriman ulang dengan payload sama mengembalikan order yang sama. Payload berubah dengan key lama ditolak. Respons eksternal ambigu menghasilkan status menunggu konfirmasi dan rekonsiliasi sebelum pengiriman baru.

**ORD-06 P0 — Sumber penjualan.** Sebelum ERP terhubung, hanya order yang dikonfirmasi melalui proses backoffice terkontrol masuk metrik confirmed order; label ini bukan invoiced sales. Setelah ERP terhubung, definisi actual sales memakai field dan status transaksi yang disepakati finance. Gross, diskon, retur, pajak, dan net ditampilkan terpisah; formula tidak menganggap field bernama net selalu berarti setelah semua potongan.

**ORD-07 P1 — Repeat order.** Order sebelumnya dapat menjadi template. Harga, promo, stok, unit, dan kredit divalidasi ulang. Data lama tidak langsung dipakai sebagai janji harga terbaru.

## 14 Command center supervisor

**SUP-01 P0 — Ringkasan hari ini.** Tampilkan team bekerja, rencana vs realisasi, coverage unik, pelanggan belum disentuh, callback overdue, order berdasarkan status, dan sinkronisasi tertunda. Setiap kartu membuka daftar sumber yang menjelaskan hitungannya.

**SUP-02 P0 — Exception inbox.** Jenis awal: visit belum checkout, lokasi perlu review, pelanggan jatuh tempo belum disentuh, callback terlewat, lead mendekati SLA, opportunity stagnan, handoff tidak diterima, order menunggu konfirmasi, dan sinkronisasi gagal. Severity berasal dari dampak serta tenggat, bukan penilaian moral terhadap sales.

**SUP-03 P0 — Tindakan.** Supervisor dapat assign, reschedule, meminta klarifikasi, membuat coaching task, menyetujui exception, atau mengeskalasi. Exception mempunyai owner, due_at, status, resolution, dan referensi sumber. Alert yang sama digabung untuk mencegah spam.

**SUP-04 P0 — Coaching.** Catat topik, bukti aktivitas, komitmen perbaikan, dan tanggal review. Sales dapat memberi konteks atau koreksi. Hindari ranking tunggal yang membandingkan territory berbeda tanpa mempertimbangkan potensi dan beban layanan.

**SUP-05 P0 — Drill-down.** Filter tanggal, cabang, team, territory, kanal, owner, segmen, dan status verifikasi. Nilai unknown ditampilkan, tidak otomatis diubah menjadi nol. Ekspor membawa filter, definisi KPI, timezone, waktu pembaruan, dan scope data.

### 14.1 Monitoring yang mengarahkan pekerjaan sales

**SUP-06 P0 — Tiga tampilan supervisor.** Tampilan lapangan memprioritaskan agenda, kunjungan, coverage outlet, hasil, dan order. Tampilan telesales memprioritaskan callback, jangkauan PIC, queue, konversi, dan handoff. Tampilan gabungan menghapus hitung ganda pelanggan serta transaksi dan memperlihatkan kontribusi kedua kanal. Pembandingan pengguna menampilkan hari kerja, segmentasi pelanggan, dan cakupan data yang sama.

**SUP-07 P0 — Hubungan aktivitas dan hasil.** Untuk setiap outlet atau peluang, tampilkan interaksi bermakna terakhir, next action, nilai potensi, hambatan, dan order terkait. Supervisor dapat berpindah dari gap target ke pelanggan prioritas lalu menugaskan kunjungan atau panggilan. Korelasi aktivitas dengan hasil tidak diberi label penyebab otomatis.

**SUP-08 P1 — Pergerakan peluang.** Tampilkan umur stage, perubahan nilai, penundaan tanggal, alasan lost, dan peluang tanpa follow-up. Konversi stage berbasis cohort entry yang tetap; jumlah open hari ini tidak digunakan sebagai denominator konversi historis. Peluang reopened dan event terlambat ditandai.

## 15 KPI dan aturan perhitungan

Semua KPI memakai event yang tidak dibatalkan atau digantikan revisi sah. Tanggal bisnis menggunakan timezone cabang. Jika denominator nol, tampilkan tidak berlaku. Aktivitas manual dan verified dapat difilter dan dibandingkan; totalnya tidak boleh diberi label terverifikasi.

| KPI | Definisi operasional |
| --- | --- |
| Visit completion | Visit rencana yang selesai / visit dalam snapshot rencana yang jatuh tempo. Pembatalan sah sebelum deadline dikecualikan dengan alasan dan histori |
| Validated visit rate | Visit selesai dengan bukti diterima / visit selesai yang wajib validasi. Pending review ditampilkan terpisah |
| Customer coverage | Outlet unik yang mendapat interaksi memenuhi syarat / outlet unik yang jatuh tempo dilayani pada periode |
| Meaningful interaction | Kunjungan bertemu PIC dengan outcome lengkap, atau percakapan dengan PIC. Tidak diangkat dan toko tutup tetap aktivitas, tetapi bukan coverage bermakna |
| Follow-up on time | Task selesai paling lambat due_at plus toleransi jenis task / seluruh task jatuh tempo yang eligible |
| Dial attempts | Jumlah attempt ID unik, dipisah manual dan provider verified. Satu retry webhook tidak menjadi attempt baru |
| Technical connect rate | Provider-connected attempts / provider-finalized attempts. Hanya untuk integrasi telephony; event belum final ditampilkan terpisah |
| PIC reach rate | Percakapan dengan PIC / attempt eligible. Tampilkan declared dan verified beserta jumlah unique contact |
| Call conversion | Pelanggan unik dari cohort campaign yang menghasilkan confirmed order dalam window atribusi / pelanggan unik cohort yang dihubungi |
| Callback on time | Callback yang attempt pertamanya dilakukan dalam slot janji sampai toleransi / callback jatuh tempo. Outcome order tidak diperlukan untuk dianggap tepat waktu |
| Productive visit | Visit selesai yang terkait confirmed order dalam window atribusi / visit selesai eligible. Tampilkan juga outlet unik yang produktif |
| Win rate | Jumlah opportunity Won / (jumlah Won + jumlah Lost) pada cohort penutupan. Open tidak dimasukkan denominator |
| Actual sales | Invoice tervalidasi setelah retur/kredit, dengan assignment Sales Rep dari invoice atau customer yang berlaku pada tanggal invoice |
| Target attainment | Actual sesuai basis target / target versi yang berlaku. Basis order, invoice, collection, dan unit tidak boleh dicampur |
| Repeat purchase rate | Customer cohort yang memiliki transaksi berikutnya / customer cohort eligible pada window yang didefinisikan |
| Contact complaint rate | Pelanggan unik dengan keluhan kontak / pelanggan unik yang dikontak pada periode yang sama |

### 15.1 Cohort atribusi dan pencegahan hitung ganda

Default window atribusi operasional tujuh hari kalender setelah interaksi bermakna. Gunakan link order ke activity bila ada. Jika tidak ada, interaksi bermakna terakhir sebelum order menjadi primary operational attribution; aktivitas sebelumnya menjadi assisted contribution. Model ini adalah aturan pelaporan, bukan bukti sebab akibat dan bukan aturan komisi.

Order dari dua kanal tetap dihitung sekali berdasarkan order ID. Actual penjualan dan pencapaian target memakai invoice tervalidasi sebagai basis utama; order, confirmed order, collection, dan draft tetap ditampilkan sebagai status/basis terpisah. Sumber transaksi menyediakan invoice ID, customer/outlet, tanggal invoice, nilai net setelah retur/kredit, currency, dan relasi Sales Rep/area bila tersedia. Jika relasi Sales Rep tidak ada di invoice, sistem memakai assignment customer yang berlaku pada tanggal invoice. Aplikasi tidak menebak Sales Rep dari status order. Activity attribution dikunci saat konfirmasi order; koreksi membutuhkan audit. Campaign cohort ditetapkan saat pelanggan pertama kali eligible dan tidak berpindah hanya untuk memperbaiki conversion rate. Laporan menjelaskan basis tanggal aktivitas, cohort, dan tanggal transaksi.

### 15.2 Contoh perhitungan

Team memiliki 100 outlet jatuh tempo. Ada 70 kunjungan selesai ke 60 outlet dan 20 percakapan PIC telesales ke 15 outlet. Sepuluh outlet muncul di kedua kanal. Bila seluruh interaksi memenuhi syarat, coverage gabungan = (60 + 15 - 10) / 100 = 65%. Total aktivitas tidak digunakan sebagai numerator coverage.

Pada 40 attempt provider yang sudah final, 10 tersambung dan enam mencapai PIC. Technical connect rate = 25%; PIC reach rate terverifikasi = 15%. Lima aktivitas manual tambahan ditampilkan terpisah sehingga tidak menaikkan denominator provider.

## 16 Target dan pengelolaan kapasitas

**TGT-01 P0:** target dapat ditetapkan per customer/outlet, Sales Rep, team, Area Manager/territory, periode, kanal, atau kelompok produk. Setiap target menyimpan basis invoice, unit/nilai, jenis transaksi, mata uang, tanggal efektif, pembuat, dan versi. Target organisasi tidak dijumlahkan ulang dari parent dan child secara bersamaan. Baseline target utama menggunakan tiga bulan historis yang dipilih Management.

**TGT-02 P0:** pembagian target mempertimbangkan hari kerja aktif dan assignment territory. Perubahan target dalam periode berjalan menghasilkan versi; dashboard dapat menunjukkan versi awal dan versi berlaku.

**TGT-03 P0:** kapasitas lapangan mempertimbangkan waktu perjalanan, durasi kunjungan, jam pelanggan, dan jam kerja. Kapasitas telesales mempertimbangkan callback, estimasi talk time, after-call work, dan jam kontak. Overload terlihat sebelum penugasan disimpan.

**TGT-04 P0:** setiap skema insentif mereferensikan target yang disahkan dan mempunyai model, parameter, sumber realisasi, pembagian kredit, serta perlakuan koreksi. User berwenang dapat menginput dan mengatur skema melalui form; detail bagian 16.5 sampai 16.8. Forecast tidak menjadi dasar insentif final.

### 16.1 Tujuan forecast bagi supervisor

Forecast menjawab empat pertanyaan kerja: berapa target yang sudah tercapai, berapa tambahan yang realistis di sisa periode, pelanggan mana yang menyumbang estimasi tersebut, dan siapa yang harus melakukan kunjungan atau panggilan berikutnya. Review berfokus pada hambatan yang dapat ditindaklanjuti.

Dokumentasi Zoho memberi acuan pemisahan kategori forecast, target berjenjang, dan penelusuran ke deal. Rancangan berikut menambahkan aturan khusus penjualan lapangan dan telesales; kategori Committed merupakan komitmen internal sales yang masih berisiko, bukan pendapatan terjamin.

**FRC-01 P0 — Basis dan periode.** Setiap forecast menyimpan organisasi, periode, timezone, basis transaksi, mata uang atau satuan, serta versi kebijakan. Default bulanan dengan checkpoint mingguan; triwulan merupakan agregasi periode yang tidak tumpang tindih. Rilis web memakai invoice net untuk target/actual/forecast. Confirmed order tetap metrik pipeline terpisah; forecast collection/order lanjutan belum aktif. Expected invoice date menentukan eligibility periode. Peluang tanpa tanggal basis yang relevan masuk daftar belum eligible.

**FRC-02 P0 — Worksheet per sales.** Kolom minimum: target, actual, sisa target, estimasi tambahan Committed, Best case, Pipeline, proyeksi akhir periode, dan gap proyeksi. Hierarki organisasi dapat dipecah menurut cabang, territory, team, dan sales. Sales yang membantu melalui kanal lain tampil sebagai contributor, tanpa menggandakan nilai transaksi.

**FRC-03 P0 — Kategori dan bukti.** Setiap estimasi terbuka berada pada tepat satu kategori: Pipeline untuk peluang awal; Best case untuk peluang dengan kebutuhan dan waktu pembelian yang cukup jelas; Committed untuk estimasi yang dipertanggungjawabkan sales dengan konfirmasi pelanggan atau bukti setara; Omitted untuk yang dikeluarkan beserta alasannya. Perpindahan kategori menyimpan alasan, aktor, waktu, dan evidence. Stage pipeline dan kategori forecast adalah field berbeda. Kategori tidak dapat diganti untuk menutupi transaksi lost atau cancelled.

**FRC-04 P0 — Dua sumber estimasi.** Deal baru membawa opportunity, pelanggan, nilai, dan next action. Repeat order membawa outlet, produk atau kelompok, periode rencana, quantity/value, dasar estimasi, serta PIC. Sales dapat memasukkan estimasi repeat order manual tanpa membuat deal palsu untuk setiap pembelian rutin. Histori transaksi dan perhitungan otomatis repeat order menjadi bantuan P1, bukan kewajiban MVP.

**FRC-05 P0 — Pencegahan hitung ganda.** Forecast rilis web berbasis invoice net. Contribution mempunyai ID sumber unik; opportunity dan repeat estimate yang sama harus dihubungkan atau masuk review. Hanya invoice eligible pada periode yang sama mengonsumsi residual contribution; konfirmasi order saja tidak menaikkan actual invoice atau mengurangi residual invoice. Realization mengacu revisi invoice yang tepat; revision berikutnya menggantikan alokasi efektif, tidak ditambahkan sebagai realisasi kedua. Total alokasi tidak melebihi nilai eligible dan contribution. Sisa terbuka tetap residual; konflik masuk exception.

**FRC-06 P0 — Dari gap ke tindakan.** Klik gap membuka pelanggan atau peluang dengan potensi, tenggat, kategori, hambatan, dan next action. Supervisor dapat membuat callback, kunjungan, handoff, atau eskalasi stok/harga/kredit. Sistem tidak menyebarkan sisa target secara merata ke pelanggan lalu menyebutnya forecast. Saran prioritas mempertimbangkan kapasitas serta preferensi kontak yang berlaku.

**FRC-07 P0 — Penetapan dan komitmen.** Target mendukung dua metode yang dipilih Management per periode: (a) **bottom-up**, target disusun dari customer/outlet dan/atau Sales Rep lalu diagregasikan ke team, area, dan organisasi; (b) **top-down**, Management menetapkan target parent lalu sistem menghitung usulan child berdasarkan aturan alokasi yang disetujui. Untuk alokasi historis, baseline default memakai proporsi invoice tervalidasi tiap customer pada **tiga bulan historis** yang dipilih, dengan fallback customer baru. Bulan pertama customer baru memakai target onboarding input Management. Untuk target bulan kedua gunakan satu bulan penuh yang sudah selesai; bulan ketiga gunakan dua bulan penuh; bulan keempat dan seterusnya gunakan tiga bulan penuh terakhir. Data masa depan atau bulan berjalan tidak mengubah target yang sudah disahkan. Hasil alokasi otomatis berstatus draft sampai direview dan disahkan; pembulatan, minimum, override, dan sisa target disimpan. Sales mengisi estimasi tambahan dan penjelasan; supervisor dapat meminta revisi atau memberikan manager forecast terpisah. Adjustment mempunyai nilai, scope, alasan, dan pemilik. Sistem menyimpan estimasi sales serta estimasi manager sebagai alternatif; keduanya tidak ditambahkan.

**FRC-08 P1 — Snapshot mingguan.** Simpan snapshot sebelum weekly sales review: contribution IDs, target version, hierarchy assignment, actual cutoff, kategori, tanggal, nilai, probability, dan status freshness. Snapshot submitted tidak dapat diedit; perubahan membuat versi berikutnya. Perubahan owner, periode, atau formula tidak menulis ulang angka lama. Ekspor menyertakan cutoff dan versi.

**FRC-09 P1 — Perubahan dan slippage.** Bandingkan dua snapshot dengan bridge: nilai awal, peluang baru, perubahan nilai, transaksi terealisasi, lost/cancelled, perubahan kategori, perpindahan periode, dan nilai akhir. Pergeseran close date ke bulan berikutnya terlihat sebagai slippage. Tampilkan tanggal awal dan terakhir serta alasan, agar mengganti tanggal tidak menghapus keterlambatan.

**FRC-10 P1 — Akurasi dan bias.** Bandingkan forecast yang dikunci sebelum cutoff dengan actual final untuk periode dan basis yang sama. WAPE = jumlah nilai absolut selisih forecast dan actual dibagi jumlah absolut actual; denominator nol menghasilkan tidak berlaku dan tetap menunjukkan error absolut. Bias = jumlah forecast dikurangi actual, dibagi jumlah absolut actual; positif berarti overforecast. Kebijakan snapshot evaluasi ditetapkan sebelum melihat actual dan berlaku untuk semua sales dalam cohort yang dibandingkan. Actual yang belum final diberi label provisional.

**FRC-11 P1 — Freshness dan penguncian periode.** Tampilkan latest successful sync, umur data, sumber actual, dan unresolved reconciliation. Periode closed mempunyai status locked; koreksi transaksi terlambat menghasilkan restatement yang dapat dibandingkan dengan angka awal. Perubahan tahun fiskal atau hierarchy membuat versi definisi, bukan menghapus histori.

**FRC-12 P2 — Bantuan analitis.** Weighted projection, estimasi repeat order, dan rekomendasi pelanggan dapat dikembangkan setelah histori cukup. Selalu tampilkan metode, cakupan, umur data, serta alasan. Model tidak mengubah komitmen sales, order, atau task secara otomatis. Tampilkan tidak cukup data untuk outlet baru dan simpan penyesuaian manusia sebagai alternatif yang dapat ditelusuri.

### 16.2 Formula forecast dasar

Untuk satu periode dan basis yang sama, A adalah actual; C, B, dan P adalah residual estimasi terbuka yang mutually exclusive untuk Committed, Best case, dan Pipeline. Residual sudah dikurangi realisasi terkait serta pengeluaran Omitted. Nilai kategori berikut merupakan bucket terpisah; tampilan kumulatif diberi label scenario agar tidak dijumlahkan kembali.

| Metrik | Formula dan arti |
| --- | --- |
| Sisa target | Maksimum nol dari target dikurangi A; overachievement ditampilkan terpisah |
| Proyeksi committed | A + C |
| Proyeksi best case | A + C + B |
| Potensi seluruh pipeline | A + C + B + P; potensi, bukan janji hasil |
| Gap proyeksi | Target dikurangi proyeksi yang dipilih; nilai negatif berarti di atas target |
| Pipeline coverage terhadap target | (C + B + P) / target; label denominator wajib terlihat |
| Coverage terhadap sisa target | (C + B + P) / sisa target; tidak berlaku bila sisa target nol |
| Weighted projection P2 | A + jumlah residual terbuka dikali probability; alternatif, tidak ditambahkan ke skenario lain |

Actual berbasis invoice hanya dipasangkan dengan estimasi sisa invoice yang eligible pada periode tersebut. Deal Won yang belum ditagihkan tidak menjadi actual invoice. Nilai multi-currency memerlukan kebijakan kurs dan snapshot kurs; MVP memakai IDR. Quantity hanya dijumlahkan pada satuan dasar yang telah tervalidasi.

### 16.3 Contoh forecast dan tindakan

Contoh ilustratif: target satu team Rp100 juta; actual invoice net Rp40 juta; residual Committed Rp25 juta; Best case Rp20 juta; Pipeline Rp30 juta. Proyeksi committed Rp65 juta, best case Rp85 juta, dan potensi seluruh pipeline Rp115 juta. Gap pada skenario best case masih Rp15 juta. Rasio pipeline terhadap target adalah 0,75 kali, sedangkan terhadap sisa target adalah 1,25 kali; kedua label tidak dipertukarkan.

Dari daftar sumber, supervisor menemukan dua outlet menunggu konfirmasi pembelian dan satu peluang membutuhkan kunjungan. Ia menugaskan dua callback ke telesales dan satu kunjungan ke sales lapangan, dengan PIC serta tenggat. Penugasan ini tidak langsung menaikkan forecast. Estimasi berubah setelah bukti dan kategorinya diperbarui.

Jika Rp10 juta dari Committed menjadi invoice eligible pada periode yang sama, actual menjadi Rp50 juta dan residual Committed menjadi Rp15 juta. Proyeksi committed tetap Rp65 juta. Contoh ini menjadi invariant pengujian untuk mencegah penjualan dihitung dua kali.

### 16.4 Ritme review sales

Briefing harian membahas pekerjaan jatuh tempo, callback, kunjungan, dan exception mendesak. Review mingguan membahas gap, perubahan forecast, pelanggan prioritas, hambatan, dan komitmen tindakan. Review akhir bulan memeriksa realisasi, forecast bias, pelanggan produktif, serta pelajaran untuk periode berikutnya. Setiap keputusan menghasilkan task yang terkait customer; keputusan rapat tidak berhenti sebagai catatan bebas.

### 16.5 Model insentif yang dapat dikonfigurasi

Modul insentif mengubah target dan hasil kerja yang sudah tervalidasi menjadi hak insentif sesuai skema. Konfigurasi dapat berbeda untuk sales lapangan, telesales, supervisor, territory, atau campaign. Skema dibuat melalui parameter dan template; tidak memerlukan perubahan kode untuk tarif atau jenjang baru dalam model yang didukung.

Model dasar persentase, tier, bonus, dan nominal per penjualan mendapat konteks dari referensi [9–10]. Untuk pilot, Management dapat membuat plan terpisah untuk Sales Rep lapangan, telesales, Supervisor, Area Manager, atau layer lain. Setiap plan memiliki peserta, target, basis invoice, atribusi primer, threshold, nominal dasar, tarif per lapisan, cap bila kelak diaktifkan, cutoff, approval, dan pembulatan sendiri. Tidak ada tarif default yang dipaksakan lintas role. Semua tarif dan contoh berikut bersifat ilustrasi pembahasan produk, bukan kebijakan kompensasi yang sudah berlaku.

| Model | Input pengguna | Cara hitung | Tahap |
| --- | --- | --- | --- |
| Persentase tetap | Tarif, basis eligible, threshold opsional | Basis eligible dikali tarif setelah syarat terpenuhi | P0 |
| Persentase berjenjang seluruh basis | Ambang achievement dan tarif tiap jenjang | Tarif jenjang yang dicapai diterapkan pada seluruh basis eligible | P0 |
| Persentase berjenjang progresif | Batas lapisan dan tarif per lapisan | Setiap bagian basis dihitung dengan tarif lapisannya | P0 |
| Bonus milestone | Ambang achievement dan nominal bonus | Nominal berdasarkan jenjang tertinggi atau akumulasi milestone, dipilih eksplisit | P0 |
| Nominal per unit atau hasil | Nominal dan definisi unit/event terverifikasi | Nominal dikali jumlah eligible; gate achievement dapat ditambahkan | P1 |
| Insentif target dengan scorecard | Nominal pada target, KPI, bobot, kurva payout | Target incentive dikali gabungan faktor pencapaian KPI | P1 |
| Pool team | Pool, faktor achievement team, bobot peserta | Pool terhitung dibagi ke peserta sesuai bobot yang disahkan | P1 |

Accelerator, minimum achievement, cap, product multiplier, dan syarat collection adalah parameter tambahan pada model yang kompatibel. Misalnya, persentase tetap dapat membayar lebih tinggi untuk produk prioritas; bonus milestone dapat dibayarkan setelah invoice terkait memenuhi syarat collection. Pengguna tidak diminta memahami formula pemrograman.

**INC-01 P0 — Keterkaitan target.** Skema wajib menyimpan target_id dan target_version yang sudah disahkan, periode, timezone, peserta, serta tanggal berlaku. Achievement = actual target metric / target metric pada periode yang sama. Target nol, negatif, belum disahkan, atau belum tersedia menghasilkan needs review, bukan achievement tak terhingga atau insentif nol otomatis. Target berbeda unit atau basis tidak boleh dipasangkan tanpa mapping yang eksplisit dan tervalidasi.

**INC-02 P0 — Pembuat dan penerima.** Hanya Management/national sales manager mengatur skema; sales dapat melihat skema miliknya, mengusulkan perubahan melalui workflow, dan mengajukan keberatan hasil. Role mengatur skema tidak otomatis mendapat hak menyetujui. Penerima tidak boleh menyetujui skema atau statement untuk dirinya sendiri. Supervisor hanya melihat scope team; finance melihat data yang dibutuhkan untuk review.

**INC-03 P0 — Form konfigurasi.** Input minimum: nama skema, model, peserta, target referensi, periode, basis achievement, payout basis, tarif atau nominal, tabel jenjang bila relevan, threshold, cap opsional, syarat eligible, aturan stacking, atribusi primer, cutoff, pembulatan, serta approver. UI memberi ringkasan aturan dalam bahasa biasa dan preview hasil pada sejumlah achievement. Field yang tidak berlaku untuk model terpilih disembunyikan.

**INC-04 P0 — Basis achievement dan payout.** Rilis web memakai nilai invoice net eligible untuk achievement dan payout pada periode/versi target yang sama. Gross/net/pajak/diskon/ongkir mengikuti mapping sumber yang terdokumentasi; retur dan credit tidak dikurangi dua kali. Confirmed order, collection, margin, volume serta basis berbeda adalah kemampuan lanjutan yang belum diaktifkan. Target nol atau missing menahan finalisasi sebagai needs_review.

**INC-05 P0 — Validasi jenjang.** Batas bawah inklusif dan batas atas eksklusif untuk pemilihan jenjang; jenjang terakhir boleh tanpa batas. Tidak boleh ada rentang overlap atau gap tanpa kebijakan. Tarif negatif dan cap negatif ditolak. Tarif menurun boleh dipakai sebagai decelerator bila dipilih secara sadar dan lolos review. Preview wajib menampilkan tepat di bawah, tepat pada, dan tepat di atas setiap batas. Persentase ditampilkan sebagai 1%, bukan angka ambigu 1 atau 0,01.

**INC-06 P0 — Seluruh basis atau progresif.** User wajib memilih mode saat memakai jenjang. Seluruh basis memakai tarif dari achievement akhir dan mengalikan seluruh payout basis. Progresif menghitung bagian nilai pada tiap lapisan, dengan batas achievement dikonversi ke nilai memakai target yang dikunci. Pada MVP, progresif hanya mendukung achievement dan payout basis yang sama. UI tidak mengizinkan pergantian mode pada skema aktif; harus membuat versi baru dan menunjukkan perubahan hasil.

**INC-07 P0 — Bonus dan stacking.** Bonus milestone menyediakan mode hanya jenjang tertinggi atau akumulasi milestone. Default hanya jenjang tertinggi. Satu peserta pada periode yang sama memiliki satu skema utama; komponen tambahan hanya ditambahkan bila dinyatakan cumulative. Rule yang overlap tidak diam-diam dijumlahkan atau memakai tarif tertinggi. Sistem meminta prioritas atau menolak aktivasi sampai konflik selesai. Bonus campaign mempunyai eligibility dan aturan kombinasi terpisah yang terlihat.

**INC-08 P0 — Simulasi sebelum aktivasi.** Pengguna dapat memasukkan target dan realisasi contoh, mengubah tarif serta jenjang dalam draft, dan membandingkan hasil seluruh basis dengan progresif. Simulasi menunjukkan detail per komponen/lapisan, syarat gagal, cap, serta estimasi biaya team. Simulasi tidak membuat payout, transaksi pembayaran, atau revisi realisasi. Plan tidak aktif sebelum data wajib lengkap, preview tersimpan, dan approver menyetujui.

**INC-09 P0 — Versi dan masa berlaku.** Skema mengikuti draft, submitted, approved, active, dan retired. Perubahan tarif, target mapping, atau eligibility pada skema aktif membuat versi baru. Default perubahan berlaku mulai periode berikutnya. Perubahan dalam periode berjalan membutuhkan review dampak dan versi target yang sesuai; hitung ulang seluruh periode dengan versi baru hanya bila secara eksplisit disetujui. Prorata segmen waktu tidak dilakukan diam-diam dan berada di luar MVP. Histori asli tetap tersedia.

**INC-10 P0 — Pemisahan kanal dan penerima.** Satu invoice eligible mempunyai satu kanal primer dan satu Sales Rep primer; rilis web tidak membagi credit lapangan/telesales. Aktivitas bantuan tetap tercatat tanpa actual kedua. Insentif SPV/AM memakai target agregat pada scope role serta komponen biaya terpisah; tidak menggandakan actual organisasi. Plan antar role dapat menggunakan invoice yang sama sebagai bukti agregat, tetapi entitlement unik per peserta/periode/komponen. Cross-channel split adalah kemampuan lanjutan, bukan konfigurasi pilot aktif.

Pilot memakai atribusi primer 100% tanpa split lintas kanal. Target dan actual masing-masing kanal harus memakai scope yang sama. Referensi split dalam contoh historis model tidak mengaktifkan fitur split pada rilis web.

**INC-11 P0 — Perhitungan deterministik.** Engine menggunakan desimal presisi tetap dan menyimpan ruleset version, target snapshot, source record versions, metric cutoff, primary attribution snapshot, serta run ID. Urutan: validasi data, tentukan eligible credit, hitung achievement, evaluasi gate, hitung komponen dan modifier yang diizinkan, terapkan cap komponen, jumlahkan komponen cumulative, terapkan cap plan, lalu bulatkan. Default pembulatan half-up ke rupiah dilakukan pada total peserta per plan-periode; perincian belum dibulatkan tetap disimpan. Rule khusus ditampilkan dan memiliki versi.

**INC-12 P0 — Estimasi dan final.** Progres dalam periode menampilkan estimated incentive beserta data cutoff serta syarat yang belum terpenuhi. Forecast, opportunity terbuka, dan order belum eligible tidak masuk insentif final. Calculation run final menggunakan snapshot realisasi setelah cutoff dan rekonsiliasi. Approval final mengunci input serta hasil. Run ulang dengan snapshot dan ruleset sama menghasilkan angka yang sama dan tidak menggandakan entitlement.

**INC-13 P0 — Statement yang dapat dijelaskan.** Sales dapat melihat target, actual eligible, achievement, jenjang terpilih, basis payout, tarif, breakdown lapisan/komponen, cap, adjustment, nilai final, dan status review. Source transaksi dapat ditelusuri sesuai izin. Event yang dikeluarkan mempunyai reason, misalnya invoice belum eligible, retur, duplikat, atau di luar periode. Data yang belum tersedia diberi status pending, bukan dianggap nol.

**INC-14 P0 — Review dan keberatan.** Hasil melewati prepared, under review, approved, exported, dan paid confirmed; needs correction serta disputed menjadi flag yang menghentikan final approval untuk item terkait. Sales dapat mengajukan keberatan dengan bukti sebelum deadline yang ditetapkan. Supervisor meninjau assignment dan hasil kerja; finance/approver memverifikasi basis dan nilai. Edit setelah approval menghasilkan revision, bukan menimpa angka approved. Pembayaran tidak dijalankan oleh modul ini.

**INC-15 P0 — Retur pembatalan dan koreksi.** Sebelum approval final, perubahan eligible event menyebabkan recalculation dengan jejak versi. Setelah approval atau paid, perubahan tidak menghapus statement lama. Sistem menghitung selisih entitlement periode asli menggunakan aturan dan target asli yang relevan, termasuk pengaruh perubahan jenjang pada seluruh basis, lalu membuat adjustment yang harus ditinjau. Selisih tidak dihitung sekadar tarif terbaru dikali nilai retur.

Adjustment negatif dibawa sebagai item terpisah ke proses penyelesaian yang diizinkan kebijakan perusahaan; sistem tidak otomatis memotong gaji atau melakukan penagihan. Jika collection menjadi gate, event pembayaran parsial hanya mengaktifkan porsi yang diizinkan aturan. Payment allocation harus mencegah satu penerimaan dialokasikan dua kali ke invoice atau sales yang sama.

**INC-16 P0 — Pencegahan payout ganda.** Entitlement memiliki kunci plan version, peserta, periode, component scope, serta source snapshot. Export memuat batch ID dan statement revision; pengulangan export tidak membuat entitlement baru. Status exported bukan bukti paid. Paid confirmed membutuhkan referensi konfirmasi dari finance atau sistem pembayaran terkait. Pengiriman ulang file diberi penanda salinan dan dapat direkonsiliasi.

**INC-17 P1 — Model nominal dan scorecard.** Nominal per unit menggunakan UOM tervalidasi; nominal per outlet produktif menghitung outlet unik yang memenuhi definisi transaksi, bukan jumlah visit. Scorecard menggunakan target incentive nominal dan bobot KPI yang totalnya 100%, dengan kurva payout serta cap per KPI yang eksplisit. Missing KPI tidak boleh otomatis direweight; hasil ditahan atau mengikuti fallback versi kebijakan. Metrik yang mudah dimanipulasi seperti jumlah dial manual tidak dijadikan komponen berbayar tanpa mekanisme validasi.

**INC-18 P1 — Pool team.** Nilai pool dihitung sekali menggunakan target dan realisasi team, lalu dialokasikan ke peserta dengan bobot disahkan yang totalnya 100%. Pool parent dan alokasi anggota bukan dua biaya terpisah. Team membership dan hari eligible memakai snapshot. Shared channel atau pergantian team tidak menggandakan penerima. Sisa pembulatan dialokasikan secara deterministik dengan metode largest remainder, tie-breaker ID peserta.

**INC-19 P0 — Ruang lingkup data insentif.** Tarif individu, statement, adjustment, dan estimasi pembayaran merupakan data terbatas. Laporan kinerja umum tidak otomatis menampilkan nominal insentif rekan. Semua perubahan skema, approval, koreksi, akses statement sensitif, serta ekspor dicatat. Role konfigurasi dan approval mengikuti RBAC serta scope organisasi.

**INC-20 P0 — Batas modul.** Output adalah insentif bruto sesuai plan sebelum perlakuan payroll atau pajak. Gaji pokok, pajak, potongan payroll, transfer uang, dan slip gaji lengkap dikelola sistem terkait. Modul menyediakan statement, persetujuan, serta export yang dapat direkonsiliasi. Penggunaan forecast pada simulasi harus jelas bertanda what-if dan tidak dapat diajukan sebagai hasil final.

### Model insentif progresif pilot

Untuk pilot, Management dapat mengaktifkan model **threshold plus progressive overachievement**. Plan menyimpan nominal dasar `B` yang mulai berlaku pada achievement 80%, basis target/invoice, serta tarif progresif per lapisan. Definisi operasional awal:

- Achievement di bawah 80%: bonus = 0, kecuali plan memberi nominal minimum lain. Achievement dihitung sebagai persentase actual invoice tervalidasi setelah retur/kredit dibanding target invoice pada periode yang sama.
- Achievement tepat atau di atas 80%: bonus dasar = `B`.
- Bagian achievement dari 80% sampai 100% mendapat tarif lapisan pertama `r1`.
- Bagian di atas 100% sampai ambang berikutnya mendapat tarif lapisan kedua `r2`; tarif hanya dikenakan pada bagian di lapisan tersebut, bukan mengubah seluruh basis.
- Setiap lapisan berikutnya memakai tarifnya sendiri dan terakumulasi. Nominal `B`, ambang, tarif, pembulatan rupiah penuh, cutoff, atribusi primer, retur, dan pembatalan diinput serta disahkan Management. Cap payout tidak diaktifkan pada pilot; parameter cap tersedia jika Management kelak mengaktifkannya melalui versi plan. Finalisasi dilakukan melalui tombol manual oleh Management/national sales manager setelah review. Tombol ini mengunci calculation run dan statement, bukan menimpa hasil hitung; koreksi dilakukan melalui revision yang dapat ditelusuri. Jadwal finalisasi otomatis tidak diaktifkan.

Contoh implementasi yang dapat diedit di konfigurasi: target Rp1.000.000.000, `B` ditentukan Management, tarif lapisan 80–100% = 1% dan di atas 100% = 2%. Pada achievement 81%, bonus = `B` + 1% × nilai bagian antara 80%–81% (Rp10.000.000) = `B` + Rp100.000. Pada achievement 102%, bonus progresif = `B` + (1% × Rp200.000.000) + (2% × Rp20.000.000) = `B` + Rp2.400.000. Sistem juga menampilkan basis, lapisan, dan formula per komponen pada statement. Ini adalah formula progresif; model “tarif tier diterapkan ke seluruh basis” tetap tersedia sebagai pilihan terpisah agar tidak tertukar.

### 16.6 Contoh persentase berjenjang

Contoh target Rp100.000.000 dan realisasi eligible Rp125.000.000, sehingga achievement 125%. Tarif berikut hanya angka simulasi. Basis nilai dan achievement sama, atribusi primer 100% digunakan, tanpa komponen lain atau cap.

| Achievement untuk memilih jenjang | Tarif |
| --- | --- |
| Di bawah 80% | 0% |
| Mulai 80% sampai di bawah 100% | 1% |
| Mulai 100% sampai di bawah 120% | 1,5% |
| Mulai 120% ke atas | 2% |

Pada model seluruh basis, achievement 125% memilih tarif 2%; hasil = Rp125.000.000 × 2% = Rp2.500.000.

Pada model progresif, bagian Rp0–80 juta bertarif 0%; bagian berikutnya Rp20 juta bertarif 1%; bagian berikutnya Rp20 juta bertarif 1,5%; dan sisa Rp5 juta bertarif 2%. Hasil = Rp0 + Rp200.000 + Rp300.000 + Rp100.000 = Rp600.000.

Tepat pada achievement 80%, seluruh basis menghasilkan Rp800.000, sedangkan progresif masih Rp0 karena belum ada nilai di atas Rp80 juta. Perbedaan ini harus terlihat pada preview batas. Istilah persentase berjenjang saja tidak cukup untuk mengaktifkan rule.

### 16.7 Konfigurasi awal untuk kedua kanal

Template awal sales lapangan menggunakan target penjualan eligible dengan pilihan tier seluruh basis atau progresif. Template telesales menggunakan target penjualan credited dari aktivitas/lead/customer telesales yang ditangani, tanpa mengubah owner customer lapangan. Untuk rilis pertama kanal dipisahkan: satu invoice memiliki satu kanal primer dan satu penerima atribusi yang tervalidasi. Aktivitas bantuan dapat dilihat pada timeline tanpa memberi kredit penjualan kedua. Credit split lintas kanal merupakan kemampuan lanjutan yang tidak aktif pada pilot. Keduanya dapat memilih bonus milestone sebagai alternatif.

Template opsional P1 dapat menambahkan outlet produktif atau qualification yang diterima sebagai komponen hasil berkualitas. Template tidak otomatis menentukan tarif perusahaan. Kebijakan target, dasar transaksi, atribusi primer, retur, cutoff, serta cap tetap harus diinput dan disahkan.

Contoh scorecard ilustratif P1: target incentive Rp2 juta; bobot penjualan 70%, outlet produktif 20%, dan follow-up tepat waktu 10%. Kurva payout tiap KPI, batas maksimum, dan gate kualitas harus diatur sebelum engine menggabungkan faktor. Menyebut bobot saja belum menjadi formula payout yang lengkap.

### 16.8 Layar pengaturan dan hasil insentif

Urutan wizard: pilih target dan peserta, pilih model, isi basis serta tarif/jenjang, atur syarat dan cap, tentukan kredit serta kombinasi komponen, jalankan simulasi, lalu ajukan approval. Layar hasil mempunyai dua tampilan: estimasi berjalan untuk sales dan worksheet review final untuk supervisor/finance.

Workflow akhir periode: cutoff dan rekonsiliasi, generate calculation run, review exception, penyelesaian keberatan, final approval, statement terkunci, export, lalu konfirmasi status pembayaran. Review harian dan forecast tetap berjalan tanpa menunggu siklus insentif selesai.

### 16.9 Metode penetapan target

**Bottom-up:** Management/national sales manager membuka periode target, memilih customer/outlet dan/atau Sales Rep, lalu mengisi nilai/unit target. Sistem mengagregasikan nilai ke parent tanpa menjumlahkan parent yang sudah diinput manual. Customer dapat mempunyai target produk atau nilai; Sales Rep dapat mempunyai target total yang berasal dari customer atau target mandiri, tetapi basisnya harus dinyatakan agar tidak double count.

**Top-down:** Management mengisi target organisasi/area/team. Sistem menawarkan kalkulasi child berdasarkan proporsi invoice tervalidasi per customer pada baseline historis yang dipilih. Formula usulan = (target parent dikurangi reserve onboarding) × bobot customer / jumlah bobot eligible. Bobot = invoice net pada bulan penuh tersedia dibagi jumlah bulan penuh tersedia (maksimal tiga). Target onboarding dialokasikan terpisah dan total anak ditambah reserve yang tersisa tepat sama parent. Customer tanpa histori memakai bucket customer baru, minimum yang dikonfigurasi, atau masuk daftar review; penyebut nol tidak menghasilkan pembagian otomatis. Management dapat mengubah hasil usulan, dan setiap override menyimpan alasan.

Aturan teknis baseline: tiga bulan target adalah tiga bulan kalender selesai sebelum periode target; ini berbeda dari rolling 90 hari untuk status aktif. Proporsi alokasi memakai total invoice net tiga bulan. Total dan rata-rata per customer menghasilkan proporsi sama bila jumlah bulan pembagi sama; customer baru memakai rata-rata bulan penuh yang sudah tersedia agar tidak otomatis direndahkan karena umur data pendek. Bulan pertama tanpa histori memakai target onboarding yang diinput Management; realisasi bulan pertama tidak digunakan secara retroaktif untuk mengubah target bulan itu. Setelah bulan pertama ditutup, baseline diperbarui untuk periode berikutnya; bulan kedua/ketiga mengikuti jumlah bulan penuh tersedia. Rumus normalisasi dan pilihan baseline disimpan sebagai versi, hasil belum disahkan tetap draft. Parameter numerik customer baru adalah input Management, bukan angka default yang dianggap disepakati.

Kedua metode menghasilkan target version, allocation run, baseline period, rule version, rounding residual, status draft/submitted/approved/locked, dan audit. Forecast tidak mengubah target yang telah disahkan. Perubahan periode berjalan membuat versi baru dan merekam dampaknya pada achievement serta insentif.

## 17 Notifikasi dan automasi

**AUT-01 P0:** pengingat tersedia dalam aplikasi untuk callback, agenda berikutnya, task jatuh tempo, approval, dan kegagalan sinkronisasi. Kanal tambahan mengikuti preferensi organisasi dan pengguna.

**AUT-02 P0:** automasi awal: buat follow-up dari outcome, eskalasi SLA, keluarkan DNC dari queue, kirim handoff, dan tandai transaksi ambigu untuk rekonsiliasi. Setiap automasi menyimpan rule version, trigger ID, target record, dan hasil. Trigger berulang tidak menggandakan task.

**AUT-03 P0:** quiet hours mengikuti timezone penerima. Alert keselamatan atau insiden kritis, bila kelak tersedia, mempunyai kebijakan terpisah. Alert operasional serupa digabung menjadi ringkasan; supervisor dapat melihat semua sumbernya.

**AUT-04 P1:** rekomendasi next action memakai alasan yang dapat dibaca, misalnya callback dijanjikan atau pelanggan belum repeat order. AI boleh menyarankan ringkasan dan draft; perubahan status, pengiriman pesan, approval, serta order tetap melalui tindakan dan izin yang sesuai.

## 18 Pengalaman pengguna dan daftar layar

| Layar | Pengguna | Isi dan tindakan utama |
| --- | --- | --- |
| Agenda hari ini | Lapangan | Urutan outlet, prioritas, status offline, check-in, next action |
| Kunjungan aktif | Lapangan | Identitas outlet, GPS, timer informatif, form outcome, order, checkout |
| Customer 360 | Semua role sesuai scope | Timeline, PIC, transaksi, peluang, preferensi kontak, task |
| Workbench telesales | Agent | Queue di kiri, konteks customer di tengah, outcome dan next action di kanan |
| Callback calendar | Agent dan supervisor | Slot janji, kapasitas, overdue, reschedule dengan alasan |
| Pipeline | Sales dan manager | Stage, nilai, usia, next action, alasan stagnasi |
| Draft dan status order | Sales dan backoffice | Item, approval, status eksternal, histori revisi |
| Command center | Supervisor | Ringkasan kanal, exception, coverage, gap dan tindakan |
| Forecast worksheet | Sales dan supervisor | Target, actual, residual estimasi, kategori, customer penyusun, next action |
| Weekly sales review | Supervisor dan manager | Snapshot, perubahan, slippage, hambatan dan komitmen task |
| Pengaturan insentif | Management/NSM | Target referensi, model, tarif, jenjang, syarat, simulasi dan approval |
| Insentif saya | Sales lapangan dan telesales | Estimasi, achievement, rincian perhitungan, statement dan keberatan |
| Review insentif | Supervisor/finance review; Management/NSM finalisasi | Calculation run, exception, adjustment, approval dan export |
| Territory dan beat plan | Management/NSM territory; supervisor agenda | Outlet, frekuensi, assignment, versi rencana |
| Campaign | Management/NSM konfigurasi; supervisor memantau | Tujuan, eligible audience, script, cadence, cohort, hasil |
| Approval inbox | Approver | Permintaan, kebijakan, bukti, approve/reject |
| Master dan integrasi | Management/NSM bisnis; IT teknis | Import, mappings, sinkronisasi, rekonsiliasi |
| Audit dan akses | Admin dan auditor | Perubahan, ekspor, role, log akses sensitif |

Aturan UX: status pending, gagal, dan sukses harus berbeda; aksi berulang tidak menggandakan data; field yang belum tersimpan tetap dapat dipulihkan setelah error; daftar kosong menjelaskan penyebab dan tindakan berikutnya. Gunakan warna bersama teks atau ikon. Target aksesibilitas WCAG 2.2 AA untuk alur utama, termasuk keyboard desktop, label form, dan kontras.

## 19 Siklus status dan aturan koreksi

| Objek | Status utama | Ketentuan |
| --- | --- | --- |
| Sesi kerja | not started, active, ended | Koreksi waktu melalui revisi beralasan |
| Visit | planned, in progress, completed, cancelled | Validasi evidence: pending, accepted, exception, rejected disimpan terpisah |
| Call | initiated, ringing, connected, ended, failed | Status provider terpisah dari disposition bisnis |
| Task | open, in progress, completed, cancelled | Overdue dihitung dari due_at |
| Handoff | draft, submitted, accepted, declined, completed, cancelled | Penolakan kembali ke pengirim dan supervisor |
| Opportunity | New sampai Won atau Lost | Entry criteria dijalankan pada server |
| Order | draft sampai accepted by ERP atau rejected/cancelled | Fulfillment, invoice, payment terpisah |
| Sync event | queued, sending, acknowledged, retryable error, needs review | acknowledged hanya setelah server memastikan tersimpan |

Transisi dijalankan server dengan version check. Edit bersamaan mengembalikan conflict dan versi terbaru, bukan menimpa perubahan orang lain. Setelah aktivitas final, koreksi menambah revision beserta reason dan approver bila diperlukan. Histori asli dapat ditelusuri. Archive tidak menghapus data historis.

## 20 Data minimum dan sumber kebenaran

| Entitas | Field inti | Sumber utama |
| --- | --- | --- |
| Organization dan branch | ID, timezone, kalender kerja, policy version | Management/NSM |
| User dan assignment | role, team, supervisor, territory, effective dates | Management/NSM |
| Pelanggan dan kontak | IDs, owner, alamat, geocode, nomor, preferences | CRM; field ERP direkonsiliasi |
| Plan dan plan item | outlet, due date, assignee, approved version | Sales ops dan supervisor |
| Activity dan visit | channel, outcome, timestamps, evidence state | Aplikasi dan perangkat sesuai provenance |
| Location sample | coordinates, accuracy, event time, received time, session ID | Perangkat; hanya bila fitur aktif |
| Call attempt | internal ID, provider ID, connection state, disposition | Provider untuk teknis; agent untuk hasil bisnis |
| Task dan handoff | assignee, due_at, status, resolution | Workflow aplikasi |
| Opportunity | stage, value, probability, close date, revisions | CRM |
| Order dan line | idempotency key, SKU, unit, price snapshot, external ID | CRM untuk request; ERP untuk status penerimaan |
| Invoice dan credit note | external ID, totals, status, transaction date | ERP atau finance terkontrol |
| Consent dan suppression | purpose, channel, state, source, effective time | Permintaan pelanggan dan kebijakan organisasi |
| Audit event | actor, action, resource, before/after, reason, correlation ID | Server |
| Sync outbox | event ID, payload version, attempts, ack state | Perangkat dan integrasi |
| Forecast definition | period, basis, unit, currency, hierarchy, policy version | Management/NSM |
| Forecast contribution | source ID, residual, category, evidence, expected basis date, assignee | Sales dengan review supervisor |
| Forecast snapshot | definition version, cutoff, contribution IDs, actual, hierarchy, adjustment | Server dan proses review |
| Incentive plan version | target version, model, parameter, scope, validity, approval | Management/NSM |
| Incentive credit | source event version, beneficiary, share, eligible basis, component | Assignment dan aturan plan |
| Incentive calculation run | plan/target snapshots, source cutoff, inputs, results, run ID | Engine kalkulasi |
| Incentive statement | participant, period, calculation revision, adjustments, status | Engine dan review |
| Incentive export batch | statement revision IDs, batch ID, confirmation reference | Finance |

Seluruh business record memiliki organization_id, created_at, updated_at, created_by, dan version. ID unik tidak mengandung nomor telepon atau identitas pribadi. Attachment disimpan pada storage privat dengan referensi ID; URL publik permanen tidak digunakan untuk bukti pelanggan.

### 20.1 Kontrak data invoice dan revisi

Invoice header dan invoice line dibedakan agar total header tidak dikalikan jumlah SKU. Field wajib: organization_id, source_system, source_invoice_id, source_version/updated_at, customer/outlet ID, invoice_date, currency IDR, status, dan nilai net invoice sesuai sumber. Line membawa source_line_id, SKU, quantity, unit, serta nilai net line jika rincian produk tersedia. Relasi Sales Rep/kanal/area harus berasal dari mapping yang sah; field tidak tersedia masuk antrean review. Nomor invoice dapat berulang antar source/organisasi, tetapi kombinasi organisasi, sumber, invoice ID dan line ID harus unik.

Invoice tervalidasi menghasilkan actual; draft, cancelled, duplikat dan mapping ambigu dikecualikan dengan alasan. Jika sumber mengirim nilai net yang sudah dikurangi credit note, credit note tidak dikurangkan dua kali. Retur membawa ID sumber unik dan referensi invoice asal. Untuk pilot, koreksi dan retur yang berelasi merevisi actual periode invoice asal beserta achievement. Periode yang sudah difinalkan menghasilkan revision/adjustment dengan referensi statement sebelumnya; histori original tetap tersedia. Ini default implementasi yang harus dicocokkan dengan semantik sumber saat mapping, bukan perubahan kebijakan pembukuan sumber.

Prioritas atribusi: Sales Rep pada invoice yang valid di area terkait, kemudian assignment customer bertanggal efektif pada invoice_date bila Sales Rep tidak tersedia. Konflik Sales Rep versus assignment atau area masuk needs review, tidak diselesaikan dengan kredit ganda. Perpindahan owner tidak mengubah atribusi invoice lama. Customer tidak wajib mempunyai dua owner ketika dua kanal pernah berinteraksi; kanal invoice dan assignment kegiatan adalah relasi terpisah.

Mode awal: tombol import/sinkronisasi manual oleh Management/national sales manager; integrasi otomatis kelak memakai kontrak yang sama. Jadwal refresh otomatis ditetapkan setelah sumber transaksi tersedia. Setiap batch memiliki dry-run, checksum/ID batch, jumlah diterima/ditolak, total nilai, hasil rekonsiliasi, dan retry idempotent. Engineer tidak membuat koneksi sumber produksi sebelum sumber serta mapping tersedia.

### 20.2 Freshness dan label dashboard

Setiap dashboard menampilkan periode/tanggal bisnis, filter scope dan kanal, waktu sumber terakhir diperbarui, last successful sync, serta waktu perhitungan. Refresh halaman tidak mengubah timestamp keberhasilan sync. Nilai dari batch parsial atau mapping belum lengkap diberi provisional; data yang gagal melewati rekonsiliasi diberi needs review; nilai yang lolos validasi diberi validated. Stale mengikuti jadwal sumber ditambah toleransi yang dikonfigurasi Management. Selama mode manual, tampilkan “data sampai [tanggal/jam]” dan umur data; jangan mengklaim real-time.

Data belum tersedia ditampilkan sebagai belum tersedia; nol hanya untuk dataset valid dengan hasil nol; denominator nol menghasilkan tidak berlaku. Drill-down dan export memakai filter, basis invoice, timezone, versi aturan dan cut-off yang sama. Label validasi data dibedakan dari workflow finalisasi insentif. Target NFR aktivitas tetap berlaku; freshness invoice mengikuti jadwal sumber yang dikonfigurasi dan tidak mengklaim real-time selama import manual.

## 21 Offline dan ketahanan data

**OFF-01 P0:** agenda assigned, data outlet yang diperlukan, form visit, draft order, dan task relevan dapat disimpan offline. Pengguna melihat jumlah item menunggu sinkronisasi dan kegagalan yang perlu diperbaiki. Data tersimpan lokal dibatasi pada kebutuhan kerja dan dilindungi oleh mekanisme perangkat serta sesi.

**OFF-02 P0:** setiap mutation memiliki event ID, client_created_at, device timezone, payload version, dan idempotency key. Server menyimpan received_at dan effective event time. Waktu perangkat tidak dipercaya sebagai satu-satunya bukti; perubahan jam dan event terlambat ditandai.

**OFF-03 P0:** update event diproses dengan urutan kausal per objek. Checkout yang tiba sebelum check-in ditahan atau direkonsiliasi menggunakan event ID; tidak membuat durasi negatif. Retry memakai backoff dan tidak menggandakan attachment atau transaksi.

**OFF-04 P0:** approval harga/kredit dan konfirmasi order membutuhkan server. Draft offline diberi label belum tervalidasi; harga dan stok harus diperiksa ulang sebelum submit. Hak akses yang dicabut menolak mutation baru ketika kembali online dan mengarahkan pengguna untuk menyelesaikan exception data lokal.

**OFF-05 P0:** konflik field master memakai versi server dan review terarah. Aktivitas append-only dipertahankan sebagai event. Kegagalan upload foto tidak menghapus form; visit menampilkan bukti belum lengkap bila foto diwajibkan.

**OFF-06 P0:** logout memperingatkan pending event dan tidak menghapus draft yang sudah berhasil di-commit ke storage lokal aplikasi. Cache/outbox terikat identitas dan tidak tampil pada user lain. Web menguji persistensi setelah reload/restart browser pada browser pilot; eviction OS/browser, clear-site-data, private mode atau perangkat rusak tidak dijanjikan pulih tanpa sync. Status storage unsupported/full menahan label saved-locally. Aplikasi Android mengikuti aturan Room pada bagian 27.

## 22 Integrasi dan arsitektur yang disarankan

Gunakan backend modular dengan API, database transaksi, penyimpanan attachment privat, worker untuk sinkronisasi/notifikasi, dan reporting layer. Baseline framework dan layanan ditetapkan pada bagian 22.3. Tidak perlu memecah menjadi banyak microservice pada MVP.

### 22.1 Kanal aplikasi

Web responsif dibangun dahulu untuk telesales, supervisor, dan alur check-in berbasis tindakan pengguna. Setelah web stabil, bangun aplikasi Android native Kotlin sesuai bagian 27. PWA tidak dijadikan dasar janji tracking saat layar terkunci. Backend dan aturan bisnis tetap dipakai bersama oleh web serta Android.

### 22.2 Kontrak integrasi

**INT-01 P0:** import customer dan produk menyediakan dry-run, mapping kolom, validasi field, laporan error per baris, dan import batch ID. Baris valid dapat diterima sesuai mode yang dipilih; hasil parsial harus terlihat. Export atau import ulang tidak menghapus histori.

**INT-02 P0:** adapter ERP mengelola external ID, mapping status, unit, harga, dan currency. Sebelum terintegrasi otomatis, gunakan proses backoffice dengan daftar order menunggu konfirmasi dan referensi transaksi eksternal.

**INT-03 P1:** order dikirim melalui transactional outbox. Webhook mempunyai signature, timestamp, event ID unik, dan replay protection. Event yang terlambat tidak mengembalikan status final ke status lama. Rekonsiliasi berkala membandingkan status lokal dan eksternal, disertai antrean perbaikan.

**INT-04 P1:** CTI dan WhatsApp Business memakai provider resmi yang dipilih. Biaya panggilan, pesan, recording, dan kuota dihitung sebagai biaya integrasi. Tombol membuka WhatsApp hanya menunjukkan aplikasi eksternal dibuka; tidak membuktikan pesan terkirim atau dibaca.

**INT-05 P0 — Peta web.** Peta customer dan posisi terakhir dari check-in nyata tersedia pada rilis web; pin pelanggan bisa diinput Management, geocoding opsional. Sumber, umur dan akurasi lokasi terlihat. Garis GPS kontinu menunggu Android/P1. Tidak ada routing, ETA, map matching atau optimasi arah perjalanan pada peta rilis awal; generator masa depan mengikuti bagian 22.6. Basemap Geoapify dengan MapLibre mengikuti atribusi dan batas provider.

### 22.3 Baseline stack pembangunan

Arah stack Cloudflare yang telah dibahas diterima pengguna sebagai dasar pembangunan pada 16 Oktober 2026. Tabel berikut membakukan pilihan implementasi untuk menghilangkan ambiguitas spesifikasi. Ini merupakan baseline desain; resource produksi belum dibuat dan kapasitas belum dibuktikan oleh persetujuan ini.

| Lapisan | Baseline implementasi | Tanggung jawab |
| --- | --- | --- |
| Web | React, TypeScript dan Vite; aset statis pada Cloudflare Workers Static Assets | Web responsif supervisor, telesales dan sales lapangan; konfigurasi per environment |
| API | TypeScript dan Hono pada Cloudflare Workers | Autentikasi token, otorisasi scope, validasi, aturan bisnis dan API bersama Android |
| Database | Cloudflare D1; schema/migration SQL melalui Drizzle | Master, assignment, aktivitas, transaksi, target, forecast, insentif dan audit; indeks berdasarkan query terukur |
| Object storage | Cloudflare R2 privat | Attachment, arsip GPS terverifikasi, file import/export sementara dengan masa simpan; akses melalui API berizin |
| Identitas | Firebase Authentication, Google/email tanpa SMS pada baseline | Identitas bersama web/Android; backend memetakan identitas ke user dan organisasi serta memeriksa izin |
| Peta | MapLibre GL JS dengan basemap Geoapify pada baseline pilot | Marker pelanggan, lokasi terakhir dan garis GPS ketika tersedia; atribusi dan kuota provider dipantau; tidak memakai routing |
| Pekerjaan terjadwal | Workers Cron Triggers dan job/outbox di D1 | Reminder, rekonsiliasi, expiry dan arsip bertahap dengan checkpoint; setiap job idempotent |
| Monitoring awal | Log terstruktur Workers, metrik provider dan status job aplikasi | Error, freshness, queue age, kapasitas dan biaya; konfigurasi retensi/log budget menurut environment |
| Android tahap berikutnya | Kotlin, Jetpack Compose, Room dan WorkManager | Mengikuti bagian 27 dan kontrak API yang sama |

Layanan tambahan seperti queue khusus, email transaksional, CTI, WhatsApp Business, AI, atau analytics eksternal bukan dependensi wajib untuk menjalankan web pertama. Aktivasi layanan mengikuti kebutuhan, verifikasi batas paket yang berlaku saat implementasi, dan pengendalian biaya. Repository serta akun provider berada di bawah kendali pemilik produk. Proyek ini tidak mengubah ERP SUKE tanpa scope integrasi tersendiri.

### 22.4 Baseline desain database yang diterima

Pengguna menyetujui arah rancangan data pada bagian 20 sebagai dasar pembangunan: satu sumber data bersama untuk web/Android, organisasi sebagai batas isolasi, assignment bertanggal efektif, transaksi berversi, dan histori yang dapat diaudit. Persetujuan ini tidak dianggap sebagai tersedianya ERD fisik, DDL, atau hasil migrasi yang belum dibuat.

Kelompok tabel mencakup organisasi/cabang/kalender, user/role/scope/team, territory dan assignment, customer_outlet/contact, activity/visit/call/task/handoff, opportunity, order/line dan referensi realisasi, target/version, forecast/snapshot, incentive plan/credit/calculation/statement, attachment, import batch, integration outbox, serta audit. Schema fisik mengikuti field dan sumber kebenaran pada bagian 20.

Sebelum migration pertama, engineering menghasilkan ERD fisik, data dictionary, DDL dan indeks, aturan unik external reference per organisasi/sumber, tipe nilai uang dan pembulatan, serta matriks query-versus-scope. Nilai uang memakai representasi desimal/fixed-point yang eksplisit, bukan floating point untuk kalkulasi finansial. Uji mencakup transaksi atomik yang didukung storage, idempotensi, penolakan akses lintas organisasi, histori perpindahan owner, dan rekonsiliasi target/actual/insentif. Target, skema insentif dan attribution yang telah disahkan tidak ditimpa tanpa revisi sah.

Rilis web menyimpan lokasi kunjungan yang diperlukan; tabel GPS berfrekuensi tinggi dan arsip mengikuti tahap Android, sehingga web tidak menanggung volume tracking yang belum digunakan. Dev, staging dan produksi memakai resource terpisah; schema migration diuji dengan salinan data yang dianonimkan dan prosedur pemulihan sebelum diterapkan ke produksi.

### 22.5 Konvensi bersama setelah audit

Kontrak API v1.2 memakai customer_id sebagai nama publik untuk customer_outlet.id. Waktu assignment invoice ditetapkan per tanggal bisnis lokal dengan batas [effective_from_date, effective_to_date), karena sumber invoice bisa hanya memiliki tanggal tanpa jam; transfer intrahari masuk review bila timestamp transaksi tidak tersedia. UTC timestamps dipakai untuk audit dan event perangkat. Invoice_revision membekukan customer, area, rep, kanal, tanggal dan nilai agar perubahan mapping tidak mengubah statement lama. Credit note juga memiliki revision dan unique source identity.

Penetapan target organisasi/area/user/customer didukung pada web. Team pada MVP adalah subtree Supervisor yang disnapshot, bukan grup user bebas. Target kelompok produk memakai product_group_id; rollup tidak menjumlahkan parent bersama child. Historical weighting memakai rata-rata per bulan penuh tersedia untuk customer baru; customer mapan memakai tiga bulan penuh. Reserve onboarding ditetapkan Management dan tidak otomatis menggunakan actual bulan berjalan.

Model dan tarif insentif diperiksa melalui schema bertipe sesuai model; bonus milestone memiliki nominal/mode highest atau cumulative, bukan tarif kosong. Breakdown menyimpan nilai decimal sebelum pembulatan, lalu total half-up rupiah penuh. Negative revision delta disimpan terpisah; original payout tidak ditimpa. Decimal achievement dapat negatif setelah koreksi; target harus >0 untuk menghitung persentase.

MFA admin/approver tetap gate rollout. Firebase TOTP membutuhkan Firebase Authentication with Identity Platform; jangan menganggap Firebase email/Google login otomatis memenuhi MFA. WEB-011 harus membuktikan metode, provider, biaya dan konfigurasi yang dipilih sebelum produksi. Kuota free tier tetap batas kapasitas, bukan jaminan biaya Rp0 tanpa metering. D1 query dibagi sesuai batas parameter/CPU; job menyimpan checkpoint dan tidak mengandalkan satu request panjang untuk seluruh import.

### 22.6 Plan Visit Generator - keputusan komputasi lokal 23 Oktober 2026

Pengguna memilih komputer pribadi untuk menjalankan OSRM dan Python OR-Tools dahulu. Web/Workers tetap menerima permintaan, memeriksa role/scope dan menampilkan job asynchronous. Agent lokal mengambil job outbound melalui HTTPS; D1 menyimpan kebijakan, status dan metadata/versi agenda, R2 snapshot besar, sedangkan graph jalan aktif disimpan pada disk/RAM komputer. PostGIS, Cloudflare Containers dan provisioning compute berbayar tidak diperlukan pada tahap awal.

Alur: Generate Plan → snapshot input → queued → agent claim/heartbeat → OSRM matrix → OR-Tools harian/bulanan → upload draft → review/edit → publish agenda berversi. Komputer mati/sleep atau internet putus ditampilkan sebagai menunggu/terputus; lease, fencing, retry, cancel dan idempotency mencegah hasil lama atau agenda ganda. Agent mempunyai identitas mesin berizin minimum, dapat dicabut, terikat environment/organisasi dan tidak menerima kredensial database/admin umum. Tidak memerlukan port publik komputer sebagai baseline.

Mulai satu sales satu hari, lanjut satu sales satu bulan, lalu multi-sales sesuai assignment. Perhitungan mempertimbangkan kalender/cuti, jam kerja/istirahat dan customer, durasi, frekuensi/jeda, janji terkunci, prioritas layanan dan perjalanan jalan; data kosong bukan nol. Jadwal bulanan wajib lolos kelayakan rute harian. Hasil feasible/infeasible/timeout, asumsi, graph/profil/cutoff, kunjungan tidak terjadwal dan alasannya terlihat. Tidak menjanjikan optimum global atau traffic real-time. SR mengusulkan rencana sendiri; SPV/Area Manager meninjau sesuai scope, sedangkan konfigurasi model dan agent hanya Management/NSM. Review/publish memvalidasi ulang input stale, scope, idempotency, versi dan audit; histori visit/invoice/target/insentif tidak berubah.

Target biaya memakai perangkat tersedia tanpa tambahan sewa compute; listrik/internet, disk, pemeliharaan dan pemakaian cloud di atas kuota tetap diperhitungkan. Spesifikasi komputer/operator, wilayah pilot, profil transport, jumlah customer dan kapasitas dipastikan serta diukur pada WEB-070/074; belum ada benchmark atau setup runtime. Graph OSM dimulai wilayah pilot, bukan nasional tanpa profiling. Pengaturan retensi/checksum, data contract/ERD/migrasi dan API/agent dirinci pada WEB-069 sebelum coding; schema/API sekarang tidak dianggap otomatis mendukung generator.

Spesifikasi lengkap: [PVG-01 sampai PVG-07 dan sepuluh acceptance tambahan](Plan_Visit_Generator_v1.md). WEB-069–074 adalah M4 extension P1 Planned setelah fondasi GIS, bukan gate tambahan pilot web/staging/login atau Android. Scope tanpa routing WEB-016/063–068 tetap; generator adalah modul tersendiri. Keputusan ini mencatat perencanaan, belum pemasangan agent, perubahan runtime atau deployment.

## 23 Keamanan privasi dan retensi

**SEC-01 P0:** sesi menggunakan mekanisme autentikasi yang sesuai, pembatasan percobaan login, pengakhiran sesi perangkat, dan proteksi token. MFA untuk role admin dan approver tersedia sebelum rollout penuh. Rahasia integrasi hanya disimpan di server.

**SEC-02 P0:** akses lintas organisasi ditolak secara default. Attachment memakai URL akses terbatas waktu. Data dienkripsi dalam transit dan pada storage yang mendukung. Log aplikasi tidak memuat token, password, isi rekaman, atau nomor telepon lengkap secara tidak perlu.

**SEC-03 P0:** pelanggan dapat ditandai DNC dan preferensi kontaknya berlaku segera pada penugasan baru. Perubahan izin kontak menyimpan sumber, tujuan, kanal, dan waktu. Penghapusan suppression tidak boleh sekadar dilakukan agent untuk mengejar target; butuh izin serta bukti permintaan baru.

**SEC-04 P0:** lokasi sales dikumpulkan sesuai fitur, sesi kerja, dan penjelasan yang diberikan. Supervisor melihat scope yang diperlukan. Tidak ada pemantauan mikrofon atau pelacakan pribadi di luar alur produk.

**SEC-05 P0:** kebijakan retensi disetujui organisasi sebelum go-live. Usulan retensi GPS untuk pilot: detail tujuh hari di D1 dan arsip terverifikasi di R2 sampai umur total 90 hari; ketentuan detail pada bagian 27. Foto kunjungan 180 hari, rekaman 90 hari jika diaktifkan, dan audit operasional 24 bulan tetap menjadi usulan untuk persetujuan organisasi. Data transaksi mengikuti kebutuhan pencatatan perusahaan. Angka ini merupakan default desain, bukan pernyataan kewajiban hukum.

Retention job menghormati legal hold dan relasi transaksi, menghasilkan audit penghapusan, dan mengelola salinan backup sesuai kebijakan expiry. Permintaan akses, koreksi, dan penghapusan data masuk workflow terkontrol. Tim yang berwenang memvalidasi kebijakan privasi dan penggunaan rekaman sebelum fitur terkait diaktifkan.

## 24 Kebutuhan nonfungsional

| ID | Kebutuhan | Kriteria penerimaan |
| --- | --- | --- |
| NFR-01 | Respons cepat | P95 baca API inti di bawah 800 ms dan tulis di bawah 1,5 detik pada beban desain; upload dan layanan eksternal diukur terpisah |
| NFR-02 | Pengalaman halaman | P95 customer summary dan queue siap dipakai dalam 3 detik pada jaringan 4G uji yang disepakati |
| NFR-03 | Ketersediaan | Target bulanan 99,5% untuk layanan inti; maintenance dan perhitungan downtime didefinisikan di runbook |
| NFR-04 | Pemulihan | Target RPO 15 menit dan RTO 4 jam untuk data transaksi; dibuktikan dengan restore drill sebelum go-live |
| NFR-05 | Sinkronisasi | P95 batch event kecil ter-ack dalam 60 detik setelah dikirim pada koneksi stabil dan sesi valid; waktu tunggu batch, umur data sejak direkam, dan attachment diukur terpisah |
| NFR-06 | Freshness dashboard | Data aktivitas online tersedia dalam 2 menit P95; tampilkan waktu refresh dan late event |
| NFR-07 | Isolasi dan audit | Seluruh mutation kritis dan ekspor sensitif terlacak; uji negatif cross-tenant lulus |
| NFR-08 | Perangkat | Uji pada minimum tiga kelas Android pilot dan browser desktop versi yang disepakati |
| NFR-09 | Konsumsi baterai | Bila tracking native aktif, tetapkan budget berdasarkan uji shift delapan jam dan perangkat nyata sebelum rollout; target awal tambahan konsumsi maksimal 15 poin persentase |
| NFR-10 | Observability | Monitor API error, queue age, provider delay, webhook reject, duplicate suppression, dan order pending; alert memiliki owner |
| NFR-11 | Aksesibilitas | Alur inti dapat diselesaikan dengan keyboard desktop dan pembaca layar; pesan error terhubung ke field |

Target performa diuji dengan profil data dan concurrency terdokumentasi. Gangguan provider ditampilkan sebagai degraded service; tidak disamarkan sebagai hasil sukses.

## 25 Acceptance test lintas modul

Skenario berikut menjadi minimum UAT. Pemilik hasil bisnis adalah sales operations bersama supervisor, dengan QA memastikan invariant teknisnya.

| UAT | Skenario | Hasil yang wajib terlihat | Kebutuhan |
| --- | --- | --- | --- |
| 01 | Sales hanya punya territory A | Tidak dapat membaca atau mengekspor territory B di luar izin | RBAC-01 |
| 02 | Dua outlet berbagi nomor | Kandidat duplikat ditinjau; outlet sah tidak digabung otomatis | CUS-02 |
| 03 | Dua agent mengambil queue bersamaan | Satu lease aktif; agent kedua mendapat item lain atau alasan | TEL-03 |
| 04 | Pelanggan meminta DNC | Queue baru mengecualikan kontak; tindakan tercatat | TEL-07, SEC-03 |
| 05 | Kunjungan aktif dan telesales bersamaan | Peringatan dan hold sesuai cooldown; pengecualian beralasan | COO-02 |
| 06 | Panggilan manual diberi outcome tersambung | Tetap declared; tidak masuk talk time provider | TEL-04 |
| 07 | Webhook call dikirim tiga kali | Satu attempt dengan status final konsisten | TEL-09 |
| 08 | Callback dijadwal ulang setelah terlambat | Histori overdue awal tetap dapat dilaporkan | TEL-06 |
| 09 | Handoff ditolak | Alasan dan pekerjaan kembali terlihat pada pengirim/supervisor | COO-03 |
| 10 | Visit offline lalu restart aplikasi | Form pulih; sync membentuk satu visit | OFF-01, OFF-06 |
| 11 | Checkout tiba lebih dahulu | Event direkonsiliasi; durasi tidak negatif | OFF-03 |
| 12 | GPS akurasi buruk | Pending review dengan konteks; bukan fraud otomatis | FLD-03 |
| 13 | Izin lokasi ditolak | Penjelasan, retry, atau exception sesuai kebijakan | FLD-03 |
| 14 | Foto wajib gagal upload | Form tetap ada; bukti belum lengkap terlihat | OFF-05 |
| 15 | Double-click submit order | Satu order dengan ID yang sama | ORD-05 |
| 16 | ERP menerima order lalu koneksi timeout | Status menunggu konfirmasi; rekonsiliasi menemukan order tanpa duplikasi | ORD-05, INT-03 |
| 17 | Harga direvisi setelah approval | Approval relevan dijalankan ulang | ORD-03 |
| 18 | Pelanggan pindah owner | Histori sales terdahulu tetap; akses mengikuti scope baru | RBAC-03, CUS-03 |
| 19 | Akurasi KPI coverage | Contoh 100 outlet menghasilkan 65%, bukan jumlah aktivitas | Bagian 15 |
| 20 | Denominator KPI nol | Tidak berlaku; tidak tampil 0% atau 100% palsu | Bagian 15 |
| 21 | Rencana diubah setelah hari berakhir | Versi awal tersimpan; completion tidak membaik diam-diam | FLD-01 |
| 22 | Opportunity dipindah ke Won tanpa order | Ditolak atau mengikuti definisi terkonfigurasi yang eksplisit | CRM-02 |
| 23 | Login user lain pada perangkat bersama | Data dan queue user sebelumnya tidak tampil | OFF-06 |
| 24 | Hak akses dicabut saat offline | Server menolak mutation baru; exception lokal dapat ditangani | OFF-04 |
| 25 | Webhook status lama tiba setelah final | Status final tidak mundur | INT-03 |
| 26 | Restore backup transaksi | Data pulih dalam RPO/RTO; hasil rekonsiliasi dapat diaudit | NFR-04 |
| 27 | Tracking native di luar sesi kerja | Tidak ada sample baru yang dikumpulkan oleh fitur | FLD-07, SEC-04 |
| 28 | Permintaan ekspor tanpa izin | Ditolak walau user dapat melihat dashboard | RBAC-01 |
| 29 | Status stok kedaluwarsa | Sumber dan umur data terlihat; tidak memberi janji tersedia | ORD-04 |
| 30 | User mencoba approve order sendiri | Diblokir dan diarahkan ke approver lain | RBAC-02 |
| 31 | Invoice eligible Rp10 juta merealisasikan Committed | Actual naik Rp10 juta dan residual turun sama; proyeksi tidak bertambah dua kali | FRC-05 |
| 32 | Repeat order dan opportunity untuk kebutuhan sama | Link atau review overlap sebelum agregasi; satu contribution utama | FRC-04, FRC-05 |
| 33 | Deal Won belum diinvoicing | Tidak masuk actual invoice | FRC-01 |
| 34 | Owner berpindah setelah snapshot | Snapshot lama tetap pada hierarchy awal | FRC-08 |
| 35 | Close date bergeser ke bulan berikutnya | Slippage dan pengurangan periode awal terlihat | FRC-09 |
| 36 | Supervisor memberi manager forecast | Angka alternatif tidak dijumlahkan dengan estimasi sales | FRC-07 |
| 37 | Actual evaluasi nol | WAPE/bias tidak berlaku dan error absolut ditampilkan | FRC-10 |
| 38 | Klik gap forecast | Daftar customer sumber dan pembuatan kunjungan/callback tersedia | FRC-06 |
| 39 | Realisasi invoice parsial | Hanya nilai residual yang tetap terbuka | FRC-05 |
| 40 | Forecast berbeda basis atau satuan | Tidak dijumlahkan; UI menjelaskan basis yang tidak kompatibel | FRC-01 |
| 41 | Target Rp100 juta dan actual Rp125 juta pada contoh tier | Seluruh basis Rp2,5 juta; progresif Rp600 ribu | INC-06 |
| 42 | Achievement tepat pada ambang 80% | Pemilihan jenjang deterministik dan preview menunjukkan lompatan mode seluruh basis | INC-05, INC-08 |
| 43 | Target nol atau belum disahkan | Needs review; tidak membagi nol atau menganggap hasil final nol | INC-01 |
| 44 | Tarif aktif diubah | Versi baru dibuat; statement lama tetap | INC-09 |
| 45 | Dua komponen tumpang tindih tanpa aturan stacking | Aktivasi ditolak sampai konflik terselesaikan | INC-07 |
| 46 | Invoice Rp10 juta melibatkan aktivitas dua kanal | Satu kanal primer Rp10 juta; kanal bantuan tidak mendapat actual kedua; split pilot ditolak | INC-10 |
| 47 | Run yang sama diulang | Hasil sama dan entitlement tidak ganda | INC-11, INC-12 |
| 48 | Retur setelah statement dibayar menurunkan jenjang | Selisih dihitung dengan rule/target periode asli dan menjadi adjustment terpisah | INC-15 |
| 49 | Export diulang | Batch/revision dapat dikenali; tidak menjadi pembayaran atau entitlement baru | INC-16 |
| 50 | Sales mengakses statement rekan atau approve miliknya | Akses ditolak sesuai scope dan pemisahan approver | INC-02, INC-19 |
| 51 | Scorecard berbobot 110% atau KPI hilang | Bobot tidak valid ditolak; missing metric mengikuti rule eksplisit | INC-17 |
| 52 | Pool team dibagi ke anggota | Total alokasi sama dengan pool setelah pembulatan; tidak dihitung dua kali | INC-18 |
| 53 | Gate web belum diterima | Implementasi Android belum masuk tahap build; kontrak dan isu blocker tercatat | AND-01 |
| 54 | Android dan web memakai akun sama | Scope, customer, task dan angka snapshot konsisten | AND-02, AND-04 |
| 55 | Izin lokasi approximate atau ditolak | Akurasi/status terlihat dan tersedia alur perbaikan; tidak memberi label valid palsu | AND-06, AND-09 |
| 56 | Shift dimulai lalu layar dikunci | Uji service/indikator dan pencatatan pada HP nyata; gap tercatat bila OS membatasi | AND-08, AND-21 |
| 57 | End Shift saat offline | Pengambilan GPS berhenti lokal dan event akhir menunggu sync | AND-08 |
| 58 | Batas sesi lokal tercapai | Pengambilan berhenti sesuai aturan dan alasan terlihat | AND-11 |
| 59 | Force-stop atau reboot | Tidak mengklaim tracking kontinu atau resume diam-diam; user mendapat status saat membuka app | AND-11 |
| 60 | Crash setelah saved locally | Event/form pulih setelah aplikasi dibuka | AND-13 |
| 61 | Timeout batch setelah server menyimpan | Retry tidak membuat event/order ganda dan ack dapat dipulihkan | AND-14 |
| 62 | Batch lama diterima setelah lokasi baru | Posisi terakhir tidak mundur | AND-12 |
| 63 | Token atau akses dicabut | Refresh/reject sesuai policy; data akun lain tetap terisolasi | AND-02, AND-15 |
| 64 | Upload foto gagal | Visit/form tetap ada; bukti pending terlihat | AND-16 |
| 65 | R2 gagal atau digest arsip tidak cocok | GPS hot tidak dihapus dari D1 | AND-18 |
| 66 | Job arsip crash lalu diulang | Satu manifest verified yang konsisten, tidak kehilangan titik | AND-18 |
| 67 | GPS terlambat untuk hari yang sudah diarsipkan | Segmen tambahan tercatat dan perjalanan tidak ganda | AND-14, AND-18 |
| 68 | Supervisor membuka perjalanan lama | Dibaca dari manifest/R2 sesuai scope; gap dan timestamp tetap terlihat | AND-20 |
| 69 | Upgrade APK ketika masih ada antrean | Migrasi mempertahankan event dan retry | AND-22 |
| 70 | Disk mendekati penuh | Warning dan pembatasan lampiran tanpa menghapus event belum ack | AND-13 |
| 71 | Budget penyimpanan/request mendekati batas | Alert muncul; tidak upgrade berbayar atau menghapus data bisnis otomatis | AND-19 |
| 72 | Build kandidat akan didistribusikan | Signing, kepemilikan akun, package registration serta jalur distribusi lolos checklist | AND-22, AND-23 |
| 73 | Invoice header memiliki beberapa line dan diimport ulang | Header dihitung sekali; line unik; total sama dengan sumber | INT-01, Bagian 20.1 |
| 74 | Owner berpindah 16 Oktober | Invoice sebelum/sesudah mengikuti atribusi bertanggal efektif; konflik masuk review | CUS-03, RBAC-03 |
| 75 | Customer tepat 90 dan 91 hari sejak invoice | Aktif pada batas 90 hari; Churn pada 91 hari berdasarkan tanggal bisnis | CUS-06 |
| 76 | Target bottom-up dan top-down dijalankan | Masing-masing sama dengan parent; tidak dijumlahkan antar skenario | TGT-01, FRC-07 |
| 77 | Customer baru belum memiliki histori bulan penuh | Gunakan target onboarding; tidak memakai penjualan masa depan | FRC-07 |
| 78 | AM Area A meminta daftar atau ekspor Area B | Backend menolak akses walau mengetahui ID | RBAC-01 |
| 79 | SR atau AM mencoba mengubah skema/target | Ditolak; konfigurasi hanya Management/NSM | RBAC-01, INC-02 |
| 80 | Insentif 80%, 81%, 102% dan role berbeda | Sesuai contoh progresif; pembulatan rupiah; tidak ada finalisasi otomatis | INC-06, INC-14 |
| 81 | Retur setelah statement final | Revision dan selisih terlacak; statement original tetap tersedia | INC-15 |
| 82 | Sync gagal setelah dashboard direfresh | Timestamp sumber tidak maju; stale/provisional dan data belum tersedia jujur | NFR-06, Bagian 20.2 |

UAT 53–72 menjadi gate rilis Android setelah web, bukan gate pilot web awal. UAT 07, 16, 25, dan 27 dijalankan ketika fitur integrasi atau tracking terkait masuk rilis. UAT 34, 35, dan 37 mengikuti rilis snapshot serta evaluasi forecast P1. UAT 51–52 mengikuti rilis model insentif lanjutan P1. MVP manual tetap harus memenuhi UAT idempotensi, status verifikasi, dan rekonsiliasi backoffice yang relevan.

## 26 Tahapan implementasi

### Tahap 0 Validasi operasional

Durasi indikatif dua minggu. Validasi master pelanggan, owner, territory, stage pipeline, outcome, definisi penjualan, SLA, dan kebutuhan tracking. Amati minimal satu siklus kerja sales lapangan dan telesales. Buat prototipe agenda, workbench, customer 360, serta exception inbox. Tetapkan baseline dan acceptance test bersama supervisor. Sepakati parameter model insentif awal, basis invoice yang telah diputuskan, atribusi primer, cutoff, perlakuan retur, role pengatur/approver, serta contoh hitung yang menjadi acuan UAT.

### Tahap 1 Pengembangan web dan backend

Scope penerimaan mengikuti bagian 6.1. Implementasikan bertahap: fondasi identitas/scope/master; distribusi customer dan pekerjaan sales; transaksi/target serta monitoring; lalu forecast/insentif P0 dan hardening. Setiap increment memakai data pilot yang dapat direkonsiliasi; rilis web pertama tetap harus memenuhi seluruh gate yang disepakati. Baseline stack dan database mengikuti bagian 22.3–22.4.

Bangun web responsif dan API bersama terlebih dahulu: autentikasi, scope akses, customer master, assignment, agenda, check-in/out berbasis tindakan, queue telesales, outcome, callback, handoff, pipeline, order, approval, dashboard, forecast dasar, konfigurasi dan kalkulasi insentif P0, audit, import, serta rekonsiliasi. Sediakan penyimpanan draft web dan penanda status sinkronisasi sesuai kemampuan browser. Native tracking belum menjadi deliverable tahap ini.

Exit gate: UAT P0 web lulus; akses lintas scope ditolak; order idempotent; angka target/actual/insentif dapat direkonsiliasi; API berversi terdokumentasi; error contract stabil; serta tidak ada isu kritis kehilangan data. Backend menyediakan endpoint mobile dan strategi GPS/arsip sebelum Android mulai dibangun.

### Tahap 2 Pilot web dan stabilisasi

Pilot indikatif empat minggu pada satu cabang, menggunakan web untuk telesales/supervisor dan check-in lapangan dasar. Jumlah peserta disepakati sesuai kapasitas gratis yang terukur. Kumpulkan baseline penggunaan, kualitas master, hasil transaksi, serta feedback. Pilot web tidak dipakai untuk menyimpulkan keandalan tracking latar belakang Android.

Gate menuju Android: product owner dan QA menerima alur inti web; contract test API serta data dictionary tersedia; target/model insentif pilot sudah jelas; dan daftar perangkat serta jalur distribusi Android disepakati. Desain antarmuka Android dapat disiapkan sebelumnya, tetapi pembangunan aplikasi dilakukan setelah gate ini.

### Tahap 3 Pembangunan Android sales lapangan

Bangun aplikasi native Kotlin dan Jetpack Compose sesuai bagian 27, dengan Room untuk antrean lokal, tracking sesi kerja melalui komponen Android yang sesuai, serta WorkManager untuk sinkronisasi tertunda. Tahap internal: fondasi/login, pekerjaan sales, offline/sync, tracking, integrasi peta web, hardening, lalu release candidate.

Exit gate: seluruh UAT Android lulus pada perangkat nyata; tidak ada tracking di luar sesi lokal yang sah; ack/retry serta arsip tidak menghilangkan atau menggandakan data; status last seen jujur; dan build release ditandatangani dengan kepemilikan akun/keystore yang benar. Dokumen APK/AAB dan prosedur update tersedia sebelum pilot lapangan.

### Tahap 4 Pilot Android dan rollout bertahap

Uji indikatif dua sampai empat minggu pada lima sampai sepuluh sales dengan variasi HP dan jaringan. Gunakan jalur distribusi yang sesuai untuk aplikasi perusahaan. Lakukan uji layar terkunci, pindah aplikasi, jaringan putus, reboot, dan pemulihan data selama shift nyata. Review baterai, disk lokal, jumlah GPS, query D1, storage R2, serta penggunaan peta. Tambah peserta hanya setelah gate kapasitas dan kualitas terpenuhi.

### Tahap 5 Integrasi dan penyempurnaan

Aktifkan snapshot/review forecast lanjutan, model insentif P1, integrasi ERP/CTI bila dibutuhkan, dan kontrol komersial pendukung. AI bersifat opsional. Perluasan routing dan optimasi kini disetujui sebagai Plan Visit Generator WEB-069–074 (keputusan 23 Oktober 2026), dengan komputer pribadi sebagai compute awal sesuai bagian 22.6. Pembangunannya bertahap setelah fondasi GIS, tanpa menambah gate pilot web atau Android; seluruh item masih Planned. Setiap integrasi mempunyai kontrak, sandbox, rekonsiliasi, monitoring, dan pemilik operasional.

Asumsi perencanaan: product owner, designer, backend/web engineer, Android engineer, QA, serta sales ops. Estimasi versi sebelumnya tidak menjadi komitmen untuk scope ini. Estimasi Android disusun setelah API stabil dan survei perangkat; tahap web dan Android mempunyai estimasi, biaya, serta acceptance terpisah. Target biaya layanan pilot adalah Rp0 selama kuota dan syarat provider terpenuhi; waktu pengembangan, perangkat, distribusi, dan biaya di atas kuota dihitung terpisah.

## 27 Pembangunan aplikasi Android setelah web

### 27.1 Tujuan dan batas tahap Android

Android adalah antarmuka kerja sales lapangan pada sistem yang sama dengan web. Aplikasi menyediakan agenda, customer, kunjungan, order, task/handoff, progres target, estimasi insentif, dan tracking sesi kerja. Telesales serta supervisor tetap menggunakan web. Perhitungan final target, forecast, dan insentif berada pada backend; Android tidak mempunyai rumus resmi yang terpisah.

Android tidak dibuat sebagai browser yang hanya membuka halaman web. Pilihan rencana adalah native Kotlin dan Jetpack Compose. Toolkit, SDK, dan versi dependency dikunci saat implementasi berdasarkan kompatibilitas serta kebijakan rilis yang berlaku. Dukungan awal minimum Android 10 merupakan usulan; survei HP pilot harus mengonfirmasi atau merevisi keputusan ini. Target SDK mengikuti ketentuan jalur distribusi saat rilis.

### 27.2 Stack dan pembagian tanggung jawab

| Bagian | Pilihan rencana | Tanggung jawab |
| --- | --- | --- |
| Android UI | Kotlin, Jetpack Compose, Material | Agenda, customer, kunjungan, order dan progres |
| Local data | Room di atas SQLite | Cache assigned, draft, event dan antrean upload |
| Location | API lokasi Android atau fused provider yang didukung | Koordinat, akurasi, timestamp dan diagnostics |
| Tracking | Foreground service bertipe location | Sesi tracking yang terlihat oleh pengguna |
| Deferred sync | WorkManager | Retry dan pengiriman pekerjaan persisten sesuai constraint |
| Network | HTTPS client dengan auth dan timeout | Komunikasi API Cloudflare |
| Shared backend | Workers dan API versioned | Otorisasi, validasi, workflow, kalkulasi dan ack |
| Data pusat | D1 | Record bisnis, posisi terakhir, GPS terbaru dan manifest |
| File pusat | R2 Standard | Foto privat dan arsip GPS terkompresi |
| Peta supervisor | Leaflet dan provider berbasis OSM yang memenuhi syarat | Marker pelanggan, posisi terakhir dan garis GPS |

Provider awal peta yang diusulkan Geoapify Free, tunduk kuota dan atribusi. Maps/routing bukan sumber GPS; lokasi dikumpulkan di perangkat dan dikirim melalui API. Google Maps dapat dibuka lewat link sebagai bantuan navigasi opsional pengguna, tanpa layanan routing di backend produk. Maps library Android dapat diputuskan saat detail desain; halaman peta tidak menjadi syarat untuk merekam check-in.

### 27.3 Kontrak API bersama

**AND-01 — Gate web dan ownership.** Mulai pembangunan setelah exit gate tahap 2. Tetapkan package ID milik organisasi, repository mobile, pemilik release, environment dev/staging/prod, dan akses ke signing key. Master customer, role, target, dan skema insentif dipakai bersama; tidak dibuat salinan master terpisah yang harus dikelola manual.

**AND-02 — Autentikasi.** Pakai provider identitas yang sama dengan web; kandidat awal Firebase Authentication Google/email tanpa SMS. Android mengirim token yang diverifikasi backend; server menentukan user dan organisasi, bukan mempercayai organization_id dari payload. Token kedaluwarsa memicu refresh yang sesuai. Logout, device revoke, dan pergantian akun mengisolasi cache. Tidak ada kredensial D1/R2 atau rahasia provider di APK.

**AND-03 — API versioned.** Kontrak minimum mencakup profile/permissions, assignment dan customer delta, target/incentive read, shift start/end, visit events, draft/submit order, task/handoff, location batch, attachment intent/finalization, sync status, dan diagnostics. Dokumentasikan field wajib, error code, idempotency, pagination, version conflict, server time, serta batas batch. Nama endpoint final mengikuti desain API; semantik tidak bergantung pada UI.

**AND-04 — Antarmuka dan provenance.** Semua event membawa event_id, device/session ID, sequence, event time, timezone, payload version, dan client version. Server menambahkan received_at. Aktivitas web dan Android tampil dalam timeline yang sama dengan sumbernya. Server memeriksa assignment serta policy pada waktu kejadian/penerimaan sesuai jenis event; perubahan akses dan data terlambat menjadi exception yang eksplisit.

### 27.4 Layar dan pekerjaan sales

**AND-05 — Layar wajib.** Login dan onboarding izin; agenda hari ini; customer summary; detail/outcome visit; draft order; task serta handoff; target dan estimasi insentif; shift/tracking status; sync center; pengaturan akun dan diagnostics. Aksi utama terlihat tanpa navigasi panjang. Sales tidak dapat mengubah tarif insentif atau menyetujui transaksi sendiri melalui Android.

**AND-06 — Kunjungan.** Terapkan field dan aturan FLD yang sama dengan web. Ambil lokasi baru pada check-in/out dengan timeout dan batas umur lokasi; tampilkan akurasi dan kegagalan. Pin outlet serta lokasi perangkat dibedakan. Check-in offline boleh disimpan untuk review sesuai aturan, bukan otomatis memperoleh status valid. Draft form bertahan setelah proses aplikasi dihentikan.

**AND-07 — Order dan tindak lanjut.** Order offline berstatus draft belum tervalidasi. Harga, kredit, promo dan assignment diperiksa server saat submit; status ambiguous tetap menunggu konfirmasi. Next action dan handoff di Android menghasilkan task yang terlihat pada web telesales; perubahan dari web dikirim melalui delta sync. Informasi target dan insentif cache diberi timestamp serta label estimasi bila relevan.

### 27.5 Sesi tracking dan izin Android

**AND-08 — Mulai dan akhir sesi.** User memulai tracking dari layar aplikasi yang terlihat. Tampilkan tujuan, status izin, sesi kerja, serta indikator/notifikasi saat service aktif. Pilihan default pilot meminta start online agar assignment dan batas sesi dapat diverifikasi; awal shift offline memerlukan kebijakan terpisah sebelum diaktifkan. End Shift menghentikan pengambilan GPS secara lokal meskipun jaringan putus dan mengantrekan event akhir untuk server.

**AND-09 — Izin minimum dan lifecycle.** Gunakan foreground service bertipe location dengan permission dan runtime prerequisite sesuai Android yang ditargetkan. Jangan meminta always-on/background permission secara otomatis bila alur start service dari UI sudah cukup; setiap kebutuhan tambahan harus mempunyai alasan produk dan memenuhi pembatasan OS. Izin approximate, penolakan izin, GPS mati, notifikasi dibatasi, dan izin dicabut saat berjalan mempunyai state serta penanganan eksplisit. WorkManager tidak dipakai sebagai sampler GPS setiap satu menit.

**AND-10 — Kebijakan sampling.** Default pilot yang dapat dikalibrasi: lokasi sekitar setiap 60 detik ketika bergerak, lebih jarang sekitar lima menit ketika diam, dan snapshot pada aksi check-in/out. Interval adalah target best effort, bukan jaminan OS. Deteksi gerak memakai sumber yang tersedia; permission tambahan hanya diminta bila benar-benar digunakan. Hindari mengaktifkan sensor akurasi tinggi terus-menerus saat tidak diperlukan.

**AND-11 — Batas sesi.** Ada batas maksimum sesi lokal, usulan 12 jam dengan pengingat sebelum habis, agar tracking tidak berlanjut tanpa batas karena End Shift terlupa. Batas shift lintas hari ditetapkan organisasi. Aplikasi tidak mulai tracking sendiri setelah reboot atau logout. Force-stop, pembatasan OS/OEM, atau baterai habis dapat membuat gap; saat user membuka kembali, jelaskan status dan minta resume melalui alur yang sah. Tidak menjanjikan kemampuan mengatasi force-stop.

**AND-12 — Kualitas GPS.** Simpan lat/lon, horizontal accuracy, captured_at, received_at, sequence, shift/device ID, serta speed jika tersedia. Battery dan diagnostics diambil secukupnya. Simpan penanda poor accuracy, clock skew, dan loncatan tidak wajar tanpa menuduh sales otomatis. Data yang difilter untuk tampilan tetap dapat dibedakan dari sumber. Titik lama yang baru tersinkron tidak boleh memundurkan posisi terakhir yang lebih baru dan sah.

### 27.6 Offline sinkronisasi dan attachment

**AND-13 — Antrean persisten.** Simpan record dan event pending di Room sebelum UI mengonfirmasi tersimpan lokal. Bedakan saved locally, queued, syncing, acknowledged, dan needs review. Rancangan kapasitas lokal menampung minimal tujuh hari event pilot dan attachment sesuai budget disk yang ditetapkan. Jika disk hampir penuh, beri peringatan dan hentikan pengambilan attachment besar terlebih dahulu; jangan menghapus event belum ack secara diam-diam. Data hilang karena uninstall atau clear storage tidak dijanjikan dapat pulih tanpa backup.

**AND-14 — Batch dan retry.** Kirim batch kecil dengan idempotency key stabil, sequence dan payload hash. Target kirim saat sesi aktif dan online sekitar satu sampai dua menit; retry tertunda lewat WorkManager mengikuti penjadwalan OS, tidak dijanjikan tepat waktu. Respons berisi ack atau error per event dan commit state yang jelas. Retry timeout memakai batch yang sama; ack hanya setelah penyimpanan server durable. Dua pengirim paralel dikoordinasikan agar tidak menggandakan event. Pertahankan metadata dedupe di server setidaknya selama window retry/offline yang didukung.

**AND-15 — Konflik dan akses dicabut.** Pembaruan master memakai cursor/version server. Perubahan transaksi bersamaan menghasilkan conflict dengan langkah penyelesaian. Hak akses dicabut menghentikan penerimaan event baru sesuai policy dan membersihkan data yang tidak boleh tersedia saat koneksi kembali. Untuk periode offline, sesi memiliki expiry lokal; backend tidak mengklaim pencabutan jarak jauh berlaku instan tanpa konektivitas. Catat exception agar pekerjaan sah sebelum pencabutan tidak hilang tanpa penjelasan.

**AND-16 — Foto dan file.** Kompres foto sebelum upload; budget awal rata-rata 300 KB dengan batas maksimum terkonfigurasi, lalu uji keterbacaan bukti. Upload melalui API atau upload intent berumur pendek yang dibatasi pemilik, ukuran, dan tipe. Finalisasi memverifikasi file dan mengaitkannya ke visit. Form tidak hilang saat upload gagal. GPS/event inti mempunyai prioritas upload lebih tinggi daripada foto. R2 bucket privat; download diperiksa sesuai scope.

### 27.7 Hemat D1 dan arsip GPS di R2

**AND-17 — Pembagian data.** D1 menyimpan satu record posisi terakhir per sales, lokasi check-in/out yang menjadi bukti bisnis, detail GPS terbaru tujuh hari, serta manifest arsip. Histori perjalanan lebih lama disimpan di R2 sebagai segmen terkompresi per organisasi, sales, shift, dan tanggal. Default total retensi GPS 90 hari dari waktu kejadian memerlukan persetujuan organisasi; legal hold mengalahkan expiry. Tidak semua GPS disimpan selamanya di D1.

**AND-18 — Arsip terverifikasi.** Job bertahap membuat file dari rentang event yang konsisten, menulis ke key berversi, lalu memverifikasi digest, jumlah event, rentang waktu/sequence, dan kemampuan baca kembali. Manifest di D1 berpindah pending ke verified sebelum data hot dihapus dalam batch. Bila upload/verifikasi gagal, data D1 dipertahankan. Job idempotent dan dapat dilanjutkan setelah crash; hapus hanya event yang tercakup manifest verified. Event terlambat masuk segmen tambahan, tidak menimpa file lama tanpa revisi.

Simpan metadata penerimaan/idempotensi secara ringkas agar retry lama tidak membuat salinan GPS yang sudah diarsipkan. Arsip bukan pengganti backup record bisnis. Uji restore satu perjalanan dari R2 dan rekonsiliasi manifest sebagai bagian acceptance, termasuk migrasi schema file.

**AND-19 — Budget kapasitas.** Tetapkan budget per organisasi untuk D1 size/rows read/write, jumlah request API, R2 storage/operations, serta map credits. Uji contoh 50 sales, delapan jam, 26 hari, dengan GPS satu menit: 624.000 titik per bulan. Pada asumsi ilustratif 300 byte/titik, payload mentah sekitar 187 MB/bulan sebelum indeks dan metadata; footprint nyata diukur, bukan dianggap ukuran SQLite final. Write posisi terakhir, indeks, dedupe dan deletion arsip juga dihitung. Alarm bertingkat pada 70%, 85%, dan 95% budget; tidak ada upgrade berbayar otomatis.

D1 Free saat pengecekan membatasi satu database 500 MB; R2 Standard mempunyai kuota gratis storage 10 GB-month dengan batas operasi tersendiri [14–15]. Kuota account dapat dipakai proyek lain. Worker Free mempunyai batas CPU sehingga arsip, laporan, serta kalkulasi besar harus dibagi menjadi pekerjaan kecil dengan checkpoint. Jika budget tidak mencukupi, operator meninjau sampling/retensi atau menyetujui perubahan paket sebelum memperluas pilot; data bisnis tidak dihapus untuk mengejar gratis.

### 27.8 Tampilan posisi dan jejak pada web

**AND-20 — Marker dan garis yang jujur.** Web supervisor mengambil posisi terakhir dari API dan memperbarui sekitar 15–30 detik selama layar monitoring aktif. Tampilkan captured_at, received_at, accuracy, dan status stale; threshold awal stale lima menit dapat dikonfigurasi. Umur lokasi tidak sama dengan umur refresh dashboard. Refresh lambat saat tab tidak aktif; hentikan polling saat halaman ditinggalkan.

Garis memakai titik yang benar-benar terekam, urut sesuai sesi, dengan pemisahan pada gap besar atau loncatan invalid. Default gap pemisah lebih dari sepuluh menit merupakan parameter pilot. Jangan menyambung gap sebagai perjalanan teramati. Tidak ada penghitungan rute jalan atau road snapping. Perjalanan terbaru dibaca dari D1; histori arsip dibaca melalui API yang memeriksa scope serta manifest R2. Tidak memuat seluruh histori semua sales sekaligus.

### 27.9 Pengujian perangkat dan kualitas rilis

**AND-21 — Matriks perangkat.** Minimum tiga kelas HP nyata dari armada pilot, mencakup versi Android minimum yang dipilih dan versi terbaru yang tersedia bagi peserta, variasi OEM, RAM, serta battery saver. Uji shift delapan jam, screen lock, pindah aplikasi, koneksi berubah, token expiry, izin dicabut, force-stop, reboot, storage hampir penuh, dan pembaruan aplikasi dengan antrean pending. Emulator membantu uji fungsi tetapi tidak menggantikan uji GPS/baterai nyata.

Kriteria pilot: tidak ada event yang sudah dikonfirmasi tersimpan lokal hilang akibat crash/restart aplikasi biasa; tidak ada order/event ganda akibat retry; tracking berhenti lokal saat End Shift; status gap/stale terlihat; dan semua angka target/insentif cocok dengan web untuk snapshot yang sama. Ukur tambahan konsumsi baterai terhadap perangkat kontrol; target awal maksimal 15 poin persentase per shift dievaluasi pada kondisi sebanding. P95 event kecil ter-ack 60 detik dihitung setelah batch dikirim pada koneksi stabil; umur lokasi end-to-end dilaporkan terpisah.

### 27.10 Build signing distribusi dan update

**AND-22 — Build yang dapat direproduksi.** Siapkan debug/staging untuk pengembangan, signed APK untuk jalur uji yang sesuai, dan release APK/AAB sesuai distribusi. Simpan keystore, password, dan recovery di bawah kendali organisasi; jangan commit ke repository. Naikkan versionCode setiap rilis, dokumentasikan dependency dan schema migration. Update menjaga database lokal serta antrean pending. Uji migrasi maju; rollback memakai build kompatibel bernomor lebih tinggi atau feature flag, bukan mengasumsikan downgrade APK selalu aman.

**AND-23 — Distribusi perusahaan.** Pilih Play Console atau jalur full distribution Android Developer Console sesuai kebutuhan. Berdasarkan dokumentasi saat disusun, registrasi full distribution di luar Play berbiaya US$25 sekali; akun Play yang sesuai dapat digunakan untuk verifikasi, sehingga kedua biaya tidak otomatis dijumlahkan [16]. Limited distribution gratis sampai 20 perangkat ditujukan akun personal/kelompok terbatas dan bukan asumsi distribusi perusahaan. Verifikasi developer dan package registration yang berlaku di Indonesia harus diselesaikan sebelum rollout terkait; kebijakan diperiksa kembali saat rilis.

Pembayaran fee, penerimaan terms, pembuatan akun, dan publikasi bukan bagian otomatis dari penulisan PRD atau pembangunan lokal. Pemilik organisasi memegang akun distribusi; tim menyediakan artefak dan panduan yang dapat direview. Aplikasi perusahaan tidak bergantung pada sharing debug APK sebagai jalur produksi.

### 27.11 Biaya dan layanan pihak ketiga

Pengembangan lokal menggunakan Android Studio, Kotlin dan library yang sesuai lisensi tanpa berlangganan layanan pembuat APK. Backend memakai Cloudflare; Firebase Auth/FCM serta provider peta dipakai hanya pada fitur yang diaktifkan dan setelah syarat/kuotanya diverifikasi. SMS OTP, call recording, layanan routing, dan AI berbayar tidak menjadi dependensi rilis Android awal.

Target biaya layanan pilot Rp0 bersifat bersyarat pada kapasitas, retensi, operasi provider, dan kebutuhan distribusi. Biaya registrasi sekali, domain jika diperlukan, perangkat serta internet tidak disamakan dengan biaya bulanan server. Tidak ada janji Rp0 untuk 500 pengguna dan tracking penuh tanpa load test.

### 27.12 Definition of Done Android

Product owner menerima alur kerja lapangan pada APK release candidate; QA menerima seluruh UAT AND dan regression API/web; sales ops merekonsiliasi assignment, event, order, target dan insentif; serta IT menerima signing, recovery, distribusi, monitoring, dan runbook. Arsip dapat dipulihkan, akses lintas organisasi ditolak, dan fitur tracking mempunyai indikator serta batas sesi yang benar.

Serah terima mencakup source, build instructions, kontrak API, schema dan migrasi lokal, konfigurasi sampling, matriks perangkat, hasil uji baterai/sync, panduan instalasi/update, serta SOP masalah GPS. Aplikasi Android baru dinyatakan operasional setelah pilot lapangan berhasil; selesainya kode atau build APK saja belum memenuhi exit gate.

## 28 Migrasi rollout dan operasional

**Migrasi:** inventaris sumber customer, contact, produk, territory, open lead, dan task. Jalankan profiling serta dry-run import. Sepakati mapping dan selesaikan kandidat duplikat. Bekukan snapshot awal dengan jumlah record, error, dan mapping ID. Lakukan delta import sebelum cutover. Histori sumber tidak dihapus.

**Rekonsiliasi:** sales operations menyetujui jumlah pelanggan, owner aktif, task terbuka, dan order pending. Finance menyetujui mapping nilai dan status transaksi bila ERP terintegrasi. Selisih mempunyai daftar exception dan PIC.

**Rollout:** gunakan feature flag per cabang dan kanal. Training berbasis skenario, bukan hanya demo menu. Sediakan SOP GPS buruk, offline, salah customer, callback, order ambigu, dan perpindahan owner. Tunjuk champion untuk lapangan serta telesales.

**Rollback:** nonaktifkan fitur baru melalui flag, hentikan pengiriman transaksi yang bermasalah, dan pertahankan read access serta audit. Outbox tidak dihapus; order yang sudah diterima eksternal direkonsiliasi sebelum proses lama diaktifkan. Jangan mengirim ulang seluruh batch tanpa pemeriksaan ID.

**Support:** level 1 sales ops untuk data dan proses; level 2 engineering untuk integrasi dan defect; incident commander untuk gangguan kritis. Insiden kehilangan data, kebocoran akses, dan duplikasi order mendapat prioritas tertinggi. SLA support disepakati sebelum rollout penuh.

### 28.1 Paket template data awal

Template adalah format file import operasional—CSV/XLSX sesuai kebutuhan—bukan template UI. Setiap template memiliki nama kolom resmi, definisi bisnis, tipe data, contoh nilai, field wajib, format tanggal dan mata uang, aturan unik, referensi ke template lain, serta kolom error yang dihasilkan sistem. Baris sumber tidak diubah; hasil import memiliki batch ID dan laporan validasi.

Paket minimum sebelum pilot terdiri dari: **customer/outlet** (satu ID pelanggan/lokasi, nama, alamat, lokasi, area, owner, status); **user dan hirarki** (user ID, Sales Rep/Supervisor/Area Manager/Management, team, area, effective date); **assignment** (customer, Sales Rep, tanggal mulai/akhir, alasan); **invoice** (invoice ID, customer/outlet, tanggal invoice, nilai net, retur/kredit, produk, currency, Sales Rep/area bila tersedia); **produk** (SKU, nama, unit, kelompok); dan **target** (scope, periode, basis invoice, nilai, metode bottom-up/top-down, versi). Kolom yang tidak tersedia harus ditandai kosong/provisional, bukan diisi dengan tebakan.

Sales Operations menyetujui isi customer, assignment, dan target. Finance menyetujui total invoice, retur, serta nilai net. IT memeriksa format, referential integrity, duplikasi ID, tanggal, timezone, dan rekonsiliasi jumlah/nilai sebelum import produksi.

### 28.2 Fixture end-to-end untuk validasi bisnis

Fixture ini menjadi contoh uji bersama product owner, Sales Operations, Finance, dan QA. Angka dapat diganti, tetapi hubungan dan invariant harus tetap sama.

| Hirarki | Anggota |
| --- | --- |
| Management | 1 national sales manager |
| Area A | 1 Area Manager |
| Supervisor | SPV-A1 dan SPV-A2; masing-masing memiliki satu scope team |
| Sales lapangan | SR-A01, SR-A02, SR-A03 pada SPV-A1; SR-A04, SR-A05 pada SPV-A2 |
| Telesales | TL-A01 dan TL-A02 pada kanal telesales terpisah |

Gunakan 10 customer pada satu lokasi masing-masing. Customer C01–C08 memiliki invoice pada rolling 90 hari; C09 tidak memiliki invoice selama lebih dari 90 hari dan menjadi Churn; C10 adalah customer baru yang baru memiliki invoice bulan pertama. Invoice fixture membawa invoice ID unik, tanggal invoice, nilai net, customer, produk, serta Sales Rep bila tersedia. Bila Sales Rep tidak tersedia, sistem memakai assignment customer pada tanggal invoice. Pada rilis pertama, satu invoice memiliki satu kanal penjualan primer: lapangan atau telesales. Fixture tidak membagi invoice menjadi kredit lintas kanal.

Uji status customer dari tanggal cut-off, lalu hitung tier dengan metode yang dipilih Management. Uji target bottom-up dengan target customer C01–C10 yang diagregasikan ke Sales Rep dan area. Uji target top-down dengan target Area A dan proporsi invoice tiga bulan; ulangi untuk C10 pada bulan pertama, kedua, dan ketiga untuk memastikan baseline bertahap. Actual dan achievement hanya memakai invoice tervalidasi setelah retur/kredit.

Untuk insentif, buat dua plan terpisah: satu untuk Sales Rep lapangan dan satu untuk telesales, masing-masing dengan nominal dasar, threshold 80%, dan tarif lapisan yang dapat berbeda. Finalisasi menghasilkan statement terkunci dan payout dibulatkan ke rupiah penuh. Retur setelah finalisasi membuat revision/adjustment, tidak mengubah statement lama. Management/national sales manager melakukan finalisasi melalui tombol manual; hasil final tidak dapat ditimpa tanpa revision.

Invariant fixture: satu invoice tidak menghasilkan actual ganda; jumlah actual kanal lapangan dan telesales sama dengan actual invoice organisasi; customer berumur invoice terakhir lebih dari 90 hari menjadi Churn; belum pernah invoice menjadi New; Area Manager tidak melihat area lain; telesales tidak muncul sebagai owner lapangan; target parent dan child tidak dijumlahkan dua kali; target/actual/insentif dapat ditelusuri ke invoice dan versi aturan.

### 28.3 Hasil fixture yang dapat direproduksi

Paket pendamping berisi `Fixture_Sales_End_to_End_v1.json` (input serta expected output) dan `Fixture_Sales_End_to_End_v1.md` (contoh hitung). Data sintetis Oktober 2026: actual invoice net Rp160 juta, terdiri atas lapangan Rp135 juta dan telesales Rp25 juta; sembilan customer aktif dan satu Churn; target parent Rp200 juta. Invoice retry tidak dihitung ulang, invoice batal dikecualikan, dan credit note Rp5 juta mengurangi invoice C03. Target bottom-up dan top-down adalah dua skenario alternatif, bukan dua target yang dijumlahkan.

Sebanyak 15 pemeriksaan numerik fixture lulus, termasuk threshold 80/81/102%, tarif per role, pembulatan, konservasi target, dan forecast yang tidak menggandakan realisasi. Hasil ini bukan bukti aplikasi, API atau integrasi sudah berfungsi. Hak akses, finalisasi manual, rejection mapping, dan revisi statement tetap harus diuji pada implementasi.

## 29 Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Sales mengejar jumlah aktivitas | Aktivitas banyak, hasil rendah | Coverage unik, outcome, transaksi tervalidasi, dan coaching |
| GPS buruk dianggap pelanggaran | Konflik dan kesalahan penilaian | Accuracy, exception, bukti alternatif, review manusia |
| Pencatatan manual dianggap bukti telephony | KPI telesales menyesatkan | Label declared vs provider verified |
| Kontak lintas kanal berlebihan | Keluhan dan kehilangan pelanggan | Shared timeline, suppression, cooldown, callback agreement |
| Owner dan kredit penjualan tumpang tindih | Konflik sales dan nilai ganda | Role kontribusi terpisah, order unik, aturan atribusi |
| Data master buruk | Route, lead, dan laporan salah | Dry-run, deduplikasi, verifikasi koordinat, data steward |
| Integrasi ERP timeout | Order hilang atau ganda | Idempotensi, outbox, pending confirmation, rekonsiliasi |
| PWA dijanjikan tracking kontinu | Perilaku tidak konsisten di lapangan | Native bila diperlukan dan uji perangkat nyata |
| Agent merasa pengawasan berlebihan | Adoption rendah dan data tidak jujur | Transparansi tujuan, batas jam kerja, hak koreksi, manfaat kerja nyata |
| Biaya maps, call, storage meningkat | Biaya per user tidak terkendali | Metering, quota, retensi, cache yang diizinkan provider |
| Dashboard memakai data terlambat | Keputusan operasional salah | Freshness, late event indicator, definisi snapshot |

## 30 Kontrol komersial tambahan

Fitur berikut diprioritaskan setelah P0 stabil karena langsung membantu supervisor menjelaskan mengapa aktivitas belum menjadi penjualan.

**COM-01 P1 — Repeat order dan risiko kehilangan outlet.** Tampilkan interval pembelian normal per outlet, transaksi terakhir, produk yang biasanya dibeli, dan perubahan nilai pembelian. Jika histori belum cukup, gunakan frekuensi layanan yang ditetapkan sales ops. Buat task reactivation dengan alasan yang terlihat dan suppression yang tetap berlaku.

**COM-02 P1 — Distribusi produk.** Ukur outlet aktif yang membeli SKU atau kelompok produk sasaran, jumlah SKU per order, nilai rata-rata order, dan penambahan outlet produktif. Denominator outlet eligible dan unit produk ditetapkan per program. Produk tidak tersedia dicatat sebagai lost sales reason, tidak dianggap otomatis kegagalan sales.

**COM-03 P1 — Lost sales terstruktur.** Alasan minimal: stok kosong, harga, pesaing, limit kredit, belum membutuhkan, layanan/pengiriman, atau tidak bertemu PIC. Nilai potensi bersifat estimasi terpisah dari revenue. Supervisor dapat mengelompokkan alasan dan meneruskan masalah ke supply, finance, atau commercial dengan PIC dan tenggat.

**COM-04 P1 — Order sampai pengiriman.** Customer 360 menampilkan status fulfillment, pengiriman tertunda, pembatalan, dan retur bila sumber tersedia. Sales dapat membuat service task dari masalah transaksi. Klaim selesai hanya setelah ada resolution dari pemilik proses, bukan karena sales menutup catatan.

**COM-05 P1 — Dukungan penagihan.** Tampilkan invoice jatuh tempo dari finance, kontak penanggung jawab, promise-to-pay, dan follow-up. Janji pembayaran bukan penerimaan uang. Konfirmasi pembayaran berasal dari finance/ERP; penerimaan kas dan transaksi finansial tetap berada pada sistem yang berwenang.

**COM-06 P1 — Katalog dan program komersial.** Sales melihat produk, satuan, harga yang berlaku, program promosi, materi penjualan, dan periode efektivitas. Semua materi memiliki versi. Promo di luar periode atau untuk segmen berbeda tidak otomatis diterapkan pada order.

**COM-07 P1 — Klaim perjalanan.** Klaim mempunyai tanggal, tujuan, referensi kunjungan, jarak yang diajukan, dasar perhitungan, bukti, dan approval. Jarak GPS mentah, estimasi peta, dan jarak klaim ditampilkan terpisah. Penggantian biaya menunggu approval dan tidak ditentukan hanya dari banyaknya titik tracking.

Acceptance tambahan: outlet dengan pembelian terakhir yang masih belum tersinkron tidak diberi kepastian dorman; retur memperbarui net actual tanpa menghapus order awal; promise-to-pay tidak menaikkan collection; lost sales akibat stok kosong dapat ditelusuri ke SKU dan sumber stok.

### 30.1 Biaya dan kelayakan

Sebelum menyetujui tahap lanjutan, hitung biaya per pengguna aktif dan per transaksi untuk hosting, storage foto, maps, geocoding, menit panggilan, rekaman, pesan, serta support. Tetapkan budget, quota, dan alert penggunaan. Estimasi nominal menunggu pemilihan provider dan profil volume; harga Lystloc tidak dijadikan estimasi biaya pembangunan.

Instrumentasi produk mencatat agenda dibuka, visit disimpan, outcome lengkap, callback selesai, handoff diterima, order dikonfirmasi, dan sync error dengan ID internal. Analytics tidak menerima isi catatan, nomor pelanggan lengkap, atau koordinat rinci tanpa kebutuhan yang ditetapkan. Pengukuran adoption menggunakan event kerja bermakna dan jumlah pengguna eligible, bukan page view.

## 31 Keputusan yang perlu ditetapkan sebelum pembangunan

Scope minimum web pertama, arah stack, dan arah rancangan database telah diterima pengguna pada 16 Oktober 2026 sebagaimana bagian 6.1 dan 22.3–22.4. Detail schema fisik, kontrak API, desain layar, serta estimasi tetap merupakan deliverable engineering berikutnya. Tabel di bawah memuat keputusan operasional yang perlu ditetapkan sebelum fitur terkait dibangun atau diaktifkan; keputusan yang sudah diterima tidak perlu diminta ulang tanpa perubahan material.

| Keputusan | Usulan awal | Penanggung jawab |
| --- | --- | --- |
| Segmen dan channel pelanggan | B2B multi-outlet; field dapat dikonfigurasi | Product owner dan sales manager |
| Sumber customer dan produk | ERP bila tersedia, CRM untuk prospect | Sales ops dan IT |
| Basis actual sales | Invoice net telah diputuskan; Finance/IT memvalidasi mapping sumber, Management/NSM mengesahkan | Management/NSM, Finance dan IT |
| Mode order MVP | Draft dan konfirmasi backoffice terkontrol | Sales ops |
| Telephony | Manual dahulu; CTI saat provider siap | Telesales manager dan IT |
| Kebutuhan lokasi | Web check-in dahulu; Android tracking setelah web stabil; tanpa routing | Sales manager dan product owner |
| Distribusi Android | Akun organisasi dan jalur full distribution yang sesuai | Pemilik organisasi dan IT |
| Retensi GPS | D1 hot tujuh hari; arsip R2 sampai total 90 hari, diverifikasi sebelum delete | Sales ops dan pemilik data |
| Metode target | Bottom-up atau top-down; baseline tiga bulan selesai dan onboarding telah ditetapkan | Management/NSM; Area Manager review |
| Aturan harga kredit dan approval | Kebijakan perusahaan dengan versi | Finance dan commercial |
| SLA dan jam kerja | Default PRD dikalibrasi pada pilot | Supervisor |
| Retensi dan rekaman | Persetujuan internal sebelum fitur aktif | Pemilik data dan fungsi yang berwenang |
| Format data awal | Template import berisi kolom, tipe data, contoh nilai, field wajib, referensi ID, dan aturan validasi untuk customer, user/hirarki, assignment, invoice, produk, dan target | IT dan Sales Operations |
| Attribution dan insentif | Pilih basis invoice, threshold 80%, nominal dasar, tarif progresif, atribusi primer, cap opsional dan syarat; uji simulasi lalu sahkan | Management dan Finance |
| Struktur organisasi pilot | Sales Rep → Supervisor → Area Manager → Management; telesales sebagai kanal terpisah; Area Manager hanya melihat area sendiri; akses lintas area dan pengaturan organisasi milik Management/national sales manager | Management dan Product owner |
| Cabang pilot | Satu cabang dengan variasi kondisi jaringan | Product owner |

## 32 Definition of Done

Rilis dianggap selesai bila kebutuhan dalam scope mempunyai desain, implementasi, pengujian, serta acceptance yang disetujui pemilik proses; alur akses, offline, idempotensi, dan koreksi berfungsi; KPI dapat direkonsiliasi ke record sumber; serta integrasi yang aktif memiliki monitoring dan runbook.

Untuk pilot, tim harus dapat menyelesaikan rencana kunjungan, aktivitas, callback, handoff, pipeline, dan order sesuai mode yang dipilih tanpa kehilangan pekerjaan. Supervisor dapat melihat exception dan menugaskan tindakan. Konfigurasi insentif dapat disimulasikan dan disahkan; hasil final dapat direproduksi, ditelusuri ke target serta realisasi, dan diekspor tanpa menganggapnya telah dibayar. Keterbatasan integrasi dan status data terlihat jelas bagi pengguna.

Rilis web dan Android mempunyai gate terpisah sesuai bagian 26–27. Selesainya web tidak berarti background tracking sudah tersedia; selesainya APK tidak berarti rollout Android sudah selesai.

Keberhasilan produk dievaluasi dari coverage, follow-up, kualitas layanan, dan hasil komersial yang tervalidasi, disertai biaya operasional serta pengalaman sales.

## 33 Referensi produk

Referensi berikut memberi konteks fitur. Seluruh requirement bernomor dalam dokumen merupakan spesifikasi produk yang diusulkan, bukan klaim bahwa fitur tersebut sudah tersedia di Lystloc atau terkonfigurasi pada akun Zoho pengguna.

1. [Lystloc admin home](https://app.lystloc.com/home) — menu utama diperiksa pada 16 Oktober 2026.
2. [Lystloc Help Center](https://www.lystloc.com/help/faq) — konteks onboarding dan kategori bantuan.
3. [Lystloc mobile app dari publisher](https://play.google.com/store/apps/details?id=com.lystloc) — konteks attendance, tracking, visit, dan task.
4. [Lystloc live reporting](https://www.lystloc.com/live-reporting) — konteks monitoring tenaga lapangan.
5. [Lystloc plans and feature matrix](https://www.lystloc.com/pricing) — konteks task, form, role, route plan, dan CRM; paket serta harga tidak dipakai sebagai asumsi biaya produk.


6. [Zoho forecast configuration](https://help.zoho.com/portal/en/kb/crm/sales-force-automation/forecasts/articles/setting-up-forecast-configuration-and-creating-forecasts) — acuan kategori, periode, serta struktur target. Detail formula dan kontrol residual PRD adalah keputusan desain tersendiri.
7. [Zoho creating and working with forecasts](https://help.zoho.com/portal/en/kb/crm/sales-force-automation/forecasts/articles/creating-and-working-with-forecasts) — acuan drill-down dan pembacaan pencapaian terhadap target.
8. [Zoho sales monitoring in CRM](https://help.zoho.com/portal/en/kb/motivator/help/getting-started/articles/zoho-motivator-features-in-zoho-crm) — acuan monitoring aktivitas dan pergerakan pipeline. Definisi KPI kita tetap mengikuti bagian 15.

9. [Salesforce sales compensation plans](https://www.salesforce.com/sales/incentive-compensation-management/sales-compensation-plans/) — konteks pilihan model persentase, tier, bonus, dan nominal hasil. Kebijakan produk tidak menyalin tarif contoh vendor.
10. [CaptivateIQ commission calculator](https://www.captivateiq.com/explainer/sales-commission-calculator) — konteks perbedaan tarif marginal/progresif dan retroaktif/seluruh basis. Formula, contoh angka, dan kontrol pada bagian 16.5–16.8 merupakan spesifikasi produk kita.

11. [Android location foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types#location) — referensi deklarasi service, permission, dan pembatasan lifecycle. Sampling serta batas sesi PRD adalah parameter produk.
12. [Android Room](https://developer.android.com/training/data-storage/room) — referensi local persistence; desain outbox dan ack adalah kontrak aplikasi.
13. [Android WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent) — referensi pekerjaan persisten tertunda; tidak dipakai sebagai jaminan sampling GPS satu menit.
14. [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/) — batas storage untuk capacity planning, diperiksa 16 Oktober 2026.
15. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) — kuota storage/operations Standard; gratis bersyarat, bukan tambahan 10 GB permanen setiap bulan.
16. [Android developer account and distribution](https://support.google.com/android-developer-console/answer/16604405?hl=en) dan [limited distribution](https://developer.android.com/developer-verification/guides/limited-distribution) — ketentuan diperiksa 16 Oktober 2026; validasi ulang menjelang rilis.
17. [Geoapify pricing](https://www.geoapify.com/pricing/) — kandidat provider peta gratis dengan kuota, fitur, dan atribusi yang harus dipenuhi.

18. [Firebase TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa) — prasyarat Identity Platform harus diperiksa pada konfigurasi dan budget autentikasi.


## Catatan implementasi M3 lokal,18Oktober2026

WEB-046–055 diimplementasikan sebagai pilot lokal; acceptance produk di atas tetap menjadi gate, bukan otomatis Accepted. Kontrak /api runtime, batas pilot, perbedaan terhadap /api/v1 rancangan serta bukti ada pada [M3_STATUS](../M3_STATUS.md), [OpenAPI M3](m3-api.openapi.json) dan [ERD M3 fisik](ERD_M3_Implementation.md). Tidak ada deployment/transfer pembayaran otomatis; dua user Firebase nyata, policy bisnis serta sumber ERP/finance menunggu UAT. Android belum dimulai.

## Pembaruan implementasi 23 Oktober 2026 - WEB-063

Pengaturan → Batas wilayah menyediakan import paket melalui popup, progres/rincian, versi dan review aktivasi dataset. Migrasi 0035 menyimpan enam tabel metadata/manifest; geometry penuh di R2 privat. Sampel teknis nasional enam kelurahan Kecamatan Gambir tersimpan draft, bukan pemilihan area bisnis atau aktivasi sumber. Backup/restore lokal dan pengujian dicatat pada [runbook WEB-063](../WEB063_ADMIN_BOUNDARIES.md). WEB-064/065 dan Plan Visit Generator tetap Planned; gate web/Android tidak berubah.

## Implementasi WEB-064 — 24 Oktober 2026

Peta & Wilayah kini menyediakan Sebaran dengan overlay desa/kelurahan, filter/hierarki, rincian dan scoped customer drilldown. Management/NSM melakukan preview full geometry/kode dan review dengan alasan; publikasi memerlukan rilis aktif, versi/hash konsisten, idempotency dan audit. Revisi/koordinat/rilis berubah memerlukan validasi ulang; tidak memindahkan area/owner atau menulis invoice/target/insentif. Periode adalah konteks navigasi; agregasi historis, Kinerja/Coverage/Risiko mengikuti WEB-066/067. Draft sumber nyata hanya dipratinjau, angka terkonfirmasi ditampilkan belum tersedia. 149 tests dan dua browser flows lulus lokal; source/human/provider/cloud acceptance tetap pending. [Runbook](../WEB064_GEOGRAPHY.md), [kontrak](geography-api.m4.openapi.json), [ERD fisik](ERD_WEB064_Implementation.md).

## Status implementasi lokal WEB-065 — 24 Oktober 2026

GIS-UX-03/GIS-U03 mempunyai membership kelurahan/desa bertanggal dan penugasan customer per kanal dengan preview/commit Management/NSM, exception beralasan, epoch/hash/ETag/idempotency dan audit. Pilihan wilayah saja tidak menulis owner/scope. Transfer area meninjau kedua kanal, histori fakta tetap. Limit 25 customer per penerapan, subset eksplisit; rilis sumber harus aktif. [Runbook](../WEB065_DISTRIBUTION.md), [API](distribution-api.m4.openapi.json), [ERD fisik](ERD_WEB065_Implementation.md). Sumber nyata masih draft; acceptance organisasi/provider/cloud belum diberikan. Analitik kinerja/coverage berikutnya WEB-066.

## Status implementasi lokal WEB-066 — 24 Oktober 2026

GIS-ANA-01/GIS-U02/GIS-A01–02 memakai nyales-geo-kpi-1 dengan mapping confirmed pada read-cutoff yang sama bagi dua periode. Actual/observed/unknown, pelanggan unique lintas kanal, target explicit-only, coverage aktivitas diterima dan bucket belum terpetakan direkonsiliasi. Mode Kinerja/Coverage serta sumber/kinerja sales, CTA pelanggan, ringkasan Overview/Monitoring dan CSV snapshot tersedia lokal. Tidak membuat klaim pasar atau mengubah fakta historis. [Kontrak metrik/runbook](../WEB066_REGIONAL_ANALYTICS.md), [API](regional-analytics-api.m4.openapi.json), [ERD](ERD_WEB066_Implementation.md). Sumber nyata draft dan gate provider/human/cloud terpisah; risiko/simulasi berikutnya WEB-067/068.


## Implementasi lokal WEB-067 — 24 Oktober 2026

Risiko pelanggan nyales-risk-1 tersedia lokal: mendekati churn, repeat order terlambat dan penurunan invoice dengan ambang/histori minimum yang diisi Management/NSM. Policy aktif immutable dan tidak dipasang default; perubahan melalui draft/aktivasi berversi. Mode Risiko menampilkan bukti, source/cutoff/scope dan snapshot historis; data minim tidak disebut aman. Near-churn perusahaan menjadi unknown bila akses sejarah perusahaan tidak sah. Tidak menulis status/owner/target/aktivitas atau menghubungi customer otomatis. Akses dan guard kontak/DNC/campaign/lease existing tetap berlaku. D1 menyimpan metadata dan R2 privat menyimpan bukti; recovery keduanya diuji lokal. [Definisi dan evidence](../WEB067_RISK_DESIGN.md), [ERD fisik](ERD_WEB067_Implementation.md), [10 operasi API](customer-risk-api.m4.openapi.json). GIS-A03/A04 diverifikasi lokal, bukan sign-off manusia/provider. Model desain baseline tidak otomatis menjadi endpoint /api/v1 yang sudah deployed.


## Implementasi lokal WEB-068 — 24 Oktober 2026

GIS-ANA-03/GIS-A05 kini mempunyai kebijakan layanan bulanan berversi, sumber seluruh portfolio yang diizinkan, before/after per kanal dan skenario immutable. Angka kosong tetap unknown, kapasitas adalah alokasi layanan tanpa travel/absensi individu, histori invoice tidak dipindahkan. Management/NSM meninjau popup konfigurasi dan transfer; role lain membaca scope parsial. Apply satu batch atomik memakai WEB-065, kemudian sisa wajib dipreview dan disimpan menjadi revisi baru. D1 empat tabel baru dan private R2 evidence, hash/epoch/If-Match/idempotency/audit serta backup/restore diuji lokal. Pilot utama tidak dipasangi parameter bisnis otomatis. [Runbook](../WEB068_WORKLOAD_DESIGN.md), [ERD fisik](ERD_WEB068_Implementation.md), [14 operasi API](workload-scenarios-api.m4.openapi.json), [evidence](../WEB068_EVIDENCE.json). WEB-069–074 generator tetap pengembangan terpisah; bukan routing yang telah aktif atau production acceptance.


## WEB-069 — baseline desain generator, 24 Oktober 2026

Kontrak `nyales-visit-generator-1`, data dictionary dan 14 tabel SQL draft telah diuji di in-memory SQLite. 37 operasi desain belum diregistrasikan; policy/units/unknown/required-monthly versus daily-candidate, scope, machine lease/fence/cancel/retry dan publish staging-activation ditetapkan. Native work_plan/revision dipakai hanya setelah publish sah, bukan import/job generic. 21 contract/model tests lulus; scope/crypto/lease runtime, OSRM/solver, graph, UI dan PVG end-to-end tetap WEB-070–074. Runtime tetap 276 operasi dan 100 tabel lokal. [Spesifikasi detail](../WEB069_PLAN_VISIT_CONTRACT.md), [API desain](visit-generator.design.openapi.json), [model](ERD_WEB069_Design.json), [evidence](../WEB069_EVIDENCE.json).


## Implementasi WEB-070 identitas komputer — 25 Oktober 2026

[Runbook pairing/vault/heartbeat/revoke](../WEB070_AGENT_IDENTITY.md), [ERD fisik 0042](ERD_WEB070_Implementation.md), [sembilan operasi API aktual](visit-agent-identity.m4.openapi.json), [bukti progres](../WEB070_PROGRESS.json). Hanya Management/NSM mengatur mesin dan izin 1–10 sales lapangan aktif. Kode sekali pakai 15 menit; credential 30 hari, perubahan izin/issue ulang mengganti generasi dan mencabut akses sebelumnya. Request mesin memakai signature/challenge terpisah dari sesi pengguna; vault Windows DPAPI menyimpan private key dan credential terenkripsi. Heartbeat saat ini manual, laporan kemampuan bukan bukti solver siap. Queue/lease/graph/solver/publish tetap rancangan. WEB-070 keseluruhan masih In progress.

Runtime total 285 operasi, semuanya terkait kontrak implementasi. Migrasi menambah tujuh tabel; 105 aplikasi/107 termasuk metadata D1. Draft SQL 14 tabel WEB-069 tidak boleh diterapkan utuh setelah 0042. Data komersial dan agenda tidak berubah melalui registrasi mesin. Tidak ada deployment cloud atau acceptance produksi.


## WEB-070 antrean diagnostik — 25 Oktober 2026

[Runbook antrean agent](../WEB070_AGENT_QUEUE.md), [kontrak aktual 11 operasi](visit-agent-queue.m4.openapi.json), [ERD fisik 0043](ERD_WEB070_Queue_Implementation.md). Management/NSM dapat mengirim probe koneksi, melihat status/riwayat dan membatalkannya. Agent Windows dapat polling foreground/once, claim, renew, checkpoint, complete, fail dan cancel-ack; expiry/retry/fencing membatasi hak proses lama. Hanya payload probe yang dibuat server, tanpa customer/koordinat/penjualan/agenda. Satu tugas pending per komputer, lease120 detik, tiga percobaan dan deadline15 menit. Polling idle60 detik; unattended quota/retention acceptance belum selesai.

Total runtime296 operasi, 108 tabel aplikasi/110 termasuk metadata D1. WEB-070 tetap In progress: planning snapshot/policy/graph dan penghubung ke transport, OSRM engine/graph nyata serta benchmark belum tersedia. Status completed probe bukan bukti rute atau jadwal. [Bukti progres](../WEB070_PROGRESS.json) membedakan tes lokal dan acceptance produksi. Bagian bertanggal sebelumnya adalah histori.


## WEB-070 kebijakan dan kesiapan — 25 Oktober 2026

[Runbook](../WEB070_PLANNING_READINESS.md), [14 operasi aktual](visit-planning-readiness.m4.openapi.json), [ERD fisik0044](ERD_WEB070_Readiness_Implementation.md), [bukti terkini](../WEB070_PROGRESS.json). Management/NSM dapat menyimpan/meninjau draft kebijakan, mengaktifkan dengan ETag/checksum/expected-active-id, mendaftarkan manifest graph sebagai metadata belum terverifikasi, serta menyimpan snapshot kesiapan privateR2. Snapshot berversi menyebut assignment/kalender/tanggal, observasi invoice/visit, sumber belum lengkap, asumsi dan penghambat. Epoch/source/agenda/policy/graph/date berubah menandai hasil historis; bytes/hash dan histori immutable.

Kesiapan bukan VisitSnapshot solver dan tidak masuk antrean agent. Nilai yang tidak diketahui tetapnull; tidak mengasumsikan histori visit lengkap atau mengonversi frekuensi lama/jam teks menjadi aturan baru. Engine/solver belum aktif, sehingga can_generate=false dan publishable=false. Kebijakan frekuensi/bobot/asumsi/runtime/retensi tidak dipasang default pada pilot utama. Form override khusus hanya menampilkan/mempertahankan/menghapus nilai yang sudah ada; API mendukung penambahan dengan validasi customer. UI pembuatan override customer terstruktur menjadi tindak lanjut.

Total310 operasi runtime semuanya terhubung kontrak, 112 tabel aplikasi/114 termasuk metadata D1. Business planning job/artifact/solver/publish, source operasional yang kurang, engine/graph OSRM nyata dan benchmark tetap pending. Aturan retensi belum menjadi job pembersihan snapshot readiness otomatis. Bagian bertanggal sebelumnya adalah histori slice terdahulu; WEB-070 tetap In progress.


## Status terbaru WEB-070/071 — 26 Oktober 2026

Data operasional berversi tersedia pada Pengaturan → Perencanaan kunjungan → Data operasional: titik awal/akhir sales, istirahat/absen yang ditinjau, durasi dan jam penerimaan pelanggan. Rentang inklusif, revisi immutable pada rentang yang sama, scope/role/calendar/timezone per tanggal dan invalidasi readiness melalui source_epoch. [Runbook](../WEB070_OPERATIONAL_PROFILES.md), [8API aktual](visit-operational-profiles.m4.openapi.json), [ERD0045](ERD_WEB070_Operational_Implementation.md), [evidence](../WEB070_PROGRESS.json). Runtime318operasi,114tabel aplikasi/116 dengan metadataD1. Pilot utama tanpa parameter/profile default; row bisnis lama main/QA tetap identik (QA hanya menambah fixture terpisah).

Pengguna tidak mempunyai akses administrator pada Windows saat ini; routing memakai komputer lain. WSL/Docker tidak dipasang di laptop ini. Paket setup dan CLI disiapkan dengan [petunjuk host](../../tools/visit-compute-kit/README.md); alamat/OS/operator/area graph tujuan belum tersedia. Windows DPAPI agent tetap Windows-only; standalone CLI Linux belum diuji dan bukan agent Linux yang sudah berfungsi.

OR-Tools9.15.6755 benar-benar terpasang di venv lokal dan menghitung daily kernel melalui matrix terkontrol, independent validation, adapter VisitSnapshot dan file/HTTP/solver CLI. [WEB-071](../WEB071_DAILY_KERNEL.md), [progres](../WEB071_PROGRESS.json). Total311tes lulus tanpa skip, typecheck/build dan2browser profile lulus/Axe0. Engine OSRM/road graph nyata belum diuji; builder sumber bisnis, job solver, agenda terlindungi/lintas kanal dan UI/review/publish masih pending. Readiness tetapcan_generatefalse; standalone artifact tetap publishablefalse. WEB-070/071 tetap In progress; bukan PVG end-to-end atau acceptance produksi. Bagian bertanggal sebelumnya adalah histori slice terdahulu.


## Keputusan perangkat26 Oktober2026 — paket pemasangan dahulu

Komputer penghitung lain **belum tersedia**. Pengguna meminta paket pemasangan disiapkan dahulu. Tidak memasang WSL/Docker di laptop sekarang dan tidak melakukan provisioning remote. Paket revisi2 menambah [Mulai di sini](../../tools/visit-compute-kit/START-HERE.md) dan pemeriksa `python check-installation.py` yang memvalidasi manifest/file serta mendeteksi Node/solver tanpa mengunduh dependensi atau memulai service. Dependency lockfile, installer solver lokal, CLI dan launcher loopback disertakan; runtime/road graph/data pelanggan/credential tidak disertakan.

Empat tes batas pemeriksa paket lulus; ZIP diekstrak dan seluruh checksum/import diperiksa. Dependensi atau Node yang terdeteksi tidak membuktikan routing siap; `ready_for_real_planning:false`. WEB-070/071 tetap In progress. Pengujian311 backend sebelumnya tetap bukti kernel/slice terkait, bukan uji OSRM pada komputer tujuan yang belum ada. Bukti paket terkini: `test-results/web071-kit-v2-verify.json` dan WEB071_PROGRESS.json.


## Pilihan backlog26 Oktober2026 — routing ditunda, lanjut WEB-057

Pengguna meminta melewati pemasangan routing dan melanjutkan backlog lain. WEB-070–074 dicatat execution_status deferred_by_user; implementasi/kernel/paket yang sudah ada dipertahankan sebagai bukti, tidak ditandai selesai. Tidak ada provisioning atau pemasangan OS.

WEB-057 dilanjutkan dengan opsi pemeriksaan isi berkas pada restore drill: lampiran ready, chunk batas, bukti risiko, revisi simulasi dan bukti kesiapan. Metadata/source checksum diverifikasi dahulu; kemudian ukuran/hash berkas saat ini, dengan batas64object/8MiB perfile/32MiB total/8MiB manifest modeberkas, scope organisasi dan hasil hilang/rusak/unavailable eksplisit. UI memakai tombol/popup, pemilihan backup/riwayat dan rincian kegagalan. Tidak menyalin/memulihkan/menghapus data; logical backup tetap slice, bukan snapshot penuh. [Runbook](../WEB057_OBJECT_VERIFICATION.md), [evidence](../WEB057_OBJECT_EVIDENCE.json), [API](m4-recovery-api.openapi.json). Runtime318operasi,114tabel aplikasi; tidak ada migrasi baru. Production restore/RPO/RTO/retensi tetap memerlukan verifikasi terpisah.

## Addendum direktori customer — 28 Oktober 2026

Sumber direktori eksternal harus dideduplikasi menurut identitas sumber yang pasti. Warung yang lolos validasi masuk master tanpa penugasan/transaksi/izin kontak rekaan; non-warung menjadi referensi peta privat. Konflik tetap ditahan untuk review. Riwayat belum lengkap berstatus Unknown/provisional, sedangkan koordinat dan penempatan administratif sumber belum terverifikasi. [Spesifikasi, rekonsiliasi dan tahapan impor](../POINT_DIRECTORY_IMPORT.md).


## Perombakan peta dan analisis terhubung — 3 November 2026

Halaman Peta menggunakan satu canvas MapLibre untuk titik customer, posisi sales terakhir, batas operasional aktif, dan layer batas nasional PMTiles. Canvas terpisah serta pembagian owner nasional placeholder dihapus dari halaman. Batas nasional dan estimasi kepadatan penduduk adalah konteks geografis, bukan bukti pembagian area operasional atau lokasi kunjungan.

Mode UI: Sebaran, Penjualan (warna kelas rupiah dan ukuran simbol), Kunjungan (ada/belum ada aktivitas bermakna pada bulan dipilih), dan Status pelanggan (status invoice, termasuk Unknown). Status pelanggan menggantikan pilihan Risiko pada halaman ini; mesin analisis risiko dan API historis tetap tersedia untuk kompatibilitas. Legenda hanya menjelaskan layer aktif; panel, tooltip, dan kontrol berada di dalam canvas termasuk fullscreen.

Invoice dan aktivitas dikelompokkan per customer kanonis, bulan, kanal, dan scope. Invoice memakai rep/area historis; filter pemilik customer tidak memindahkan atribusi invoice. Ringkasan tidak menjumlahkan kembali salinan operasi pada titik referensi. Hubungan invoice/kunjungan pada periode yang sama adalah observasi, bukan klaim kausal. Unknown, belum ada invoice, dan sumber lengkap adalah kondisi berbeda.

Pelengkap DEMO Bekasi dibatasi Agu–Okt 2026: target bulanan empat sales, tiga skema insentif threshold-progressive, dan 12 statement prepared untuk review. Bonus asumsi Rp500.000 pada achievement 80%; bagian penjualan 80–100% mendapat tarif marginal 1%, bagian di atas 100% tarif 2%; pembulatan half-up rupiah. Semua record bernama DEMO dan audit synthetic; tidak ada pembayaran, perubahan invoice/customer/kunjungan sumber, maupun pengesahan target bisnis asli. Jika target latihan Oktober sudah aktif, pelengkap memakai revisi pada plan latihan sintetis yang sama: leaf lama disalin dengan nilai utuh, versi lama menjadi superseded dan tetap tersimpan; tidak membuat plan aktif kedua yang bertumpang tindih. Penerapan melalui input workflow staging yang eksplisit, preflight overlap, dan rekonsiliasi.

Performa: halaman analitik, insentif, distribusi, dan peta dimuat sesuai kebutuhan; widget peta Overview baru dipasang dekat viewport. Peta memakai WebGL clustering, ringkasan server, payload compact tanpa duplikasi seluruh master customer, daftar wilayah terbatas 40 hasil, serta pembatalan request filter lama. Ini bukan pernyataan bahwa seluruh jalur legacy atau volume nasional sudah memenuhi SLO; ukur payload, query metadata, dan UX pada data staging.
