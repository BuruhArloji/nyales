# ERD WEB-070 — sumber operasional kunjungan

26 Oktober 2026. [Inventaris fisik](ERD_WEB070_Operational_Implementation.json) dihasilkan dengan mengeksekusi seluruh migrasi sampai0045 di SQLite lalu membaca columns, foreign keys, indexes dan triggers. Total114 tabel aplikasi/116 termasuk metadata D1 lokal.

`visit_rep_planning_profile` menyimpan sumber operasional satu sales: branch kalender, titik awal/akhir E7, interval istirahat dan tanggal absen yang ditinjau, source_note dan tanggal berlaku inklusif. `visit_customer_planning_profile` menyimpan durasi layanan nullable serta interval penerimaan per hari minggu yang ditinjau. Review kosong berarti tidak ada pada periode yang dinyatakan; tanpa profil tetap unknown.

Keduanya memiliki organization/target, id, rentang tanggal, revision_no/version, status current/superseded/retired, previous_id, config_json/hash, alasan, pembuat/waktu dan ended_at. FK target, actor dan previous memakai organisasi yang sama. Tidak boleh menghapus atau mengubah parameter versi yang telah tersimpan. Perubahan membuat versi baru pada rentang tanggal yang persis sama, mensupersede versi current dengan CAS; retirement hanya mengakhiri status. Trigger menolak overlap periode current, perubahan parameter dan transisi ilegal, serta menaikkan source_epoch agar readiness lama ditandai historis.

Assignment, koordinat customer, invoice, target, aktivitas dan agenda tidak diperbarui oleh profil ini. Branch/timezone/role/scope/calendar/absence dan jendela penerimaan diperiksa lagi per tanggal saat readiness. Profile tidak membuktikan histori visit lengkap dan bukan VisitSnapshot solver.

Logical recovery allowlist mencakup kedua tabel; sumber privateR2 readiness tetap memiliki inventaris referensi tersendiri. Bukti integrity/FK dan perbandingan seluruh row bisnis yang sudah ada sebelum migrasi ada pada `test-results/web070-profiles-commercial-preservation.json`. Main tidak memperoleh dummy atau default profile. QA memperoleh satu customer, satu assignment, empat user sintetis dan tiga row profile untuk pengujian; row lama seluruh18 tabel tetap identik.
