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


### Bukti query selector setelah indeks dan koreksi predicate

Posisi `COLLATE NOCASE` pada kolom (sebelum LIKE), bukan pada ekspresi ESCAPE,
memungkinkan planner memakai rentang `name > / name <` dan `external_code > /
external_code <`. Regression test memeriksa EXPLAIN kedua rentang sekaligus.
Query provider yang diambil langsung dari implementasi baru, prefix `warung`,
Management, limit 20 + sentinel, menghasilkan 21 baris yang **identik dan dalam
urutan yang sama** sebelum/sesudah. Rows read: **75.288 → 67**, rows written 0,
satu sampel SQL **1.208,97 ms → 1,72 ms**. Pengurangan sekitar **99,91% untuk
query selector ini**; bukan endpoint directory lama, request lengkap, latency
p95, penghematan harian, atau kapasitas concurrent pengguna. Query sebelum
belum memakai indeks baru/koreksi predicate; query setelah memakai keduanya.
Receipt tanpa isi pelanggan tersedia di direktori privat operator:
`customer-options-comparison-20261104.json`. Raw hasil tetap tidak dikomit.

### Insiden 503 setelah impor tambahan titik

Setelah direktori menjadi 58.331 pelanggan, log staging menunjukkan penolakan
`D1 DB is overloaded. Too many resources consumed within a 10 second window`.
Satu GET peta mencatat 87.337.175 rows read sebelum gagal. Ini batas beban
database, bukan bukti kuota harian habis. EXPLAIN pada snapshot menemukan
`SCAN facts LEFT-JOIN` dan `SCAN owner LEFT-JOIN`: dua agregat materialized
dipindai ulang untuk setiap pelanggan.

Agregat invoice dan pemilik lapangan kini dibaca sekali, lalu dicocokkan lewat
Map berindeks ID pada Worker. Filter invoice historis, canonical merge, urutan
pemilik, cutoff dan hasil directory tetap sama. Rekonsiliasi lokal pada seluruh
58.331 pelanggan memastikan actual, last invoice, dan owner identik. Query
keluarga pelanggan untuk pembuatan segmentation snapshot semula dicoba memakai
UNION. Pemeriksaan staging masih menemukan CPU timeout pada agregasi tersebut.
Perbaikan lanjut mengagregasi invoice sekali per canonical ID lalu mencocokkan
cohort pelanggan melalui Map. Seluruh 1.020 anggota cohort pada snapshot lokal
memiliki input segmentasi identik; satu sampel lokal turun dari 59.199 ms menjadi
86 ms. Angka tersebut bukan latency provider atau kapasitas multiuser.

Pemeriksaan API setelah deployment diperlukan untuk membuktikan pemulihan;
hasil rekonsiliasi lokal bukan bukti latency staging atau kapasitas multiuser.

### Console Overview / peta sesudah pemulihan D1

Pemeriksaan lanjutan menemukan GET `/api/dashboard` dan monitoring summary 200,
tetapi peta Overview `/api/map` masih gagal dengan `RangeError: Invalid string
length` saat serialisasi JSON. Peta tersebut mengirim dua daftar customer penuh.
Endpoint display kini memakai projection pin; Overview memakai `compact=1` dan
`all_customers: []`. Default API tetap mempertahankan daftar all_customers dalam
projection pin untuk kompatibilitas, termasuk pelanggan tanpa koordinat. ID pin,
koordinat, owner/status, tautan directory dan overlay/metrik operasi dipertahankan.
Detail formulir dan evidence tetap tersedia dari endpoint customer/detail.
Geo-map internal yang memerlukan cohort untuk summary tidak diubah oleh projection
display ini. Viewport pagination dan pengurangan payload geo-map masih pekerjaan
lanjut, bukan klaim sudah selesai.

409 pada ringkasan regional disebabkan belum adanya dataset boundary operasional
aktif. Query `optional=1` khusus ringkasan boleh mengembalikan `data:null` dengan
`meta.availability=no_active_dataset`. Query eksplisit, draft/retired, sources dan
export tetap fail-closed. Batas nasional PMTiles tidak otomatis dianggap rilis
boundary terverifikasi. Kontrak regional diperbarui mengikuti response tersebut.

Style OpenFreeMap mempunyai filter road shield yang membandingkan `ref_length`
dengan angka meskipun sebagian feature tidak mempunyai nilai numerik. Transform
style sebelum tile worker dimuat menambahkan numeric fallback di atas ambang,
sehingga feature tanpa panjang valid tetap tidak diberi shield. Filter jaringan,
geometri dan layer lain tidak berubah; tidak ada penekanan console error global.

### Revamp navigasi daftar dan target

Pagination pelanggan, distribusi, source drill dan customer picker memakai satu
komponen responsif. Agenda, kunjungan, task, handoff dan exception hanya meminta
tab aktif dengan `limit=25`, offset dan sentinel untuk halaman selanjutnya.
Scope/filter diterapkan sebelum SQL LIMIT; legacy GET tetap kompatibel. Sesi
kerja aktif diambil terpisah agar status mulai/akhiri kerja tidak bergantung pada
halaman histori. Kontrak M2 mendokumentasikan live-offset dan batas 100 baris.
Tes rekonsiliasi memastikan halaman tidak duplikat, data di luar 200 aktivitas
pertama dapat dijangkau, scope dan filter tetap berlaku. Tidak ada COUNT seluruh
daftar atau pengukuran load multiuser/provider baru dalam slice ini.

Target dipisah menjadi Kelola target dan Pencapaian, dengan alur bulanan, basis
pelanggan/sales, pembagian manual atau histori, serta status pengajuan/pengesahan
yang jelas. Pencarian customer target tidak lagi mengambil seluruh master.
Pagination target dan status/tier membatasi baris DOM, tetapi endpoint target
dan segmentasi masih mengambil response lengkap; bukan pagination server.

Spacing card sekarang berlaku pada `.page-scene`. Invoice memakai aksi Detail
tanpa nomor dan menghapus paragraf teknis yang diminta. Banner Bekasi global
dihapus. Penanda DEMO dibersihkan pada label presentasi; source IDs, histori,
klasifikasi sintetis, payload API dan nilai bisnis tetap asli. Pengujian visual
diserahkan kepada pengguna sesuai instruksinya; perubahan tidak menyatakan data
sintetis menjadi transaksi nyata.

### Penyederhanaan copy dan pagination 50/100

Panduan empat box pada halaman target dihapus sesuai review pengguna; alur tetap
tersedia melalui aksi dan popup. Tab target memakai class settings-tabs agar
teks berada di atas indikator bergerak. Kotak sinkronisasi tidak dirender jika
antrean kosong/sudah synced; pending tetap menampilkan jumlah serta aksi, dan
review/rejected tetap terlihat. Kotak teknis/informasional yang tidak perlu pada
invoice, forecast dan sejumlah pengaturan dihapus. Error, konflik, konfirmasi
mutasi dan kondisi yang membutuhkan keputusan tetap dipertahankan.

Daftar pelanggan, distribusi, source drill, aktivitas, target, status/tier memakai
default 50 dengan pilihan 50/100. CustomerPicker tetap bounded 20 untuk pencarian.
Pipeline/order/forecast mendapat pagination SQL opt-in dengan sentinel; invoice
memakai LIMIT/OFFSET dan total existing, tanpa COUNT tambahan. Totals invoice,
CSV dan financial scope tetap mencakup semua filter, bukan halaman. Forecast
review kini membaca seluruh kontribusi pada periode terkait, terpisah dari
halaman tabel. Preview next-actions tetap legacy bounded 200. Riwayat import
invoice masih bounded legacy 100, bukan paging SQL baru. Target/status-tier
masih membatasi rendering client; batasan endpoint itu tidak diubah di sini.

Pengujian domain memeriksa traversal invoice 237 dan commercial 251 record,
halaman 50/100, scope, filter, validasi query, totals/CSV serta full forecast.
Tidak ada benchmark rows_read provider atau uji kapasitas multiuser; tidak ada
query staging untuk pengujian aplikasi sesuai permintaan pengguna.

Ikon aksi memakai komponen ActionIcon (Lucide, 16px, stroke 1.8) pada 40
komponen, dengan label teks yang tetap menjadi accessible name dan SVG dekoratif
aria-hidden. CSS dimuat pada entrypoint agar komponen dapat dirender di server
untuk tes. Penerapan mengikuti skill apple-hig-review: icons/Best practices,
buttons/Content, sf-symbols/Rendering modes dan app-icons/Design, diterjemahkan
ke web melalui cross-platform. Logo/app icon NYALES tetap menggunakan aset merek
yang sudah ada; perubahan ini fokus pada simbol aksi.
