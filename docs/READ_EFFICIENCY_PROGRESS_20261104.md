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


## Tahap lanjutan — pemilih pelanggan dan metadata peta

- Endpoint `GET /api/customer-options` menyajikan proyeksi ID/nama/kode ERP/area/
  record status/jam visit. Default 20, maksimum 50, satu baris tambahan untuk
  `has_more`; tanpa exact COUNT, invoice, segmentasi atau pemuatan directory.
- Pencarian memakai prefix nama atau kode ERP dengan wildcard literal yang
  di-escape. Dua cabang pencarian dibatasi sebelum UNION; identitas yang cocok
  di kedua cabang tetap muncul sekali. `0052_customer_option_indexes.sql`
  menambah indeks nama dan kode terpisah; setiap cabang memakai indeksnya secara eksplisit agar ORDER BY tidak memicu scan seluruh organisasi. Tidak ada indeks JSON atau trigger
  invalidasi baru.
- Cursor keyset membandingkan tuple nama NOCASE + ID. Cursor terikat query,
  record-status, tanggal bisnis dan scope/capabilities. Cursor bukan credential;
  predicate akses diterapkan lagi pada setiap halaman dan hydration ID.
- Mode active mempertahankan perilaku form yang memerlukan pelanggan aktif;
  mode all hanya untuk form yang sebelumnya juga menampilkan pelanggan nonaktif.
  Alias merge tidak ditawarkan sebagai pilihan baru. Pelanggan terpilih di luar
  halaman pertama diambil lewat satu query ID, tidak dengan memuat semua halaman.
- Picker digunakan pada **Monitoring (coaching/exception), Data Tools (merge),
  review pemetaan lokasi, serta form aktivitas lapangan/agenda/task/handoff**.
  Field Work tidak lagi memuat seluruh master saat awal; nama exception dikirim
  oleh JOIN yang sudah ada. Data terpilih dan jam layanan tetap dipulihkan saat
  membuka draft. Rute mutasi dan validasi bisnis tetap authoritative di server.
- Komponen hanya menampilkan 20 pilihan sekaligus, debounce 250 ms, abort hasil
  lama, navigasi keyboard, status loading/error/retry, pagination sebelumnya/
  berikutnya dan validasi pemilihan. Data tidak disimpan di localStorage.
- Metadata batas operasional, pemetaan pelanggan dan membership peta menggunakan
  cache 60 detik dengan revision + scope + dataset/cohort. Ringkasan dan hasil
  tetap sama; posisi sales tidak dimasukkan ke cache metadata ini. Pembacaan
  geometri operasional dihentikan saat layer dimatikan.
- Empat tes domain baru mencakup enam role, organisasi lain, prefix/wildcard,
  cursor/filter mismatch, hydration pelanggan nonaktif/asing, deduplikasi,
  urutan nama identik, pemisahan cache scope dan invalidasi bukti koordinat.
  Suite aplikasi: 390 tes, 382 lulus, 8 dilewati, 0 gagal. Build/typecheck lulus.
  Pemeriksaan UI tetap dilakukan pengguna sesuai instruksinya.
- Kontrak API dan inventory runtime bertambah menjadi 326 operasi, seluruhnya
  memiliki tautan kontrak. Lihat `customer-options.openapi.json`.

Pengukuran provider sebelum migration untuk query selector baru (prefix
`warung`, 20 opsi + 1 sentinel): 75.288 rows read, 0 rows written, satu sampel
SQL 1.208,97 ms. Ini **bukan** baseline endpoint customer lama, biaya auth atau
latency aplikasi. Receipt privat:
`.nyales-agent/staging/customer-options-provider-before-20261104.json`.
Hasil setelah migration akan dilaporkan terpisah; tidak ada asumsi bahwa indeks
pasti dipilih planner sebelum diperiksa.

Batas sebelumnya tetap berlaku: belum ada viewport/server cluster peta, sebagian
consumer Planning/Pipeline masih memakai directory penuh, tidak ada klaim
kapasitas concurrency/p95 atau materialisasi segmentasi terjadwal. Keyset lookup
adalah daftar live untuk memilih pelanggan, bukan snapshot export; perubahan nama
oleh pengguna lain dapat mengubah urutan antarhalaman. Mutasi tetap memvalidasi
ID/scope/version saat disimpan.


Integrasi source terbaru mempertahankan `chunkMapIds` (batas parameter JSON D1
512 KiB) di dalam producer cache pemetaan serta fallback layer referensi opsional.
Tes cohort besar dan fallback tetap dipertahankan. Angka 390 tes di atas adalah
pemeriksaan sebelum integrasi commit 68105c0. Pemeriksaan gabungan menambah
suite audit dari pekerjaan lain; satu test workflow diperbaiki agar normalisasi
CRLF Windows tidak mengubah pemeriksaan isolasi audit. Status CI gabungan
menjadi bukti akhir release, tanpa menimpa workflow/data pekerjaan lain.
