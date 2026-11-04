# Read efficiency — 4 November 2026

## Implementasi

1. **Page-first invoice facts.** Daftar pelanggan menghitung invoice hanya untuk
   ID halaman dan keluarga merge-nya. Tenant, scope invoice historis, current,
   validation state, cutoff, sum dan last invoice tetap sama. Query keluarga
   memakai indeks `customer_family` secara eksplisit: pengukuran provider
   menemukan planner memilih indeks organization-only pada kandidat awal.
2. **Exact count cache.** Total hasil disimpan 30 detik per scope, filter,
   snapshot segmentasi dan source revision; offset/limit tidak memecah count.
   Baris halaman tetap dibaca dari database. Pencarian dan pagination tidak
   memakai angka perkiraan atau jumlah halaman sebagai total organisasi.
3. **Revisioned read models.** Cache pelanggan dan dashboard menyertakan epoch
   transactional sumber, geografi, finance serta versi tier rules. Nama/assignment,
   invoice dan sumber yang berubah menyebabkan key berbeda pada request baru.
   Cache key disimpan sebagai SHA256 berukuran tetap, bukan SQL/filter di URL.
4. **Scope sharing.** Management dengan scope organisasi setara dapat berbagi
   read model nonpersonal; scope terbatas tetap memuat area dan rep IDs yang
   diurutkan. Role, channel, hari bisnis dan capabilities ikut key. Sesi,
   identitas dan scope server tetap diperiksa setiap request sebelum cache.
5. **Map metrics cache.** Hasil agregat invoice/aktivitas peta disimpan 60 detik
   per scope, revision, periode, kanal, rep, area dan hash cohort. Cache berisi
   agregat yang sudah diotorisasi, bukan salinan token atau izin lama.
6. **In-flight browser GET deduplication.** GET identik yang berjalan bersamaan
   dibagi; respons di-clone per caller, tanpa completed-response cache. Token,
   sesi, query dan headers berbeda tidak digabung. Satu abort tidak membatalkan
   caller lain. Logout membatalkan pending dan menolak respons generasi lama.
   Tidak ada persistence pelanggan ke localStorage atau deduplikasi mutasi.
7. **Security heartbeat.** Timer tetap 30 detik ketika halaman terlihat. Event
   focus/visibility yang berdekatan digabung dengan batas 15 detik dan satu
   request berjalan; tidak memperpanjang masa sesi atau menunda validasi aksi.
8. **Activity indexes (0051).** Indeks organization/channel/time/outlet dan
   organization/outlet/time untuk mempersempit scan aktivitas. Tidak mengindeks
   JSON besar, tidak mengubah business records dan tidak menambah epoch triggers.

## Bukti D1 provider

Pembandingan read-only pada staging memakai **100 ID pelanggan yang sama**,
cutoff 2026-11-04. Dua query invoice facts menghasilkan satu baris agregat yang
identik. Nilai ID/nominal pelanggan hanya disimpan di direktori privat operator.

| Query invoice facts | Rows read | Rows written | SQL duration satu sampel |
|---|---:|---:|---:|
| Sebelum (group invoice dahulu, filter customer sesudahnya) | 4.886 | 0 | 5,05 ms |
| Sesudah (keluarga halaman dibatasi, indeks family) | 649 | 0 | 0,96 ms |

Pengurangan **86,7% untuk query tersebut pada sampel itu**. Bukan klaim penghematan
seluruh page/request/hari atau kapasitas pengguna bersamaan. Auth, count,
segmentasi dan telemetry di luar sampel SQL. Kandidat awal tanpa petunjuk indeks
membaca 47.518 rows; ditolak dan diperbaiki sebelum release. Percobaan awal yang
menaruh SQL pemilih halaman di query invoice bukan kontrak aplikasi sebenarnya;
hasilnya tidak dipakai untuk persentase. Semua percobaan hanya SELECT; tidak ada
invoice/customer/assignment diubah. File SQL yang diunggah oleh Wrangler adalah
input query operator, bukan seed bisnis.

Receipt privat: `.nyales-agent/staging/read-page-comparison-20261104.json`;
hasil raw, SQL dan explain disimpan di direktori yang sama, tidak dikomit.

## Validasi dan batas

Tes rekonsiliasi memeriksa customer canonical/alias, invoice future/draft/
superseded, cutoff, count reuse/invalidation, pemisahan scope, GET simultan,
abort/logout, kegagalan request dan heartbeat. UI/manual acceptance oleh pengguna.
Build lokal (termasuk typecheck) lulus; suite 386 tes: 378 lulus, 8 dilewati, 0 gagal. Pemeriksaan tampilan tidak dijalankan sesuai arahan pengguna. Status CI/deploy dilaporkan terpisah setelah workflow selesai.

Masih memerlukan pekerjaan lanjutan, sehingga program read efficiency tetap
**In progress**:

- Peta masih memuat cohort scoped penuh; viewport tiles atau server clusters
  beserta summary terpisah belum tersedia. Raster WorldPop di R2 tidak membaca D1.
- Endpoint legacy tanpa `limit` dan beberapa form masih memuat directory penuh.
  Paged customer dan distribusi sudah dibatasi, tetapi belum seluruh endpoint.
- Pagination masih OFFSET; keyset cursor untuk deep pagination belum diterapkan.
- Cache API berlaku per colo. Auth/resolveScope/revision masih membutuhkan read
  pada cache HIT; bukan zero-read. Tidak ada distributed singleflight lintas Worker.
- Cold rebuild segmentasi masih bisa membaca organisasi; belum dipindah ke job
  materialisasi dengan checkpoint. Full SELECT-star audit/N+1 audit seluruh
  modul belum selesai; proyeksi kolom tidak otomatis mengurangi rows_read D1.
- Kapasitas multiuser perlu workload representatif dan p95/rows-read budget
  terukur. Tidak dilakukan load test staging pada pekerjaan ini.

Rollback kode dapat memakai deployment sebelumnya tanpa menghapus indeks atau
data. Tidak rollback schema/history secara destruktif. Cache lama terpisah oleh
key version/revision dan kedaluwarsa menurut TTL; mutasi tidak memakai cache ini.
