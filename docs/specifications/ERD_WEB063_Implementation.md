# ERD implementasi lokal WEB-063

23 Oktober 2026. Migrasi `0035_administrative_boundaries.sql`; [inventaris kolom/FK/index dari D1 lokal](ERD_WEB063_Implementation.json). Enam tabel baru, tanpa mengubah master customer, assignment atau invoice. [Kontrak delapan operasi aktual](admin-boundaries-api.m4.openapi.json).

| Tabel | Penyimpanan dan guard |
| --- | --- |
| admin_boundary_dataset | Manifest rilis immutable, namespace, sumber/checksum, cakupan, expected count/chunks, review/lisensi/atribusi; exact release date nullable. Draft → active → retired. Satu active per organisasi. Aktivasi membutuhkan manifest lengkap dan pemeriksaan R2. |
| admin_boundary_chunk | PK organisasi/dataset/index; checksum, key R2 privat, byte/feature count. Chunk append-only dan berurutan dari 0. |
| admin_unit | Identitas stabil organisasi/namespace/kode, parent yang konsisten tingkatannya; tidak memakai nama sebagai kunci. Identitas immutable, nama/hierarki tiap rilis dibekukan pada boundary. |
| admin_boundary | Unique dataset/unit dan dataset/source ID; nama/parent/hierarchy snapshot, bbox E7, geometry type/checksum. Key R2 menunjuk FeatureCollection penuh dan geometry_feature_index menunjuk feature. Tidak menyimpan koordinat polygon di D1. |
| area_admin_membership | Composite FK area/unit/boundary dan guard interval overlap; belum ada write API WEB-065. |
| customer_admin_location | Composite FK customer/unit/boundary/reviewer, bukti dan status, guard confirmed overlap; belum ada matching/write API WEB-064. Revisi/penutupan interval memerlukan penurunan workflow pada WEB-064. |

Semua referensi ke organisasi/aktor/customer/area menggunakan composite FK. Batas dan chunk tidak dapat diedit/dihapus melalui API; pembaruan membuat rilis baru. Pergantian rilis menggunakan satu transaksi D1 setelah R2 diperiksa, dengan If-Match, expected_active_id, mutation guards, audit dan idempotency. Kegagalan tidak menonaktifkan rilis sebelumnya. Nama yang berubah pada rilis baru memakai snapshot baru, bukan rewrite unit/histori.

Geometry penuh divalidasi dengan JSTS 2.12.1: struktur, WGS84 longitude/latitude, ring tertutup, self-intersection, hole dan MultiPolygon topology. Ini validitas tiap feature; overlap antarwilayah tetap dapat ada pada sumber dan memerlukan review saat matching WEB-064. Tidak ada simplifikasi untuk matching.

Backup logis WEB-057 kini memasukkan metadata enam tabel ini, tetap merupakan slice metadata. Full restore lokal terpisah membuktikan pemulihan seluruh D1 pilot serta byte satu chunk batas dan satu lampiran R2; bukan cloud restore atau acceptance produksi. Lihat [runbook/evidence WEB-063](../WEB063_ADMIN_BOUNDARIES.md).
