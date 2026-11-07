# Rekap kunjungan dan off visit

Status: implementasi lokal, belum dirilis ke staging. Migrasi 0057 diperlukan. Tidak ada backfill atau perubahan invoice/customer.

## Alur

- Aktivitas lapangan → Off visit: sales mengajukan satu tanggal penuh dengan alasan cuti tahunan, sakit, izin pribadi, pelatihan/tugas kantor, atau izin lainnya. Atasan dalam scope menyetujui, menolak, atau membatalkan dengan catatan. Management, NSM, Area Manager dan Supervisor dapat mencatat langsung untuk bawahan yang dapat diakses; tidak dapat menyetujui pengajuan sendiri.
- Alfa hanya boleh dicatat atasan, sampai tanggal hari ini. Ketiadaan transaksi atau kunjungan bukan bukti alfa. Pencatatan ini bukan mesin absensi maupun perhitungan hak cuti/payroll.
- Satu sales hanya memiliki satu pengajuan pending/approved per tanggal. Catatan ditolak/dibatalkan tetap disimpan. Setiap perubahan menggunakan idempotency, pemeriksaan versi, dan audit.
- Approval off ditolak jika sudah ada kunjungan berlangsung, selesai, atau perlu ditinjau pada tanggal tersebut. Off yang disetujui memblokir kunjungan baru dan generator. Check-out kunjungan lama tetap dapat diselesaikan; agenda lama tidak dihapus otomatis.
- Perubahan off menaikkan revisi sumber generator agar pratinjau lama tidak dapat diterapkan. Pemeriksaan guard atomik menjaga benturan approval versus pembuatan aktivitas.
- Sesi `leave` lama tetap tersimpan, tetapi tidak diterjemahkan menjadi off sehari penuh karena tidak memiliki tanggal/alasan terstruktur yang disetujui.

## Rekap di Monitoring

Rekap khusus sales lapangan, mengikuti filter sales, kanal, area, cabang, tim dan scope hierarki. Rentang tanggal lokal inklusif maksimal 93 hari, sampai hari ini. Pagination 50/100 sales, tanpa polling dan tanpa query per sales.

| Angka | Definisi |
| --- | --- |
| Target visit | Target harian generator × hari kerja ketika role lapangan aktif − target pada hari off berizin yang disetujui |
| Off berizin | Hari kerja dengan off approved selain alfa; pending belum mengurangi target |
| Alfa | Hari kerja yang secara eksplisit dicatat approved sebagai alfa; tidak mengurangi target |
| Visit | Pelanggan unik per sales per tanggal lokal dengan aktivitas field visit berstatus done. Ulang kunjungan ke pelanggan yang sama sehari dihitung satu. Visit needs_review/draft/call tidak dihitung |
| Visit compliance | Jumlah kredit visit harian ÷ target efektif × 100%. Kredit per hari dibatasi target harian. Kelebihan satu hari tidak menutupi kekurangan hari lain |

Calendar dan target menggunakan **pengaturan generator saat ini**, bukan kontrak target historis yang dibekukan. Hal ini dinyatakan pada tooltip dan metadata `target_basis=current_generator_policy`. Perubahan kebijakan dapat menghitung ulang rekap historis. Jika kelak dipakai untuk penilaian formal, tambahkan versi target efektif per tanggal terlebih dahulu. Target yang belum dikonfigurasi tetap null; compliance tanpa target atau ketika target nol ditampilkan sebagai tidak berlaku, bukan 0% atau 100%.

Visit di luar hari kerja tetap terlihat pada jumlah visit, tetapi tidak memberi kredit terhadap target hari kerja lain. Status produktif/coverage berbeda dari visit compliance: kunjungan toko tutup yang tercatat selesai dapat dihitung sebagai visit, tanpa menjadi meaningful coverage.

## Penugasan, tindak lanjut, dan simulasi

Kunjungan manual maupun agenda mengharuskan customer terikat ke sales pelaksana pada kanal lapangan. Generator juga hanya memakai customer aktif yang sudah diassign. Kunjungan tanpa agenda masih diperbolehkan; penugasan customer dan agenda kunjungan adalah dua hal berbeda.

Task terbuka adalah tindak lanjut/callback yang belum selesai. Actual teramati adalah invoice net yang berhasil dibaca, bukan jumlah visit. Kartu Actual invoice menampilkan jumlah invoice valid yang tercatat, tanpa mensyaratkan penanda kelengkapan sumber dan tanpa badge sementara. Pencapaian memakai realisasi yang eligible terhadap target valid; overlap/dimensi bermasalah tetap tidak dihitung sebagai pencapaian valid. Metadata kelengkapan sumber tetap tersimpan untuk audit, baseline, dan proses finalisasi yang memerlukannya. Kedua kolom diganti oleh rekap kunjungan pada tabel Monitoring; data sumbernya tetap ada untuk kebutuhan fitur lain.

Tab “Beban & simulasi” dinamai **Simulasi pembagian**. Ini membandingkan beban portofolio, pelanggan, kapasitas layanan dan dampak calon perubahan PIC/wilayah. Preview tidak mengubah penugasan; penerapan tetap aksi eksplisit. Fitur ini berbeda dari agenda/PJP dan rekap realisasi visit.

## Operasional dan batas

- Data hanya ditulis saat Simpan/Tinjau ditekan. Membuka rekap atau filter tidak membuat absensi/agenda.
- Query recap memakai agregasi per sales/hari dan indeks aktivitas serta off. Seluruh invoice dan pelanggan tidak dimuat ke browser untuk menghitung rekap.
- Data off termasuk dalam logical backup allowlist; bukan klaim backup seluruh database atau restore yang sudah diverifikasi.
- API: `visit-attendance.openapi.json`. Migrasi masih lokal; D1 staging belum disentuh.

## Rekap Sales dan Telesales — 7 November 2026

Monitoring menyediakan pilihan **Sales | Telesales** pada satu kartu rekap. Filter tanggal tersembunyi saat pertama dibuka; mengubah kanal tidak mengubah data atau agenda.

- Sales mempertahankan target visit, off berizin, alfa, visit, dan visit compliance.
- Telesales: **Call target** adalah jumlah agenda panggilan berstatus planned/proposed/done dalam rentang, bukan kebijakan target baru. Tanpa agenda nilainya belum diatur.
- **Call** menghitung aktivitas telesales call selesai. **Berhasil** menghitung hasil manual connected_pic; tidak menyatakan verifikasi provider, order atau konversi penjualan.
- **Success rate** = Berhasil / Call; tanpa panggilan nilainya kosong.
- Agregasi hanya untuk halaman sales yang sedang diminta dan customer dalam scope pengguna. Tidak ada perubahan data saat GET.
