# Rencana Penghematan Pembacaan D1 NYALES

| Atribut | Nilai |
|---|---|
| Versi dan tanggal | 1.0, 2 November 2026 |
| Status | Proposed, siap dipecah menjadi pekerjaan implementasi |
| Sponsor | Product Owner NYALES |
| Penanggung jawab teknis | Engineering Lead, perlu ditunjuk |
| Cakupan | Web sales lapangan, telesales, monitoring, GIS, laporan, import, dan operasi |
| Baseline sumber | Commit `444937165ee375d16b08ea781207a087094f3c90` |
| Backlog pendamping | [READ Efficiency Backlog](READ_EFFICIENCY_BACKLOG_20261102.json) |

Implementasi awal lokal dicatat terpisah pada [laporan progres](READ_EFFICIENCY_PROGRESS_20261102.md). Target dan estimasi di dokumen ini tetap merupakan rencana; belum merupakan hasil penggunaan D1 staging.

## 1. Ringkasan keputusan

NYALES perlu mengurangi pekerjaan database per interaksi sebelum menambah kapasitas. Urutan yang direkomendasikan adalah mengukur biaya, memperbaiki query dan bentuk API, mengurangi pengambilan ulang dari browser, memperkuat cache, lalu membangun ringkasan data hanya bila masih diperlukan.

D1 tetap menjadi sumber data utama. Workers menjalankan API dan otorisasi. R2 menyimpan file, ekspor, dan snapshot besar yang memang lebih sesuai sebagai objek. Cache merupakan percepatan, bukan sumber kebenaran. Tidak diperlukan penggantian stack atau pembelian layanan untuk memulai fase pertama.

Keputusan utama:

1. Detail customer dan pemilih customer harus mengambil data berdasarkan ID atau halaman yang diperlukan; tidak membangun seluruh master sebagai efek samping.
2. Semua daftar operasional, termasuk hasil GIS dan pencarian dalam form, harus mempunyai batas hasil serta filter scope di server.
3. Identitas, sesi, dan kewenangan permintaan diperiksa sebelum membaca cache. Cache tidak boleh menjadi jalan pintas ketika otorisasi gagal.
4. Angka invoice, retur, target, insentif, atribusi historis, dan aturan customer tidak berubah sebagai akibat optimasi.
5. Penghematan dibuktikan dengan workload yang sama sebelum dan sesudah perubahan. Persentase pada proposal tidak dianggap hasil aktual.
6. Sasaran awal pilot adalah paling banyak 2 juta rows read per hari, dengan batas operasional lunak 3,5 juta pada asumsi kuota Free 5 juta. Ini target internal yang harus divalidasi setelah baseline.

Rencana ini hanya mencakup perencanaan. Tidak ada perubahan aplikasi, migrasi, load test remote, deployment, atau upgrade berbayar yang dijalankan dalam penyusunannya.

## 2. Dasar praktik industri

| Praktik | Penerapan NYALES | Bukti penerimaan |
|---|---|---|
| FinOps Usage Optimization | Mengukur konsumsi per aktivitas bisnis dan prioritas berdasarkan dampaknya | Read per perjalanan pengguna, total harian, dan biaya tambahan write/storage |
| Google SRE | Menetapkan indikator, sasaran layanan, anggaran kesalahan, dan tindakan ketika kapasitas menipis | Dashboard operasional, alert, rollout bertahap, dan rollback |
| OWASP Authorization | Least privilege, validasi setiap request, dan deny by default | Pengujian organisasi, area, rep, kanal, pencabutan akses, dan cache |
| Optimasi SQL berbasis bukti | Memilih indeks dan bentuk query dari pola akses nyata | EXPLAIN QUERY PLAN, metadata provider, dan rekonsiliasi hasil |
| Perubahan terkontrol | Desain terdokumentasi, kompatibilitas API, migration terpisah, dan feature flag | Review teknis, bukti uji, canary, dan runbook pemulihan |

Ini penerapan praktik engineering yang lazim, bukan klaim sertifikasi atau SLA produksi. Target numerik berikut merupakan rancangan untuk NYALES, bukan standar universal yang menjamin hasil tertentu.

Referensi: [FinOps](https://www.finops.org/framework/capabilities/usage-optimization/), [Google SRE](https://sre.google/workbook/implementing-slos/), dan [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## 3. Definisi biaya dan batas kapasitas

Metrik utama adalah **rows read**, yakni baris yang diperiksa mesin database. Nilainya dapat lebih besar daripada jumlah hasil. `LIMIT 100` tidak menjamin 100 read karena filter, join, sort, COUNT, CTE, dan subquery dapat memeriksa lebih banyak baris.

Mengurangi kolom biasanya menghemat payload dan CPU, tetapi tidak otomatis menurunkan rows read. Batch dan `Promise.all` mengurangi round-trip atau waktu tunggu, bukan otomatis mengurangi scan. Indeks dapat menekan read dengan tambahan write dan storage. Ukur seluruh pertukaran tersebut. [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Dokumentasi resmi saat penyusunan mencantumkan Free 5 juta rows read dan 100 ribu rows written per hari. Reset harian 00.00 UTC atau 07.00 WIB. Paid memakai jatah bulanan serta biaya kelebihan pemakaian. Plan dan penggunaan akun aktual harus diperiksa pada fase baseline; dokumen ini tidak membaca billing live. Alokasi internal harus memperhitungkan database lain dalam akun yang sama. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

| Dimensi | Contoh masalah | Penanganan utama |
|---|---|---|
| Read D1 | COUNT dan proyeksi customer penuh berulang | Query, indeks, pagination, cache |
| Write D1 | Rebuild snapshot dan indeks terlalu sering | Pembaruan incremental dan batch terukur |
| CPU Worker | Pencocokan array kuadratik pada ribuan titik | Algoritme, struktur data, pembatasan pekerjaan |
| Payload | Data lengkap dikirim untuk kebutuhan pin sederhana | Projection dan lazy detail |
| Request | Data referensi dimuat ulang setiap klik atau ketikan | Deduplikasi, lazy loading, debounce |

Optimasi join peta menjadi Map pada release sebelumnya terutama mengurangi CPU Worker. Perubahan itu tidak boleh diklaim sebagai penghematan read tanpa bukti metadata D1.

## 4. Diagnosis kode dan koreksi rencana lama

Temuan berikut dikonfirmasi dari sumber, bukan peringkat query termahal berdasarkan analytics produksi.

| Area | Kondisi saat ini | Pekerjaan yang diperlukan | Bukti |
|---|---|---|---|
| Daftar customer | Pagination SQL sudah tersedia | Optimalkan count, enrichment, dan jalur yang belum paged | `src/server/customer-page.ts`, `index.ts:217` |
| GIS drilldown | Parameter geo melewati jalur paged dan memakai model penuh | Pagination server untuk seluruh mode | `src/server/index.ts:222–236` |
| Detail customer | Resolve alias lalu memanggil `readCustomers(...).find(...)` | Query detail berdasarkan canonical ID dan scope | `src/server/index.ts:257` |
| Enrichment halaman | COUNT setiap request; segmentation dipanggil; fakta invoice dibentuk dalam CTE | Ukur query plan, batasi fakta pada ID halaman, pisahkan count | `customer-page.ts:35,65,83` |
| Form dan opsi Monitoring | Mengambil `/api/customers` lengkap sebagai opsi | Endpoint lookup terbatas dan lazy consumer | `src/client/Monitoring.tsx:16`, Assignments, Planning |
| UI daftar customer | Paging/filter juga mengambil contacts dan areas lagi | Pisahkan lifecycle data referensi dan detail | `src/client/Customers.tsx:56` |
| Cache | TTL customer 60 detik dan dashboard 300 detik sudah tersedia | Buktikan hit rate, invalidasi, dan biaya auth pada HIT | `src/server/cache.ts` |
| Cache key | Scope memuat org, role, tanggal, kanal, area dan rep; `repIds` org-wide tetap berisi actor | Audit sharing cache serta data personal | `cache.ts:16`, `scope.ts:16` |
| Peta | Model penuh, dua koleksi customer, dan posisi sales ada pada respons yang sama | Pisahkan pin, detail, posisi, dan snapshot wilayah | `src/server/index.ts:295` |
| Telemetri | `all/run/batch` menangkap meta; `first` memakai `all`; raw/exec tidak selalu mencatat meta | Lengkapi coverage dan pisahkan unknown dari zero | `src/server/telemetry.ts:5–20` |
| Biaya observer | Upsert `ops_hourly` per request memakai binding mentah di luar counter request | Ukur overhead observer, jangan menyampling audit bisnis | `telemetry.ts:29–49` |
| Auth dan scope | Resolusi server terjadi sebelum endpoint | Cache HIT aplikasi tetap mempunyai biaya akses | `src/server/index.ts:58–113` |
| Indeks | File 0047 dan 0048 tersedia | Inventaris indeks serta migration yang benar-benar applied | `migrations/0047*`, `0048_read_path_indexes.sql` |

Jumlah terakhir dalam dokumen status adalah 12.100 customer direktori, ditambah customer pilot. Ini bukan hitungan live baru. Finance pilot masih sintetis dan kecil; pengujian pertumbuhan membutuhkan fixture yang lebih representatif. Catatan status yang masih menyebut 47 migration perlu direkonsiliasi dengan keberadaan file 0048.

[Rencana 31 Oktober](PERFORMANCE_QUOTA_PLAN_20261031.md) dipertahankan sebagai histori. Dokumen ini menggantikan asumsi teknis dan urutan kerjanya:

- Pagination bukan lagi fitur baru; gap-nya ada pada count, detail, lookup, GIS, dan consumer legacy.
- Angka pemakaian historis pada dokumen lama belum diverifikasi ulang dan bukan baseline terkini.
- Seratus hasil tidak sama dengan seratus baris terbaca.
- Rebuild 12.100 snapshot bukan pasti 12.100 write; indeks, audit, revision, dan pipeline ikut dihitung.
- Stale-on-error tidak menjamin aplikasi tetap dapat digunakan saat D1 gagal karena auth/scope juga dapat bergantung pada D1.
- Dashboard sudah mempunyai TTL 300 detik; menaikkan TTL global bukan langkah awal.
- Upgrade berbayar bukan prasyarat program dan tidak dilakukan otomatis.

## 5. Sasaran layanan dan anggaran

### 5.1 Indikator dan target awal

| Indikator | Target usulan | Pengukuran |
|---|---|---|
| Total read pilot terencana | ≤2 juta per hari | Provider analytics dan ledger operasi |
| Batas operasi lunak | ≤70% kuota akun yang tersedia untuk NYALES | Aktual dan proyeksi akhir hari |
| Ketepatan uang | Tidak ada selisih pada skenario penerimaan | Rekonsiliasi integer rupiah/minor unit |
| Isolasi akses | Tidak ada data lintas scope | Negative tests dan uji revoke/transfer |
| Latensi respons hangat | p95 ≤500 ms server wall time | Dipisah dari network dan CPU |
| List/detail tanpa cache | p95 ≤1.500 ms pada fixture representatif | Workload tetap dan versi query tercatat |
| Keberhasilan request inti | Target 99,5% selama 30 hari | Request valid berhasil / seluruh request valid |
| Hit rate kandidat | ≥80% untuk referensi dengan scope/filter berulang | HIT dan MISS; OFF dipisah, per kelas/per colo |
| Coverage metadata | ≥95% eksekusi SQL eligible mempunyai meta atau gap teridentifikasi | Counter sampel dan jalur yang belum terukur |
| Overhead observabilitas | ≤5% budget write normal | Write observer serta efek indeks ikut dihitung |

Target endpoint sementara setelah refactor: list normal 100 item p95 ≤2.000 data-rows read, lookup 20 item ≤500, detail ≤200. Anggaran ini harus dikalibrasi pada READ-001. Auth/scope, observer, dan count dicatat terpisah tetapi tetap masuk total biaya request. Filter kompleks atau substring tidak boleh dibuang dari laporan agar angka terlihat bagus.

Satu smoke tidak membuktikan SLO 30 hari. Anggaran kesalahan reliabilitas dan cadangan kuota adalah dua hal berbeda.

### 5.2 Alokasi harian awal pada asumsi Free

| Kategori | Rows read |
|---|---:|
| Interaksi pengguna beserta auth/scope | 1.400.000 |
| Job bisnis dan rekonsiliasi incremental | 300.000 |
| Import dan maintenance terjadwal | 150.000 |
| Deployment, smoke, dan diagnosis | 150.000 |
| **Target operasi pilot** | **2.000.000** |
| Ruang pertumbuhan terencana | 1.500.000 |
| Cadangan insiden dan keterlambatan analytics | 1.500.000 |
| **Total asumsi kuota** | **5.000.000** |

Jika ada aplikasi lain pada akun yang sama, kurangi alokasinya terlebih dahulu. Write normal ditargetkan ≤60.000/hari, batas lunak 80.000 termasuk indeks, dengan sisa 20.000 untuk insiden. Ini budget internal, bukan jatah tambahan dari provider.

Model estimasi:

`Read harian = Σ(volume journey × request per journey × [biaya auth/scope + hit rate × biaya HIT + miss rate × biaya MISS]) + job + maintenance + observer`

Contoh ilustrasi, bukan baseline: 600 pembukaan halaman × satu query mahal 30.000 read = 18 juta read. Jika query menjadi 2.000 read, hit rate 80%, dan biaya auth/HIT 200 read/request, komponen itu menjadi `600 × (200 + 20% × 2.000) = 360.000 read`. Tambahkan request lain dan job. Jangan menjumlahkan persentase penghematan cache, indeks, dan pagination secara langsung karena pekerjaannya dapat tumpang tindih.

## 6. Baseline dan protokol pengukuran

### 6.1 Register query

Catat query ID stabil, route template, versi query/schema, kelas scope, bentuk filter tanpa nilai pribadi, jumlah hasil, rows read/written, wall time, plan fingerprint, cache result, dan kualitas metadata. Hindari raw binding, nama customer, telepon, koordinat, token, atau body dalam label metrik.

Gunakan tiga sumber bukti:

1. Metadata D1 per eksekusi untuk pengukuran langsung.
2. Provider analytics/insights untuk total akun, database, dan query teratas.
3. Local restore/fixture untuk EXPLAIN QUERY PLAN, rekonsiliasi, serta uji volume besar.

SQLite VM steps hanya proxy kerja, bukan billing rows D1. Telemetri dengan nol sampel ditulis sebagai unknown, bukan nol read. Biaya upsert metrik di luar wrapper harus masuk ledger observer.

Wrapper `first()` yang memakai `all()` ditinjau per callsite. Tambahkan `LIMIT 1` hanya jika semantik query memang satu hasil; jangan melakukan rewrite SQL generik yang merusak agregasi atau pemeriksaan identitas ambigu.

Provider analytics diambil paling sering setiap 15 menit pada awal program, dengan backoff dan jitter saat rate limited. Snapshot analytics dapat terlambat. [Cloudflare D1 metrics dan insights](https://developers.cloudflare.com/d1/observability/metrics-analytics/).

### 6.2 Dataset dan perjalanan pengguna

| Dataset | Ukuran fixture | Tujuan |
|---|---|---|
| A | Sekitar 12 ribu customer, 10 sales, finance pilot | Baseline kondisi sekarang |
| B | 50 ribu customer, 50 sales, 100 ribu invoice dan retur | Pertumbuhan query dan ringkasan |
| C | 100 ribu customer, 250 sales, 1 juta invoice | Stress lokal; tidak dijalankan di remote Free |

Ukuran B/C adalah rancangan fixture sintetis, bukan proyeksi bisnis yang disepakati. Distribusi harus mencakup unassigned, Unknown, churn, alias, transfer bertanggal, dua kanal, dan customer besar/kecil.

Journey wajib: login dan Overview; daftar 100 customer, search, halaman berikut, detail dan timeline; customer lookup pada coaching; peta, filter, detail dan posisi; target per kanal; telesales assigned; import terbatas dan rekonsiliasi; export terikat scope. Jalankan dengan Management, NSM, Area Manager, Supervisor, Sales Rep, dan Telesales sesuai izin.

Pisahkan cold/warm, scope, filter, dan versi query. Lokal: 5 warm-up dan sedikitnya 30 sampel per kelas untuk indikasi p95. Remote: mulai 3 cold dan 10 warm pada lima query utama setelah preflight; jangan purge publik besar-besaran demi sampel cold.

### 6.3 Pengaman profiling remote

- Verifikasi identitas akun, database, URL, plan, dan usage yang cukup baru.
- Alokasi awal maksimal 100.000 read untuk satu sesi profiling; angka dikalibrasi setelah baseline.
- Gunakan nilai terbesar antara analytics dan ledger eksekusi ditambah cadangan, karena analytics dapat terlambat.
- Jika usage tidak tersedia, terlalu lama, atau melewati budget, hentikan pengujian remote dan lanjutkan lokal.
- Jangan melakukan retry mahal berulang ketika quota atau Worker resource error. Simpan hasil dan resume terkontrol.

## 7. Rencana perubahan API dan browser

### 7.1 Detail dan pemilih customer

**Detail berdasarkan ID, P0.** Resolve alias satu kali, terapkan scope pada SQL, lalu ambil fakta untuk canonical customer dan alias terkait saja. Pertahankan ETag, requested/canonical ID, status Unknown/provisional, atribusi invoice historis, dan respons 404. Tidak ada fallback diam-diam ke full model.

**Scoped lookup, P0.** Rancang endpoint customer options dengan pencarian, kanal, area, `limit=20`, dan cursor. Hasil berisi ID, nama, kode serta label penugasan secukupnya. Data baru dimuat ketika form dibuka atau pengguna mencari. Debounce 250–350 ms; dua karakter untuk pencarian nama luas, sedangkan exact code/ID dapat langsung. Customer terpilih di luar halaman dimuat by ID, tetap dicek scope.

Migrasikan Monitoring, Assignment, Planning, workload dan operational profile bertahap. Consumer daftar operasional memakai API paged, bukan memaksa endpoint lookup mengembalikan seluruh populasi. Buat kontrak API additive dan inventaris caller sebelum menonaktifkan jalur lama; dokumentasi OpenAPI diubah bersama implementasinya.

### 7.2 Pagination dan total

Semua mode, termasuk geo/risk drilldown, memakai pagination server. Gunakan `limit+1` untuk `has_more`. Exact total dihitung hanya ketika diperlukan dan dapat dicache menurut filter, scope, serta revision; jangan menghitungnya lagi saat hanya pindah halaman.

Keyset `(normalized_name,id)` diprioritaskan untuk next/previous dengan cursor opaque yang terikat filter, scope, dan versi query. Offset tetap sementara untuk consumer lama atau random jump yang memang dibutuhkan. Deep offset dibatasi. Jelaskan perilaku ketika data berubah di antara halaman; jangan menjanjikan snapshot stabil tanpa implementasinya.

Ketika total belum dihitung, UI menampilkan jumlah yang sudah dimuat, bukan angka perkiraan sebagai total pasti.

### 7.3 Request lifecycle

Pisahkan areas/users/branches dari daftar customer. Contacts dimuat saat detail PIC dibuka dan difilter di server. Tambahkan deduplikasi request identik, abort request obsolete, serta perlindungan agar respons lama tidak menimpa filter baru.

Cache browser awal cukup di memory, terikat sesi dan scope; bersihkan saat logout atau perubahan identitas. Data pelanggan tidak disimpan ke localStorage sebagai kebijakan cache default. Abort browser tidak menjamin query yang sudah berjalan di server berhenti; biayanya tetap dihitung.

Ekspor besar dipisahkan dari GET daftar interaktif. Scope diperiksa saat membuat dan mengunduh; file hasil disimpan privat di R2 dengan manifest serta expiry. Penjadwalan tambahan dipilih setelah kapasitas dan biaya dievaluasi.

## 8. Rencana optimasi SQL dan indeks

Prioritaskan total read dikalikan frekuensi, bukan query yang terlihat paling rumit. Setiap perubahan memiliki plan sebelum/sesudah, rekonsiliasi hasil, serta dampak write/storage.

1. **Page-first enrichment:** ambil ID halaman sesudah scope/filter, lalu agregasikan invoice hanya untuk canonical ID dan alias yang relevan. Bentuk CTE saja belum membuktikan full scan karena optimizer mungkin melakukan pushdown; ukur plan dan meta.
2. **COUNT terpisah:** exact count dengan substring sering tetap mahal. Cache count atau gunakan summary khusus; batasi cardinality kombinasi filter.
3. **Indeks kandidat:** verifikasi 0048 dan indeks terpasang sebelum menambah. Evaluasi org/record-status/name/id, varian org/name/id tanpa filter status, alias org/source, status run/customer, assignment org/outlet/channel/effective, serta invoice org/outlet/current/date. Urutan kolom mengikuti equality, range, join dan sort yang nyata.
4. **Search:** exact/prefix dan normalized code dibandingkan dengan `lower(name) LIKE '%term%'`. Leading wildcard tidak otomatis terbantu B-tree. Jika substring wajib, evaluasi FTS5/trigram dengan dukungan D1, sinkronisasi, dan biaya write yang terverifikasi; jangan mengubah hasil pencarian tanpa kontrak UX.
5. **Tanggal:** gunakan rentang yang dapat memakai indeks jika semantik setara; timezone, rolling 90 hari, dan end-exclusive tetap dipertahankan.
6. **N+1:** gunakan indexed join dan batch ID terbatas, bukan query per customer. Hormati limit parameter D1; `json_each` tetap memerlukan rencana eksekusi yang efisien.
7. **Planner maintenance:** evaluasi ANALYZE/PRAGMA optimize bila didukung dan diperlukan setelah perubahan distribusi data, bukan setiap request. Hindari covering index besar tanpa penghematan nyata.

[Cloudflare index dan query-plan guidance](https://developers.cloudflare.com/d1/best-practices/use-indexes/) menjadi acuan provider. Indeks baru diterima bila pengurangan read lebih bernilai daripada tambahan write/storage pada workload yang sama.

## 9. Rencana cache dan konsistensi

### 9.1 Lapisan dan kunci

| Lapisan | Kegunaan | Batas |
|---|---|---|
| Memo per request | Resolver atau referensi yang sama tidak dibaca berulang | Hanya umur request |
| Memory browser | Pilihan dan data display selama sesi | Dibersihkan saat logout/scope berubah |
| Cache API | Respons atau fragmen yang aman untuk scope tertentu | Oportunistik, per data center |
| Read model D1 | Ringkasan terverifikasi | Sumber transaksi tetap otoritatif |
| Snapshot R2 | Hasil besar atau laporan immutable | Privat, versioned, akses diperiksa |

Cache API tidak mereplikasi isi antardata-center; delete lokal tidak sama dengan invalidasi global. [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

Kunci rancangan: `environment + tenant + resource + query/schema version + scope fingerprint + business date + canonical filters + period + data epoch + snapshot ID`.

Share antar-Management hanya untuk payload org-wide yang benar-benar tidak personal. Hilangkan actor dari key hanya setelah audit isi respons dan negative tests. Queue, notifikasi, serta data personal tetap actor-specific. Normalisasi filter, batasi ukuran key dan jumlah kombinasi, serta hindari raw identifier pada log. Hash bukan pengganti otorisasi.

### 9.2 Invalidasi yang dapat dipertanggungjawabkan

Naikkan domain revision bersama source write dalam transaksi D1. Jika perlu invalidasi eksternal, simpan dirty key/outbox dalam transaksi yang sama dan proses secara idempotent. Jangan mengandalkan callback best-effort yang dapat hilang sesudah commit.

Mulai dengan revision per tenant/domain customer, finance, assignment dan segmentation. GPS tidak menginvalidasi seluruh dashboard. Pembacaan revision juga menggunakan read: resolve sekali per request dan gabungkan dengan query yang sudah diperlukan bila aman.

KV eventual-consistent tidak dijadikan authority pencabutan izin. Evaluasi KV hanya untuk referensi atau snapshot versioned bila manfaat lintas colo terbukti. [Cloudflare KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

Respons API customer tidak menjadi publik hanya karena objek internal Cache API memakai cache-control public. R2 mentah tidak dipublikasikan. Auth dan scope tetap diperiksa sebelum HIT.

### 9.3 Kontrak kesegaran usulan

| Data | Kesegaran awal | Stale fallback |
|---|---|---|
| Sesi, akses, revoke, izin kontak saat aksi | Validasi per request/commit | Tidak menjadi dasar izin |
| Customer display | 30–60 detik; actor melihat commit sendiri pada fetch berikut | Maksimal 5 menit bila izin kini valid dan diberi timestamp |
| Referensi area/produk | 5–15 menit dengan invalidasi saat edit | Maksimal 1 jam bila aman |
| Dashboard dan ringkasan target | 30–60 detik sebagai target pilot | Maksimal 5 menit, ditandai stale |
| Posisi sales terakhir | 15–30 detik ketika peta aktif | Maksimal 60 detik, timestamp/akurasi terlihat |
| Approval invoice dan finalisasi insentif | Verifikasi sumber/versi saat commit | Tidak boleh mengambil keputusan dari stale data |
| Laporan final | Snapshot immutable per cutoff dan versi sumber | Sesuai retention dan pemeriksaan akses |

TTL tersebut adalah titik awal pengujian. Dashboard saat ini 300 detik; tidak diperpanjang demi hit rate. Bila monitoring memerlukan lebih segar, turunkan biaya query agar TTL dapat dipendekkan. Metadata `as_of`, `source_version`, `is_stale`, dan `refresh_after` disediakan konsisten.

### 9.4 Stampede dan kegagalan

Singleflight per key pada satu isolate, refresh terbatas, dan jitter TTL 10–20% mengurangi request serentak. Memory isolate bukan koordinasi global. Jangan mengandalkan dukungan stale-while-revalidate tanpa verifikasi; jika perlu, simpan fresh/stale record eksplisit dengan expiry serta pemeriksaan revision.

Cache failure tidak boleh mengakibatkan seluruh pengguna menjalankan full scan bersamaan. Terapkan batas refresh; stale hanya sesuai tabel di atas. Bila izin tidak dapat diperiksa, tolak akses dengan error terstruktur. Buktikan HIT/MISS/OFF pada staging nyata; jangan mengasumsikan workers.dev selalu efektif atau selalu tidak mendukung.

## 10. Peta dan materialisasi terpilih

### 10.1 Pisahkan frekuensi perubahan

Pisahkan customer pins/clusters terfilter viewport, detail by ID, referensi peta versioned, dan last-position sales. Pan/zoom tidak memuat ulang invoice, segmentation, atau alamat lengkap seluruh customer. Polling posisi berhenti saat tab tersembunyi.

Respons harus menjelaskan `complete`, `has_more`, `truncated`, `snapshot_id`, serta total terfilter bila tersedia. Semua titik tetap dapat dijangkau melalui pencarian dan zoom; viewport-only tidak disamakan dengan total perusahaan. Tidak ada pemotongan diam-diam demi penghematan.

BBox mempunyai dua range dan tidak otomatis efisien dengan indeks lat/lng biasa. Evaluasi coarse spatial grid/geohash terlebih dahulu; R-tree, vector tile atau objek tile R2 hanya dipilih setelah dukungan, scope, dan biayanya dibuktikan. Ini tidak menambah routing atau mengaktifkan tracking Android.

### 10.2 Bangun read model hanya jika masih diperlukan

| Kandidat | Grain | Tujuan |
|---|---|---|
| customer_current_read_model | Tenant, canonical customer, snapshot version | Daftar/pin/status/owner display |
| sales_daily_summary | Tenant, business date, rep, channel, area atribusi | Tren dan pencapaian periodik |
| customer_sales_summary | Customer dan periode/rolling state yang benar-benar dibutuhkan | Segmentasi dan target customer |
| report_snapshot | Jenis laporan, scope, cutoff, source version | Reproducible export privat di R2 |

Schema belum final. Grain mempertahankan invoice ownership historis, alias, atribusi kanal primer, dan retur. Penjualan kanal observasi tidak dijumlahkan menjadi omzet unik. All-time, MTD, dan rolling 90 hari harus memiliki definisi terpisah; jangan menganggap field actual dari dua jalur API pasti ekuivalen.

Pipeline: mutation/import commit → dirty key → incremental recompute → validasi snapshot → publish pointer atomik. Source epoch/cutoff stabil, lease, checkpoint dan idempotency wajib. Snapshot parsial tidak dipublikasikan dan gap tidak diubah menjadi nol.

Segmentation yang dihitung secara lazy dalam GET perlu dipindahkan ke persiapan terukur hanya setelah job dan freshness UX tersedia. Full rebuild dipakai untuk initial/recovery/perubahan algoritme, bukan setiap baris, setiap batch kecil, atau setiap malam tanpa anggaran. Rekonsiliasi incremental mengikuti affected keys; audit sampel harian dan rekonsiliasi penuh periodik dijadwalkan terpisah.

## 11. Operasi dan pengendalian kuota

| Pemicu | Tindakan rancangan | Tanggung jawab PIC |
|---|---|---|
| Forecast akhir hari melampaui alokasi atau aktual ≥50% | Peringatan dan tampilkan top consumers | Review operasi terencana |
| ≥70% | Tunda warming, benchmark, dan bulk nonmendesak | Setujui budget operasi berikutnya |
| ≥85% | Pause import/rebuild/export besar | Diagnosis terbatas dan komunikasi degraded mode |
| ≥95% atau quota error | Hentikan retry mahal; circuit breaker bulk | Tunggu reset atau putuskan kapasitas resmi |
| Worker resource exceeded | Tangani sebagai insiden CPU terpisah | Profile algoritme dan payload |

Controller tersebut merupakan pekerjaan yang akan dibangun, bukan klaim sudah aktif. Alert dideduplikasi per window/threshold, ditambah satu recovery alert. Jangan menonaktifkan otorisasi/audit atau mengubah hasil finansial agar kuota muat.

Telemetri tetap low-cardinality. Evaluasi sampling atau buffer hanya untuk metrik operasional, dengan keterangan kehilangan sampel dan ekstrapolasi; audit bisnis tidak disampling. Jangan menjadikan buffer isolate sebagai ledger biaya final. Ukur read/write observer sendiri.

Import dilanjutkan dari receipt dan offset; validasi statis dan hash dilakukan lokal. Rekonsiliasi remote dibatasi batch/ID yang terdampak. Migration indeks mempunyai budget scan/write dan dijadwalkan sekali. Workflow resmi serta pemeriksaan migration tetap dijalankan; jangan melewatinya ketika kuota habis.

Backup sebelum perubahan berisiko tetap wajib dan diberi budget. Backup penuh tidak diulang tanpa alasan pada UI-only deploy. E2E massal memakai emulator; staging smoke hanya sampel terukur. Analitik provider dengan lag tidak dianggap kuota kosong.

## 12. Matriks ketepatan dan invalidasi

| Peristiwa | Domain terdampak | Bukti wajib |
|---|---|---|
| Invoice baru/revisi/void | Finance period, customer terkait, achievement | Current revision tepat sekali, atribusi asal tetap |
| Retur/revisi retur | Actual eligible dan ringkasan terkait | Pengurangan tepat sekali, cutoff dan rounding tetap |
| Target disahkan/revisi | Target dan achievement | Parent/leaf/reserve tidak dihitung ganda |
| Merge/alias customer | Detail, lookup, peta, fakta affected | Identitas sumber terjaga, omzet/target tidak ganda |
| Transfer/hirarki/assignment | Scope dan current projection | Akses lama hilang, histori tidak ditulis ulang |
| User/role dinonaktifkan | Sesi dan akses | Request berikut menolak akses lama |
| Boundary/mapping baru | GIS version | Draft tidak menjadi operasional |
| Segmentation/coverage | Status/tier | Rolling 90 hari tanggal invoice; Unknown bukan Churn |
| Posisi GPS | Last-position saja | Timestamp/akurasi; bukan invalidasi finansial |
| DNC/contact permission | Kontak/queue serta recheck aksi | Izin kontak tidak berasal dari cache lama |

Finalisasi insentif memerlukan source version dan aturan yang konsisten dengan preview. Perubahan sumber setelah preview memicu verifikasi ulang, bukan memfinalkan nilai cache.

## 13. Backlog implementasi

ID READ terpisah dari nomor WEB yang sudah ada. Seluruh item berikut berstatus Planned; pembuatan dokumen tidak menyelesaikan item implementasi.

| ID | Prioritas | Deliverable | Dependensi | Person-day |
|---|---|---|---|---:|
| READ-001 | P0 | Baseline, query register, inventory provider/index | — | 2–3 |
| READ-002 | P0 | Scoped customer detail by ID | 001 | 1–2 |
| READ-003 | P0 | Customer options dan migrasi consumer | 001,002 | 2–3 |
| READ-004 | P0 | Page-first facts, count, geo pagination | 001 | 2–3 |
| READ-005 | P0 | Index review dan migration terukur | 001,004 | 1–2 |
| READ-006 | P0 | Request dedupe, lazy reference, abort | 001,003 | 1–2 |
| READ-007 | P0 | Cache consistency ADR, revision, isolation | 001,002 | 2–3 |
| READ-008 | P1 | Cache measurement, singleflight, TTL policy | 005,007 | 1–2 |
| READ-009 | P1 | Pisahkan pin, detail dan posisi; viewport strategy | 002,005,007 | 3–5 |
| READ-010 | P1 | Metadata coverage dan observer overhead | 001 | 1–2 |
| READ-011 | P1 | Budget controller, alert dan runbook | 001,010 | 1–2 |
| READ-012 | P1 conditional | Read model grain ADR dan reconciliation | 004,005,008 | 1–2 |
| READ-013 | P1 conditional | Incremental read model dan atomic publish | 012 | 3–5 |
| READ-014 | P1 | Bounded import/export/maintenance | 005,011 | 1–2 |
| READ-015 | P0 gate | Final regression, load, security dan canary | Seluruh item wajib yang dirilis | 2–3 |
| READ-016 | P1 | Capacity review dan handover | 009,011,014,015 | 0,5–1 |

Estimasi total seluruh item adalah **24,5–42 person-day**, termasuk 4–7 hari pekerjaan conditional. Ini estimasi effort satu engineer, bukan jadwal kalender atau komitmen tanggal. QA dilakukan sepanjang fase; READ-015 merupakan effort final tambahan. Re-estimasi sesudah READ-001.

Gate delivery:

1. **Baseline:** inventory dan pengukuran cukup; top query mempunyai owner dan biaya.
2. **Quick wins:** READ-002–006, hasil bisnis setara dan read per journey turun terukur.
3. **Cache aman:** READ-007–008, revoke/isolation/read-your-write lulus sebelum memperpanjang TTL.
4. **GIS dan operasi:** READ-009–011/014, bounded workload serta proyeksi harian lulus.
5. **Materialisasi bersyarat:** READ-012–013 hanya jika residual cost atau pertumbuhan membenarkannya.
6. **Acceptance:** regression serta observasi pilot tujuh hari; pekerjaan conditional yang tidak dibangun diberi Deferred beserta alasan.

## 14. Pengujian dan definisi selesai

### 14.1 Matriks penerimaan

- Input, scope, cutoff, alias, serta versi sumber sama harus menghasilkan kolom bisnis dan nominal yang setara dengan aturan bisnis yang disahkan. Query lama menjadi pembanding, bukan kebenaran mutlak: bila ditemukan cacat perhitungan, catat dan selesaikan sebagai perbaikan terpisah beserta persetujuan bisnis, bukan mempertahankan bug demi parity atau menyamarkannya sebagai optimasi.
- Uji seluruh role dan dua tenant, termasuk guessed ID, perpindahan area, merge, dan revoke di antara request.
- Uji cold/warm, cache failure, stale expiry, read-your-write, dan request serentak. Singleflight lokal tidak diklaim global.
- Uji retur, void, revised invoice, target overlap, parent/leaf, rounding insentif, batas bulan/tahun, serta rolling 90 hari.
- Uji response lama, abort, cursor/filter mismatch, deep pagination, dan total/partial indicator yang benar.
- Uji quota error dan CPU error terpisah; tidak ada retry loop.
- Uji rebuild parsial, snapshot drift, replay idempotent, dan pointer publish.
- Uji data volume A/B/C lokal; buktikan query plan lokal dengan sampel meta D1 remote yang dibatasi.

Tes tidak sekadar mencocokkan nama indeks atau teks SQL. Tes harus membuktikan hasil yang benar dan pekerjaan yang terbatas. Latensi bukan satu-satunya assertion performa.

### 14.2 Evidence pack

Setiap item menyimpan revision kode, fixture manifest/hash, query register, EXPLAIN sebelum/sesudah, provider meta, coverage metadata, cold/warm workload, CPU/wall/payload, biaya write/storage, rekonsiliasi, negative cases, deployment run, dan catatan rollback. Artefak berisi data pribadi tetap privat; repository hanya menyimpan ringkasan aman.

Format minimum satu catatan baseline:

```json
{
  "query_id": "customer.list.page.v1",
  "route_template": "GET /api/customers",
  "code_revision": "revision-yang-diuji",
  "dataset_manifest_hash": "hash-fixture",
  "scope_class": "SUPERVISOR_FIELD",
  "filter_shape": ["area", "record_status"],
  "cache_result": "MISS",
  "sample_count": 0,
  "rows_read_p50": null,
  "rows_read_p95": null,
  "rows_written_total": null,
  "auth_scope_rows_read": null,
  "observer_cost_included": false,
  "metadata_complete": false,
  "measurement_status": "not_measured"
}
```

Nilai null berarti belum diukur. Hasil pengukuran wajib memiliki waktu, window provider, ukuran sampel dan lokasi eksekusi; contoh di atas tidak boleh dipakai sebagai bukti nol biaya.

Laporan hasil mempunyai kolom sebelum, sesudah, selisih absolut, dan persentase. Jika workload berbeda, tandai tidak dapat dibandingkan. Persentase global hanya dihitung dari distribusi workload yang disepakati.

Program selesai ketika tujuh hari pilot memenuhi alokasi read/write, tidak ada quota outage pada workload terencana, top query mempunyai owner/budget, pengujian akses/finansial lulus, freshness sesuai kontrak, rollback direhearsal, dan PIC menerima runbook. SLO 30 hari tetap memerlukan pengamatan 30 hari tersendiri.

## 15. Rollout dan rollback

1. Gunakan flag per resource; jalur baru mulai nonaktif. Tidak harus menambah provider feature flag.
2. Implementasi additive; kontrak lama dipertahankan saat consumer dimigrasikan. Migration indeks dipisahkan dari reader.
3. Shadow compare terutama di fixture/local restore. Live shadow maksimal 1% dengan budget eksplisit karena dua query dapat menggandakan read; jangan dijalankan saat kuota ketat.
4. Canary pada satu grup/area pilot, lalu perluas setelah SLI dan rekonsiliasi lulus. Jika pembagian traffic belum tersedia, rilis per resource lebih aman daripada mengklaim canary acak.
5. Rollback langsung untuk scope mismatch, selisih uang, stale tanpa label, budget terlampaui, atau p95 memburuk lebih dari 20% pada workload yang sama.
6. Rollback reader/flag tanpa downgrade migration destruktif. Putar query/cache version; pertahankan audit, outbox, dan snapshot yang dibutuhkan.
7. Reader lama mungkin lebih mahal: fallback diberi load limit, bukan membuka full scan massal.
8. Read model dapat dibangun ulang dari sumber/ledger. Cache tidak menggantikan backup atau bukti RPO/RTO.

## 16. Pemilik, risiko dan keputusan kapasitas

| Peran | Tanggung jawab |
|---|---|
| Product Owner/Management | Prioritas, toleransi freshness, acceptance pilot, dan keputusan biaya |
| Engineering Lead | Desain query/cache, kualitas teknis, rollout dan rollback |
| Backend/Data Engineer | SQL, indeks, read model, rekonsiliasi dan bukti |
| Frontend Engineer | Lookup, request lifecycle, pagination, dan freshness UX |
| QA | Regression, security, finance, dan performance gate |
| Cloud account owner/ops PIC | Usage, alokasi kuota, insiden dan persetujuan operasi mahal |

Nama pelaksana belum ditetapkan. Tim kecil boleh merangkap peran, tetapi gate review tetap dicatat. PIC pilot tidak otomatis menjadi pemilik akun cloud atau penanggung jawab insiden.

Selama pilot: review usage dan forecast harian, lalu weekly review top query, biaya per journey, hit rate per colo, freshness, write amplification dan backlog. Setiap bulan evaluasi pertumbuhan tiga/enam bulan.

Risiko utama adalah cache akses lama, write amplification, snapshot drift, perubahan semantik search/pagination, kebocoran scope pada peta, analytics lag, dan rollback ke full scan. Mitigasinya melekat pada gate masing-masing; risiko tidak ditutup hanya karena satu smoke berhasil.

Pertahankan Free selama workload dan sasaran layanan dapat dipenuhi dengan cadangan. Evaluasi kapasitas berbayar bila konsumsi normal terukur di atas 70% selama tiga hari kerja atau forecast peak menembus reserve setelah query utama diperbaiki. Bandingkan manfaat availability dengan biaya engineering; jangan membangun koordinasi kompleks semata-mata untuk menghindari biaya kecil. Tidak ada upgrade otomatis. Migrasi database/OLAP membutuhkan alasan kemampuan atau SLO, bukan sekadar 12 ribu customer.

**Langkah pertama yang direkomendasikan:** READ-001, kemudian READ-002 dan READ-003. Hindari full materialization, penambahan provider, atau kenaikan TTL global sebelum baseline tersedia.

## 17. Referensi

- [Cloudflare D1 pricing dan billing metrics](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 indexes dan EXPLAIN QUERY PLAN](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
- [D1 metrics dan query insights](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Workers KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Google SRE Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [FinOps Usage Optimization](https://www.finops.org/framework/capabilities/usage-optimization/)
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

Dokumentasi provider diperiksa pada 2 November 2026. Implementasi wajib mengecek versi tool, fitur, kuota, dan konfigurasi akun yang berlaku. Target internal NYALES tidak sama dengan limit resmi provider.
