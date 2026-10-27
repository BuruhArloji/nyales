# NYALES — UI/UX dan analisis wilayah

> Status terkini 24 Oktober 2026: WEB-063/064/065/066/067 implemented dan diuji lokal. Sumber nyata tetap draft; WEB-068–074 belum selesai. Keterangan Planned bertanggal 22/23 Oktober di bawah adalah baseline perencanaan. [WEB-065](../WEB065_DISTRIBUTION.md), [WEB-066](../WEB066_REGIONAL_ANALYTICS.md).

22 Oktober 2026. Keputusan backlog setelah diskusi GIS. Melengkapi [batas kelurahan/desa GEO-01–08](GIS_Admin_Kelurahan_v1.md), PRD v1.10 dan backlog v1.2. Semua kemampuan baru di dokumen ini **Planned**, bukan hasil implementasi. Sumber polygon tetap dataset nasional yang sudah dipilih pada GEO-02.

## Penempatan dalam aplikasi

**GIS-UX-01 — Peta & Wilayah.** Kembangkan halaman Peta customer dalam kelompok Pelanggan menjadi **Peta & Wilayah**. Sidebar kelompok dan urutan Overview tetap. Filter atas mengikuti periode, area, kanal dan sales; pencarian wilayah berjenjang provinsi/kabupaten-kota/kecamatan/kelurahan menghindari deretan dropdown berlebih. Status scope, cutoff sumber, versi boundary dan pelanggan belum terpetakan dapat dibaca. Peta memiliki tinggi terkontrol; panel dan daftar dapat discroll tanpa memanjangkan peta.

Mode memakai pill **Sebaran · Kinerja · Coverage · Risiko** dengan gaya/gerakan NYALES yang sudah ada. Sebaran adalah mode awal pada WEB-064 dan mempertahankan pin pelanggan, posisi terakhir, fullscreen serta kontrol peta yang sudah tersedia. Kinerja/Coverage tersedia saat WEB-066 selesai dan Risiko saat WEB-067 selesai; kemampuan yang belum tersedia diberi status jelas atau tidak ditawarkan, tidak menghasilkan angka nol tiruan. Data/range/filter aktif dipertahankan saat berpindah mode atau fullscreen. Mode analisis memakai polygon kelurahan; geometry penuh untuk matching tetap berbeda dari geometry display.

Klik kelurahan menyorot polygon dan membuka panel rincian di kanan desktop; pada mobile memakai panel bawah yang dapat dibuka/tutup. Pengguna tetap dapat memilih wilayah lain dan kembali ke posisi/filter sebelumnya. Daftar wilayah menyediakan alternatif keyboard dan pencarian tanpa mengharuskan klik peta. Panel memuat nama/kode/hierarki, jumlah pelanggan, sales terkait dan metrik yang tersedia, dengan tombol **Lihat pelanggan** dan **Lihat kinerja sales** sesuai izin. Esc/tombol Tutup, fokus, nama aksesibel, keyboard dan reduced motion mengikuti pola aplikasi. Tidak bergantung pada hover saja.

Gunakan teal bertingkat untuk nilai metrik, tooltip hitam-putih, legend dan skala yang jelas serta konsisten pada periode/perbandingan yang sama. Bedakan nilai absolut (misalnya rupiah) dan rasio (misalnya coverage). Data kosong/unknown/outside coverage memakai abu-abu berpola/label, berbeda dari nilai nol. Warna selalu disertai angka/teks. Panel putih/glass mengikuti UI NYALES dengan kontras teks memadai; detail tidak menutupi area kerja peta di layar kecil.

**GIS-UX-02 — Masuk dari monitoring dan tindakan.** Overview hanya menampilkan ringkasan wilayah perlu perhatian dan tautan **Lihat wilayah**; jangan menggandakan dashboard analisis penuh. Monitoring dapat memilih/drill-down kelurahan. Link ke Peta & Wilayah, daftar customer dan kinerja sales membawa periode, area, kanal, sales dan kelurahan yang sama, dengan back navigation mempertahankan konteks. Link tidak memperluas scope atau membocorkan nama/angka pelanggan di luar izin. Customer belum terpetakan mempunyai bucket/daftar terpisah yang tetap masuk rekonsiliasi total.

Setiap insight membuka pelanggan sumber lalu tindakan sah: rencana kunjungan, task follow-up atau workflow telesales yang sudah ada. Telesales tetap tunduk assignment, izin kontak, DNC, jam kontak dan campaign/lease; pemilihan pada peta tidak langsung menelepon atau membuat queue. Summary antarkanal menghitung pelanggan unik, invoice memakai atribusi primer yang sudah berlaku. Card Overview/Monitoring dan mode baru dipasang bertahap sesuai ketersediaan WEB-066/067, bukan menganggap WEB-064 membangun seluruh analitik.

**GIS-UX-03 — Distribusi sales dan pengaturan.** Pembagian kelurahan tetap pada **Pelanggan → Distribusi sales**: pilih kelurahan → pilih penerima per kanal → preview pelanggan/konflik dan perbandingan sebelum–sesudah → tanggal efektif/alasan → commit Management/NSM. Checkbox/pilihan polygon tidak menulis assignment. WEB-065 menampilkan jumlah pelanggan dan atribusi penjualan historis sebagai konteks, bukan memindahkan histori. Simulasi berbobot lanjutan merupakan WEB-068. Pengaturan dataset, versi dan koreksi pemetaan diletakkan di **Kelola → Pengaturan**, hanya Management/NSM. Tidak membuat sidebar kelompok GIS baru.

## Analisis yang diprioritaskan

**GIS-ANA-01 — Kinerja dan celah layanan per kelurahan (WEB-066).** Aggregasi actual invoice net, pertumbuhan periode sebanding, pelanggan aktif/churn, pelanggan unassigned, coverage meaningful unik dan keterlambatan layanan menurut kelurahan. Cohort, numerator/denominator, tanggal bisnis, source completeness dan aturan KPI memakai definisi monitoring yang berlaku; denominator nol menghasilkan tidak berlaku, sumber belum lengkap menghasilkan provisional/unknown dengan observed terpisah. Tampilkan pelanggan tanpa pemetaan sebagai bucket tersendiri; total kelurahan + belum terpetakan harus cocok dengan total scope. Satu pelanggan tidak dijumlahkan ulang karena memakai dua kanal.

Achievement kelurahan hanya tersedia jika target mempunyai rincian pelanggan atau alokasi wilayah yang eksplisit dan valid. Target sales/area yang melintasi beberapa kelurahan tidak dibagi rata atau diproporsikan diam-diam; jika belum ada dasar alokasi, tampilkan **Target belum dialokasikan per kelurahan**, bukan 0%. Pilihan atribusi geography **as-of transaksi/aktivitas** atau **pemetaan saat cutoff** harus ditetapkan dalam kontrak metrik, ditampilkan pada hasil dan dibawa saat export. Jangan menulis ulang invoice/target untuk memenuhi grouping. Perbandingan memakai basis mapping/boundary dan periode yang konsisten; perubahan basis diberi label.

Celah layanan berarti pelanggan tercatat yang belum assigned, belum berinteraksi bermakna atau melewati frekuensi layanan. Wilayah tanpa pelanggan tercatat bukan bukti pasar kosong. Market share, total outlet pasar atau potensi rupiah eksternal tidak dibuat dari jumlah pelanggan internal. Field dan telesales dibedakan dengan drill-down yang tetap mempertahankan union pelanggan unik.

**GIS-ANA-02 — Risiko pelanggan dan repeat order (WEB-067).** Layer risiko mengelompokkan pelanggan mendekati churn, melewati pola repeat order atau mengalami penurunan nilai pembelian. Status aktif/churn tetap memakai rolling 90 hari tanggal invoice yang sudah disepakati; indikator risiko tidak mengubah status itu. Ambang mendekati churn, periode pembanding, metode repeat order dan histori minimum harus eksplisit, berversi dan dapat dikonfigurasi Management/NSM sebelum diaktifkan; jangan memasang parameter bisnis seolah sudah disetujui. Histori/data tidak cukup menghasilkan **Belum cukup data**, bukan aman atau risiko nol. Bandingkan periode penuh atau rentang hari yang sebanding. Retur, pembatalan dan kelengkapan sumber mengikuti aturan invoice.

Setiap flag memiliki alasan dan bukti, misalnya invoice terakhir, baseline repeat, keterlambatan dan perubahan nilai. Ranking awal harus dapat dijelaskan; tidak memerlukan AI/provider berbayar. Klik flag → customer sumber → task/kunjungan/follow-up sesuai izin. Kebijakan dan hasil analisis tidak otomatis mengubah owner, mengirim pesan atau menetapkan insentif. Desain penyimpanan versi kebijakan dan snapshot/evidence hasil menjadi deliverable sebelum implementasi, tanpa mengasumsikan tabel segmentasi yang ada cocok untuk semua aturan risiko.

**GIS-ANA-03 — Pemerataan beban dan simulasi territory (WEB-068).** Bandingkan pelanggan aktif, frekuensi layanan, estimasi durasi layanan/kerja yang memiliki dasar, kapasitas hari kerja dan histori penjualan menurut sales/kelurahan. Telesales mempunyai beban callback/kontak sendiri; jangan menyamakan durasi telepon dengan kunjungan. Durasi tidak tersedia tetap unknown, bukan nol. Setiap bobot, satuan, periode dan asumsi dapat dibaca/dipilih oleh Management/NSM; histori penjualan disebut histori, bukan otomatis potensi pasar.

Skenario memindahkan satu atau beberapa kelurahan menghasilkan preview sebelum–sesudah: jumlah pelanggan, frekuensi/beban, histori penjualan referensi, pelanggan terdampak, penerima per kanal, konflik scope/SPV dan assignment. Preview tidak mengubah data; simpan basis boundary/mapping/cutoff, versi input dan asumsi yang digunakan agar dapat direview. Perubahan data sesudah preview menuntut validasi ulang sebelum commit. Penerapan memakai alur transfer WEB-065 dengan tanggal efektif dan audit, satu owner aktif per kanal dan histori tetap. Tidak ada routing, ETA atau estimasi waktu perjalanan dari jarak lurus. Kontrak serta penyimpanan skenario dirancang sebelum coding; reuse tabel lain hanya bila semantik tervalidasi.

## Urutan dan hubungan dengan rilis

| Tahap | Backlog | Hasil |
| --- | --- | --- |
| Fondasi | WEB-063 | Dataset nasional, versi, kode dan schema wilayah |
| Peta dan pemetaan | WEB-064 | Sebaran, overlay, filter, panel dan review pelanggan |
| Pembagian awal | WEB-065 | Area kelurahan dan preview/commit assignment |
| Analisis pertama | WEB-066 | Kinerja + coverage; integrasi Overview/Monitoring |
| Analisis berikutnya | WEB-067 dan WEB-068 | Risiko pelanggan; pemerataan dan simulasi, dapat dikerjakan paralel setelah dependensi masing-masing |

Staging, Firebase/login per role dan UAT tim berjalan sebagai jalur paralel; jangan menambah dependensi WEB-062 ke semua analitik secara otomatis. WEB-066–068 adalah **M4 extension P1**, bukan gate wajib pilot tim saat ini. Acceptance fitur GIS dibedakan dari acceptance web/cloud yang sudah ada. Android tetap mengikuti gate web/API yang sebelumnya disepakati. Penetrasi produk dan analisis akuisisi/total pasar tetap kandidat pengembangan berikut, belum termasuk tiket baru ini.

## Acceptance tambahan

Seluruh kasus berikut Planned. Tambahan ini tidak mengubah 82 kasus UAT baseline maupun GEO-A01–08.

| ID | Skenario dan hasil wajib | Backlog |
| --- | --- | --- |
| GIS-U01 | Desktop/mobile, keyboard, pencarian wilayah, panel kanan/bawah, Esc/fokus, reduced motion dan fullscreen mempertahankan filter; mode belum tersedia tidak membuat data tiruan | WEB-064 |
| GIS-U02 | Klik wilayah → customer/sales → kembali mempertahankan periode/kanal/kelurahan; seluruh link/data tetap scoped; empty dan nol berbeda, warna bukan satu-satunya informasi | WEB-064, WEB-066 |
| GIS-U03 | Pembagian kelurahan menampilkan preview sebelum–sesudah, konflik, tanggal efektif dan alasan; hanya Management/NSM commit; stale preview ditolak | WEB-065 |
| GIS-A01 | Pelanggan dua kanal, pemetaan kosong, denominator nol, source tidak lengkap dan target tanpa alokasi kelurahan: total rekonsiliasi, unknown/provisional dan basis target ditampilkan benar | WEB-066 |
| GIS-A02 | Batas/mapping berubah dan perbandingan periode: basis geography/versi/definisi KPI terlihat, perbandingan konsisten, fakta historis tidak ditimpa | WEB-066 |
| GIS-A03 | Customer baru/histori minim, retur, pembatalan dan penurunan periode parsial: risiko dapat dijelaskan, parameter berversi dan data minim tidak disebut aman | WEB-067 |
| GIS-A04 | Tindakan dari risiko tunduk role/assignment/DNC/jam kontak; tidak otomatis menghubungi pelanggan atau memindahkan owner | WEB-067 |
| GIS-A05 | Beberapa kelurahan disimulasikan ke sales berbeda: bobot/satuan/durasi unknown terlihat, preview tidak menulis, data berubah perlu validasi ulang, commit melalui transfer bertanggal dan histori tetap | WEB-068 |

API operasi dan model fisik baru yang diperlukan harus dirinci serta divalidasi pada masing-masing tiket sebelum implementasi; daftar `/api` dan ERD implementasi sekarang tidak dianggap sudah mendukung kemampuan ini.

## Bukti lokal WEB-064 — 24 Oktober 2026

GIS-U01 dan bagian customer dari GIS-U02 terverifikasi lokal pada browser (keyboard/polygon click/tooltip, responsive 390/768/1440, fullscreen, periode dan daftar pelanggan kembali ke peta). Geometry/permission backend diuji terpisah. GIS-U02 untuk kinerja sales/historical analytics tetap WEB-066; tidak ada link yang mengesankan filter wilayah sudah diterapkan pada Monitoring. Periode pada Sebaran hanyalah konteks navigasi; jumlah dan mapping memakai tanggal efektif terkini. U01/U02 tidak menjadi sign-off tim/provider. [Evidence](../WEB064_EVIDENCE.json).

## Bukti lokal WEB-066 — 24 Oktober 2026

GIS-U02/GIS-A01–02: basis geography ditetapkan current mapping read-cutoff untuk kedua periode. [Definisi/KPI dan batas bukti](../WEB066_REGIONAL_ANALYTICS.md), [evidence](../WEB066_EVIDENCE.json). Source customer/invoice/aktivitas/target/kinerja sales memakai snapshot scoped; wilayah + bucket tetap reconcile. Unknown/null dan source provisional terpisah. Transfer historis tidak membocorkan customer/area terkini. Ringkasan dan navigasi mempertahankan cabang/tim/periode/kanal. Tidak menyatakan 82 baseline UAT/human/cloud telah diterima.


## Implementasi lokal WEB-067 — 24 Oktober 2026

Risiko pelanggan nyales-risk-1 tersedia lokal: mendekati churn, repeat order terlambat dan penurunan invoice dengan ambang/histori minimum yang diisi Management/NSM. Policy aktif immutable dan tidak dipasang default; perubahan melalui draft/aktivasi berversi. Mode Risiko menampilkan bukti, source/cutoff/scope dan snapshot historis; data minim tidak disebut aman. Near-churn perusahaan menjadi unknown bila akses sejarah perusahaan tidak sah. Tidak menulis status/owner/target/aktivitas atau menghubungi customer otomatis. Akses dan guard kontak/DNC/campaign/lease existing tetap berlaku. D1 menyimpan metadata dan R2 privat menyimpan bukti; recovery keduanya diuji lokal. [Definisi dan evidence](../WEB067_RISK_DESIGN.md), [ERD fisik](ERD_WEB067_Implementation.md), [10 operasi API](customer-risk-api.m4.openapi.json). GIS-A03/A04 diverifikasi lokal, bukan sign-off manusia/provider. Model desain baseline tidak otomatis menjadi endpoint /api/v1 yang sudah deployed.


## WEB-068 tahap engine — 24 Oktober 2026

[Kontrak satuan, unknown, skenario immutable dan batas penerapan](../WEB068_WORKLOAD_DESIGN.md) diturunkan menjadi validator/pure engine dengan 12 tests. Ini belum UI, API atau acceptance GIS-A05. Durasi/kapasitas tidak diisi default, lapangan/telesales terpisah dan histori invoice tidak direatribusi.
