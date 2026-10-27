> Pembaruan26 Oktober2026: sumber start/end/break/absence dan jam/durasi manual berversi sudah tersedia lewat [profil operasional](WEB070_OPERATIONAL_PROFILES.md). Histori layanan lengkap/agenda lintas kanal dan engine masih pending; readiness bukan snapshot solver.

# WEB-070 — pengaturan dan pemeriksaan kesiapan kunjungan

25 Oktober 2026. Slice0044. Menu Pengaturan → Perencanaan kunjungan menyimpan aturan, deklarasi graph dan bukti kesiapan. **Belum menghasilkan jadwal atau mengirim snapshot pelanggan ke komputer penghitung.** Lihat [API aktual](specifications/visit-planning-readiness.m4.openapi.json), [ERD](specifications/ERD_WEB070_Readiness_Implementation.md), [status/evidence](WEB070_PROGRESS.json). Bagian queue/identitas sebelumnya tetap tersedia.

## Kebijakan

Hanya Management/NSM membuat draft, mengedit draft, mengaktifkan dengan checksum/version/expected-active-id/konfirmasi, dan menghentikan versi. Aktivasi mengganti versi aktif secara atomik; parameter yang sudah aktif tidak diedit. Kebijakan baru bukan salinan otomatis angka bisnis. Form memerlukan bobot total100%, batas proses/retensi eksplisit dan alasan. Frekuensi/jeda kosong tetap null. Durasi/jam penerimaan hanya boleh diasumsikan lewat pilihan eksplisit beralasan; teks visit_window lama tidak diparse menjadi jam yang dianggap valid.

Kontrak mendukung override customer eksplisit yang diperiksa terhadap customer aktif kanonik organisasi. Null pada override berarti tidak diketahui, tidak diam-diam mewarisi default umum. Form saat ini menampilkan/mempertahankan override yang ada dan dapat menghapusnya; pembuatan override khusus tersedia melalui API dan UI terstruktur customer menjadi tindak lanjut. Tidak mengubah service_frequency_days lama menjadi jumlah visit per bulan.

Retensi pada kebijakan adalah aturan untuk pipeline generator berikutnya. Pembersihan bukti readiness belum otomatis. Jangan menganggap parameter input_days sudah menghapus R2 atau cache agent pada slice ini.

## Graph jalan

Import file manifest JSON maksimal16KiB melalui popup. Field manifest mencakup ID/versi, tanggal extract, hash extract/graph, profil/versi profil/referensi validasi, OSRM/versi, bbox dan referensi sumber/lisensi HTTPS/atribusi. Tanggal extract masa depan ditolak. Ini deklarasi metadata; URL tidak di-fetch, file graph tidak dipasang, profil kendaraan tidak diverifikasi. Status hanya draft/retired, engine_verified=false. Bbox menunjukkan cakupan yang dideklarasikan, bukan bukti connectivity atau snap yang berhasil.

## Pemeriksaan kesiapan

Pilih harian(satu sales/satu tanggal) atau bulanan(maksimal10sales/dalam satu bulan), kebijakan, graph opsional, periode dan rentang histori eksplisit. Cutoff histori tidak boleh melebihi tanggal bisnis organisasi; periode seluruhnya lampau ditolak dan tanggal lampau pada bulan berjalan dipisahkan. Maksimal200customer aktif kanonik berdasarkan assignment field yang beririsan periode. API dapat menyempitkan customer_ids; UI awal memilih populasi assignment sales terpilih. Telesales tidak menjadi rep generator.

Snapshot membekukan sumber master/role/scope/assignment/calendar, current validated IDR invoice net lintas kanal per customer kanonik, aktivitas visit field meaningful yang diterima, coverage invoice, agenda dan deklarasi policy/graph. Tidak mengubah atribusi invoice, menggabungkan invoice primer dua kali atau mengubah status aktivitas. Net invoice sudah memakai rekonsiliasi kredit dari pipeline transaksi; snapshot tidak mengurangi credit_note sekali lagi.

Eligible date memerlukan assignment field tunggal, role rep pada tanggal tersebut, area/cabang aktif, kalender tunggal, weekday/holiday yang sesuai serta tanggal belum lampau pada cabang. Titik awal/akhir, break, cuti, durasi/jam penerimaan, kelengkapan histori visit dan interval agenda yang belum tersedia ditampilkan sebagai penghambat. Agenda existing tidak digeser, dikonversi atau diberi durasi tebakan.

Nilai observasi invoice terpisah dari nilai yang lengkap: tanpa source coverage, observedSales dapat0 tetapi sales_rupiah=null. Observasi visit tidak membuktikan jumlah kunjungan selesai lengkap; known_completed_contacts dan remaining_contacts tetapnull. Source coverage invoice bukan bukti histori visit lengkap. Kebijakan bobot penjualan dapat meminta blok atau pengecualian metrik dengan disclosure; readiness belum menjalankan normalisasi bobot solver.

Engine/routing dan solver selalu menjadi penghambat pada slice ini; can_generate=false dan publishable=false. Payload readiness bukan VisitSnapshot input solver dan tidak bisa di-enqueue lewat diagnostic queue. Global blocker, blocker sales/customer, asumsi dan asal sumber terlihat pada hasil.

## Bukti, concurrency dan pemulihan

Snapshot privateR2 dibatasi4MiB dengan hash/size; D1 hanya metadata/input refs/epoch/customer/blocking count. Batas source200customer/50000invoice/10000activity/5000assignment/6000agenda menolak oversized, tidak memotong hasil. Epoch diperiksa sebelum/sesudah read serta pada transaksi metadata. Jika penyimpanan bytes berhasil tetapi commit ditolak, hanya objek yang terbukti tidak direferensikan dihapus; commitstate tidak diketahui tetap dipertahankan untuk operator.

GET detail memverifikasi hash/size/org/refs/environment, lalu membandingkan source/agenda epoch, business date org/cabang dan policy/graph version/hash. Hasil lama immutable dan ditandai historis, bukan diubah mengikuti data baru. Retire deklarasi atau perubahan input dapat membuat hasil lama stale. List dibatasi100versi/graph dan50snapshot dengan has_more.

Logical backup menyertakan metadata/versi/epoch serta inventory referensi R2. Restore drill saat ini checksum/jumlah, bukan restore produksi atau penggandaan seluruh bytesR2. Full onlineSQLite backup tetap dilakukan sebelum migrasi; R2 recovery dan acceptance produksi dipisahkan. Tidak ada default policy, graph atau readiness pada pilot utama; fixture dibuat hanya pada QA.

Berikutnya: sumber operasional yang masih kurang, builder VisitSnapshot solver yang lengkap beserta stale guards, graph OSRM nyata/launcher verification/benchmark, penghubung ke deliveryqueue, solver harian/bulanan dan review/publish agenda.
