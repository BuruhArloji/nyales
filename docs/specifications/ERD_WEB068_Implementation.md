# WEB-068 — model fisik beban kerja dan simulasi wilayah

24 Oktober 2026. Migrasi `0041_workload_scenarios.sql` menambah empat tabel, tanpa memasang kebijakan bawaan. Database lokal mempunyai 100 tabel (termasuk infrastruktur Wrangler). [Kolom, foreign key, indeks dan trigger aktual](ERD_WEB068_Implementation.json) diekstrak dari SQLite hasil migrasi.

`organization` memiliki banyak `workload_policy_version`: konfigurasi layanan bulanan per kanal, frekuensi/durasi, sumber kapasitas dan pengaturan khusus customer/rep, bobot, alasan, hash, actor dan timestamp. Satu versi aktif per organisasi. Draft dapat diedit dengan ETag; konfigurasi aktif immutable. Mengaktifkan versi baru meretire versi sebelumnya dalam transaksi yang sama. Tidak ada penghapusan versi.

`territory_scenario` menyimpan identitas, nama, status draft/archived, pembuat dan optimistic version. Satu root memiliki banyak `territory_scenario_revision`. Revisi baru menambahkan nomor revisi unik dan `supersedes_id`, tidak menimpa bukti lama. Revisi mengacu ke versi policy, boundary dataset dan actor dengan composite organization foreign keys. Epoch, tanggal mapping, fingerprint scope, exact preview hash dan request JSON disimpan bersama private R2 key/checksum/ukuran. Maksimum bukti 4 MiB. Tidak menduplikasi geometry ke tabel ini.

`territory_scenario_application` menghubungkan revisi yang ditinjau, key satu batch dan satu `geo_distribution_run`. Baris immutable berisi effective date, alasan, actor dan timestamp. Unique organization/scenario/batch key mencegah penerapan ulang; unique distribution run mencegah satu run diklaim oleh beberapa aplikasi. Foreign key revisi dan supersedes tidak boleh keluar organisasi atau skenario.

Penerapan adalah satu transaksi D1: optimistic root version, seluruh pernyataan planner WEB-065, distribution run, audit distribusi, application, audit operasi dan idempotency. Perubahan epoch membatalkan kelayakan revisi untuk batch selanjutnya. Revalidasi sisa batch menghasilkan revisi baru; tidak ada loop HTTP yang diklaim sebagai transaksi seluruh skenario. Batas 600 statements termasuk guard dan audit.

Trigger policy, cabang dan kalender menambah `geo_distribution_epoch`; tabel root/revision/application tidak menaikkan epoch sendiri. Revisi yang disimpan mengunci epoch dan active policy/hash sekali lagi. Tidak menulis ulang invoice, target, aktivitas atau insentif. Recovery logical schema 0041 mencakup empat tabel dan inventaris private scenario snapshots; full database/R2 restore diuji terpisah. Retensi/purge otomatis skenario belum diaktifkan.

[Runbook dan batas metrik](../WEB068_WORKLOAD_DESIGN.md) · [14 operasi API](workload-scenarios-api.m4.openapi.json) · [evidence](../WEB068_EVIDENCE.json).
