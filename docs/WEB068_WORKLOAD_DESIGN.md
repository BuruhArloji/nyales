# WEB-068 — pemerataan beban dan simulasi territory

24 Oktober 2026. **Implementasi lokal tersedia:** kebijakan berversi, sumber sesuai scope, perbandingan beban, preview/save skenario, revisi immutable dan penerapan satu batch melalui WEB-065. Migrasi 0041 dan 14 operasi runtime; total 276 operasi. Ini bukan optimizer atau Plan Visit Generator WEB-069–074. Sumber nyata pilot utama tetap draft dan belum mempunyai kebijakan beban bawaan. [Evidence](WEB068_EVIDENCE.json), [API](specifications/workload-scenarios-api.m4.openapi.json), [ERD fisik](specifications/ERD_WEB068_Implementation.md).

## Kontrak satuan dan input

Definisi `nyales-workload-1`, schema parameter 1. Input periode 1–31 tanggal bisnis, rilis/versi boundary, tanggal mapping/source, epoch, fingerprint scope dan status kelengkapan cohort wajib. Data sumber backend harus berupa customer canonical aktif yang sudah diotorisasi, termasuk bucket belum terpetakan; alias dan kanal ganda tidak menggandakan unique customer.

Layanan lapangan dan telesales dihitung **terpisah**. Satu customer pada dua kanal adalah satu unique customer dan dua hubungan layanan. Satu orang boleh memiliki record kanal historis lain, tetapi maksimal satu record mempunyai kapasitas diketahui. Kanal historis tanpa role aktif tetap berkapasitas null agar kapasitas orang yang sama tidak dihitung ganda. Recipient harus ada pada kanal yang sama. Proposal tidak dapat menciptakan kanal layanan yang tidak ada di sumber; unassign memakai recipient null yang eksplisit.

Frekuensi engine adalah **jumlah kontak layanan yang direncanakan untuk periode ini**, integer 0–366, bukan hari antarvisit atau jumlah kunjungan yang telah terjadi. Adaptor kebijakan harus menjelaskan konversi cadence hari menjadi jumlah periode sebelum menyuplai engine. Jangan menghitung `ceil(31/30)` diam-diam dan menyebut dua visit sebagai kewajiban bulanan. Nilai null berarti belum ada frekuensi sah; nol berarti kebijakan eksplisit tidak merencanakan kontak pada periode ini.

Durasi adalah menit layanan per kontak, integer 1–1440, per kanal. Durasi yang belum diatur tetap null. Nilai nol frekuensi menghasilkan nol demand meski durasi belum tersedia; frekuensi positif/unknown dengan durasi kosong tetap data kurang. Belum ada default menit lapangan/telesales. Master `service_frequency_days` tidak otomatis menjadi cadence telepon; belum ada field source durasi yang dapat dianggap lengkap.

Kapasitas adalah menit yang **secara eksplisit tersedia untuk layanan**, setelah overhead/cuti/tugas lain sesuai policy organisasi. Jam shift kalender bukan kapasitas layanan otomatis. Null adalah belum tersedia; nol adalah memang tidak ada kapasitas. Kapasitas tidak boleh melampaui jumlah menit kalender periode. Perjalanan, routing, ETA dan durasi dari jarak lurus tidak dihitung. Karena travel tidak dihitung, label yang sah adalah *within observed service capacity*, bukan jadwal feasible.

Histori sales adalah invoice net yang sah per atribusi rep historis. Simulasi pemindahan customer tidak memindahkan angka invoice lama ke penerima baru. Angka yang diberikan tetap teramati; sumber tidak lengkap menahan total dikonfirmasi/weighting. `known_observed_historical_sales_minor` mempertahankan subtotal yang tersedia, `observed_historical_sales_minor` ringkasan penuh tetap null bila input/source belum lengkap. Retur net negatif tetap terlihat; angka ini bukan potensi pasar.

## Perbandingan dan unknown

Engine menghasilkan before/after per kanal, rep, wilayah dan bucket belum ditugaskan; transfer yang tidak mengubah owner ditandai no-op. Jumlah customer/layanan dan demand seluruh cohort tetap rekonsiliasi. Tidak ada input dimutasi, data bisnis ditulis atau rekomendasi otomatis dipilih.

`known_contacts_per_period` dan `known_service_minutes` adalah subtotal yang diketahui. `contacts_per_period`/`service_minutes` penuh menjadi null bila ada frekuensi/durasi yang belum diketahui. Kapasitas belum tersedia tidak diperlakukan nol. Persentase utilization hanya tersedia bila cohort penuh, demand lengkap, kapasitas diketahui dan >0. Kapasitas nol dengan demand positif adalah over-capacity; keduanya nol adalah no-service-demand, tanpa pembagian nol. Subtotal demand yang sudah lebih besar dari kapasitas tetap memberikan `known_demand_exceeds_capacity`, walaupun demand lengkap belum tersedia.

Cohort lengkap berarti mencakup **seluruh portfolio customer yang membebani rep yang dibandingkan**, bukan hanya kelurahan yang sedang diseleksi. Customer di luar kelurahan terpilih tetap menjadi beban dasar. Scope parsial yang tidak bisa membuktikan portfolio penuh menghasilkan `partial_cohort`, utilization/score null dan label yang jelas. Flag cohort tidak boleh dipercayakan ke browser; adaptor backend yang menentukan berdasarkan akses dan query terverifikasi.

Bobot customer, menit layanan dan histori sales harus eksplisit, nonnegative integer basis points, total 10.000. Tidak ada nilai default. Hasilnya weighted share atas denominator per kanal, **bukan** rasio kapasitas atau potensi pasar. Normalisasi memakai integer basis points dan floor; nilai pembulatan dapat tidak persis berjumlah 10.000. Jika indikator berbobot mempunyai denominator nol/unknown, source gap, atau baseline histori negatif, score null. Subtotal yang belum lengkap tidak dipakai untuk menyatakan pemerataan. Customer unassigned tetap masuk denominator beban, namun tidak memperoleh score rep; konsekuensinya ditampilkan.

Batas pure input: 2.000 customer canonical, 200 rep, 2.000 perubahan customer/kanal. Duplicate ID, kanal/owner asing, recipient beda kanal, periode tidak sah, kapasitas mustahil dan integer overflow ditolak, tanpa truncation. Ini pengaman engine lokal, bukan kapasitas Free Cloudflare yang sudah terukur.

## Kebijakan dan sumber operasional

Pengaturan → **Beban & kapasitas**, hanya Management/NSM. Tambah/edit draft melalui popup; review hash, alasan, versi aktif yang digantikan dan konfirmasi sebelum aktivasi. Angka bisnis dimulai kosong. Frekuensi/durasi boleh null; pilihan populasi layanan, sumber kapasitas dan bobot wajib eksplisit. Dua populasi per kanal: seluruh customer aktif atau customer ditugaskan/diusulkan. Telesales tidak otomatis menerima cadence lapangan. Pengaturan khusus customer/rep bersifat beralasan dan berversi; referensi yang sudah nonaktif meminta review.

Sumber kapasitas: belum diketahui, menit layanan tetap per rep per bulan, atau persentase kalender nominal cabang. Kalender harus berasal dari satu cabang yang jelas dan menghormati weekdays/holidays/timezone. Kalender hilang/ambigu/tidak sah tetap unknown. Perubahan clock musiman meminta kapasitas eksplisit. Kalender belum mempunyai feed cuti/absensi individu. Kapasitas bukan jam shift penuh otomatis dan tidak mengklaim layak rute.

Backend memakai seluruh customer canonical aktif dalam authorized scope, termasuk yang belum terpetakan atau di luar kelurahan dipilih. Pemilik baseline dibaca pada tanggal efektif yang tidak boleh di masa lalu; metadata geographic memakai confirmed mapping read-cutoff. Sales historis mengikuti atribusi invoice, bukan owner simulasi. Sumber invoice terikat periode terpisah dari bulan layanan penuh. Actor non-org-wide selalu partial cohort; tidak memperoleh klaim spare capacity seluruh portofolio. Role kanal tetap membatasi sumber dan angka finansial.

`prepareWorkload` membangun source sekali. `distributionSnapshot` memverifikasi geometry dan sumber penugasan bersama untuk maksimal sepuluh batch, lalu planner WEB-065 yang sama memeriksa tiap batch. Epoch diperiksa ulang setelah seluruh pembacaan; perubahan saat scan meminta retry. Limit: 2.000 customer, 200 record rep/kanal, 10 batch, 50 kelurahan dan 25 customer gabungan per penerapan, 16 chunk geometry, bukti 4 MiB dan 600 pernyataan transaksi. Tidak mengklaim batas ini telah memenuhi CPU/RPC Free Workers di provider.

## Penyimpanan, revisi dan penerapan

Empat tabel baru: `workload_policy_version`, `territory_scenario`, `territory_scenario_revision`, `territory_scenario_application`. D1 menyimpan metadata/relasi/versi; private R2 menyimpan payload `nyales-territory-scenario-v1` dengan input, konfigurasi dan hasil. Tidak menduplikasi geometry. Ukuran, checksum, tenant, schema dan referensi diverifikasi saat dibaca. Upload yang konflik dibersihkan hanya setelah D1 membuktikan tidak direferensikan; status commit yang tidak pasti mempertahankan objek.

Preview read-only tidak menyimpan draft, mengunggah R2 atau mengubah assignment. Save eksplisit memeriksa ulang preview hash, epoch, active policy dan If-Match root. Setiap customer berada dalam satu batch; kedua kanal customer harus ditinjau dalam batch yang sama bila area berubah. Request assignment memakai subset customer eksplisit, tidak memperluas cohort diam-diam. Membership kelurahan ke dua area berbeda dalam satu skenario ditolak.

Apply hanya untuk revisi terbaru yang current, satu batch yang ditinjau, If-Match root, hash/epoch dan konfirmasi beralasan. Seluruh statement WEB-065 beserta audit/idempotency/application berada dalam satu transaksi. Setelah satu batch sukses, revisi menjadi historis dan sisa batch wajib dipreview lalu disimpan sebagai revisi baru. Key batch yang telah diterapkan tidak boleh digunakan ulang. Source epoch, tanggal bisnis, policy atau root version berubah menolak apply. Revisi lama tetap bisa dibaca sebagai bukti, bukan akses atau kelayakan penerapan abadi.

## UI dan cara memeriksa

Buka **Distribusi sales → Beban & simulasi**. Bulan layanan penuh, bulan invoice acuan dan tanggal efektif dipilih terpisah. Ringkasan dan tabel memperlihatkan pelanggan, menit diketahui/penuh, unassigned, kapasitas, utilisasi dan porsi berbobot per kanal. Meter kapasitas menampilkan persentase terhitung; unknown tidak diberi meter palsu. Dasar kapasitas dan cutoff sumber tersedia untuk penjelasan.

Management/NSM menambah batch dalam popup: kelurahan, area tujuan, kanal, PIC eligible, subset customer eksplisit dan pengecualian beralasan. Preview menampilkan konflik, before/after dan customer terpengaruh. Simpan skenario belum menerapkan distribusi. Review penerapan kembali menampilkan wilayah/customer/PIC/tanggal sebelum konfirmasi. Riwayat membuka revisi immutable; URL mempertahankan view dan skenario untuk reload. Semua peran lain hanya membaca summary sesuai scope.

Kunjungan/telesales, izin kontak, DNC/campaign/lease, target, invoice dan insentif memakai alur existing. Simulasi tidak menghubungi customer atau membuat agenda otomatis. Angka invoice `net_minor` di aplikasi adalah rupiah penuh; display preview WEB-065 telah diperbaiki agar tidak membaginya dengan sejuta.

## Verifikasi lokal dan batas penerimaan

Engine, source/role, lifecycle policy, stale/hash, multiskenario concurrency, R2 tamper/missing/orphan, immutable revisions, revalidate/apply, recovery inventory dan response OpenAPI diuji dengan SQLite dan private-object fixture. Runtime inventory mempunyai 276/276 operasi terhubung kontrak; 274 nonpublic API menolak bearer kosong sebelum akses DB. Unit/integration terbaru: `test-results/web068-full-tests.log`; [27 tes beban kerja](../tests/workload-engine.test.ts) dan [skenario/kontrak](../tests/workload-scenarios.test.ts).

Browser QA sintetis memeriksa policy popup, preview/save dua batch, apply satu batch, stale barrier, revalidate/revisi kedua, apply sisa, reload/riwayat, keyboard/axe dan viewport 390/768/1440. Histori invoice dibandingkan sebelum–sesudah. Main pilot tetap tanpa policy/scenario beban, 20 customer dan sumber nyata draft; 18 tabel komersial/master/history dibandingkan setelah migrasi. Full restore main 100 tabel + PDF + boundary chunk; QA nonempty scenario recovery memulihkan database dan bytes kedua revision, lalu membaca revisi melalui router dari database hasil restore.

Backup API adalah logical allowlist, bukan full point-in-time restore. Bukti full restore menggunakan namespace lokal baru; QA restore hanya mengklaim objek skenario yang benar-benar disalin, bukan seluruh R2 lain. Cloud/provider capacity, human sign-off dan aktivasi sumber nyata tetap pending. Retensi otomatis belum diaktifkan. [Evidence final](WEB068_EVIDENCE.json).

## Pemulihan QA dan startup lokal

Ditemukan korupsi storage QA setelah server lokal ganda; mekanisme kegagalan storage persisnya belum ditetapkan. Kondisi awal beserta WAL/SHM diarsipkan di `test-results/web068-qa-integrity-1792850309873`; reindex tidak berhasil. QA dipulihkan dari snapshot sehat terverifikasi ke namespace baru `.wrangler/web068-recovered-20261024`, tanpa menimpa namespace lama. Seluruh 100 tabel snapshot dibandingkan, 41 file R2 disalin dan dibandingkan bytes. Rehearsal sintetis yang lebih baru tidak direplay ke snapshot tersebut. Pilot utama tetap sehat dan tidak dipulihkan/direset. Lihat `test-results/web068-qa-recovered.json`.

Jalankan QA dengan `node scripts/local-runtime.cjs 5193 .wrangler/web068-recovered-20261024`. Pilot utama tetap `node scripts/pilot-local.cjs pilot/local-20261021-v3`. Wrapper menolak port yang dipakai dan lock persistence yang sudah dimiliki proses lain, termasuk bila port berbeda. Lock dengan shutdown terputus memerlukan pemeriksaan operator atas parent/child sebelum dihapus; wrapper tidak menghapus lock asing atau mereset database otomatis. Perintah Wrangler langsung tidak mempunyai pengaman wrapper ini. Jangan menyalakan server kedua pada namespace sama. Periksa integritas sebelum dan sesudah rehearsal; backup SQLite online dipakai untuk capture, bukan menyalin DB aktif tanpa WAL.
