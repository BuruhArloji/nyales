# ERD WEB-070 — pengaturan dan kesiapan perencanaan

25 Oktober 2026. [Inventaris fisik](ERD_WEB070_Readiness_Implementation.json) berasal dari eksekusi DDL dan introspeksi SQLite. Migrasi0044 menambah empat tabel; total112 tabel aplikasi/114 termasuk metadata D1 lokal.

- `visit_generator_policy_version`: draft/active/retired, revisi, aturan typed JSON/hash, versi concurrency, alasan dan actor/timestamp. Satu aktif per organisasi, parameter versi aktif/retired immutable.
- `visit_generator_graph_release`: deklarasi manifest JSON/hash, draft/retired, versi dan audit. Tidak mempunyai status active atau verified karena engine belum diverifikasi; URL hanya metadata dan tidak di-fetch.
- `visit_planning_revision`: source_epoch/agenda_epoch per organisasi. Trigger pada sumber master, kalender, role/scope, assignment, invoice/coverage, aktivitas, work_plan dan deklarasi kebijakan/graph mendeteksi perubahan. Upsert revision saat restore seed menghindari duplikasi row yang otomatis dibuat trigger organisasi.
- `visit_planning_preflight`: metadata immutable, policy/graph/actor FK komposit organisasi, input JSON, epoch/tanggal bisnis, referensi privateR2, hash/size dan jumlah customer/penghambat. Payload besar tidak masuk D1.

Snapshot `nyales-visit-readiness-1` berbeda dari VisitSnapshot input solver. Snapshot hanya membekukan observasi sumber, eligible dates, asumsi eksplisit dan penghambat. `can_generate=false`, `publishable=false` selalu. Sumber visit/ketidakhadiran, titik awal/akhir, break, interval agenda/constraint lintas kanal, engine/routing belum lengkap. Tidak ada hasil rute atau mutasi agenda.

Logical backup mencakup empat tabel dan inventaris referensi snapshot, bukan klaim backup bytesR2 otomatis. Restore drill memeriksa checksum/count payload backup; operator tetap perlu memulihkan objek privateR2 terpisah. Batas data source200customer/50000invoice/10000activity/5000assignment dan snapshot4MiB menolak pekerjaan yang terlalu besar, tidak memotong data menjadi laporan tampak lengkap.
