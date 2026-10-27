# ERD implementasi lokal WEB-065

24 Oktober 2026. Migrasi 0037/0038 menambah dua tabel dan melengkapi guard membership. [Schema fisik, FK, index dan trigger](ERD_WEB065_Implementation.json).

`geo_distribution_epoch` mempunyai satu row per organisasi. Counter meningkat saat customer/alias, assignment, transfer, struktur role/area/hirarki, mapping, batas, invoice/retur atau timezone organisasi berubah. Counter hanya pengaman konservatif preview, bukan jumlah transaksi. Dipulihkan persis pada restore.

`geo_distribution_run` merekam input/hasil immutable, referensi organisasi/dataset/area/actor, tanggal efektif/alasan, basis epoch, preview hash, mapping revision per customer dan ID hasil assignment. Daftar ID cohort serta digest disimpan; geometry tidak diduplikasi. Read history juga dibatasi Management/NSM.

`area_admin_membership` tetap interval [from,to), tanpa overlap per unit administrasi. API menutup interval lama lalu INSERT baru atomik; identitas/alasan tidak dapat diubah atau dihapus. Area dengan membership aktif/terjadwal tidak boleh diarsip. Membership saja tidak mengubah owner atau scope. Penugasan memakai workflow WEB-015 dengan versi, role/area/SPV dan satu owner per kanal. Transfer area selalu meninjau kedua kanal.

Logical backup body/response/manifest schema 0038 sinkron. Field Unicode besar dipulihkan via staging fragmen sebelum INSERT lengkap, tanpa menonaktifkan immutable guard. Histori invoice/target/visit/insentif tetap. [Kontrak](distribution-api.m4.openapi.json), [runbook](../WEB065_DISTRIBUTION.md).
