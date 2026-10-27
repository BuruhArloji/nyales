# ERD implementasi lokal WEB-064

24 Oktober 2026. Migrasi `0036_customer_geography_review.sql` melanjutkan enam tabel WEB-063, menambah `revision`, `superseded_at`, `created_at` pada `customer_admin_location`. [Kolom, FK, index dan trigger dari database lokal](ERD_WEB064_Implementation.json).

Unique `(organization_id,outlet_id,revision)` memberi urutan revisi per pelanggan. Index current memakai organisasi/customer/supersession/tanggal efektif. Composite FK customer, unit, boundary dan reviewer tetap. Unit hasil review harus village dan boundary harus milik unit/organisasi yang sama. Interval confirmed yang belum superseded tidak boleh overlap.

Mapping tidak boleh dihapus atau diubah identitas, bukti, metode, status dan reviewer-nya. API menutup interval sebelumnya jika berasal dari tanggal lebih awal; koreksi hari sama mempertahankan record lama dengan `superseded_at`, lalu menambah revisi. Guard versi, rilis aktif dan input customer dieksekusi atomik bersama mapping, audit dan idempotency. Perubahan fakta komersial/owner tidak menjadi bagian transaksi ini.

`evidence_json` menyimpan input koordinat/status, namespace/kode opsional, kandidat, algoritma, dataset/version, customer version, revisi awal dan preview hash. Geometry tetap immutable di R2 melalui referensi boundary WEB-063; tidak diduplikasi dalam record mapping. Relasi, metadata snapshot dan riwayat memungkinkan validasi ulang saat rilis atau koordinat berubah.

Status runtime `stale` dihitung dari bukti dibandingkan koordinat/status terkini dan rilis aktif; bukan rewrite status historis. Logical backup schema 0036 menyertakan kolom baru. Area membership/assignment write API belum diimplementasikan sampai WEB-065. [Kontrak lima endpoint](geography-api.m4.openapi.json), [alur operasional](../WEB064_GEOGRAPHY.md).
