# ERD implementasi lokal WEB-066

24 Oktober 2026. Tidak menambah tabel. [Schema trigger dan basis fisik](ERD_WEB066_Implementation.json), [kontrak metrik/API](regional-analytics-api.m4.openapi.json).

Migrasi 0039 menambah 15 trigger INSERT/UPDATE/DELETE pada activity, target_plan, target_version, target_item dan customer_source_coverage. Semuanya menaikkan geo_distribution_epoch organisasi. Input assignment/geography/master/finance/hirarki/timezone sudah ditangani 0037/0038. Efek konservatif: input KPI baru juga dapat membatalkan preview distribusi; tidak ada histori diubah.

Agregasi menggunakan invoice/current net dan atribusi historis, canonical customer, mapping confirmed efektif saat read, boundary snapshot rilis aktif, customer_assignment efektif cutoff, activity meaningful, approved target leaves serta source coverage. Status memakai helper rolling-90-hari tanpa menulis customer_status_snapshot atau segmentation run. Mapping saat read-cutoff yang sama dipakai pada dua periode; geometry tetap R2.

Snapshot/fingerprint laporan dikembalikan ke client, mengikat actor/scope/input revision. Sources dan CSV hanya dapat dibaca ulang jika snapshot masih sama. Ini bukan tabel laporan immutable permanen. Backup body/response/manifest schema 0039 diselaraskan, data komersial utama tetap. Restore penuh lokal masih 94 tabel/1 PDF/1 chunk batas; cloud/human acceptance terpisah.
