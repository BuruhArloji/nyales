## 2 November 2026 — pelaksanaan audit Apple UI/UX

Perbaikan BOM build, FilterPanel mobile Peta/Target, label dan area sentuh, target cards, detail lokasi sebagai sheet mobile, material/fallback kontras, memori halaman grup dan motion tersedia. Enam tes popup direktori, delapan tes navigasi/hirarki/responsif, TypeScript serta build standar lulus. Uji browser/API lokal sintetis memastikan filter tetap berfungsi, tanpa pageerror atau penulisan bisnis. Rincian dan batas verifikasi pada [laporan](UI_UX_APPLE_REVIEW_20261102.md). Menunggu deployment resmi staging dan smoke; tidak ada migrasi atau seed baru.

## 31 Oktober 2026 — impor dibatasi tepat 500 customer

Atas instruksi pengguna, hanya 500 customer tambahan dimasukkan: batch59/60 masing-masing200 dan 100pertama batch61. Total direktori12.100, sisa524. Batch61 tersisa100; receipt parsial menyimpan offset0/count100 dan runner melanjutkan dari offset100, tanpa mengulang impor. Jangan memakai runner lama yang menganggap setiap receipt selalu satu batch penuh. File SQL asli dan hash manifest tetap utuh; uji lokal membuktikan dua potongan100 identik dengan200 sumber kecuali timestamp otomatis, serta menolak receipt overlap.

Backup sebelum impor11.217.058byte diuji restore: quick_check ok, FK0. Rekonsiliasi sesudah impor membuktikan organisasi, user/role, invoice/retur, target, assignment, sesi, customer asli serta11.600 customer direktori sebelumnya tidak berubah; kode12.100 unik dan tidak ada assignment baru, FK0. Metadata eksekusi tiga file melaporkan3.006 reads dan6.512 writes. Ini pemakaian batch saja, di luar backup/verifikasi/operasi lain. Analytics sebelum impor2.597.649 reads/150 writes; sesudah impor masih menunjukkan angka sama karena lag, sehingga bukan bukti total akhir harian. Kuota tidak habis dan impor berhenti pada batas pengguna. Referensi peta2.638 dan review812 tidak berubah; tidak ada deploy kode/seed/penugasan baru.

Bukti privat: BEFORE_500_BACKUP_20261031.json, CLOUD_500_RECONCILED_20261031.json, IMPORT_500_USAGE_20261031.json dan PARTIAL_BATCH_VALIDATION_20261031.json pada folder customer-source-20261028. Tidak ada resume otomatis. Runner privat terbaru `.git/directory-cloud.py` mendukung `--max-customers`; salinannya disimpan sebagai bounded-import-runner-20261031.py di folder bukti privat.

## 31 Oktober 2026 — popup lokasi sudah online

Workflow [41182304003](https://github.com/BuruhArloji/nyales/actions/runs/41182304003) berhasil setelah reset kuota, termasuk pemeriksaan, build, migrasi resmi tanpa seed, publikasi, dan smoke. Commit terpasang `07449ad` memuat redesign `1c99e04`. Enam pemeriksaan layanan independen lulus. Browser staging dengan titik direktori nyata memverifikasi lebar desktop 360px, metadata terpadu, tombol Street View/Google Maps tetap terlihat saat detail digulir, dan batas popup mobile 390px. Tidak ada JavaScript error; sesi uji dicabut, tanpa penulisan data bisnis. Tidak ada migration/seed baru. Ini verifikasi staging, bukan acceptance produksi. Sisa impor 1.024 customer belum dilanjutkan pada deployment ini.

## 30 Oktober2026 — redesign popup lokasi selesai lokal, deploy tertahan kuota

Commit `1c99e04` menambah popup360px desktop, metadata status pelanggan/Sales-PIC menyatu dengan detail lokasi, foto, serta footer Street View/Google Maps yang tetap terlihat saat body digulir. Enam pengujian browser fixture, TypeScript dan build lulus. Provider data/endpoint/skema tidak diubah.

Workflow40995040761 berhenti pada Apply staging D1 migrations dengan daily row read limit code7500. Versi baru belum dipublikasikan; live tetap168317d. Tidak ada retry otomatis atau bypass migration. Reset berikut31 Oktober2026 pukul07.00WIB. Tidak menjalankan pemeriksaan data staging/popup login setelah block; screenshot browser pada pekerjaan ini adalah fixture lokal, bukan bukti popup sumber nyata di staging. Rincian `docs/POINT_DIRECTORY_IMPORT.md` dan STAGING_STATUS.json.

## 30 Oktober 2026 — bottom dock transparan dengan lapisan optik

Commit `168317d` dideploy melalui workflow40991945045; CI40991936102 lulus. Bottom dock memakai9% putih dan lapisan backdrop blur3px/saturate dengan SVG displacement halus pada Chromium; ikon/label tidak ikut terfilter. Highlight rim dan shadow memberi bentuk kaca. Safari memakai transparansi/blur4px tanpa SVG extension; reduced transparency/forced colors mempunyai fallback, tanpa klaim efek native iOS atau pengujian iPhone fisik. Pill Aktivitas Lapangan tidak diubah.

Enam uji browser dan build lokal lulus. Perbandingan screenshot objek kartu serta garis pembanding menunjukkan distorsi dibanding fallback blur pada Chromium. Browser staging memverifikasi optical layer, scroll fixed, modal hide/restore, empat viewport dan desktop rail, tanpa JavaScript/API error. Enam public smoke lulus. Tidak ada perubahan data/API/migrasi, dan sesi uji dicabut. Bukti `.nyales-agent/staging/glass-browser-20261030.json` dan screenshot `test-results/staging-glass-dock-*.png`.

## 30 Oktober 2026 — dock mobile floating tersedia di staging

Commit `a966791` dideploy melalui workflow40990609009; CI40990585734 lulus. Pada lebar<=767px, rail desktop menjadi dock bawah floating dengan ikon/label, target sentuh>=44px, safe-area dan ruang bawah konten. Submenu sticky di atas; tabel lebar digulir di panel. Dock disembunyikan selama dialog terbuka, lalu kembali saat ditutup. Desktop tetap sticky rail. Toolbar studio hanya lokal, ditempatkan di atas dock dan tidak masuk staging.

Enam uji browser dan build lokal lulus. Enam halaman melalui API lokal diperiksa pada320/390/430px tanpa overflow/page error. Browser staging nyata di Kesehatan Sistem memeriksa dock fixed ketika scroll, dialog hide/restore, viewport320/390/430/767 dan rail desktop1280px; tidak ada JavaScript/API error. Enam public smoke lulus. Screenshot desktop/mobile/modal diperiksa, sesi uji dicabut; tidak ada mutation bisnis atau migration baru. Ini verifikasi layout browser, bukan bukti uji seluruh perangkat fisik.

## 30 Oktober 2026 — polesan UI dan org chart tersedia di staging

Commit `b8e99fd` dipush ke BuruhArloji/nyales dan dideploy melalui workflow resmi [40989054380](https://github.com/BuruhArloji/nyales/actions/runs/40989054380); CI [40989026894](https://github.com/BuruhArloji/nyales/actions/runs/40989026894) lulus. Paket mencakup org chart/panel detail/pencarian/filter, dropdown Bagan/Histori dalam canvas bertitik samar dengan default Bagan, customizable select, perapian filter target/distribusi/GIS, aksi detail metrik dan copy ringkas. Prototipe lokal/HMR tetap terpisah dan toolbar studio tidak disertakan dalam staging.

Pemeriksaan lokal: 337 tes lulus, 8 dilewati, 0 gagal; build/TypeScript dan lima uji browser lulus. Sesudah deploy: enam public smoke dan pemeriksaan aset tersaji lulus; browser staging nyata memeriksa login pilot, bagan, Histori, detail anggota, reset Bagan setelah reload dan viewport390px. Screenshot desktop/mobile telah diperiksa; tidak ada JavaScript error atau API gagal. Hanya sesi uji dibuat lalu dicabut; tidak ada penulisan bisnis. Pemeriksaan count setelah deploy tetap 11.600 customer direktori, 80 invoice, 4 credit, 10 item target, 20 assignment, 47 migration. Tidak ada migration atau seed baru. Bukti rinci pada STAGING_STATUS.json dan artefak privat `.nyales-agent/staging/ui-polish-*-20261030.json`. Ini verifikasi staging, bukan acceptance produksi atau UAT semua role.

## 25 Oktober 2026 — kebijakan dan kesiapan kunjungan WEB-070 terverifikasi lokal

Pengaturan → Perencanaan kunjungan tersedia: draft/edit/aktivasi kebijakan, deklarasi manifest graph draft yang belum terverifikasi, pemeriksaan kesiapan privateR2 dengan penghambat/asumsi dan histori/stale guards. 293 tes backend dan 2 skenario browser lulus (exit0, Axe0, viewport390/768/1440). Migrasi0044 menambah4tabel; total112tabel aplikasi/114termasuk metadata D1. 310operasi runtime semuanya terhubung kontrak. Online backup dan rekonsiliasi hash18tabel bisnis per database pilot/QA lolos, integrity/FK bersih. Pilot utama tidak diisi kebijakan/graph/pemeriksaan default; boundary nyata tetapdraft. Snapshot kesiapan bukan input solver, can_generate/publishable=false. Sumber operasional yang kurang, snapshot solver, OSRM graph/engine/benchmark dan workflow generator tetappending; WEB-070 keseluruhan In progress. [Runbook](WEB070_PLANNING_READINESS.md), [bukti](WEB070_PROGRESS.json). Catatan di bawah adalah histori slice sebelumnya.

## 25 Oktober 2026 — antrean uji agent WEB-070 terverifikasi lokal

Uji antrean komputer, CLI foreground run/once, lease120 detik, retry3 kali, checkpoint, pembatalan dan riwayat sudah tersedia. 282 tes backend serta 2 skenario browser lulus (exit0, Axe0, viewport390/768/1440). Alur browser → API/D1 → vault Windows → CLI → hasil/riwayat diuji nyata dengan fixture sintetis. Migrasi0043 diterapkan lokal setelah online backup; integrity/FK dan hash18 tabel bisnis per database pilot/QA tetap sama. Pilot utama tidak mendapat komputer/tugas default; seluruh akses fixture QA dicabut dan tugasnya terminal. Runtime296 operasi terhubung kontrak, 108 tabel aplikasi/110 termasuk metadata D1. Planning snapshot/OSRM/solver tetap pending, sehingga WEB-070 keseluruhan In progress. [Runbook](WEB070_AGENT_QUEUE.md), [bukti](WEB070_PROGRESS.json). Catatan di bawah adalah histori slice sebelumnya.

## 25 Oktober 2026 — WEB-070 identitas komputer tersedia lokal

Pengaturan → Komputer penghitung menyediakan popup tambah/izin/pairing/cabut akses untuk Management/NSM. Pairing sekali pakai, vault Windows DPAPI, signed status/heartbeat, version/generation fences, rate/replay guards dan logical recovery hash-only teruji. Sembilan operasi baru; 285 operasi runtime semuanya terhubung kontrak. Migrasi 0042: tujuh tabel baru, total 105 tabel aplikasi/107 termasuk metadata D1. Seluruh 267 tes backend dan dua skenario browser lolos; Axe 0 pelanggaran, viewport 390/768/1440. Backup dan rekonsiliasi hash 18 tabel bisnis per database pilot/QA lolos. Pilot utama tidak mendapat komputer/default baru; batas nyata tetap draft. Queue/polling dan OSRM/solver belum tersedia, sehingga WEB-070 tetap In progress. [Runbook](WEB070_AGENT_IDENTITY.md), [bukti](WEB070_PROGRESS.json). Bagian bertanggal sebelumnya adalah histori.

## WEB-067 dimulai — 24 Oktober 2026

[Desain](WEB067_RISK_DESIGN.md), validator dan pure risk engine tersedia; sembilan unit tests lulus. Tidak memasang kebijakan bisnis/default aktif. API, policy/run persistence, snapshot R2/recovery dan mode Risiko masih dikerjakan; bukan fitur selesai. WEB-065/066 sudah terverifikasi lokal seperti catatan di bawah.

## 24 Oktober 2026 — WEB-066 kinerja dan coverage wilayah

Mode Kinerja/Coverage, choropleth teal/unknown berpola, bucket belum terpetakan, sumber customer/invoice/aktivitas/target/kinerja sales dan CSV snapshot tersedia lokal. Ringkasan Overview/Monitoring dan back navigation mempertahankan filter. Basis mapping read-cutoff konsisten untuk dua periode; target sales/area tidak diprorata. 164 unit/integration tests, 2 browser analytics + 4 regresi, TypeScript/build dan restore 94 tabel/1 PDF/1 chunk lulus. Pilot komersial tetap, sumber nyata masih draft. [Runbook](WEB066_REGIONAL_ANALYTICS.md), [evidence](WEB066_EVIDENCE.json). Berikutnya WEB-067; cloud/provider/human acceptance pending.

## 24 Oktober 2026 — WEB-065 pembagian kelurahan dan sales

Membership area dan preview/commit assignment bertanggal tersedia lokal di Distribusi sales, hanya Management/NSM. Epoch/hash/ETag/idempotency, konflik, role/area/SPV, satu owner per kanal dan audit diperiksa; transfer area meninjau kedua kanal. 156 tests, dua browser flows, regresi peta dan restore 94 tabel/1 PDF/1 chunk lulus. Data komersial pilot tetap, sumber nyata masih draft. [Runbook](WEB065_DISTRIBUTION.md), [evidence](WEB065_EVIDENCE.json). Berikutnya WEB-066; acceptance provider/cloud/human tetap terbuka.

## 24 Oktober 2026 — WEB-064 Peta & Wilayah

Overlay, pencarian hierarki, pemetaan penuh JSTS, review/riwayat revisi dan daftar pelanggan scoped tersedia lokal. 149 tests, dua browser flows dan restore 92 tabel/1 lampiran/1 chunk batas lulus; 80 invoice dan actual Rp36.520.000 tetap. Sumber nyata enam kelurahan tetap draft. Periode pada peta adalah konteks; analitik wilayah menyusul WEB-066. Engineering berikutnya WEB-065; human/Firebase/provider/cloud acceptance tetap pending. [Runbook](WEB064_GEOGRAPHY.md), [evidence](WEB064_EVIDENCE.json).

## 22 Oktober — backlog UI/UX dan analitik GIS

WEB-064 diperinci menjadi Peta & Wilayah pada kelompok Pelanggan: mode Sebaran, filter, panel desktop/mobile, drill-down, fullscreen dan aksesibilitas. WEB-065 merinci alur Distribusi sales dan preview sebelum/sesudah. WEB-066 kinerja/coverage didahulukan; WEB-067 risiko dan WEB-068 pemerataan/simulasi menyusul setelah dependensi masing-masing. WEB-066–068 merupakan M4 extension P1, bukan gate wajib pilot tim; staging/login per role tetap paralel. Target yang tidak teralokasi ke kelurahan tidak dibagi diam-diam, unknown tidak menjadi nol, fakta historis tetap. PRD, ERD catatan desain, backlog MD/JSON dan status diselaraskan. Seluruh perluasan masih Planned; tidak ada runtime/API/migrasi baru. [Spesifikasi dan delapan acceptance tambahan](specifications/GIS_UX_dan_Analitik_v1.md).

## 22 Oktober 2026 — sumber batas desa/kelurahan dipilih

Pengguna memilih file batas desa/kelurahan Indonesia: Geoportal Kementerian Pertanian layer ADMINISTRASI_DESAKELURAHAN_AR, sumber BIG menurut metadata, acuan Semester 1 Tahun 2025. PRD, addendum GEO-02, ERD dan backlog (MD/JSON) mencatat sumber yang sama. WEB-063 tetap Planned untuk verifikasi metadata/lisensi/namespace, pengambilan snapshot bertahap, checksum dan import. Belum mengunduh file atau mengubah aplikasi/database.

## 22 Oktober 2026 — perencanaan kelurahan/desa

Keputusan pengguna: batas administrasi kelurahan/desa menjadi dasar pembagian awal wilayah. CUS-04 diperjelas, addendum GEO-01–08 dan GEO-A01–08 ditambahkan, lima entitas ERD rancangan serta WEB-063–065 Planned diselaraskan di MD/JSON. Area bisnis dapat menggabungkan beberapa kelurahan; assignment tetap per customer/kanal, preview/commit Management/NSM bertanggal; perubahan boundary tidak memindahkan owner atau histori otomatis. Tidak ada migration, endpoint atau UI runtime baru. Validasi struktur JSON, relasi ERD, dependency/ID backlog, konsistensi MD dan preservasi 82 skenario UAT PASS. [Spesifikasi](specifications/GIS_Admin_Kelurahan_v1.md).

## 22 Oktober 2026 — stabilisasi pilot operasional dan full restore lokal

Pilot dummy sekarang memuat 8 kunjungan, 4 hasil telesales, 8 aktivitas bermakna (coverage 40%), 8 posisi, 3 follow-up dan satu lampiran sintetis. Role/assignment/DNC/lease/qualification/replay diperiksa melalui scoped-route rehearsal; browser membaca record yang dipublikasikan ke D1/R2 lokal. Seluruh invoice tetap sama. Backup aktual D1 dipulihkan ke namespace baru: 86 tabel, schema/history/guards dan 1 object R2 cocok; query Wrangler membaca 80 invoice, 12 aktivitas dan observed actual Rp36.520.000. 135/135 tests, TypeScript dan browser operasional PASS. Cakupan sumber tetap 21 Oktober: layar 22 Oktober menandai actual provisional secara benar. Tidak ada human training/sign-off, real role Firebase login atau cloud acceptance. [Runbook](WEB062_LOCAL_PILOT.md), [evidence](WEB062_STABILIZATION.json).

## WEB-062 — pilot dummy lokal aktif (21 Oktober 2026)

Pilot terisolasi di http://127.0.0.1:5183 memakai turunan sumber sintetis Oktober, D1/R2 tersendiri dan login demo lokal. Empat pilar diverifikasi: 20 pelanggan, 10 sales, 80 invoice/4 retur, actual Rp36.520.000 dan target leaf Rp80.000.000 plus reserve Rp200.000. Browser menyimpan cakupan sumber dan order, reload, membatalkan order, serta membuktikan seluruh nilai/status invoice tidak berubah. Dua belas halaman, tiga lebar viewport, 134/134 tests dan TypeScript PASS. Peta 2D/20 pin simulasi terlihat; aktivitas dan posisi sales belum diisi. Training manusia, real accounts/data/provider/restore dan go-live tetap pending. [Runbook](WEB062_LOCAL_PILOT.md), [evidence](WEB062_PILOT_EVIDENCE.json).

## 2026-10-21 · WEB-060 dummy rehearsal and WEB-061 training/handover materials

Completed the user-requested dummy scope with a separate 10-sales source JSON, customer/invoice CSVs, independent expected/database snapshots, canonical mapping, checksums and API rehearsal evidence. SQLite in-memory initializes synthetic masters/hierarchy, then executes finance dry-run/commit/retry and target creation/items/submission/independent approval through scoped application routes. 20 customers, 80 invoices, 4 credits, 2 targets; zero record diffs, September net Rp36.520.000, approved leaf Rp80.000.000 plus separate reserve Rp200.000. No preview/cloud writes or real login accounts.

WEB-061 now includes per-role guide, 12 SOPs, support/severity/incident flow, handover inventory, 15 human training cases and evidence validator. Materials prepared; human training, support assignment, provider/restore and named handover remain pending. 133/133 tests, TypeScript and build PASS. Existing large-bundle warning remains. [Dummy package](../pilot/demo-10-sales/README.md), [training](WEB061_TRAINING.md), [SOP](WEB061_SOP.md), [support](WEB061_SUPPORT.md), [handover](WEB061_HANDOVER.md).

## 2026-10-20 · WEB-060 read-only pilot reconciliation preparation

Added pilot manifest (PIC Rizky Aditya; Novely, Didik, Mursal; capacity 10, seven open slots), runtime-derived JSON schemas, snapshot/mapping templates and local npm run pilot:check. Record-level comparison, exact IDR BigInt aggregates, customer/owner/invoice/credit/target references, historical assignment, three-month history window, target leaf/reserve control, canonical/alias mapping, source hashes and fresh output directories are checked. Original sources and databases remain untouched. Synthetic ten-sales tests do not become real-pilot acceptance.

129/129 tests, TypeScript and production build PASS. Corrected a forecast leak regression assertion to inspect numeric JSON values rather than UUID/timestamp substrings. Actual manifest readiness is blocked with missing scope/identity/source inputs; data totals remain null. No actual migration, real account provisioning, source adapter deployment or business sign-off. [Runbook](WEB060_PILOT.md), [manifest](../pilot/pilot-01/manifest.json).

## 2026-10-20 · Spring pada navigasi workspace

Lebar pill kini mengikuti lebar teks yang diukur, dengan spring teredam (stiffness 420, damping 38, mass 0.85) untuk membuka/menutup secara bersamaan. Menggantikan animasi max-width 200px yang membuat timing label pendek/panjang berbeda. Label tetap pada posisi ikon yang stabil; fade singkat dan press feedback menyertai geometri, tanpa blur tambahan. Spring dapat berbalik dari posisi/kecepatan berjalan ketika pilihan berubah cepat. Scroll pilihan aktif mengikuti perubahan ukuran setiap frame melalui ResizeObserver, menggantikan jeda 600ms dan lompatan scroll. Reduced motion meniadakan spring dan press scale. Warna, glass, ikon dan perilaku tab di dalam halaman dipertahankan.

TypeScript dan production build PASS. Browser terarah PASS: 40 sampel frame, gerak membuka/menutup, pergantian cepat/berbalik, lima kelompok, viewport 320/390/768, keyboard, reduced motion dan tanpa page error. Evidence lokal: test-results/workspace-spring.json, workspace-spring-build.txt dan screenshot. Tidak ada perubahan API/data bisnis.

## 2026-10-20 · Navigasi workspace mengikuti sidebar

Navigasi atas pada seluruh kelompok hanya menampilkan ikon ketika tidak dipilih; pilihan aktif membuka label horizontal 550ms sambil label sebelumnya menutup. Glass dan warna dipertahankan, nama tetap tersedia melalui aria-label/title. Pada layar sempit container dapat digeser dan pilihan aktif ditampilkan penuh setelah transisi/resize. In-page tabs tetap mengikuti perilaku sebelumnya.

TypeScript/production build PASS. Pemeriksaan browser terarah pada lima kelompok, perpindahan horizontal, viewport 320/390/768, keyboard, reduced motion dan page errors PASS. Evidence lokal: test-results/workspace-compact.json serta screenshot desktop/mobile. Tidak ada perubahan API/data bisnis.

## 2026-10-20 · WEB-059 local automated UAT

121/121 regression tests, TypeScript/production build and 11/11 Chrome/Edge browser checks PASS; dependency audit 0 vulnerabilities. Isolated local fixture preserves the main demo state and auth rate limit. Fixed empty-state/supporting-text contrast, modal focus trap, tab keyboard navigation/skip link, Monitoring retry and Overview unknown-vs-confirmed-zero. Register preserves all 82 scenarios (53 web, 8 integration/P1, 21 Android); named business sign-off remains 0. No cloud deployment or production acceptance. Actual device/role/screen-reader/provider and restore gates remain. [Report](WEB059_UAT.md), [register](WEB059_UAT_REGISTER.json), [browser evidence](WEB059_BROWSER_EVIDENCE.json). Next preparation: WEB-060 real pilot data reconciliation.

## 2026-10-20 · WEB-058 local security review and regression



Same-origin guard/no cookie auth, actual-stream request limits, legal hold/report deletion claim/retry, recovery ETag/atomic review/replay/provenance and patched dependencies. 232 runtime operations linked to implementation contracts; all 230 nonpublic operations tested missing-bearer denial before DB. Added 16 regression tests; full suite 119/119 PASS, TypeScript/build PASS and npm audit 0 vulnerabilities. Evidence and production boundaries: [WEB058_SECURITY_REVIEW](WEB058_SECURITY_REVIEW.md). No cloud deployment, production acceptance, real provider MFA, actual restore or destructive business deletion. Next: WEB-059 UAT.



## 2026-10-20 · WEB-057 recovery local slice



Migration 0034 dan panel Recovery Management/NSM tersedia. Logical/attachment metadata backup menyimpan private R2 manifest dengan SHA-256, row/byte counts dan expiry. Restore drill membaca object, memverifikasi checksum dan merekonsiliasi row/attachment metadata tanpa write-back. Policy RPO/RTO/retensi, legal hold, privacy request review, retention preview dan migration rollback dry-run tersedia. Tidak ada penghapusan customer/invoice/order/outbox, tidak ada rewrite accepted order, dan tidak ada provider deployment.



Validation: `tests/recovery.test.ts` 4/4 PASS; full `npm test` 103/103 PASS; `npm run build` PASS. Local D1 migration 0034 applied. Runbook: [WEB057_RECOVERY](WEB057_RECOVERY.md). Production RPO15m/RTO4h, provider durability, cross-region restore, legal retention approval, privacy UAT dan actual deletion policy tetap gate sebelum go-live.



## 2026-10-20 · WEB-056 Monitoring capacity hardening



Monitoring organization-wide no longer rejects invoice/activity sources above 2.000. Server SQL aggregates KPI, channel, coverage, meaningful activity and per-rep actuals; browser receives 50-record previews. `/api/dashboard/sources` provides scoped keyset pages up to 100 rows with filter-bound cursors. Monitoring drill-down UI uses the paginated endpoint. Private CSV export reads the complete dataset and rejects >10.000 rows or >5 MiB UTF-8 before R2/report creation.



Validation: `npm test` 99/99 PASS; `npm run build` PASS. `tests/monitoring-capacity.test.ts` covers 2.600-row pagination, 1.000 customer/10.000 invoice/5.000 activity aggregation, merged-family and Area Manager scope, cursor binding, overflow, full CSV checksum, row/byte caps. `test-results/monitoring-capacity-v4.json` reports local SQLite summary mean ~69ms, source page ~20ms, rep filter ~23ms and five concurrent 200 responses. These are local regressions, not Cloudflare CPU/billing/SLA evidence. Production provider measurement, UAT and WEB-057 backup/restore/retention remain open.



## 2026-10-19 · Koreksi animasi sidebar horizontal



Shared slider vertikal sidebar dihapus. Masing-masing tombol kelompok kini menutup/membuka permukaannya sendiri secara horizontal: pilihan lama 124px ke 44px, tujuan 44px ke 124px, label fade/clip mengikuti lebar. Mobile 112px/40px. Easing 550ms tetap fluid, posisi vertikal tombol dan gutter konten stabil. Slider pada navigasi/tab/peta serta page entrance tetap dipertahankan.



Build PASS. test-results/sidebar-horizontal.cjs PASS: lebar awal/tengah/akhir membuktikan penutupan lama dan pembukaan tujuan; posisi y tombol dan x konten tetap, tidak ada shared rail slider, rapid switch benar, mobile tanpa overflow, reduced-motion instan, page errors kosong. Evidence sidebar-horizontal.json. Supersedes perilaku vertical rail pada entry Motion seluruh pill interaktif.



## 2026-10-19 · Fluid page entrance



Keyed page-scene menerapkan fade/rise 18px desktop dan 12px mobile, 550ms dengan easing pill yang sama. Judul, toolbar/filter, callout, KPI/content card, tabel dan peta memakai stagger maksimal 240ms. Shell tetap diam; mount card setelah fetch ikut animasi, tooltip rerender tidak memutar ulang entrance. Tidak ada antrean animasi per baris tabel atau penundaan fetch/interaksi. Transform kembali normal setelah selesai, reduced-motion meniadakan entrance.



Build PASS. test-results/page-entrance.cjs PASS: 18 halaman memiliki entrance, sampel opacity/translate nyata bergerak, 4 KPI async Overview masuk sekali, tooltip tidak replay, reduced-motion none, mobile tanpa overflow/page errors. Evidence page-entrance.json dan page-entrance-mobile.png. Tidak mengubah API/data atau styling visual statis.



## 2026-10-19 · Motion seluruh pill interaktif



Indikator 550ms/easing konsisten kini mencakup rail sidebar, navigasi workspace, seluruh tab halaman dan kontrol peta 2D/3D. Tombol aksi primary/secondary serta ikon memakai press scale 0.97 secara global, tanpa mengganti UI. Disabled dan reduced-motion ditangani. Badge informasi tetap statis; select native mempertahankan perilaku browser.



Build PASS. test-results/all-pill-motion.cjs PASS: rail vertikal dan kontrol peta menunjukkan posisi awal/tengah/akhir, alignment desktop/mobile, kontrol peta tetap absolute, press scale aktual 0.97, reduced-motion 0s, tanpa page errors/overflow. Peta memakai fixture vektor sintetis hanya untuk menguji kontrol tanpa ketergantungan layanan tile; bukan validasi provider atau geometri. Evidence all-pill-motion.json. Tidak mengubah API/data.



## 2026-10-19 · Animasi tab di dalam halaman



Shared LiquidTabs diterapkan pada 11 kelompok tab yang sudah ada, termasuk Statement/Skema/Peserta, Monitoring, customer, distribusi, katalog, invoice, pipeline, aktivitas, Hirarki/User, Pengaturan dan pengelolaan data. Gerakan 550ms/easing yang sama, tanpa mengganti warna/layout/role/callback. Koordinat x/y dan ukuran aktual mengikuti wrapping di mobile. Reduced-motion tetap didukung.



Build PASS. test-results/liquid-tabs.cjs PASS: perpindahan Statement ke Skema diukur pada posisi awal/tengah/akhir, 11 halaman diperiksa pada desktop dan 390px, alignment indikator mengikuti pilihan termasuk baris kedua, tanpa document overflow/page errors, reduced-motion 0s. Evidence liquid-tabs.json dan liquid-incentives.png. Tidak ada perubahan API/data.



## 2026-10-19 · Sliding navigation motion



Navigasi halaman atas memakai satu indikator aktif yang bergeser mengikuti tombol, dengan durasi 550ms dan easing cubic-bezier(0.22,0.9,0.25,1) dari contoh Uiverse pengguna (gleydson_9898). Gaya glass/charcoal dan layout NYALES dipertahankan. Label variabel diukur melalui ResizeObserver dan font readiness; reduced-motion menghapus animasi dan efek tekan. Tidak mengubah navigasi kelompok, API atau data.



Build PASS. test-results/liquid-nav.cjs PASS: posisi antara awal/akhir terbukti bergerak, durasi 0.55s, posisi/lebar indikator selaras dengan menu pada desktop dan mobile, reduced-motion 0s, page errors kosong. Evidence liquid-nav.json / liquid-nav.png. Preview lokal.



## 2026-10-19 · Circular rail dan glass recipe



Menu kelompok yang tidak aktif berbentuk lingkaran; menu aktif melebar menjadi pill dengan label melalui transisi 200ms. Gutter desktop tetap; mobile memakai strip scroll. Nama aksesibel, tooltip hover/fokus keyboard, serta reduced-motion tersedia. Workspace memakai gradasi radial mint–abu seperti login. Permukaan glass mengikuti contoh pengguna: white 34%, blur 9px, border white 30%, inner glow dan highlight tepi; ukuran komponen tetap responsif dan tooltip grafik tidak dipotong.



Build PASS. test-results/rail-glass.cjs PASS: 18 halaman, circle/pill dimensions, keyboard tooltip, reduced-motion, modal buka/tutup, semua halaman diperiksa pada lebar mobile, Overview 390/768/1280 tanpa document overflow, page errors kosong. Evidence rail-glass-verification.json dan rail-glass-*.png. Preview lokal saja.



## 2026-10-19 · NYALES Studio UI



Gaya referensi screenshot Behance diterapkan dengan Inter lokal, canvas abu netral, card putih, primary charcoal, grafik teal–mint dan slate–sage. Navigasi menjadi rail 5 kelompok dan pill halaman, tetap difilter capability; Overview tetap awal. Glass terbatas pada navigasi, kontrol peta, header popup dan login. Demo disclosure dapat dibuka. Seluruh API, data dan kalkulasi tetap memakai implementasi yang ada.



Build PASS. Browser lokal membuka 18 halaman, memeriksa overflow mobile tiap halaman, viewport Overview 390/768/1280, font Inter, modal buka/tutup dan tanpa page errors. Artefak: test-results/studio-ui-verification.json dan studio-*.png. Panduan: [UI_STUDIO.md](UI_STUDIO.md). Hanya preview lokal, bukan deploy atau acceptance produksi.



## 2026-10-19 · WEB-056 observability dan kapasitas lokal



Kesehatan sistem Management/NSM, structured API/job telemetry, request ID, D1 metadata subtotals/R2 attempts, owner/profil pilot, manual provider snapshots dan alert70/85/95 tersedia. Metrik/peringatan tidak auto-upgrade atau menghapus data. CPU/kuota cloud tetap unknown sampai ada evidence provider. Migrasi0033 lokal menambah4tabel ops dan index.



93tes dan build PASS; browser5concurrent requests, R2 export/download, D1meta, popup dan responsive PASS; data lama direkonsiliasi. Simulasi1.000 customer/10.000 invoice menemukan Monitoring organisasi>2.000source ditolak422; scoped per-sales berhasil. Ini capacity gate, bukan Accepted produksi. Lihat [M4_STATUS](M4_STATUS.md), [operational runbook](WEB056_OPERATIONS.md), [actual API](specifications/m4-observability-api.openapi.json). WEB057–062 tetap Planned.



## 2026-10-19 · Popup Google Street View



Tombol Lihat Street View tersedia pada popup pin customer di Overview/Peta customer dan baris customer berkoordinat pada halaman Peta customer. Endpoint authenticated GET /api/customers/:id/street-view memeriksa customerPredicate sebelum membaca konfigurasi; customer di luar scope 404, tanpa koordinat 422, key belum diatur 503. Respons no-store berisi URL Maps Embed streetview dengan koordinat tersimpan, radius 50m dan bahasa Indonesia. GOOGLE_MAPS_EMBED_API_KEY dibaca dari binding lokal .dev.vars yang diabaikan Git. Key tidak ditulis ke log/dokumentasi; penggunaan iframe tetap membawa key di browser sesuai desain Embed API, sehingga pembatasan API dan HTTP referrer di Google Cloud tetap diperlukan.



Iframe hanya dibuat saat popup dibuka dan dihapus saat ditutup; referrerPolicy strict-origin-when-cross-origin, fullscreen, tautan cadangan Google Maps tanpa key tersedia. Bila dibuka dari peta fullscreen, native fullscreen keluar dahulu supaya popup terlihat. Basemap OpenFreeMap/2D/3D tetap terpisah. Error cross-origin Google tidak bisa dideteksi andal oleh parent; pesan dan tautan cadangan tersedia tanpa mengklaim onLoad sebagai bukti panorama tersedia.



Validasi lokal: TypeScript/build; tes API scope/koordinat/missing key/no-store/URL memakai key sintetis lulus. Browser dengan key lokal sebenarnya menerima HTTP 200 dari Google, panorama Bekasi terlihat pada screenshot test-results/street-view-live.png; lazy load satu request saat dibuka, kedua tombol, popup lebar 390/320 tanpa overflow, iframe hilang setelah tutup, tanpa JavaScript error. Tidak ada perubahan database atau deployment cloud. Nama/koordinat customer contoh adalah data demo, bukan konfirmasi lokasi toko nyata.



## 2026-10-19 · OpenFreeMap dan bangunan 3D



Basemap default menjadi style Positron OpenFreeMap, mengambil vector tiles langsung di browser. API /api/map menambah provider dan style_url, tanpa mengubah scope customer/posisi. Jika MAP_TILE_URL dikonfigurasi, sumber raster tersebut tetap dipakai dan 3D dinonaktifkan. Mode default 2D; tombol 3D memiringkan kamera 55 derajat, mengaktifkan rotasi, dan menampilkan fill-extrusion bangunan cream mulai zoom 14. Tinggi memakai render_height/render_min_height dari tiles; fallback tinggi 6m jika field tidak tersedia. Catatan estimasi tersedia di peta; tidak menjanjikan geometri atau tinggi aktual semua bangunan. Fokus sales/customer zoom 16. Reduced motion menonaktifkan transisi kamera.



Worker MapLibre diimpor sebagai aset Vite eksplisit agar pemrosesan vektor bekerja pada build preview; sebelumnya URL worker relatif gagal dimuat. Fullscreen mencakup tombol mode; daftar sales tetap scroll dengan tinggi tetap. Atribusi OpenFreeMap/OpenMapTiles/OpenStreetMap berasal dari sumber. Tidak ada penyimpanan data bangunan di D1/R2 atau download wilayah.



Validasi lokal: TypeScript/build; tes API map filters/scoped positions lulus. Browser live memuat 2 style, 36 respons vector tile, 1364 building features dan 1359 feature dengan tinggi positif pada tiles yang berhasil didekode saat pengujian (bukan jumlah bangunan unik/seluruh Jakarta). Tidak ada respons gagal HTTP pada provider atau page errors; pembatalan request saat navigasi/zoom normal. Scope pin direkonsiliasi terhadap API. Mode 2D/3D, posisi sales, fullscreen enter/exit, halaman Peta customer dan lebar 390/768 lolos. Screenshot test-results/openfreemap-3d-fullscreen.png, openfreemap-3d.png, openfreemap-2d.png. Hanya preview lokal; belum deploy.



Referensi: https://openfreemap.org/quick_start/ dan https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/.



## 2026-10-19 · Morphing Infinity loading



Komponen Motion dari referensi pengguna diterapkan sebagai Loading bersama pada pemeriksaan sesi dan state Memuat di halaman/popup. Bentuk circle–infinity memakai durasi lima detik, warna teal, ukuran ikon 96px, status teks sesuai konteks. Preferensi reduced motion memakai ikon infinity statis; hanya wrapper memiliki live status. Pesan error dan logika pengambilan data tetap terpisah. Dependency motion ditambahkan.



Validasi lokal: TypeScript/build; browser memastikan path berubah saat loading, ikon statis saat reduced motion, sesi/Monitoring tampil loading selama respons tertahan lalu berganti konten asli tanpa JavaScript error. Screenshot test-results/morphing-loading.png. Tidak ada perubahan API/database.



## 2026-10-19 · Panel peta tetap, daftar sales scroll, layar penuh



Area peta dan panel sales dibatasi 320px pada desktop, 300px pada layout satu kolom. Daftar posisi sales memakai scroll internal; legenda dan catatan lokasi tetap terlihat. Jumlah sales tidak memperpanjang panel. Kontrol layar penuh MapLibre ditambahkan di kanan atas peta dengan label Indonesia dan dukungan native/fallback bawaan MapLibre. Ukuran serta sudut peta kembali normal setelah keluar. Berlaku pada Overview dan halaman Peta customer; tabel customer di halaman penuh tetap terpisah.



Validasi lokal: build; browser dengan 60 sales simulasi memastikan tinggi kartu tidak berubah, daftar bisa di-scroll, masuk/keluar fullscreen, ukuran kembali 320px, layout 768/390px, kedua halaman, tanpa JavaScript error. Simulasi hanya respons browser pengujian, tanpa perubahan database.



## 2026-10-19 · Tata letak rincian statement insentif



Popup rincian statement diperlebar dengan ringkasan dua kolom (satu kolom pada mobile), nama penerima/status/periode terpisah, angka ringkas dan tooltip rupiah penuh. Komponen memakai nama yang mudah dibaca; bonus menampilkan ambang yang sebenarnya, bukan rentang 0–0%. Nilai sebelum pembulatan diformat dari string desimal mesin tanpa konversi float: pemisah ribuan Indonesia dan nol pecahan di belakang dihapus. Invoice sumber memakai kartu terstruktur. Perubahan hanya presentasi, tanpa perubahan engine atau data.



Validasi: TypeScript/build; browser pada desktop serta lebar 620/390/320 tanpa overflow popup/kartu (tabel mobile dapat digeser horizontal); tooltip, nominal besar sampai 999999999999999, desimal 46000.123450000000 menjadi Rp 46.000,12345, nama komponen, rincian invoice, tanpa JavaScript error. Screenshot: test-results/statement-detail-desktop.png dan statement-detail-mobile.png.



## 2026-10-18 · Donut kontribusi kanal Overview



Kontribusi kanal di Overview mengikuti referensi donut tebal berujung bulat: total invoice di tengah, nominal pada lengkung, legenda nominal dan persentase. Palet teal–sage dan champagne–cream menyamai Monitoring. Tooltip hitam putih tersedia lewat hover/focus dan keyboard. Nilai net negatif atau total nol tidak digambarkan sebagai proporsi positif. Grafik batang enam bulan tetap tersedia.



Validasi lokal: TypeScript/build dan browser untuk total Rp523 jt, Lapangan Rp366 jt/70%, Telesales Rp157 jt/30%, tooltip, keyboard, lebar 390/768/1440 tanpa overflow, dan tanpa JavaScript error. Tidak ada perubahan API/database.



## 2026-10-18 · Dua cincin pencapaian kanal



Kartu kontribusi diganti Pencapaian per kanal mengikuti referensi: nilai di kiri, cincin Lapangan teal dan Telesales navy di kanan. Actual dan target memakai leaf target approved yang sama beserta cutoff monitoring. Invoice di luar alokasi tidak masuk numerator achievement; actual seluruh kanal tetap tersedia di API `channels`. Tambahan API `channel_achievement` berisi actual, target, achievement, dan status. Klik kanal/cincin membuka rincian target beserta actual. Cincin dibatasi 0–100% secara visual, angka asli tetap ditampilkan. Missing/zero target, sumber belum lengkap, dan basis perlu review tidak diberi persentase.



Data demo saat pemeriksaan: Lapangan Rp186 jt/Rp214 jt = 86,92%; Telesales Rp62 jt/Rp71 jt = 87,32%. Perbedaan dari total kanal sebelumnya berasal dari invoice tanpa alokasi target, bukan perubahan invoice.



Validasi lokal: 6 tes monitoring termasuk approval terpisah, actual di luar target, >100%, sumber provisional, dan scope rep; TypeScript/build; browser dua cincin, tooltip hitam putih, drill target, keyboard, filter, serta lebar 390/768/1440 tanpa overflow. Pemeriksaan browser tambahan menguji cincin 150% penuh dengan angka 150% dan target tidak tersedia. Tidak ada migrasi atau perubahan data.



## 2026-10-18 · Kontribusi penjualan per kanal



Kartu Monitoring menampilkan total invoice teramati dan dua bar horizontal Lapangan/Telesales. Panjang bar memakai porsi total; nominal ringkas disertai tooltip hitam putih nominal penuh. Klik membuka invoice kanal pada scope/filter yang sama. Total nol tidak diberi persentase; nilai net negatif ditampilkan bertanda dengan besaran absolut dan kontribusi tidak berlaku. Sumber provisional tetap ditandai.



Validasi lokal: TypeScript/build dan browser untuk Rp523 jt (Rp366 jt/70%, Rp157 jt/30%), drill invoice, tooltip, filter telesales 100%, lebar 390/768/1440 tanpa overflow dan tanpa JavaScript error. Tidak ada perubahan database atau API.



## 2026-10-18 · Visualisasi coverage dan aktivitas



Monitoring kini memakai donut pelanggan unik dan bar aktivitas bertumpuk per kanal pada skala jumlah yang sama. Legenda pelanggan membuka daftar tercakup/belum tercakup; segmen aktivitas membuka record sesuai kanal dan meaningful flag. Tooltip hitam putih, keyboard focus, dan keadaan tanpa pelanggan/aktivitas tersedia. Definisi meaningful dan scope tidak berubah. API summary menambah `activity_channels`, `sources.customers[].covered`, dan `sources.activities[].meaningful`.



Validasi: 5 tes monitoring termasuk kunjungan berulang, lintas kanal, scope rep, dan cohort kosong; TypeScript/build; browser pada data lokal 12/23 pelanggan, 11 belum tercakup, 9 aktivitas lapangan bermakna, filter telesales, tooltip, dan lebar 390/768/1440. Tidak ada migrasi atau perubahan data bisnis. Hasil ini untuk preview lokal.



# NYALES build status



> Status terbaru M3,18Oktober2026: insentif dan monitoring tersedia sebagai pilot lokal. Lihat [M3_STATUS.md](M3_STATUS.md), [JSON](M3_STATUS.json), API/ERD implementasi. Catatan M1/M2 di bawah adalah histori. Belum ada acceptance atau deployment produksi.



> Status terbaru 18 Oktober 2026: M2 pilot lokal tersedia. Lihat [M2_STATUS.md](M2_STATUS.md), [JSON](M2_STATUS.json), kontrak /api dan ERD implementasi. Bagian selanjutnya adalah histori iterasi; klaim fitur belum dibangun di dalam histori tidak menggantikan status terbaru. Acceptance/deployment produksi tetap pending.



> Status terkini18Oktober2026: implementasi lokal seluruh item M1 tercatat di [M1_STATUS.md](M1_STATUS.md). Bagian awal di bawah adalah catatan historis iterasi, bukan status terbaru. Seluruh fallback data sintetis sudah dihapus dari jalur runtime; auth/scope/sesi, R2 import, katalog dan pipeline invoice kini tersedia lokal. Firebase nyata/MFA/provider peta/integrasi ERP dan acceptance produksi tetap pending.





## Keputusan arsitektur pelanggan - 18 Oktober 2026



Baseline aktif: PRD v1.10, ERD/API/backlog v1.2 di [specifications/README.md](specifications/README.md). Bagian historis berikut yang menyebut Account sebagai master bisnis telah digantikan.



- Pelanggan/toko menjadi entitas utama satu lokasi; UI hanya Pelanggan dan Kontak, form popup tetap dipakai.

- API dan CSV tidak menerima relasi Account. Manual memakai nama/alamat/area, kode ERP opsional; import memerlukan kode ERP unik, nama/alamat/area.

- Migrasi 0017 diterapkan hanya pada D1 lokal setelah backup. Tabel account dan kolom customer_outlet.account_id dihapus; 11 master lama beserta relasi dipertahankan sebagai snapshot audit.

- Rekonsiliasi semua tabel sebelum/sesudah membuktikan 13 pelanggan, 6 kontak, 6 invoice, 3 assignment, alias, fakta dan versi historis tetap sama. Foreign key check bersih; batch import lama dan sumber asli dipertahankan. Batch pelanggan schema1 wajib validasi ulang.

- 48 tes otomatis dan production build lulus. Peringatan ukuran bundle MapLibre tetap ada seperti sebelumnya.

- Bukti: test-results/account-removal-reconciliation.json dan tests/customers.test.ts serta tests/imports-merges.test.ts.

- Browser regression lulus: tambah pelanggan langsung, kontak, template dan import tanpa Account, merge/alias, invoice tetap, responsif 320/390/768/1440, halaman distribusi/produk/invoice/peta/overview, logout dan tanpa page errors. Data contoh baru dinonaktifkan dan kontak diarsipkan; sumber import/audit dipertahankan. Bukti: test-results/customer-primary-browser.json dan customer-primary-desktop.png.

- Tidak ada deployment cloud atau perubahan database remote.



17 Oktober 2026.



## Selesai pada iterasi ini



- Project mandiri `sales-operations` dengan nama aplikasi NYALES.

- Shell React responsif memakai Poppins lokal dan brand mark SVG.

- Halaman Overview, Customer, dan Telesales sesuai Design System v1.1.

- Hono API `/api/health`, `/api/me`, `/api/dashboard`, `/api/customers`, dan `/api/telesales/queue`.

- Migration D1 `0001_initial.sql` dan seed lokal berhasil dijalankan.

- Dashboard mengambil data `/api/dashboard`; Customer mengambil data `/api/customers` dengan fallback fixture saat API belum tersedia.

- WEB-016 peta distribusi sudah masuk Overview: MapLibre + basemap raster OpenStreetMap, marker customer, posisi terakhir sales, popup timestamp/source/akurasi, attribution, dan fallback tanpa routing. Provider tile perlu capacity/usage review sebelum produksi.



## Validasi



- `npm run check` lulus.

- `npm run build` lulus.

- D1 migration: 14 perintah berhasil.

- D1 seed: 7 perintah berhasil.

- Browser test preview: endpoint health 200, tidak ada page error, tiga halaman dapat dinavigasi.



## Status implementasi



Data masih demo dan belum ada Firebase Authentication, middleware authorization produksi, import invoice nyata, target/forecast server, finalisasi insentif, R2 upload, MapLibre tile provider, atau Android. Kode ini merupakan fondasi M0/M1 yang mulai executable; status backlog fitur tetap Planned sampai runtime acceptance diselesaikan.



## Referensi



PRD v1.9, ERD v1.1, API v1.1, backlog web v1.1, dan Design System v1.1 berada pada artefak spesifikasi sebelumnya.





## WEB-007 — Implemented, menunggu verifikasi Firebase nyata



Login email/password dan Google via Firebase SDK; login demo local-only; API middleware memverifikasi Firebase JWT dan mapping UID ke user/role aktif di D1. Semua API domain memerlukan identitas. Domain nonlocal ditutup sampai WEB-008; session binding/revoke tetap WEB-011.



Validasi: empat automated test groups lulus (environment guard, JWT claims/signature, endpoint 401, mapping unmapped/ambiguity), browser login/reload/logout lulus, migration 0002 berhasil, TypeScript/build lulus. Firebase web config dan project ID belum tersedia; belum ada login akun nyata atau provisioning user production. Baca AUTH_SETUP.md.



Pernyataan sebelumnya bahwa seluruh data domain sudah production-ready tidak berlaku. Dashboard/queue/map tetap fixture dan resource authorization berikutnya adalah WEB-008.





## WEB-008 — Scope data pada endpoint yang sudah dibangun



17 Oktober 2026. Implementasi backend kini memuat effective-date user_area_scope dan reporting_assignment; identitas berasal dari middleware Firebase/mapping, bukan parameter query. Scope: Management/NSM organisasi, AM area sendiri, SPV subtree beririsan area, SR area atau explicit field assignment, telesales explicit telesales assignment. Invoice mengikuti rep/channel dan dimensi area invoice; perpindahan owner customer tidak memindahkan actual historis ke sales baru. Scope tanggal memakai timezone organisasi dan tanggal server; cutoff client tidak memperluas akses.



Endpoints GET /api/me, /api/customers, /api/customers/:id, /api/dashboard, /api/map, /api/telesales/queue memakai scope. Detail resource di luar scope = 404, operasi dilarang = 403. Query area/owner hanya mempersempit hasil yang sudah diizinkan. SQL memakai prepared bindings dan organisasi di tiap join. Field output diproyeksikan eksplisit; auth_subject, nomor kontak penuh, dan nominal insentif tidak dikirim. Settings capability hanya untuk Management/NSM; route mutation/master dan resource belum diimplementasikan tidak otomatis terbuka. Export/attachment/insentif authorization harus ditambahkan bersama modul terkait, belum Accepted untuk seluruh API rancangan.



Seluruh fixture domain frontend/server dihapus dari jalur data; error/denied tidak memunculkan data contoh. Dashboard kini mengagregasi invoice D1; target/achievement yang belum ada = null/Belum tersedia. Kontrol periode/area dengan angka hardcoded dan chart sintetis dihapus sampai API filter/tren benar tersedia. Actual customer memakai bulan bisnis berjalan; status aktif tetap rolling90. Queue belum mempunyai preference DNC terintegrasi, sehingga panggilan/simpan hasil dinonaktifkan, tanpa menebak izin hubungi.



Migration 0003 dan seed lokal lulus. Enam automated test groups lulus: JWT/mapping, environment guard, anonymous API, scope roles, lintas organisasi/area, subtree, expired assignment, SR area/assigned, tele separation, narrow filters, detail404, map scope, mutation denied, and storage failure. SQLite in-memory mengeksekusi SQL route yang sama; browser menguji Worker/D1 lokal, total actual Rp275 juta, target null, customer lookup, queue, dan responsive 320/390/768/1440. No page errors. `npm run build` dan TypeScript lulus; bundle MapLibre masih menghasilkan warning chunk besar (optimisasi berikutnya).



Batas: Firebase nyata dan test multi-user production belum tersedia. Date-effective scope mempunyai read enforcement; UI CRUD hirarki/validasi cycle dan temporal overlap pada mutation adalah WEB-010/015. Data tier/sync/invoice revision/retur lengkap belum dibangun. Role dan area test menggunakan harness identitas pada tests; tidak ada endpoint production untuk memilih role melalui client. Mode demo tetap Management dan local-only.





## WEB-009 — Master organisasi, cabang, area dan kalender kerja



Halaman Pengaturan tersedia untuk capability settings:manage (Management/NSM). Backend tetap memeriksa scope untuk GET master/detail dan menolak POST/PUT/archive oleh role lain. GET /api/organization, /api/branches, /api/areas, /api/calendars serta detail; PUT organization; create/edit/archive pada tiga master. Cabang dan kalender yang dibaca AM/SPV/SR mengikuti area atau assignment yang sah, bukan daftar seluruh organisasi.



Form menyimpan nama organisasi dan timezone; cabang dengan timezone IANA; relasi area–cabang; kalender dengan hari kerja ISO 1=Senin sampai7=Minggu, jam mulai/selesai, dan tanggal libur ISO. Kalender aktif tunggal per cabang. Jam selesai harus sesudah mulai; overnight belum didukung. Tanggal libur dimasukkan organisasi, belum ada sinkronisasi hari libur nasional. Arsip menyimpan histori; cabang yang masih mempunyai area/kalender aktif dan area yang masih terkait customer/scope user ditolak.



Semua mutation memakai If-Match/version untuk update/archive dan Idempotency-Key untuk POST/PUT. Request key+payload sama mengembalikan record yang sama; payload beda dengan key sama ditolak. Mutation, audit before/after UTC dan idempotency disimpan dalam batch D1 atomik dengan check guard untuk mencegah versi kedaluwarsa lolos. UI mempertahankan key retry selama payload/versi sama; aksi simpan dinonaktifkan saat pending. Tidak ada hard delete.



Endpoint /api/calendars/:id/clock menampilkan waktu UTC, tanggal/jam bisnis menurut timezone cabang, dan status jam kerja. Fungsi isWorkingInstant dan workingMinutesBetween tersedia untuk modul SLA berikutnya; uji membuktikan timezone Jakarta/Makassar, batas jam selesai, hari libur dan akhir pekan. Integrasi job SLA otomatis dan reminder belum diimplementasikan pada WEB-009 ini; penerimaan SLA ujung-ke-ujung menunggu modul pekerjaan/otomasi.



Validasi: migration0004/0005 dan seed D1 lokal berhasil; delapan automated test groups lulus, termasuk izin master, tenant, missing/stale If-Match, idempotency replay/conflict, audit, referensi cabang, tanggal libur tidak valid, duplicate weekdays, kalender aktif ganda dan archive dependency. Browser memeriksa create branch/area/calendar, edit/reload nilai, archive, dan lebar320/390/768/1440 tanpa horizontal overflow. Data QA browser diarsipkan; tidak ada perubahan cloud production. Snapshot dan hasil berada di test-results/web009-settings.png dan web009-browser.json.



Catatan acceptance: konfigurasi Firebase/provisioning akun nyata belum tersedia. Uji role menggunakan harness backend dengan SQL SQLite yang sama dan browser akun demo Management. Mapping tabel branch/work_calendar dipakai bertahap; kalender historis final pada kalkulasi harus dibekukan sebagai versi saat modul tersebut dibangun. Default demo: Cabang Contoh Jakarta, Senin–Jumat08:00–17:00, tanpa libur otomatis; bukan aturan perusahaan yang disepakati.





## Pola interaksi form — 17 Oktober 2026



Semua form pengelolaan yang tersedia memakai pola daftar/ringkasan sebagai tampilan awal, aksi utama di kanan atas di atas card, dan form tambah/edit dalam popup. Diterapkan pada organisasi, cabang, area, kalender kerja, user, pelaporan dan transfer hirarki. Hirarki menjadi tab pertama/default, diikuti User. Organisasi memakai tombol Edit organisasi karena hanya ada satu organisasi pada scope akun. Konfirmasi arsip dan detail customer juga memakai popup. Filter/pencarian tetap tersedia di halaman; login tetap menjadi halaman autentikasi. Telesales masih berupa antrean dan konteks dengan aksi catat panggilan nonaktif sesuai status modul.



Komponen bersama `src/client/Modal.tsx` menggunakan native dialog dengan label judul, penguncian fokus, Escape/tombol tutup, pengembalian fokus ke pemicu, scroll internal dan ukuran responsif. Saat mutation berlangsung, popup tidak dapat ditutup untuk mencegah pengiriman ganda. Error tampil di popup dan nilai form dipertahankan untuk koreksi; sukses menutup popup dan memperbarui daftar. Pola ini menjadi standar untuk form modul berikutnya.



Validasi browser lokal: popup seluruh bagian Pengaturan, posisi tombol di atas card, create/edit/archive cabang melalui D1 lokal (record QA telah diarsipkan), detail customer, lebar 320/390/768/1440 tanpa overflow dan tanpa page error. Pengujian Hirarki/User menguji form tersembunyi, urutan tab, popup tambah/kelola, Escape, fokus kembali dan reset draft.





## WEB-011 — sesi perangkat, revoke dan proteksi admin



Implementasi lokal 17 Oktober 2026: migration0008_device_sessions, binding Firebase identity + X-Device-Session untuk seluruh endpoint domain; bootstrap recent login, token acak256-bit dengan hash saja di D1, expiry12jam, audit create/revoke, rate limit20bootstrap/user/10menit dan last_seen ditulis paling sering15menit. POST/GET /api/device-sessions, GET detail dan POST revoke tersedia. Revoke memakai reason + If-Match; pengulangan yang sudah dicabut tidak menggandakan audit. Pencabutan efektif di backend pada request selanjutnya. Login lama tidak bisa membuat binding baru setelah revoke dengan mengganti device_id; sesi lain tetap berlaku. Bootstrap mengembalikan secret sekali dan belum mendukung replay secret melalui Idempotency-Key; kehilangan respons dapat membuat sesi tambahan sampai expiry, dibatasi rate limit.



Menu Sesi perangkat untuk semua role: user biasa hanya miliknya, Management/NSM seluruh organisasi; relasi lintas organisasi =404. Konfirmasi revoke memakai popup. Logout mencoba revoke server dan membongkar state lokal; kegagalan jaringan ditampilkan sebagai revoke belum terkonfirmasi. Browser memeriksa sesi setiap30detik saat terlihat/focus, sedangkan API menolak sesi revoked langsung. State dan token browser terikat identitas, respons dari akun yang berubah ditolak. Offline domain cache/outbox belum ada; WEB-035 masih harus mengisolasi storage draft/sync.



Gate admin nonlocal memerlukan verified JWT second-factor; client flag tidak diterima. Firebase TOTP memerlukan Identity Platform, dengan kelayakan Spark/kuota/billing proyek belum terverifikasi. Tidak mengaktifkan layanan berbayar. MFA enrollment/challenge/recovery dan Firebase nyata belum dibangun/diuji: status gate pending_project_verification, rollout admin penuh ditahan. Role approver baru harus masuk policy saat approval dibangun. Rincian dan sumber provider ada di AUTH_SETUP.md.



Validasi: empat test groups baru mencakup binding/ownership/tenant, hash dan sanitasi audit, per-device revoke, reauth floor, MFA admin dan recent auth, expiry, activity throttling, rate limit dan mapping user nonaktif. Total14testgroups lulus. Browser dua konteks membuktikan revoke perangkat kedua menghasilkan401/login, perangkat pertama tetap aktif, logout mencabut backend, login baru/reload berhasil, popup alasan dan320/390/768/1440 tanpa overflow/pageerror. Sesi QA dari uji browser terakhir dicabut. Bukti: test-results/web011-sessions.cjs dan web011-sessions.png. Deployment produksi belum dilakukan.





## WEB-012 — master account, outlet, contact dan lokasi



Implementasi lokal 18 Oktober 2026. Customer kini memiliki tab Outlet, Account dan Kontak. Daftar/ringkasan menjadi tampilan awal; Management/NSM mendapat tombol tambah di kanan atas, form tambah/edit, detail outlet dan konfirmasi arsip dalam popup bersama. Role lainnya hanya membaca data dalam scope. Nama/owner, status rolling90, tier yang belum dikonfigurasi, actual invoice dan detail tetap tersedia. Filter area, status customer, status aktif/nonaktif outlet dan status koordinat tersedia; pencarian/filter ini dijalankan pada daftar yang telah dibatasi server.



Migration0009 membuat legal account dan contact, menambah relasi account/outlet, version, status record, satu pasangan koordinat, status/catatan lokasi, tipe outlet, frekuensi layanan dan jam menerima kunjungan. Satu account dapat mempunyai banyak outlet; tiap kontak terikat satu outlet. Status aktif/nonaktif master outlet berbeda dari lifecycle Aktif/Churn berbasis invoice. Tidak ada hard delete. Account dengan outlet aktif tidak dapat diarsipkan; outlet dinonaktifkan melalui PUT. Kode account wajib, kode ERP outlet opsional dan unik dalam organisasi; kode di-trim dan dibuat uppercase. Nomor yang sama boleh dipakai di beberapa outlet/contact tanpa merge otomatis.



Migrasi tidak menebak hubungan badan usaha data lama: account placeholder diberi needs_review. Kode ERP duplikat lama tetap disimpan, diberi external_code_review dan tidak dihapus/diubah paksa. Koordinat lama tidak otomatis menjadi verified. Seed diperbaiki supaya dapat diulang setelah migration baru tanpa konflik trigger role dan tanpa menimpa koordinat yang sudah diubah. Review duplikat, merge dan alias ID adalah WEB-014 (walaupun endpoint merge disebut dalam daftar API WEB-012 pada rancangan awal); endpoint merge pada tahap WEB-012 belum diaktifkan; kini sudah tersedia melalui WEB-014 di bawah.



API tersedia: GET/POST /api/accounts, GET/PUT /api/accounts/:id, POST archive; GET/POST /api/contacts, GET/PUT detail, POST archive; GET/POST /api/customers, GET/PUT detail dan GET /api/customers/:id/timeline. Semua domain tetap memerlukan Firebase identity + sesi WEB-011. Mutation Management/NSM saja, strict validation, Idempotency-Key dan If-Match untuk update/archive, dengan mutation/audit/dedupe atomik. Relasi lintas organisasi ditolak; account/outlet/area/contact guard juga diperiksa pada SQL. Snapshot kontrak implementasi lokal: specifications/customer-api.web012.openapi.json; bukan keseluruhan API produk masa depan.



Koordinat disimpan integer E7 dalam rentang geografis, wajib berpasangan, nilai0 sah. Tanpa koordinat tetap masuk daftar/total. Status lokasi missing/unverified/verified; verified adalah verifikasi manual dan memerlukan catatan, bukan bukti GPS perangkat. Perubahan koordinat melalui UI mengembalikan status ke unverified. Peta hanya mem-pin outlet operasional aktif yang mempunyai lokasi; jumlah outlet aktif tanpa koordinat dan outlet nonaktif diberitahukan, semuanya tetap tersedia di daftar Customer. Tidak menambahkan geocoding, routing, atau provider berbayar.



Kontak menerima format Indonesia0/62 serta internasional+/00, menyimpan E164 (8–15 digit). Management/NSM melihat nomor lengkap; role lain hanya masked phone_display dan tidak menerima permission_note. Izin unknown/allowed/denied/dnc dicatat manual; status selain unknown memerlukan catatan. Jika field izin tidak disertakan pada update nomor yang sama, status lama termasuk DNC tetap dipertahankan. Mengganti nomor mengembalikan izin ke unknown; izin nomor baru dicatat pada update berikutnya. Ini belum menjadi mesin contact_preference/cooldown/DNC global; aksi panggilan tetap nonaktif sampai modul TEL dibangun.



Timeline memproyeksikan perubahan master outlet, invoice tervalidasi sesuai atribusi/scope, dan aktivitas yang diizinkan; maksimal100 terbaru dengan has_more. Timestamp legacy SQL dinormalisasi UTC; tanggal invoice tetap terpisah. Timeline tidak menampilkan payload audit mentah/nomor kontak. Perubahan area outlet yang sudah mempunyai assignment/invoice/target ditahan sampai workflow transfer WEB-015. UI tidak mengubah owner/invoice historis melalui form master. Jadwal/frekuensi saat ini hanya data preferensi, belum menghasilkan agenda otomatis.



Validasi:19automatedtests lulus termasuk phone normalization, kode unik, pasangan/rentang koordinat dan titik0, replays/conflicts/stale versions, izin role/tenant, shared number, masking nomor, DNC preservation/reset, scope account counts/timeline, proteksi atribusi area invoice, dependensi arsip, migrasi legacy duplikat dan seed ulang. Browser lokal menjalankan account→2outlet→2kontak dengan nomor sama; error koordinat mempertahankan draft, edit/reload mempertahankan GPS, verifikasi manual, archive dependency, timeline dan320/390/768/1440 tanpa overflow/pageerror. Data QA diinaktifkan/diarsipkan melalui API; tidak ada record yang dihapus. Bukti: test-results/web012-customers.cjs, web012-customers.png, web012-cleanup.cjs, web012-final-ui.cjs dan web012-customers-final.png. TypeScript/build lulus; warning chunk MapLibre besar yang sudah ada masih tersedia untuk optimisasi berikutnya. Firebase nyata, import sumber transaksi, merge, assignment transfer dan acceptance produksi belum termasuk; tidak ada deployment cloud.





## WEB-013 — import customer/produk, sumber asli dan error per baris



Implementasi lokal 18 Oktober 2026. Menu Import & duplikat untuk Management/NSM menyediakan daftar 100 batch terbaru, katalog produk, tombol import di kanan atas, popup pemilihan file, mapping, dry-run dan review/commit. Format pilot: CSV UTF-8 (BOM didukung), delimiter koma/titik koma/tab, quoted multiline/escaped quotes, maksimum512KiB/200baris data dan40kolom. XLSX, impor invoice, user/assignment/target, auto-create account dan penjadwalan sinkronisasi belum termasuk. Customer import mewajibkan kode ERP, nama, alamat, account_code yang sudah terdaftar, dan area_id aktif. Produk mewajibkan SKU/nama/base_unit; group_code opsional masih metadata, belum relasi product_group/KPI. Tanggal source_date yang dipetakan harus ISO valid; bukan bukti cutoff transaksi/keberhasilan ERP sync.



Migration0010 menambah product, import_file, master_import_batch dan master_import_row. Master batch dipisahkan dari importer transaksi keuangan masa depan. File asli disimpan pada binding IMPORT_FILES R2 dengan kunci acak dalam namespace organisasi, SHA-256, ETag, ukuran, nama dan waktu upload server; D1 menyimpan manifest/staging, bukan bytes sumber. Unggahan identik dideduplikasi per organisasi/checksum. Pengakuan D1 yang hilang setelah insert tidak menghapus objek sumber yang sudah direferensikan. File sumber hanya dapat diunduh oleh Management/NSM organisasi yang sama; bytes diverifikasi SHA-256 saat dry-run dan download, ETag saat commit. Sumber disajikan sebagai attachment/octet-stream dengan nosniff.



Retensi: retention_hold=1, retain_until belum ditetapkan; tidak ada penghapusan otomatis sampai organisasi menetapkan kebijakan dan prosedur legal hold. Ini gate sebelum go-live, bukan klaim retensi perusahaan sudah disetujui. R2 lokal telah diuji; bucket cloud nyales-import-sources belum diprovision/deploy. Tidak mengaktifkan layanan berbayar. Orphan reconciliation/expiry job umum mengikuti pekerjaan operasi-retensi berikutnya; failure yang belum mempunyai manifest tidak diberi label upload berhasil.



Dry-run memeriksa header, mapping field wajib, lebar baris, tipe/rentang, tanggal, kode berulang dalam file, kode ambigu/alias, parent account/area, status, panjang field dan satuan produk. Staging invalid memuat error per baris (nilai error dibatasi2000karakter/field; sumber asli tetap utuh). Kosongnya koordinat pada CSV tidak menghapus GPS yang sudah tersimpan; koordinat baru tetap unverified. Update base_unit produk yang berbeda ditahan untuk review; tidak ada konversi kuantitas/harga. Preview memperlihatkan aksi baru/perbarui/tidak berubah/ditolak serta nilai yang akan diterapkan. Baris error dapat diunduh sebagai CSV dengan formula-neutralization. CSV sumber asli tidak ditulis ulang.



Commit strict menolak batch dengan error; operator dapat mengonfirmasi baris valid saja, menghasilkan status partial dan jumlah valid/error yang jelas. Seluruh baris valid diterapkan dalam satu transaksi D1 set-based (maksimum200), dengan snapshot version resource/parent, cek kode unik dan validasi ulang referensi. Perubahan setelah dry-run, konflik kode, source berubah atau territory berhistori menggagalkan seluruh transaksi valid-row tanpa penerapan separuh tersembunyi. Validasi ulang menghasilkan snapshot baru dari sumber yang sama. Commit, staging applied, audit row/batch dan idempotency atomik; retry tidak membuat record/audit row ganda. Source lama yang sudah menjadi alias tidak membuat ulang outlet; perlu menggunakan kode kanonik.



API: POST/GET source /api/import-files, GET /api/master-imports/template/:kind, GET/POST /api/master-imports, GET detail dan /errors, GET /api/products. Idempotency-Key untuk dry-run/commit; commit memakai If-Match batch. Binding Firebase+device-session tetap wajib; semua operasi import/produk di modul ini Management/NSM. Kontrak implementasi ada di specifications/operations-api.web013-014.openapi.json. Binding dan query telah diuji lokal; free-plan capacity/CPU dan akun Firebase/cloud asli belum diterima sebagai produksi.



## WEB-014 — review duplikat, merge dan alias ID



Menu Review duplikat mengusulkan kandidat dari kode ERP, nama+alamat, nomor kontak sama, atau nama+koordinat berdekatan. Nomor sama bukan bukti lokasi sama, dan tidak ada auto-merge. Kandidat maksimal200 dengan has_more; alias menampilkan200terbaru. Review manual tersedia tanpa kandidat. Popup membandingkan alamat/koordinat, account/area dan jumlah relasi, serta mewajibkan alasan, konfirmasi lokasi yang sama dan pilihan outlet yang dipertahankan. Management/NSM saja, dengan source If-Match dan surviving_version.



Migration0010 menambah customer_alias dan merged_into_id; migration0011 membuat proteksi territory memperhitungkan seluruh keluarga alias. Merge mensyaratkan organisasi/account/area sama, outlet aktif/kanonik berbeda, dan tidak ada benturan rep per kanal pada interval assignment aktif/terjadwal. SQL transaction mengunci kedua versi dan memeriksa benturan kembali. Sumber menjadi inactive/alias; invoice, activity, target, contact dan customer_assignment tetap memakai ID fisik asal. Tidak ada hard delete, pemindahan invoice.rep_id/area/channel atau penggabungan consent kontak. Sumber dan target diaudit. Merge berantai meratakan alias ke outlet kanonik terakhir.



Daftar customer hanya menghitung outlet kanonik; actual/last invoice/owner/timeline mengacu keluarga alias tanpa join pengganda. Invoice totals tetap mengikuti atribusi invoice dan scope role. GET ID lama mengembalikan outlet kanonik yang diizinkan serta meta requested/canonical/alias_resolved. Customer scope, queue telesales, kontak, account counts dan peta mengikuti resolusi alias. Nomor/consent kontak tetap terpisah; nomor full tetap Management/NSM saja. Kontak historis di source tetap dapat diperbarui tanpa memindah customer_id aslinya. Form master tidak dapat mengedit source yang sudah digabung, mengganti kode ERP kanonik yang sudah beridentitas, atau memindahkan area dengan histori dari salah satu alias. Penetapan kode pertama pada kanonik tanpa kode tetap diizinkan.



Kode legacy yang ambigu tidak dihapus. Merge menyelesaikan review kode bila tidak ada outlet kanonik lain yang masih bertabrakan; kasus berbeda badan usaha/lokasi harus diperbaiki di master/territory, bukan dipaksa merge. Workflow WEB-015 yang akan dibangun wajib memeriksa assignment seluruh keluarga alias; tidak boleh hanya tabel outlet kanonik. Global contact-preference/DNC mesin panggilan tetap pekerjaan TEL, bukan diaktifkan oleh merge. Source ERP correction/undo merge dan bulk merge belum tersedia; record/audit asal tetap tersimpan.



API: GET /api/customer-duplicates, GET /api/customer-aliases, GET /api/customers/:id/merge-preview?surviving_customer_id=..., POST /api/customers/:id/merge. Semua melalui role, organisasi, device-session dan idempotency; lintas organisasi404, role lain403, versi stale412, benturan409. Kontrak WEB-012 diperbarui untuk menunjuk kontrak merge yang kini tersedia.



Validasi WEB-013/014:27automatedtests mencakup CSV/parser/formula, original bytes, upload checksum/dedupe/acknowledgement ambiguity, strict/partial commit/retry, 200-row atomic commit dan audit unik, field/date/reference errors, snapshot/source/territory conflicts, canonical aliases, permissions/tenant isolation, owner collision, old-ID/queue/timeline/account scope, consent independence, merge chain serta perlindungan invoice/assignment mentah. Browser dengan Worker/D1/R2 lokal membuktikan unduh template, mapping, error export, byte-identical original download, partial customer import, full product import, konfirmasi merge, resolusi alias, consent terpisah dan320/390/768/1440 tanpa overflow/pageerror. Data QA telah inactive/archived melalui API; original CSV, batch, alias dan audit sengaja dipertahankan. Bukti: test-results/web013-014.cjs, web013-014-cleanup.cjs, web013-imports.png, web014-merge-review.png dan web014-aliases.png. Build/TypeScript dicek; warning bundle MapLibre besar tetap pekerjaan optimisasi. Tidak ada deployment cloud/acceptance produksi; gate MFA, retensi dan load/capacity nyata tetap berlaku.



Pemeriksaan akhir WEB-013/014: 27/27 tests lulus dan npm run build (termasuk tsc --noEmit) lulus. Smoke browser terakhir memeriksa preview nilai per baris, sumber asli ber-BOM, dialog pada 320/390/768/1440, penolakan merge lintas account/area, alias historis dan logout tanpa page error. Bukti tambahan: test-results/web013-014-final.cjs, web013-preview-final.png dan web014-blocked-mobile.png. Server lokal berjalan di http://127.0.0.1:5180/.





## WEB-015 — distribusi, assignment dan transfer territory



Implementasi lokal 18 Oktober 2026. Menu Distribusi sales menyediakan kanal lapangan/telesales, filter area, sales, assigned/unassigned dan pencarian nama/kode ERP. Customer kanonik memakai PIC lapangan dan supporting telesales terpisah; telesales tidak mengganti owner lapangan. Customer unassigned tetap ditampilkan dalam scope. Customer nonaktif diberi label. Tombol Atur penugasan berada di atas card, form/histori memakai popup; form awal tidak terbuka. Management/NSM saja yang mengubah konfigurasi. Role operasional membaca distribusi/histori sesuai scope; Area Manager tidak mendapat area lain, Sales Rep melihat areanya atau assignment, histori rep/subtree/kanal dibatasi lagi. Tidak menyediakan ekspor baru.



POST /api/customers/:id/assignments menerima rep_id nullable (lepas PIC), area_id, channel, effective_from_date dan reason. Perubahan area wajib menyertakan other_channel_rep_id eksplisit (boleh null) karena kedua kanal ditutup pada tanggal efektif dan ditetapkan ulang. Transfer owner biasa hanya menutup kanal terpilih. Start inklusif, end eksklusif; tidak ada backdate. Tanggal dengan assignment yang mulai pada/sesudahnya ditolak agar histori dan jadwal yang ada tidak ditimpa. Jadwal lanjutan harus setelah jadwal terakhir. Hanya satu transfer area pending per customer; perubahan berikutnya/merge/arsip outlet ditahan sampai berlaku. Cancel/reschedule, koreksi retroaktif, bulk transfer dan preview dampak target belum tersedia di pilot ini.



PIC baru harus user aktif dengan role SALES_REP/field atau TELESALES/telesales, area scope tanpa tanggal akhir untuk assignment berkelanjutan, dan tepat satu Supervisor aktif dengan kanal sesuai pada tanggal efektif. Role PIC juga harus mencakup assignment berkelanjutan; perpindahan hirarki ke area lain yang sudah terjadwal membuat pilihan tidak eligible. API assignment-options memfilter pilihan, commit memeriksa ulang di SQL. Supervisor/Area Manager tidak otomatis menjadi owner lapangan. Lengkapi User & Hirarki sebelum memilih PIC: data demo lama tidak otomatis diperbaiki menjadi hirarki perusahaan. User nonaktif/perubahan role/area hirarki ditahan bila masih mempunyai customer assignment aktif/terjadwal yang bertentangan; alihkan customer dahulu.



Semua interval aktif/terjadwal pada keluarga alias diperiksa, tidak hanya ID kanonik. Penutupan interval menyimpan ended_reason, ended_by dan ended_at; identitas/awal/kanal/PIC asal tidak diubah. Assignment baru ada pada ID kanonik. Guard SQL mencegah overlap owner per kanal dan tenant silang; data legacy dengan satu PIC sama pada beberapa alias tetap ditelusuri, reassignment menutup seluruh relasi keluarga tersebut. ETag customer, snapshot interval, role/ref, audit dan idempotency berada dalam transaksi atomik. Retry tidak menambah assignment/audit ganda; kegagalan transaksi mengembalikan versi dan semua interval lama. GET ID alias mengembalikan histori kanonik dengan metadata resolusi. Histori mencakup 200 assignment dan 200 transfer terbaru, has_more menjelaskan data lebih lama tetap disimpan; belum ada cursor/export histori.



Migration0012 menambah snapshot area/provenance assignment, event customer_territory_transfer dan guard; 0013 melindungi histori territory dari alias; 0014 menyimpan provenance penutupan. Area saat ini diterapkan dari event jatuh tempo dalam transaksi sebelum setiap resolusi scope domain, berdasarkan tanggal bisnis timezone organisasi. Perubahan hari ini berlaku pada transaksi penyimpanan; perubahan masa depan diterapkan sebelum request domain pertama pada/setelah tanggal efektif, tanpa bergantung timer browser. Version customer naik saat jadwal disimpan dan saat area diterapkan; audit territory_effective merekam tanggal efektif dan waktu penerapan sebenarnya. Tidak menjalankan cron/billing/cloud deployment. Area tujuan pending/outlet aktif tidak dapat diarsipkan. Master edit/import biasa tidak dapat melewati transfer workflow setelah ada histori, termasuk dari alias yang digabung.



Invoice, activity, target dan contact mempertahankan ID fisik, area/rep/kanal atribusi asal; tidak memindahkan invoice historis, target atau insentif secara otomatis. Current-area scope, customer list, account/contact visibility, queue dan peta mengikuti territory yang telah berlaku. Timeline memberi label penugasan/transfer yang dapat dibaca. Merge menolak pending territory; histori transfer yang sudah berlaku tetap terbaca melalui keluarga alias. Seed dapat diulang setelah interval seed ditutup/diganti, tanpa membuka kembali penugasan lama.



Kontrak lokal: specifications/assignment-api.web015.openapi.json. Validasi: 34 tests lulus, mencakup boundary tanggal, idempotency/version/scope, kanal terpisah, unassign, pilihan PIC, penolakan role/area/Supervisor tidak sesuai, keluarga alias, guard histori, rollback transaksi, applied-once dan atribusi fakta tetap sama. Browser Worker/D1 lokal memeriksa popup, transfer area dengan kedua kanal unassigned, histori, filter assigned/unassigned dan lebar320/390/768/1440 tanpa overflow/pageerror. Pemindahan ke PIC nyata diuji pada integration tests dengan SQLite/D1 adapter; browser memakai fixture area tanpa PIC agar tidak mengubah hirarki demo. Fixture account/outlet QA diinaktifkan/diarsipkan melalui API, event dan audit dipertahankan. Bukti: test-results/web015.cjs, web015-transfer.png, web015-history.png, web015-mobile.png. Build/TypeScript lulus; warning chunk MapLibre besar masih ada. Verifikasi produksi/Firebase/MFA dan kapasitas cloud belum termasuk.



Pemeriksaan UI akhir WEB-015: field filter memakai kontrol rounded/font yang konsisten dengan design system. Daftar awal hanya outlet aktif; filter status outlet membuka histori nonaktif. Histori seed dan popup edit terbaca, versi mobile390px tidak overflow, logout berhasil tanpa pageerror. Bukti: test-results/web015-final.cjs, web015-desktop-final.png dan web015-mobile-final.png. Build terakhir mencakup provenance penutupan dan label timeline.





## Penyelesaian implementasi lokal sisa M1 — WEB-016,019–024



18Oktober2026. Halaman Peta customer mempunyai filter area/sales/kanal/status, tabel seluruh outlet dalam scope termasuk tanpa koordinat/nonaktif, tombol fokus pin, posisi sales last-received beserta timestamp/source/accuracy/umur. GET /sales/last-positions memakai scope yang sama. Timestamp future/invalid tidak menjadi umur0. Tidak ada routing, ETA atau tracking Android yang dipalsukan. Basemap bisa diatur melalui MAP_TILE_URL dan MAP_ATTRIBUTION di environment; fallback OSM lokal tetap memerlukan provider/capacity acceptance. Error tile ditampilkan eksplisit; ilustrasi jalan CSS dihapus agar bukan pengganti basemap nyata. Tidak ada provider berbayar/key baru diaktifkan.



WEB-019: kontrak mapping sumber, CSV template, integer IDR exponent0, header/line/credit dan source-version ada di INVOICE_SOURCE_MAPPING.md. Adapter menerima CSV atau JSON, sumber asli privat R2 tetap ber-checksum/hold. Fixture sales end-to-end disalin ke tests/fixtures tanpa memasukkan transaksi masa depan ke D1 operasional. Sumber perusahaan dan semantik pajak/diskon/ongkir/net belum diverifikasi, sehingga integrasi sumber nyata tetap pending_input.



WEB-020: Produk & harga mendukung create/edit/archive produk dan kelompok, SKU unik/immutable, quantity_scale eksplisit, kelompok aktif dan harga efektif dengan sumber. UI form/pengaturan harga/arsip dalam popup, tombol di kanan atas. Harga lama ditutup dengan interval akhir eksklusif, tidak ditimpa; perubahan unit/scale yang mempunyai invoice/price history ditolak. Product import memakai group_code aktif yang sudah ada dan scale; produk legacy tanpa kelompok ditandai belum dipetakan. Stock dan credit eligibility tetap null/belum tersedia. Schema product memakai inactive sebagai arsip; group memakai archived.



WEB-021: dry-run terpisah dari commit; job menyimpan request/hash/source/refepoch/plan/error/summary, dan endpoint detail/errorCSV/validationJSON. Batas pilot512KiB,200record gabungan,100invoice; strict batch tanpa partial invoice commit. Mapping ambigu masuk needs_review. Commit memerlukan payload/hash/job/version sesuai validasi serta reference epoch belum berubah, memverifikasi ulang checksum sumber. Writes set-based satu transaksi bounded, bukan SQL per row; invoice/current flags/line/credit/source-event/audit/job/idempotency atomik. Maximum100invoice fixture teruji. Job merupakan staging sinkron lokal, bukan klaim worker queue/background scalable.



WEB-022: revisi immutable, satu versi berlaku per org/source/external-ID, credit unik dan berversi, linked-credit snapshot, net-includes-credit mencegah potong ganda. Retur merevisi periode invoice asal. Cancelled/draft/needs_review dikecualikan actual. Source header dan eligible net terpisah. finance_period_lock + finance_adjustment pending_review mendukung hook periode final; statement final belum dibangun, modul berikutnya wajib menulis lock dan mengonsumsi adjustment, bukan menganggap hook ini pembayaran/approval final. Line menyimpan unit/scale serta product/group snapshot; revisi credit/koreksi mempertahankan klasifikasi line historis.



WEB-023: attribution resolver mengutamakan Rep sumber sah, fallback assignment pada tanggal invoice, memeriksa area territory historis/role/scope/channel dan konflik owner. Konflik ditahan sebagai row review. Tidak ada atribusi ganda lintas kanal atau perubahan invoice lama ketika customer transfer. Versi sumber pilot harus integer positif monotonic; timestamp/non-numeric version memerlukan adapter sumber eksplisit. Payload sama pada versi sama/retry no-op; payload berbeda pada versi sama ditolak. Identical duplicates dalam batch tidak dihitung ulang.



WEB-024: daftar/detail/revision, periode/channel/area/rep/status filter, totals organisasi/kanal dan export admin. Detail root memakai ID current; histori tersedia melalui current/revisions dan dibatasi lagi menurut scope tiap versi. SQL actual pada dashboard/customer/status/timeline memakai is_current=1, tidak menjumlahkan revisi lama. List200terbaru, totals seluruh hasil, ekspor maksimal5000match, metadata periode/filter/timezone/scope/cutoff. Refresh/batch error tidak mengubah last successful sync. Original source cutoff dan commit time terlihat, mode manual tidak disebut real-time. Order belum menghasilkan actual.



Migration0015 menambah katalog/harga, invoice version/current identity/source ledger/line/credit/job/epoch/final-period hook;0016 product classification snapshots + indeks invoice current. Migrasi legacy menyimpan semua row, memilih row terakhir per identity sebagai current dan menandai collision needs_review agar tidak diam-diam menghitung ganda. Tidak mengklaim urutan source_version legacy sebagai versi sumber yang terbukti benar. Tidak ada remote migration/deploy.



Validasi:45/45automatedtests lulus. Fixture Rp160juta = lapangan Rp135juta + telesales Rp25juta, cancelled/retry/retur Rp5juta dan tanggal transfer owner lulus. Uji private source bytes/CSV/error/hash/stale snapshot/rollback/multi-tenant/scope/export/100invoice/credit cancellation/final-period adjustment/product group frozen lulus. Browser nyata Worker/D1/R2 lokal: kelompok→produk→harga→CSV(header+2line+credit)→dry-run/commit→revisi→export→mapfilter/focuspin, lebar320/390/768/1440 dan popup mobile tanpa pageerror. QA invoice dibatalkan melalui revision, master diarsipkan, total actual dikembalikan; source/revisions/credit/jobs/audits dipertahankan. Browser akhir membuktikan unknown customer masuk needs_review/errorCSV dan commit tidak tersedia, last-sync tidak berubah, map fallback bukan ilustrasi jalan, chart bar Overview tetap ada. Bukti test-results/m1-complete.cjs,m1-final.cjs beserta PNG. Build/TypeScript lulus; warning chunk MapLibre besar masih terbuka. Status keseluruhan M1 dan gate ada di M1_STATUS.json/md; baseline perencanaan tidak dipalsukan menjadi production accepted.



18Oktober2026 — perapihan data contoh:29nama master lokal demo-org yang berawalan QA diganti menjadi nama outlet/account/produk/kontak/cabang/area/kalender yang terbaca. Audit rename_demo_display dan manifest before/after berada di test-results/demo-name-changes.json; identitas/relasi/status arsip dan provenance transaksi tetap. Customer memakai kode eksternal sebagai identitas sekunder, tombol singkat Lihat/Edit/Arsipkan berjarak dengan aria-label nama, serta default outlet aktif. Katalog menyediakan filter Aktif/Diarsipkan/Semua, default aktif. Catatan sumber harga QA ditampilkan sebagai Daftar harga contoh; nilai provenance aslinya disimpan. Browser demo-names-ui.cjs lulus.



## Perencanaan 23 Oktober 2026 - Plan Visit Generator lokal

PRD, backlog MD/JSON dan status M4 mencatat WEB-069–074 sebagai M4 extension P1 Planned. Compute awal OSRM + Python OR-Tools pada komputer pribadi, agent outbound ke Workers; D1/R2 tetap, PostGIS/Cloudflare Containers belum diperlukan. Kontrak/data model, agent/routing, harian, bulanan/multi-sales, UI review/publish dan QA/operasi menjadi urutan pembangunan. Tidak ada pemasangan/runtime baru; tidak menambah gate pilot web atau Android. [Spesifikasi PVG](specifications/Plan_Visit_Generator_v1.md).


## WEB-063 tersedia lokal - 23 Oktober 2026

Pengaturan → Batas wilayah menyediakan import/resume draft dan review aktivasi dataset berversi. Backend: delapan operasi admin, migrasi 0035/enam tabel, R2 geometry privat/full topology/checksum, source/manifest count, ETag/idempotency/audit. 143 tests, build dan dua browser scenarios lulus; full D1/R2 restore termasuk batas wilayah lulus. Sampel enam kelurahan Gambir tetap draft; metadata/namespace/hak penggunaan/provider capacity belum diterima. Tidak mengubah customer/invoice/target/owner. WEB-064 overlay/matching berikutnya. [Runbook/evidence](WEB063_ADMIN_BOUNDARIES.md).


## WEB-067 — risiko pelanggan lokal, 24 Oktober 2026

Pengaturan kebijakan berversi dan popup, mode Risiko di Peta & Wilayah, immutable private evidence/history dan scoped customer drill tersedia. 183 tests, 3 browser scenarios, TypeScript/build dan recovery utama 96 tabel + QA 2 risk snapshots lulus. Pilot utama tetap tanpa policy/run risiko dan sumber nyata draft; fakta komersial tetap. Tidak ada cloud/production acceptance. Berikutnya WEB-068 pemerataan/simulasi beban. [Runbook/evidence](WEB067_RISK_DESIGN.md).

## WEB-068 — beban layanan dan simulasi wilayah lokal, 24 Oktober 2026

Pengaturan → Beban & kapasitas dan Distribusi sales → Beban & simulasi tersedia lokal. Policy bulanan eksplisit per kanal, seluruh portfolio sesuai scope, customer/kontak/menit/kapasitas terpisah, unknown/partial tidak menjadi spare capacity. Preview/save/history immutable/revisi dan apply satu batch WEB-065 lalu revalidate sisa, dengan tanggal efektif, scope/SPV/hash/epoch/ETag/idempotency/audit. 0041 menambah empat tabel; private R2 menyimpan bukti, tidak menduplikasi geometry. 276 operasi runtime terhubung kontrak. Histori fakta komersial tetap; pilot utama tanpa default policy/scenario dan sumber nyata draft. Recovery database/R2 serta browser diverifikasi lokal. Provider/cloud/human acceptance tetap pending. [Runbook](WEB068_WORKLOAD_DESIGN.md), [evidence](WEB068_EVIDENCE.json). Berikutnya WEB-069 kontrak dan model Plan Visit Generator.
## WEB-067 dimulai — 24 Oktober 2026

[Desain](WEB067_RISK_DESIGN.md), validator dan pure risk engine tersedia; sembilan unit tests lulus. Tidak memasang kebijakan bisnis/default aktif. API, policy/run persistence, snapshot R2/recovery dan mode Risiko masih dikerjakan; bukan fitur selesai. WEB-065/066 sudah terverifikasi lokal seperti catatan di bawah.

## 24 Oktober 2026 — WEB-066 kinerja dan coverage wilayah

Mode Kinerja/Coverage, choropleth teal/unknown berpola, bucket belum terpetakan, sumber customer/invoice/aktivitas/target/kinerja sales dan CSV snapshot tersedia lokal. Ringkasan Overview/Monitoring dan back navigation mempertahankan filter. Basis mapping read-cutoff konsisten untuk dua periode; target sales/area tidak diprorata. 164 unit/integration tests, 2 browser analytics + 4 regresi, TypeScript/build dan restore 94 tabel/1 PDF/1 chunk lulus. Pilot komersial tetap, sumber nyata masih draft. [Runbook](WEB066_REGIONAL_ANALYTICS.md), [evidence](WEB066_EVIDENCE.json). Berikutnya WEB-067; cloud/provider/human acceptance pending.

## 24 Oktober 2026 — WEB-065 pembagian kelurahan dan sales

Membership area dan preview/commit assignment bertanggal tersedia lokal di Distribusi sales, hanya Management/NSM. Epoch/hash/ETag/idempotency, konflik, role/area/SPV, satu owner per kanal dan audit diperiksa; transfer area meninjau kedua kanal. 156 tests, dua browser flows, regresi peta dan restore 94 tabel/1 PDF/1 chunk lulus. Data komersial pilot tetap, sumber nyata masih draft. [Runbook](WEB065_DISTRIBUTION.md), [evidence](WEB065_EVIDENCE.json). Berikutnya WEB-066; acceptance provider/cloud/human tetap terbuka.

## 24 Oktober 2026 — WEB-064 Peta & Wilayah

Overlay, pencarian hierarki, pemetaan penuh JSTS, review/riwayat revisi dan daftar pelanggan scoped tersedia lokal. 149 tests, dua browser flows dan restore 92 tabel/1 lampiran/1 chunk batas lulus; 80 invoice dan actual Rp36.520.000 tetap. Sumber nyata enam kelurahan tetap draft. Periode pada peta adalah konteks; analitik wilayah menyusul WEB-066. Engineering berikutnya WEB-065; human/Firebase/provider/cloud acceptance tetap pending. [Runbook](WEB064_GEOGRAPHY.md), [evidence](WEB064_EVIDENCE.json).

## 22 Oktober — backlog UI/UX dan analitik GIS

WEB-064 diperinci menjadi Peta & Wilayah pada kelompok Pelanggan: mode Sebaran, filter, panel desktop/mobile, drill-down, fullscreen dan aksesibilitas. WEB-065 merinci alur Distribusi sales dan preview sebelum/sesudah. WEB-066 kinerja/coverage didahulukan; WEB-067 risiko dan WEB-068 pemerataan/simulasi menyusul setelah dependensi masing-masing. WEB-066–068 merupakan M4 extension P1, bukan gate wajib pilot tim; staging/login per role tetap paralel. Target yang tidak teralokasi ke kelurahan tidak dibagi diam-diam, unknown tidak menjadi nol, fakta historis tetap. PRD, ERD catatan desain, backlog MD/JSON dan status diselaraskan. Seluruh perluasan masih Planned; tidak ada runtime/API/migrasi baru. [Spesifikasi dan delapan acceptance tambahan](specifications/GIS_UX_dan_Analitik_v1.md).

## 22 Oktober 2026 — sumber batas desa/kelurahan dipilih

Pengguna memilih file batas desa/kelurahan Indonesia: Geoportal Kementerian Pertanian layer ADMINISTRASI_DESAKELURAHAN_AR, sumber BIG menurut metadata, acuan Semester 1 Tahun 2025. PRD, addendum GEO-02, ERD dan backlog (MD/JSON) mencatat sumber yang sama. WEB-063 tetap Planned untuk verifikasi metadata/lisensi/namespace, pengambilan snapshot bertahap, checksum dan import. Belum mengunduh file atau mengubah aplikasi/database.

## 22 Oktober 2026 — perencanaan kelurahan/desa

Keputusan pengguna: batas administrasi kelurahan/desa menjadi dasar pembagian awal wilayah. CUS-04 diperjelas, addendum GEO-01–08 dan GEO-A01–08 ditambahkan, lima entitas ERD rancangan serta WEB-063–065 Planned diselaraskan di MD/JSON. Area bisnis dapat menggabungkan beberapa kelurahan; assignment tetap per customer/kanal, preview/commit Management/NSM bertanggal; perubahan boundary tidak memindahkan owner atau histori otomatis. Tidak ada migration, endpoint atau UI runtime baru. Validasi struktur JSON, relasi ERD, dependency/ID backlog, konsistensi MD dan preservasi 82 skenario UAT PASS. [Spesifikasi](specifications/GIS_Admin_Kelurahan_v1.md).

## 22 Oktober 2026 — stabilisasi pilot operasional dan full restore lokal

Pilot dummy sekarang memuat 8 kunjungan, 4 hasil telesales, 8 aktivitas bermakna (coverage 40%), 8 posisi, 3 follow-up dan satu lampiran sintetis. Role/assignment/DNC/lease/qualification/replay diperiksa melalui scoped-route rehearsal; browser membaca record yang dipublikasikan ke D1/R2 lokal. Seluruh invoice tetap sama. Backup aktual D1 dipulihkan ke namespace baru: 86 tabel, schema/history/guards dan 1 object R2 cocok; query Wrangler membaca 80 invoice, 12 aktivitas dan observed actual Rp36.520.000. 135/135 tests, TypeScript dan browser operasional PASS. Cakupan sumber tetap 21 Oktober: layar 22 Oktober menandai actual provisional secara benar. Tidak ada human training/sign-off, real role Firebase login atau cloud acceptance. [Runbook](WEB062_LOCAL_PILOT.md), [evidence](WEB062_STABILIZATION.json).

## WEB-062 — pilot dummy lokal aktif (21 Oktober 2026)

Pilot terisolasi di http://127.0.0.1:5183 memakai turunan sumber sintetis Oktober, D1/R2 tersendiri dan login demo lokal. Empat pilar diverifikasi: 20 pelanggan, 10 sales, 80 invoice/4 retur, actual Rp36.520.000 dan target leaf Rp80.000.000 plus reserve Rp200.000. Browser menyimpan cakupan sumber dan order, reload, membatalkan order, serta membuktikan seluruh nilai/status invoice tidak berubah. Dua belas halaman, tiga lebar viewport, 134/134 tests dan TypeScript PASS. Peta 2D/20 pin simulasi terlihat; aktivitas dan posisi sales belum diisi. Training manusia, real accounts/data/provider/restore dan go-live tetap pending. [Runbook](WEB062_LOCAL_PILOT.md), [evidence](WEB062_PILOT_EVIDENCE.json).

## 2026-10-21 · WEB-060 dummy rehearsal and WEB-061 training/handover materials

Completed the user-requested dummy scope with a separate 10-sales source JSON, customer/invoice CSVs, independent expected/database snapshots, canonical mapping, checksums and API rehearsal evidence. SQLite in-memory initializes synthetic masters/hierarchy, then executes finance dry-run/commit/retry and target creation/items/submission/independent approval through scoped application routes. 20 customers, 80 invoices, 4 credits, 2 targets; zero record diffs, September net Rp36.520.000, approved leaf Rp80.000.000 plus separate reserve Rp200.000. No preview/cloud writes or real login accounts.

WEB-061 now includes per-role guide, 12 SOPs, support/severity/incident flow, handover inventory, 15 human training cases and evidence validator. Materials prepared; human training, support assignment, provider/restore and named handover remain pending. 133/133 tests, TypeScript and build PASS. Existing large-bundle warning remains. [Dummy package](../pilot/demo-10-sales/README.md), [training](WEB061_TRAINING.md), [SOP](WEB061_SOP.md), [support](WEB061_SUPPORT.md), [handover](WEB061_HANDOVER.md).

## 2026-10-20 · WEB-060 read-only pilot reconciliation preparation

Added pilot manifest (PIC Rizky Aditya; Novely, Didik, Mursal; capacity 10, seven open slots), runtime-derived JSON schemas, snapshot/mapping templates and local npm run pilot:check. Record-level comparison, exact IDR BigInt aggregates, customer/owner/invoice/credit/target references, historical assignment, three-month history window, target leaf/reserve control, canonical/alias mapping, source hashes and fresh output directories are checked. Original sources and databases remain untouched. Synthetic ten-sales tests do not become real-pilot acceptance.

129/129 tests, TypeScript and production build PASS. Corrected a forecast leak regression assertion to inspect numeric JSON values rather than UUID/timestamp substrings. Actual manifest readiness is blocked with missing scope/identity/source inputs; data totals remain null. No actual migration, real account provisioning, source adapter deployment or business sign-off. [Runbook](WEB060_PILOT.md), [manifest](../pilot/pilot-01/manifest.json).

## 2026-10-20 · Spring pada navigasi workspace

Lebar pill kini mengikuti lebar teks yang diukur, dengan spring teredam (stiffness 420, damping 38, mass 0.85) untuk membuka/menutup secara bersamaan. Menggantikan animasi max-width 200px yang membuat timing label pendek/panjang berbeda. Label tetap pada posisi ikon yang stabil; fade singkat dan press feedback menyertai geometri, tanpa blur tambahan. Spring dapat berbalik dari posisi/kecepatan berjalan ketika pilihan berubah cepat. Scroll pilihan aktif mengikuti perubahan ukuran setiap frame melalui ResizeObserver, menggantikan jeda 600ms dan lompatan scroll. Reduced motion meniadakan spring dan press scale. Warna, glass, ikon dan perilaku tab di dalam halaman dipertahankan.

TypeScript dan production build PASS. Browser terarah PASS: 40 sampel frame, gerak membuka/menutup, pergantian cepat/berbalik, lima kelompok, viewport 320/390/768, keyboard, reduced motion dan tanpa page error. Evidence lokal: test-results/workspace-spring.json, workspace-spring-build.txt dan screenshot. Tidak ada perubahan API/data bisnis.

## 2026-10-20 · Navigasi workspace mengikuti sidebar

Navigasi atas pada seluruh kelompok hanya menampilkan ikon ketika tidak dipilih; pilihan aktif membuka label horizontal 550ms sambil label sebelumnya menutup. Glass dan warna dipertahankan, nama tetap tersedia melalui aria-label/title. Pada layar sempit container dapat digeser dan pilihan aktif ditampilkan penuh setelah transisi/resize. In-page tabs tetap mengikuti perilaku sebelumnya.

TypeScript/production build PASS. Pemeriksaan browser terarah pada lima kelompok, perpindahan horizontal, viewport 320/390/768, keyboard, reduced motion dan page errors PASS. Evidence lokal: test-results/workspace-compact.json serta screenshot desktop/mobile. Tidak ada perubahan API/data bisnis.

## 2026-10-20 · WEB-059 local automated UAT

121/121 regression tests, TypeScript/production build and 11/11 Chrome/Edge browser checks PASS; dependency audit 0 vulnerabilities. Isolated local fixture preserves the main demo state and auth rate limit. Fixed empty-state/supporting-text contrast, modal focus trap, tab keyboard navigation/skip link, Monitoring retry and Overview unknown-vs-confirmed-zero. Register preserves all 82 scenarios (53 web, 8 integration/P1, 21 Android); named business sign-off remains 0. No cloud deployment or production acceptance. Actual device/role/screen-reader/provider and restore gates remain. [Report](WEB059_UAT.md), [register](WEB059_UAT_REGISTER.json), [browser evidence](WEB059_BROWSER_EVIDENCE.json). Next preparation: WEB-060 real pilot data reconciliation.

## 2026-10-20 · WEB-058 local security review and regression



Same-origin guard/no cookie auth, actual-stream request limits, legal hold/report deletion claim/retry, recovery ETag/atomic review/replay/provenance and patched dependencies. 232 runtime operations linked to implementation contracts; all 230 nonpublic operations tested missing-bearer denial before DB. Added 16 regression tests; full suite 119/119 PASS, TypeScript/build PASS and npm audit 0 vulnerabilities. Evidence and production boundaries: [WEB058_SECURITY_REVIEW](WEB058_SECURITY_REVIEW.md). No cloud deployment, production acceptance, real provider MFA, actual restore or destructive business deletion. Next: WEB-059 UAT.



## 2026-10-20 · WEB-057 recovery local slice



Migration 0034 dan panel Recovery Management/NSM tersedia. Logical/attachment metadata backup menyimpan private R2 manifest dengan SHA-256, row/byte counts dan expiry. Restore drill membaca object, memverifikasi checksum dan merekonsiliasi row/attachment metadata tanpa write-back. Policy RPO/RTO/retensi, legal hold, privacy request review, retention preview dan migration rollback dry-run tersedia. Tidak ada penghapusan customer/invoice/order/outbox, tidak ada rewrite accepted order, dan tidak ada provider deployment.



Validation: `tests/recovery.test.ts` 4/4 PASS; full `npm test` 103/103 PASS; `npm run build` PASS. Local D1 migration 0034 applied. Runbook: [WEB057_RECOVERY](WEB057_RECOVERY.md). Production RPO15m/RTO4h, provider durability, cross-region restore, legal retention approval, privacy UAT dan actual deletion policy tetap gate sebelum go-live.



## 2026-10-20 · WEB-056 Monitoring capacity hardening



Monitoring organization-wide no longer rejects invoice/activity sources above 2.000. Server SQL aggregates KPI, channel, coverage, meaningful activity and per-rep actuals; browser receives 50-record previews. `/api/dashboard/sources` provides scoped keyset pages up to 100 rows with filter-bound cursors. Monitoring drill-down UI uses the paginated endpoint. Private CSV export reads the complete dataset and rejects >10.000 rows or >5 MiB UTF-8 before R2/report creation.



Validation: `npm test` 99/99 PASS; `npm run build` PASS. `tests/monitoring-capacity.test.ts` covers 2.600-row pagination, 1.000 customer/10.000 invoice/5.000 activity aggregation, merged-family and Area Manager scope, cursor binding, overflow, full CSV checksum, row/byte caps. `test-results/monitoring-capacity-v4.json` reports local SQLite summary mean ~69ms, source page ~20ms, rep filter ~23ms and five concurrent 200 responses. These are local regressions, not Cloudflare CPU/billing/SLA evidence. Production provider measurement, UAT and WEB-057 backup/restore/retention remain open.



## 2026-10-19 · Koreksi animasi sidebar horizontal



Shared slider vertikal sidebar dihapus. Masing-masing tombol kelompok kini menutup/membuka permukaannya sendiri secara horizontal: pilihan lama 124px ke 44px, tujuan 44px ke 124px, label fade/clip mengikuti lebar. Mobile 112px/40px. Easing 550ms tetap fluid, posisi vertikal tombol dan gutter konten stabil. Slider pada navigasi/tab/peta serta page entrance tetap dipertahankan.



Build PASS. test-results/sidebar-horizontal.cjs PASS: lebar awal/tengah/akhir membuktikan penutupan lama dan pembukaan tujuan; posisi y tombol dan x konten tetap, tidak ada shared rail slider, rapid switch benar, mobile tanpa overflow, reduced-motion instan, page errors kosong. Evidence sidebar-horizontal.json. Supersedes perilaku vertical rail pada entry Motion seluruh pill interaktif.



## 2026-10-19 · Fluid page entrance



Keyed page-scene menerapkan fade/rise 18px desktop dan 12px mobile, 550ms dengan easing pill yang sama. Judul, toolbar/filter, callout, KPI/content card, tabel dan peta memakai stagger maksimal 240ms. Shell tetap diam; mount card setelah fetch ikut animasi, tooltip rerender tidak memutar ulang entrance. Tidak ada antrean animasi per baris tabel atau penundaan fetch/interaksi. Transform kembali normal setelah selesai, reduced-motion meniadakan entrance.



Build PASS. test-results/page-entrance.cjs PASS: 18 halaman memiliki entrance, sampel opacity/translate nyata bergerak, 4 KPI async Overview masuk sekali, tooltip tidak replay, reduced-motion none, mobile tanpa overflow/page errors. Evidence page-entrance.json dan page-entrance-mobile.png. Tidak mengubah API/data atau styling visual statis.



## 2026-10-19 · Motion seluruh pill interaktif



Indikator 550ms/easing konsisten kini mencakup rail sidebar, navigasi workspace, seluruh tab halaman dan kontrol peta 2D/3D. Tombol aksi primary/secondary serta ikon memakai press scale 0.97 secara global, tanpa mengganti UI. Disabled dan reduced-motion ditangani. Badge informasi tetap statis; select native mempertahankan perilaku browser.



Build PASS. test-results/all-pill-motion.cjs PASS: rail vertikal dan kontrol peta menunjukkan posisi awal/tengah/akhir, alignment desktop/mobile, kontrol peta tetap absolute, press scale aktual 0.97, reduced-motion 0s, tanpa page errors/overflow. Peta memakai fixture vektor sintetis hanya untuk menguji kontrol tanpa ketergantungan layanan tile; bukan validasi provider atau geometri. Evidence all-pill-motion.json. Tidak mengubah API/data.



## 2026-10-19 · Animasi tab di dalam halaman



Shared LiquidTabs diterapkan pada 11 kelompok tab yang sudah ada, termasuk Statement/Skema/Peserta, Monitoring, customer, distribusi, katalog, invoice, pipeline, aktivitas, Hirarki/User, Pengaturan dan pengelolaan data. Gerakan 550ms/easing yang sama, tanpa mengganti warna/layout/role/callback. Koordinat x/y dan ukuran aktual mengikuti wrapping di mobile. Reduced-motion tetap didukung.



Build PASS. test-results/liquid-tabs.cjs PASS: perpindahan Statement ke Skema diukur pada posisi awal/tengah/akhir, 11 halaman diperiksa pada desktop dan 390px, alignment indikator mengikuti pilihan termasuk baris kedua, tanpa document overflow/page errors, reduced-motion 0s. Evidence liquid-tabs.json dan liquid-incentives.png. Tidak ada perubahan API/data.



## 2026-10-19 · Sliding navigation motion



Navigasi halaman atas memakai satu indikator aktif yang bergeser mengikuti tombol, dengan durasi 550ms dan easing cubic-bezier(0.22,0.9,0.25,1) dari contoh Uiverse pengguna (gleydson_9898). Gaya glass/charcoal dan layout NYALES dipertahankan. Label variabel diukur melalui ResizeObserver dan font readiness; reduced-motion menghapus animasi dan efek tekan. Tidak mengubah navigasi kelompok, API atau data.



Build PASS. test-results/liquid-nav.cjs PASS: posisi antara awal/akhir terbukti bergerak, durasi 0.55s, posisi/lebar indikator selaras dengan menu pada desktop dan mobile, reduced-motion 0s, page errors kosong. Evidence liquid-nav.json / liquid-nav.png. Preview lokal.



## 2026-10-19 · Circular rail dan glass recipe



Menu kelompok yang tidak aktif berbentuk lingkaran; menu aktif melebar menjadi pill dengan label melalui transisi 200ms. Gutter desktop tetap; mobile memakai strip scroll. Nama aksesibel, tooltip hover/fokus keyboard, serta reduced-motion tersedia. Workspace memakai gradasi radial mint–abu seperti login. Permukaan glass mengikuti contoh pengguna: white 34%, blur 9px, border white 30%, inner glow dan highlight tepi; ukuran komponen tetap responsif dan tooltip grafik tidak dipotong.



Build PASS. test-results/rail-glass.cjs PASS: 18 halaman, circle/pill dimensions, keyboard tooltip, reduced-motion, modal buka/tutup, semua halaman diperiksa pada lebar mobile, Overview 390/768/1280 tanpa document overflow, page errors kosong. Evidence rail-glass-verification.json dan rail-glass-*.png. Preview lokal saja.



## 2026-10-19 · NYALES Studio UI



Gaya referensi screenshot Behance diterapkan dengan Inter lokal, canvas abu netral, card putih, primary charcoal, grafik teal–mint dan slate–sage. Navigasi menjadi rail 5 kelompok dan pill halaman, tetap difilter capability; Overview tetap awal. Glass terbatas pada navigasi, kontrol peta, header popup dan login. Demo disclosure dapat dibuka. Seluruh API, data dan kalkulasi tetap memakai implementasi yang ada.



Build PASS. Browser lokal membuka 18 halaman, memeriksa overflow mobile tiap halaman, viewport Overview 390/768/1280, font Inter, modal buka/tutup dan tanpa page errors. Artefak: test-results/studio-ui-verification.json dan studio-*.png. Panduan: [UI_STUDIO.md](UI_STUDIO.md). Hanya preview lokal, bukan deploy atau acceptance produksi.



## 2026-10-19 · WEB-056 observability dan kapasitas lokal



Kesehatan sistem Management/NSM, structured API/job telemetry, request ID, D1 metadata subtotals/R2 attempts, owner/profil pilot, manual provider snapshots dan alert70/85/95 tersedia. Metrik/peringatan tidak auto-upgrade atau menghapus data. CPU/kuota cloud tetap unknown sampai ada evidence provider. Migrasi0033 lokal menambah4tabel ops dan index.



93tes dan build PASS; browser5concurrent requests, R2 export/download, D1meta, popup dan responsive PASS; data lama direkonsiliasi. Simulasi1.000 customer/10.000 invoice menemukan Monitoring organisasi>2.000source ditolak422; scoped per-sales berhasil. Ini capacity gate, bukan Accepted produksi. Lihat [M4_STATUS](M4_STATUS.md), [operational runbook](WEB056_OPERATIONS.md), [actual API](specifications/m4-observability-api.openapi.json). WEB057–062 tetap Planned.



## 2026-10-19 · Popup Google Street View



Tombol Lihat Street View tersedia pada popup pin customer di Overview/Peta customer dan baris customer berkoordinat pada halaman Peta customer. Endpoint authenticated GET /api/customers/:id/street-view memeriksa customerPredicate sebelum membaca konfigurasi; customer di luar scope 404, tanpa koordinat 422, key belum diatur 503. Respons no-store berisi URL Maps Embed streetview dengan koordinat tersimpan, radius 50m dan bahasa Indonesia. GOOGLE_MAPS_EMBED_API_KEY dibaca dari binding lokal .dev.vars yang diabaikan Git. Key tidak ditulis ke log/dokumentasi; penggunaan iframe tetap membawa key di browser sesuai desain Embed API, sehingga pembatasan API dan HTTP referrer di Google Cloud tetap diperlukan.



Iframe hanya dibuat saat popup dibuka dan dihapus saat ditutup; referrerPolicy strict-origin-when-cross-origin, fullscreen, tautan cadangan Google Maps tanpa key tersedia. Bila dibuka dari peta fullscreen, native fullscreen keluar dahulu supaya popup terlihat. Basemap OpenFreeMap/2D/3D tetap terpisah. Error cross-origin Google tidak bisa dideteksi andal oleh parent; pesan dan tautan cadangan tersedia tanpa mengklaim onLoad sebagai bukti panorama tersedia.



Validasi lokal: TypeScript/build; tes API scope/koordinat/missing key/no-store/URL memakai key sintetis lulus. Browser dengan key lokal sebenarnya menerima HTTP 200 dari Google, panorama Bekasi terlihat pada screenshot test-results/street-view-live.png; lazy load satu request saat dibuka, kedua tombol, popup lebar 390/320 tanpa overflow, iframe hilang setelah tutup, tanpa JavaScript error. Tidak ada perubahan database atau deployment cloud. Nama/koordinat customer contoh adalah data demo, bukan konfirmasi lokasi toko nyata.



## 2026-10-19 · OpenFreeMap dan bangunan 3D



Basemap default menjadi style Positron OpenFreeMap, mengambil vector tiles langsung di browser. API /api/map menambah provider dan style_url, tanpa mengubah scope customer/posisi. Jika MAP_TILE_URL dikonfigurasi, sumber raster tersebut tetap dipakai dan 3D dinonaktifkan. Mode default 2D; tombol 3D memiringkan kamera 55 derajat, mengaktifkan rotasi, dan menampilkan fill-extrusion bangunan cream mulai zoom 14. Tinggi memakai render_height/render_min_height dari tiles; fallback tinggi 6m jika field tidak tersedia. Catatan estimasi tersedia di peta; tidak menjanjikan geometri atau tinggi aktual semua bangunan. Fokus sales/customer zoom 16. Reduced motion menonaktifkan transisi kamera.



Worker MapLibre diimpor sebagai aset Vite eksplisit agar pemrosesan vektor bekerja pada build preview; sebelumnya URL worker relatif gagal dimuat. Fullscreen mencakup tombol mode; daftar sales tetap scroll dengan tinggi tetap. Atribusi OpenFreeMap/OpenMapTiles/OpenStreetMap berasal dari sumber. Tidak ada penyimpanan data bangunan di D1/R2 atau download wilayah.



Validasi lokal: TypeScript/build; tes API map filters/scoped positions lulus. Browser live memuat 2 style, 36 respons vector tile, 1364 building features dan 1359 feature dengan tinggi positif pada tiles yang berhasil didekode saat pengujian (bukan jumlah bangunan unik/seluruh Jakarta). Tidak ada respons gagal HTTP pada provider atau page errors; pembatalan request saat navigasi/zoom normal. Scope pin direkonsiliasi terhadap API. Mode 2D/3D, posisi sales, fullscreen enter/exit, halaman Peta customer dan lebar 390/768 lolos. Screenshot test-results/openfreemap-3d-fullscreen.png, openfreemap-3d.png, openfreemap-2d.png. Hanya preview lokal; belum deploy.



Referensi: https://openfreemap.org/quick_start/ dan https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/.



## 2026-10-19 · Morphing Infinity loading



Komponen Motion dari referensi pengguna diterapkan sebagai Loading bersama pada pemeriksaan sesi dan state Memuat di halaman/popup. Bentuk circle–infinity memakai durasi lima detik, warna teal, ukuran ikon 96px, status teks sesuai konteks. Preferensi reduced motion memakai ikon infinity statis; hanya wrapper memiliki live status. Pesan error dan logika pengambilan data tetap terpisah. Dependency motion ditambahkan.



Validasi lokal: TypeScript/build; browser memastikan path berubah saat loading, ikon statis saat reduced motion, sesi/Monitoring tampil loading selama respons tertahan lalu berganti konten asli tanpa JavaScript error. Screenshot test-results/morphing-loading.png. Tidak ada perubahan API/database.



## 2026-10-19 · Panel peta tetap, daftar sales scroll, layar penuh



Area peta dan panel sales dibatasi 320px pada desktop, 300px pada layout satu kolom. Daftar posisi sales memakai scroll internal; legenda dan catatan lokasi tetap terlihat. Jumlah sales tidak memperpanjang panel. Kontrol layar penuh MapLibre ditambahkan di kanan atas peta dengan label Indonesia dan dukungan native/fallback bawaan MapLibre. Ukuran serta sudut peta kembali normal setelah keluar. Berlaku pada Overview dan halaman Peta customer; tabel customer di halaman penuh tetap terpisah.



Validasi lokal: build; browser dengan 60 sales simulasi memastikan tinggi kartu tidak berubah, daftar bisa di-scroll, masuk/keluar fullscreen, ukuran kembali 320px, layout 768/390px, kedua halaman, tanpa JavaScript error. Simulasi hanya respons browser pengujian, tanpa perubahan database.



## 2026-10-19 · Tata letak rincian statement insentif



Popup rincian statement diperlebar dengan ringkasan dua kolom (satu kolom pada mobile), nama penerima/status/periode terpisah, angka ringkas dan tooltip rupiah penuh. Komponen memakai nama yang mudah dibaca; bonus menampilkan ambang yang sebenarnya, bukan rentang 0–0%. Nilai sebelum pembulatan diformat dari string desimal mesin tanpa konversi float: pemisah ribuan Indonesia dan nol pecahan di belakang dihapus. Invoice sumber memakai kartu terstruktur. Perubahan hanya presentasi, tanpa perubahan engine atau data.



Validasi: TypeScript/build; browser pada desktop serta lebar 620/390/320 tanpa overflow popup/kartu (tabel mobile dapat digeser horizontal); tooltip, nominal besar sampai 999999999999999, desimal 46000.123450000000 menjadi Rp 46.000,12345, nama komponen, rincian invoice, tanpa JavaScript error. Screenshot: test-results/statement-detail-desktop.png dan statement-detail-mobile.png.



## 2026-10-18 · Donut kontribusi kanal Overview



Kontribusi kanal di Overview mengikuti referensi donut tebal berujung bulat: total invoice di tengah, nominal pada lengkung, legenda nominal dan persentase. Palet teal–sage dan champagne–cream menyamai Monitoring. Tooltip hitam putih tersedia lewat hover/focus dan keyboard. Nilai net negatif atau total nol tidak digambarkan sebagai proporsi positif. Grafik batang enam bulan tetap tersedia.



Validasi lokal: TypeScript/build dan browser untuk total Rp523 jt, Lapangan Rp366 jt/70%, Telesales Rp157 jt/30%, tooltip, keyboard, lebar 390/768/1440 tanpa overflow, dan tanpa JavaScript error. Tidak ada perubahan API/database.



## 2026-10-18 · Dua cincin pencapaian kanal



Kartu kontribusi diganti Pencapaian per kanal mengikuti referensi: nilai di kiri, cincin Lapangan teal dan Telesales navy di kanan. Actual dan target memakai leaf target approved yang sama beserta cutoff monitoring. Invoice di luar alokasi tidak masuk numerator achievement; actual seluruh kanal tetap tersedia di API `channels`. Tambahan API `channel_achievement` berisi actual, target, achievement, dan status. Klik kanal/cincin membuka rincian target beserta actual. Cincin dibatasi 0–100% secara visual, angka asli tetap ditampilkan. Missing/zero target, sumber belum lengkap, dan basis perlu review tidak diberi persentase.



Data demo saat pemeriksaan: Lapangan Rp186 jt/Rp214 jt = 86,92%; Telesales Rp62 jt/Rp71 jt = 87,32%. Perbedaan dari total kanal sebelumnya berasal dari invoice tanpa alokasi target, bukan perubahan invoice.



Validasi lokal: 6 tes monitoring termasuk approval terpisah, actual di luar target, >100%, sumber provisional, dan scope rep; TypeScript/build; browser dua cincin, tooltip hitam putih, drill target, keyboard, filter, serta lebar 390/768/1440 tanpa overflow. Pemeriksaan browser tambahan menguji cincin 150% penuh dengan angka 150% dan target tidak tersedia. Tidak ada migrasi atau perubahan data.



## 2026-10-18 · Kontribusi penjualan per kanal



Kartu Monitoring menampilkan total invoice teramati dan dua bar horizontal Lapangan/Telesales. Panjang bar memakai porsi total; nominal ringkas disertai tooltip hitam putih nominal penuh. Klik membuka invoice kanal pada scope/filter yang sama. Total nol tidak diberi persentase; nilai net negatif ditampilkan bertanda dengan besaran absolut dan kontribusi tidak berlaku. Sumber provisional tetap ditandai.



Validasi lokal: TypeScript/build dan browser untuk Rp523 jt (Rp366 jt/70%, Rp157 jt/30%), drill invoice, tooltip, filter telesales 100%, lebar 390/768/1440 tanpa overflow dan tanpa JavaScript error. Tidak ada perubahan database atau API.



## 2026-10-18 · Visualisasi coverage dan aktivitas



Monitoring kini memakai donut pelanggan unik dan bar aktivitas bertumpuk per kanal pada skala jumlah yang sama. Legenda pelanggan membuka daftar tercakup/belum tercakup; segmen aktivitas membuka record sesuai kanal dan meaningful flag. Tooltip hitam putih, keyboard focus, dan keadaan tanpa pelanggan/aktivitas tersedia. Definisi meaningful dan scope tidak berubah. API summary menambah `activity_channels`, `sources.customers[].covered`, dan `sources.activities[].meaningful`.



Validasi: 5 tes monitoring termasuk kunjungan berulang, lintas kanal, scope rep, dan cohort kosong; TypeScript/build; browser pada data lokal 12/23 pelanggan, 11 belum tercakup, 9 aktivitas lapangan bermakna, filter telesales, tooltip, dan lebar 390/768/1440. Tidak ada migrasi atau perubahan data bisnis. Hasil ini untuk preview lokal.



# NYALES build status



> Status terbaru M3,18Oktober2026: insentif dan monitoring tersedia sebagai pilot lokal. Lihat [M3_STATUS.md](M3_STATUS.md), [JSON](M3_STATUS.json), API/ERD implementasi. Catatan M1/M2 di bawah adalah histori. Belum ada acceptance atau deployment produksi.



> Status terbaru 18 Oktober 2026: M2 pilot lokal tersedia. Lihat [M2_STATUS.md](M2_STATUS.md), [JSON](M2_STATUS.json), kontrak /api dan ERD implementasi. Bagian selanjutnya adalah histori iterasi; klaim fitur belum dibangun di dalam histori tidak menggantikan status terbaru. Acceptance/deployment produksi tetap pending.



> Status terkini18Oktober2026: implementasi lokal seluruh item M1 tercatat di [M1_STATUS.md](M1_STATUS.md). Bagian awal di bawah adalah catatan historis iterasi, bukan status terbaru. Seluruh fallback data sintetis sudah dihapus dari jalur runtime; auth/scope/sesi, R2 import, katalog dan pipeline invoice kini tersedia lokal. Firebase nyata/MFA/provider peta/integrasi ERP dan acceptance produksi tetap pending.





## Keputusan arsitektur pelanggan - 18 Oktober 2026



Baseline aktif: PRD v1.10, ERD/API/backlog v1.2 di [specifications/README.md](specifications/README.md). Bagian historis berikut yang menyebut Account sebagai master bisnis telah digantikan.



- Pelanggan/toko menjadi entitas utama satu lokasi; UI hanya Pelanggan dan Kontak, form popup tetap dipakai.

- API dan CSV tidak menerima relasi Account. Manual memakai nama/alamat/area, kode ERP opsional; import memerlukan kode ERP unik, nama/alamat/area.

- Migrasi 0017 diterapkan hanya pada D1 lokal setelah backup. Tabel account dan kolom customer_outlet.account_id dihapus; 11 master lama beserta relasi dipertahankan sebagai snapshot audit.

- Rekonsiliasi semua tabel sebelum/sesudah membuktikan 13 pelanggan, 6 kontak, 6 invoice, 3 assignment, alias, fakta dan versi historis tetap sama. Foreign key check bersih; batch import lama dan sumber asli dipertahankan. Batch pelanggan schema1 wajib validasi ulang.

- 48 tes otomatis dan production build lulus. Peringatan ukuran bundle MapLibre tetap ada seperti sebelumnya.

- Bukti: test-results/account-removal-reconciliation.json dan tests/customers.test.ts serta tests/imports-merges.test.ts.

- Browser regression lulus: tambah pelanggan langsung, kontak, template dan import tanpa Account, merge/alias, invoice tetap, responsif 320/390/768/1440, halaman distribusi/produk/invoice/peta/overview, logout dan tanpa page errors. Data contoh baru dinonaktifkan dan kontak diarsipkan; sumber import/audit dipertahankan. Bukti: test-results/customer-primary-browser.json dan customer-primary-desktop.png.

- Tidak ada deployment cloud atau perubahan database remote.



17 Oktober 2026.



## Selesai pada iterasi ini



- Project mandiri `sales-operations` dengan nama aplikasi NYALES.

- Shell React responsif memakai Poppins lokal dan brand mark SVG.

- Halaman Overview, Customer, dan Telesales sesuai Design System v1.1.

- Hono API `/api/health`, `/api/me`, `/api/dashboard`, `/api/customers`, dan `/api/telesales/queue`.

- Migration D1 `0001_initial.sql` dan seed lokal berhasil dijalankan.

- Dashboard mengambil data `/api/dashboard`; Customer mengambil data `/api/customers` dengan fallback fixture saat API belum tersedia.

- WEB-016 peta distribusi sudah masuk Overview: MapLibre + basemap raster OpenStreetMap, marker customer, posisi terakhir sales, popup timestamp/source/akurasi, attribution, dan fallback tanpa routing. Provider tile perlu capacity/usage review sebelum produksi.



## Validasi



- `npm run check` lulus.

- `npm run build` lulus.

- D1 migration: 14 perintah berhasil.

- D1 seed: 7 perintah berhasil.

- Browser test preview: endpoint health 200, tidak ada page error, tiga halaman dapat dinavigasi.



## Status implementasi



Data masih demo dan belum ada Firebase Authentication, middleware authorization produksi, import invoice nyata, target/forecast server, finalisasi insentif, R2 upload, MapLibre tile provider, atau Android. Kode ini merupakan fondasi M0/M1 yang mulai executable; status backlog fitur tetap Planned sampai runtime acceptance diselesaikan.



## Referensi



PRD v1.9, ERD v1.1, API v1.1, backlog web v1.1, dan Design System v1.1 berada pada artefak spesifikasi sebelumnya.





## WEB-007 — Implemented, menunggu verifikasi Firebase nyata



Login email/password dan Google via Firebase SDK; login demo local-only; API middleware memverifikasi Firebase JWT dan mapping UID ke user/role aktif di D1. Semua API domain memerlukan identitas. Domain nonlocal ditutup sampai WEB-008; session binding/revoke tetap WEB-011.



Validasi: empat automated test groups lulus (environment guard, JWT claims/signature, endpoint 401, mapping unmapped/ambiguity), browser login/reload/logout lulus, migration 0002 berhasil, TypeScript/build lulus. Firebase web config dan project ID belum tersedia; belum ada login akun nyata atau provisioning user production. Baca AUTH_SETUP.md.



Pernyataan sebelumnya bahwa seluruh data domain sudah production-ready tidak berlaku. Dashboard/queue/map tetap fixture dan resource authorization berikutnya adalah WEB-008.





## WEB-008 — Scope data pada endpoint yang sudah dibangun



17 Oktober 2026. Implementasi backend kini memuat effective-date user_area_scope dan reporting_assignment; identitas berasal dari middleware Firebase/mapping, bukan parameter query. Scope: Management/NSM organisasi, AM area sendiri, SPV subtree beririsan area, SR area atau explicit field assignment, telesales explicit telesales assignment. Invoice mengikuti rep/channel dan dimensi area invoice; perpindahan owner customer tidak memindahkan actual historis ke sales baru. Scope tanggal memakai timezone organisasi dan tanggal server; cutoff client tidak memperluas akses.



Endpoints GET /api/me, /api/customers, /api/customers/:id, /api/dashboard, /api/map, /api/telesales/queue memakai scope. Detail resource di luar scope = 404, operasi dilarang = 403. Query area/owner hanya mempersempit hasil yang sudah diizinkan. SQL memakai prepared bindings dan organisasi di tiap join. Field output diproyeksikan eksplisit; auth_subject, nomor kontak penuh, dan nominal insentif tidak dikirim. Settings capability hanya untuk Management/NSM; route mutation/master dan resource belum diimplementasikan tidak otomatis terbuka. Export/attachment/insentif authorization harus ditambahkan bersama modul terkait, belum Accepted untuk seluruh API rancangan.



Seluruh fixture domain frontend/server dihapus dari jalur data; error/denied tidak memunculkan data contoh. Dashboard kini mengagregasi invoice D1; target/achievement yang belum ada = null/Belum tersedia. Kontrol periode/area dengan angka hardcoded dan chart sintetis dihapus sampai API filter/tren benar tersedia. Actual customer memakai bulan bisnis berjalan; status aktif tetap rolling90. Queue belum mempunyai preference DNC terintegrasi, sehingga panggilan/simpan hasil dinonaktifkan, tanpa menebak izin hubungi.



Migration 0003 dan seed lokal lulus. Enam automated test groups lulus: JWT/mapping, environment guard, anonymous API, scope roles, lintas organisasi/area, subtree, expired assignment, SR area/assigned, tele separation, narrow filters, detail404, map scope, mutation denied, and storage failure. SQLite in-memory mengeksekusi SQL route yang sama; browser menguji Worker/D1 lokal, total actual Rp275 juta, target null, customer lookup, queue, dan responsive 320/390/768/1440. No page errors. `npm run build` dan TypeScript lulus; bundle MapLibre masih menghasilkan warning chunk besar (optimisasi berikutnya).



Batas: Firebase nyata dan test multi-user production belum tersedia. Date-effective scope mempunyai read enforcement; UI CRUD hirarki/validasi cycle dan temporal overlap pada mutation adalah WEB-010/015. Data tier/sync/invoice revision/retur lengkap belum dibangun. Role dan area test menggunakan harness identitas pada tests; tidak ada endpoint production untuk memilih role melalui client. Mode demo tetap Management dan local-only.





## WEB-009 — Master organisasi, cabang, area dan kalender kerja



Halaman Pengaturan tersedia untuk capability settings:manage (Management/NSM). Backend tetap memeriksa scope untuk GET master/detail dan menolak POST/PUT/archive oleh role lain. GET /api/organization, /api/branches, /api/areas, /api/calendars serta detail; PUT organization; create/edit/archive pada tiga master. Cabang dan kalender yang dibaca AM/SPV/SR mengikuti area atau assignment yang sah, bukan daftar seluruh organisasi.



Form menyimpan nama organisasi dan timezone; cabang dengan timezone IANA; relasi area–cabang; kalender dengan hari kerja ISO 1=Senin sampai7=Minggu, jam mulai/selesai, dan tanggal libur ISO. Kalender aktif tunggal per cabang. Jam selesai harus sesudah mulai; overnight belum didukung. Tanggal libur dimasukkan organisasi, belum ada sinkronisasi hari libur nasional. Arsip menyimpan histori; cabang yang masih mempunyai area/kalender aktif dan area yang masih terkait customer/scope user ditolak.



Semua mutation memakai If-Match/version untuk update/archive dan Idempotency-Key untuk POST/PUT. Request key+payload sama mengembalikan record yang sama; payload beda dengan key sama ditolak. Mutation, audit before/after UTC dan idempotency disimpan dalam batch D1 atomik dengan check guard untuk mencegah versi kedaluwarsa lolos. UI mempertahankan key retry selama payload/versi sama; aksi simpan dinonaktifkan saat pending. Tidak ada hard delete.



Endpoint /api/calendars/:id/clock menampilkan waktu UTC, tanggal/jam bisnis menurut timezone cabang, dan status jam kerja. Fungsi isWorkingInstant dan workingMinutesBetween tersedia untuk modul SLA berikutnya; uji membuktikan timezone Jakarta/Makassar, batas jam selesai, hari libur dan akhir pekan. Integrasi job SLA otomatis dan reminder belum diimplementasikan pada WEB-009 ini; penerimaan SLA ujung-ke-ujung menunggu modul pekerjaan/otomasi.



Validasi: migration0004/0005 dan seed D1 lokal berhasil; delapan automated test groups lulus, termasuk izin master, tenant, missing/stale If-Match, idempotency replay/conflict, audit, referensi cabang, tanggal libur tidak valid, duplicate weekdays, kalender aktif ganda dan archive dependency. Browser memeriksa create branch/area/calendar, edit/reload nilai, archive, dan lebar320/390/768/1440 tanpa horizontal overflow. Data QA browser diarsipkan; tidak ada perubahan cloud production. Snapshot dan hasil berada di test-results/web009-settings.png dan web009-browser.json.



Catatan acceptance: konfigurasi Firebase/provisioning akun nyata belum tersedia. Uji role menggunakan harness backend dengan SQL SQLite yang sama dan browser akun demo Management. Mapping tabel branch/work_calendar dipakai bertahap; kalender historis final pada kalkulasi harus dibekukan sebagai versi saat modul tersebut dibangun. Default demo: Cabang Contoh Jakarta, Senin–Jumat08:00–17:00, tanpa libur otomatis; bukan aturan perusahaan yang disepakati.





## Pola interaksi form — 17 Oktober 2026



Semua form pengelolaan yang tersedia memakai pola daftar/ringkasan sebagai tampilan awal, aksi utama di kanan atas di atas card, dan form tambah/edit dalam popup. Diterapkan pada organisasi, cabang, area, kalender kerja, user, pelaporan dan transfer hirarki. Hirarki menjadi tab pertama/default, diikuti User. Organisasi memakai tombol Edit organisasi karena hanya ada satu organisasi pada scope akun. Konfirmasi arsip dan detail customer juga memakai popup. Filter/pencarian tetap tersedia di halaman; login tetap menjadi halaman autentikasi. Telesales masih berupa antrean dan konteks dengan aksi catat panggilan nonaktif sesuai status modul.



Komponen bersama `src/client/Modal.tsx` menggunakan native dialog dengan label judul, penguncian fokus, Escape/tombol tutup, pengembalian fokus ke pemicu, scroll internal dan ukuran responsif. Saat mutation berlangsung, popup tidak dapat ditutup untuk mencegah pengiriman ganda. Error tampil di popup dan nilai form dipertahankan untuk koreksi; sukses menutup popup dan memperbarui daftar. Pola ini menjadi standar untuk form modul berikutnya.



Validasi browser lokal: popup seluruh bagian Pengaturan, posisi tombol di atas card, create/edit/archive cabang melalui D1 lokal (record QA telah diarsipkan), detail customer, lebar 320/390/768/1440 tanpa overflow dan tanpa page error. Pengujian Hirarki/User menguji form tersembunyi, urutan tab, popup tambah/kelola, Escape, fokus kembali dan reset draft.





## WEB-011 — sesi perangkat, revoke dan proteksi admin



Implementasi lokal 17 Oktober 2026: migration0008_device_sessions, binding Firebase identity + X-Device-Session untuk seluruh endpoint domain; bootstrap recent login, token acak256-bit dengan hash saja di D1, expiry12jam, audit create/revoke, rate limit20bootstrap/user/10menit dan last_seen ditulis paling sering15menit. POST/GET /api/device-sessions, GET detail dan POST revoke tersedia. Revoke memakai reason + If-Match; pengulangan yang sudah dicabut tidak menggandakan audit. Pencabutan efektif di backend pada request selanjutnya. Login lama tidak bisa membuat binding baru setelah revoke dengan mengganti device_id; sesi lain tetap berlaku. Bootstrap mengembalikan secret sekali dan belum mendukung replay secret melalui Idempotency-Key; kehilangan respons dapat membuat sesi tambahan sampai expiry, dibatasi rate limit.



Menu Sesi perangkat untuk semua role: user biasa hanya miliknya, Management/NSM seluruh organisasi; relasi lintas organisasi =404. Konfirmasi revoke memakai popup. Logout mencoba revoke server dan membongkar state lokal; kegagalan jaringan ditampilkan sebagai revoke belum terkonfirmasi. Browser memeriksa sesi setiap30detik saat terlihat/focus, sedangkan API menolak sesi revoked langsung. State dan token browser terikat identitas, respons dari akun yang berubah ditolak. Offline domain cache/outbox belum ada; WEB-035 masih harus mengisolasi storage draft/sync.



Gate admin nonlocal memerlukan verified JWT second-factor; client flag tidak diterima. Firebase TOTP memerlukan Identity Platform, dengan kelayakan Spark/kuota/billing proyek belum terverifikasi. Tidak mengaktifkan layanan berbayar. MFA enrollment/challenge/recovery dan Firebase nyata belum dibangun/diuji: status gate pending_project_verification, rollout admin penuh ditahan. Role approver baru harus masuk policy saat approval dibangun. Rincian dan sumber provider ada di AUTH_SETUP.md.



Validasi: empat test groups baru mencakup binding/ownership/tenant, hash dan sanitasi audit, per-device revoke, reauth floor, MFA admin dan recent auth, expiry, activity throttling, rate limit dan mapping user nonaktif. Total14testgroups lulus. Browser dua konteks membuktikan revoke perangkat kedua menghasilkan401/login, perangkat pertama tetap aktif, logout mencabut backend, login baru/reload berhasil, popup alasan dan320/390/768/1440 tanpa overflow/pageerror. Sesi QA dari uji browser terakhir dicabut. Bukti: test-results/web011-sessions.cjs dan web011-sessions.png. Deployment produksi belum dilakukan.





## WEB-012 — master account, outlet, contact dan lokasi



Implementasi lokal 18 Oktober 2026. Customer kini memiliki tab Outlet, Account dan Kontak. Daftar/ringkasan menjadi tampilan awal; Management/NSM mendapat tombol tambah di kanan atas, form tambah/edit, detail outlet dan konfirmasi arsip dalam popup bersama. Role lainnya hanya membaca data dalam scope. Nama/owner, status rolling90, tier yang belum dikonfigurasi, actual invoice dan detail tetap tersedia. Filter area, status customer, status aktif/nonaktif outlet dan status koordinat tersedia; pencarian/filter ini dijalankan pada daftar yang telah dibatasi server.



Migration0009 membuat legal account dan contact, menambah relasi account/outlet, version, status record, satu pasangan koordinat, status/catatan lokasi, tipe outlet, frekuensi layanan dan jam menerima kunjungan. Satu account dapat mempunyai banyak outlet; tiap kontak terikat satu outlet. Status aktif/nonaktif master outlet berbeda dari lifecycle Aktif/Churn berbasis invoice. Tidak ada hard delete. Account dengan outlet aktif tidak dapat diarsipkan; outlet dinonaktifkan melalui PUT. Kode account wajib, kode ERP outlet opsional dan unik dalam organisasi; kode di-trim dan dibuat uppercase. Nomor yang sama boleh dipakai di beberapa outlet/contact tanpa merge otomatis.



Migrasi tidak menebak hubungan badan usaha data lama: account placeholder diberi needs_review. Kode ERP duplikat lama tetap disimpan, diberi external_code_review dan tidak dihapus/diubah paksa. Koordinat lama tidak otomatis menjadi verified. Seed diperbaiki supaya dapat diulang setelah migration baru tanpa konflik trigger role dan tanpa menimpa koordinat yang sudah diubah. Review duplikat, merge dan alias ID adalah WEB-014 (walaupun endpoint merge disebut dalam daftar API WEB-012 pada rancangan awal); endpoint merge pada tahap WEB-012 belum diaktifkan; kini sudah tersedia melalui WEB-014 di bawah.



API tersedia: GET/POST /api/accounts, GET/PUT /api/accounts/:id, POST archive; GET/POST /api/contacts, GET/PUT detail, POST archive; GET/POST /api/customers, GET/PUT detail dan GET /api/customers/:id/timeline. Semua domain tetap memerlukan Firebase identity + sesi WEB-011. Mutation Management/NSM saja, strict validation, Idempotency-Key dan If-Match untuk update/archive, dengan mutation/audit/dedupe atomik. Relasi lintas organisasi ditolak; account/outlet/area/contact guard juga diperiksa pada SQL. Snapshot kontrak implementasi lokal: specifications/customer-api.web012.openapi.json; bukan keseluruhan API produk masa depan.



Koordinat disimpan integer E7 dalam rentang geografis, wajib berpasangan, nilai0 sah. Tanpa koordinat tetap masuk daftar/total. Status lokasi missing/unverified/verified; verified adalah verifikasi manual dan memerlukan catatan, bukan bukti GPS perangkat. Perubahan koordinat melalui UI mengembalikan status ke unverified. Peta hanya mem-pin outlet operasional aktif yang mempunyai lokasi; jumlah outlet aktif tanpa koordinat dan outlet nonaktif diberitahukan, semuanya tetap tersedia di daftar Customer. Tidak menambahkan geocoding, routing, atau provider berbayar.



Kontak menerima format Indonesia0/62 serta internasional+/00, menyimpan E164 (8–15 digit). Management/NSM melihat nomor lengkap; role lain hanya masked phone_display dan tidak menerima permission_note. Izin unknown/allowed/denied/dnc dicatat manual; status selain unknown memerlukan catatan. Jika field izin tidak disertakan pada update nomor yang sama, status lama termasuk DNC tetap dipertahankan. Mengganti nomor mengembalikan izin ke unknown; izin nomor baru dicatat pada update berikutnya. Ini belum menjadi mesin contact_preference/cooldown/DNC global; aksi panggilan tetap nonaktif sampai modul TEL dibangun.



Timeline memproyeksikan perubahan master outlet, invoice tervalidasi sesuai atribusi/scope, dan aktivitas yang diizinkan; maksimal100 terbaru dengan has_more. Timestamp legacy SQL dinormalisasi UTC; tanggal invoice tetap terpisah. Timeline tidak menampilkan payload audit mentah/nomor kontak. Perubahan area outlet yang sudah mempunyai assignment/invoice/target ditahan sampai workflow transfer WEB-015. UI tidak mengubah owner/invoice historis melalui form master. Jadwal/frekuensi saat ini hanya data preferensi, belum menghasilkan agenda otomatis.



Validasi:19automatedtests lulus termasuk phone normalization, kode unik, pasangan/rentang koordinat dan titik0, replays/conflicts/stale versions, izin role/tenant, shared number, masking nomor, DNC preservation/reset, scope account counts/timeline, proteksi atribusi area invoice, dependensi arsip, migrasi legacy duplikat dan seed ulang. Browser lokal menjalankan account→2outlet→2kontak dengan nomor sama; error koordinat mempertahankan draft, edit/reload mempertahankan GPS, verifikasi manual, archive dependency, timeline dan320/390/768/1440 tanpa overflow/pageerror. Data QA diinaktifkan/diarsipkan melalui API; tidak ada record yang dihapus. Bukti: test-results/web012-customers.cjs, web012-customers.png, web012-cleanup.cjs, web012-final-ui.cjs dan web012-customers-final.png. TypeScript/build lulus; warning chunk MapLibre besar yang sudah ada masih tersedia untuk optimisasi berikutnya. Firebase nyata, import sumber transaksi, merge, assignment transfer dan acceptance produksi belum termasuk; tidak ada deployment cloud.





## WEB-013 — import customer/produk, sumber asli dan error per baris



Implementasi lokal 18 Oktober 2026. Menu Import & duplikat untuk Management/NSM menyediakan daftar 100 batch terbaru, katalog produk, tombol import di kanan atas, popup pemilihan file, mapping, dry-run dan review/commit. Format pilot: CSV UTF-8 (BOM didukung), delimiter koma/titik koma/tab, quoted multiline/escaped quotes, maksimum512KiB/200baris data dan40kolom. XLSX, impor invoice, user/assignment/target, auto-create account dan penjadwalan sinkronisasi belum termasuk. Customer import mewajibkan kode ERP, nama, alamat, account_code yang sudah terdaftar, dan area_id aktif. Produk mewajibkan SKU/nama/base_unit; group_code opsional masih metadata, belum relasi product_group/KPI. Tanggal source_date yang dipetakan harus ISO valid; bukan bukti cutoff transaksi/keberhasilan ERP sync.



Migration0010 menambah product, import_file, master_import_batch dan master_import_row. Master batch dipisahkan dari importer transaksi keuangan masa depan. File asli disimpan pada binding IMPORT_FILES R2 dengan kunci acak dalam namespace organisasi, SHA-256, ETag, ukuran, nama dan waktu upload server; D1 menyimpan manifest/staging, bukan bytes sumber. Unggahan identik dideduplikasi per organisasi/checksum. Pengakuan D1 yang hilang setelah insert tidak menghapus objek sumber yang sudah direferensikan. File sumber hanya dapat diunduh oleh Management/NSM organisasi yang sama; bytes diverifikasi SHA-256 saat dry-run dan download, ETag saat commit. Sumber disajikan sebagai attachment/octet-stream dengan nosniff.



Retensi: retention_hold=1, retain_until belum ditetapkan; tidak ada penghapusan otomatis sampai organisasi menetapkan kebijakan dan prosedur legal hold. Ini gate sebelum go-live, bukan klaim retensi perusahaan sudah disetujui. R2 lokal telah diuji; bucket cloud nyales-import-sources belum diprovision/deploy. Tidak mengaktifkan layanan berbayar. Orphan reconciliation/expiry job umum mengikuti pekerjaan operasi-retensi berikutnya; failure yang belum mempunyai manifest tidak diberi label upload berhasil.



Dry-run memeriksa header, mapping field wajib, lebar baris, tipe/rentang, tanggal, kode berulang dalam file, kode ambigu/alias, parent account/area, status, panjang field dan satuan produk. Staging invalid memuat error per baris (nilai error dibatasi2000karakter/field; sumber asli tetap utuh). Kosongnya koordinat pada CSV tidak menghapus GPS yang sudah tersimpan; koordinat baru tetap unverified. Update base_unit produk yang berbeda ditahan untuk review; tidak ada konversi kuantitas/harga. Preview memperlihatkan aksi baru/perbarui/tidak berubah/ditolak serta nilai yang akan diterapkan. Baris error dapat diunduh sebagai CSV dengan formula-neutralization. CSV sumber asli tidak ditulis ulang.



Commit strict menolak batch dengan error; operator dapat mengonfirmasi baris valid saja, menghasilkan status partial dan jumlah valid/error yang jelas. Seluruh baris valid diterapkan dalam satu transaksi D1 set-based (maksimum200), dengan snapshot version resource/parent, cek kode unik dan validasi ulang referensi. Perubahan setelah dry-run, konflik kode, source berubah atau territory berhistori menggagalkan seluruh transaksi valid-row tanpa penerapan separuh tersembunyi. Validasi ulang menghasilkan snapshot baru dari sumber yang sama. Commit, staging applied, audit row/batch dan idempotency atomik; retry tidak membuat record/audit row ganda. Source lama yang sudah menjadi alias tidak membuat ulang outlet; perlu menggunakan kode kanonik.



API: POST/GET source /api/import-files, GET /api/master-imports/template/:kind, GET/POST /api/master-imports, GET detail dan /errors, GET /api/products. Idempotency-Key untuk dry-run/commit; commit memakai If-Match batch. Binding Firebase+device-session tetap wajib; semua operasi import/produk di modul ini Management/NSM. Kontrak implementasi ada di specifications/operations-api.web013-014.openapi.json. Binding dan query telah diuji lokal; free-plan capacity/CPU dan akun Firebase/cloud asli belum diterima sebagai produksi.



## WEB-014 — review duplikat, merge dan alias ID



Menu Review duplikat mengusulkan kandidat dari kode ERP, nama+alamat, nomor kontak sama, atau nama+koordinat berdekatan. Nomor sama bukan bukti lokasi sama, dan tidak ada auto-merge. Kandidat maksimal200 dengan has_more; alias menampilkan200terbaru. Review manual tersedia tanpa kandidat. Popup membandingkan alamat/koordinat, account/area dan jumlah relasi, serta mewajibkan alasan, konfirmasi lokasi yang sama dan pilihan outlet yang dipertahankan. Management/NSM saja, dengan source If-Match dan surviving_version.



Migration0010 menambah customer_alias dan merged_into_id; migration0011 membuat proteksi territory memperhitungkan seluruh keluarga alias. Merge mensyaratkan organisasi/account/area sama, outlet aktif/kanonik berbeda, dan tidak ada benturan rep per kanal pada interval assignment aktif/terjadwal. SQL transaction mengunci kedua versi dan memeriksa benturan kembali. Sumber menjadi inactive/alias; invoice, activity, target, contact dan customer_assignment tetap memakai ID fisik asal. Tidak ada hard delete, pemindahan invoice.rep_id/area/channel atau penggabungan consent kontak. Sumber dan target diaudit. Merge berantai meratakan alias ke outlet kanonik terakhir.



Daftar customer hanya menghitung outlet kanonik; actual/last invoice/owner/timeline mengacu keluarga alias tanpa join pengganda. Invoice totals tetap mengikuti atribusi invoice dan scope role. GET ID lama mengembalikan outlet kanonik yang diizinkan serta meta requested/canonical/alias_resolved. Customer scope, queue telesales, kontak, account counts dan peta mengikuti resolusi alias. Nomor/consent kontak tetap terpisah; nomor full tetap Management/NSM saja. Kontak historis di source tetap dapat diperbarui tanpa memindah customer_id aslinya. Form master tidak dapat mengedit source yang sudah digabung, mengganti kode ERP kanonik yang sudah beridentitas, atau memindahkan area dengan histori dari salah satu alias. Penetapan kode pertama pada kanonik tanpa kode tetap diizinkan.



Kode legacy yang ambigu tidak dihapus. Merge menyelesaikan review kode bila tidak ada outlet kanonik lain yang masih bertabrakan; kasus berbeda badan usaha/lokasi harus diperbaiki di master/territory, bukan dipaksa merge. Workflow WEB-015 yang akan dibangun wajib memeriksa assignment seluruh keluarga alias; tidak boleh hanya tabel outlet kanonik. Global contact-preference/DNC mesin panggilan tetap pekerjaan TEL, bukan diaktifkan oleh merge. Source ERP correction/undo merge dan bulk merge belum tersedia; record/audit asal tetap tersimpan.



API: GET /api/customer-duplicates, GET /api/customer-aliases, GET /api/customers/:id/merge-preview?surviving_customer_id=..., POST /api/customers/:id/merge. Semua melalui role, organisasi, device-session dan idempotency; lintas organisasi404, role lain403, versi stale412, benturan409. Kontrak WEB-012 diperbarui untuk menunjuk kontrak merge yang kini tersedia.



Validasi WEB-013/014:27automatedtests mencakup CSV/parser/formula, original bytes, upload checksum/dedupe/acknowledgement ambiguity, strict/partial commit/retry, 200-row atomic commit dan audit unik, field/date/reference errors, snapshot/source/territory conflicts, canonical aliases, permissions/tenant isolation, owner collision, old-ID/queue/timeline/account scope, consent independence, merge chain serta perlindungan invoice/assignment mentah. Browser dengan Worker/D1/R2 lokal membuktikan unduh template, mapping, error export, byte-identical original download, partial customer import, full product import, konfirmasi merge, resolusi alias, consent terpisah dan320/390/768/1440 tanpa overflow/pageerror. Data QA telah inactive/archived melalui API; original CSV, batch, alias dan audit sengaja dipertahankan. Bukti: test-results/web013-014.cjs, web013-014-cleanup.cjs, web013-imports.png, web014-merge-review.png dan web014-aliases.png. Build/TypeScript dicek; warning bundle MapLibre besar tetap pekerjaan optimisasi. Tidak ada deployment cloud/acceptance produksi; gate MFA, retensi dan load/capacity nyata tetap berlaku.



Pemeriksaan akhir WEB-013/014: 27/27 tests lulus dan npm run build (termasuk tsc --noEmit) lulus. Smoke browser terakhir memeriksa preview nilai per baris, sumber asli ber-BOM, dialog pada 320/390/768/1440, penolakan merge lintas account/area, alias historis dan logout tanpa page error. Bukti tambahan: test-results/web013-014-final.cjs, web013-preview-final.png dan web014-blocked-mobile.png. Server lokal berjalan di http://127.0.0.1:5180/.





## WEB-015 — distribusi, assignment dan transfer territory



Implementasi lokal 18 Oktober 2026. Menu Distribusi sales menyediakan kanal lapangan/telesales, filter area, sales, assigned/unassigned dan pencarian nama/kode ERP. Customer kanonik memakai PIC lapangan dan supporting telesales terpisah; telesales tidak mengganti owner lapangan. Customer unassigned tetap ditampilkan dalam scope. Customer nonaktif diberi label. Tombol Atur penugasan berada di atas card, form/histori memakai popup; form awal tidak terbuka. Management/NSM saja yang mengubah konfigurasi. Role operasional membaca distribusi/histori sesuai scope; Area Manager tidak mendapat area lain, Sales Rep melihat areanya atau assignment, histori rep/subtree/kanal dibatasi lagi. Tidak menyediakan ekspor baru.



POST /api/customers/:id/assignments menerima rep_id nullable (lepas PIC), area_id, channel, effective_from_date dan reason. Perubahan area wajib menyertakan other_channel_rep_id eksplisit (boleh null) karena kedua kanal ditutup pada tanggal efektif dan ditetapkan ulang. Transfer owner biasa hanya menutup kanal terpilih. Start inklusif, end eksklusif; tidak ada backdate. Tanggal dengan assignment yang mulai pada/sesudahnya ditolak agar histori dan jadwal yang ada tidak ditimpa. Jadwal lanjutan harus setelah jadwal terakhir. Hanya satu transfer area pending per customer; perubahan berikutnya/merge/arsip outlet ditahan sampai berlaku. Cancel/reschedule, koreksi retroaktif, bulk transfer dan preview dampak target belum tersedia di pilot ini.



PIC baru harus user aktif dengan role SALES_REP/field atau TELESALES/telesales, area scope tanpa tanggal akhir untuk assignment berkelanjutan, dan tepat satu Supervisor aktif dengan kanal sesuai pada tanggal efektif. Role PIC juga harus mencakup assignment berkelanjutan; perpindahan hirarki ke area lain yang sudah terjadwal membuat pilihan tidak eligible. API assignment-options memfilter pilihan, commit memeriksa ulang di SQL. Supervisor/Area Manager tidak otomatis menjadi owner lapangan. Lengkapi User & Hirarki sebelum memilih PIC: data demo lama tidak otomatis diperbaiki menjadi hirarki perusahaan. User nonaktif/perubahan role/area hirarki ditahan bila masih mempunyai customer assignment aktif/terjadwal yang bertentangan; alihkan customer dahulu.



Semua interval aktif/terjadwal pada keluarga alias diperiksa, tidak hanya ID kanonik. Penutupan interval menyimpan ended_reason, ended_by dan ended_at; identitas/awal/kanal/PIC asal tidak diubah. Assignment baru ada pada ID kanonik. Guard SQL mencegah overlap owner per kanal dan tenant silang; data legacy dengan satu PIC sama pada beberapa alias tetap ditelusuri, reassignment menutup seluruh relasi keluarga tersebut. ETag customer, snapshot interval, role/ref, audit dan idempotency berada dalam transaksi atomik. Retry tidak menambah assignment/audit ganda; kegagalan transaksi mengembalikan versi dan semua interval lama. GET ID alias mengembalikan histori kanonik dengan metadata resolusi. Histori mencakup 200 assignment dan 200 transfer terbaru, has_more menjelaskan data lebih lama tetap disimpan; belum ada cursor/export histori.



Migration0012 menambah snapshot area/provenance assignment, event customer_territory_transfer dan guard; 0013 melindungi histori territory dari alias; 0014 menyimpan provenance penutupan. Area saat ini diterapkan dari event jatuh tempo dalam transaksi sebelum setiap resolusi scope domain, berdasarkan tanggal bisnis timezone organisasi. Perubahan hari ini berlaku pada transaksi penyimpanan; perubahan masa depan diterapkan sebelum request domain pertama pada/setelah tanggal efektif, tanpa bergantung timer browser. Version customer naik saat jadwal disimpan dan saat area diterapkan; audit territory_effective merekam tanggal efektif dan waktu penerapan sebenarnya. Tidak menjalankan cron/billing/cloud deployment. Area tujuan pending/outlet aktif tidak dapat diarsipkan. Master edit/import biasa tidak dapat melewati transfer workflow setelah ada histori, termasuk dari alias yang digabung.



Invoice, activity, target dan contact mempertahankan ID fisik, area/rep/kanal atribusi asal; tidak memindahkan invoice historis, target atau insentif secara otomatis. Current-area scope, customer list, account/contact visibility, queue dan peta mengikuti territory yang telah berlaku. Timeline memberi label penugasan/transfer yang dapat dibaca. Merge menolak pending territory; histori transfer yang sudah berlaku tetap terbaca melalui keluarga alias. Seed dapat diulang setelah interval seed ditutup/diganti, tanpa membuka kembali penugasan lama.



Kontrak lokal: specifications/assignment-api.web015.openapi.json. Validasi: 34 tests lulus, mencakup boundary tanggal, idempotency/version/scope, kanal terpisah, unassign, pilihan PIC, penolakan role/area/Supervisor tidak sesuai, keluarga alias, guard histori, rollback transaksi, applied-once dan atribusi fakta tetap sama. Browser Worker/D1 lokal memeriksa popup, transfer area dengan kedua kanal unassigned, histori, filter assigned/unassigned dan lebar320/390/768/1440 tanpa overflow/pageerror. Pemindahan ke PIC nyata diuji pada integration tests dengan SQLite/D1 adapter; browser memakai fixture area tanpa PIC agar tidak mengubah hirarki demo. Fixture account/outlet QA diinaktifkan/diarsipkan melalui API, event dan audit dipertahankan. Bukti: test-results/web015.cjs, web015-transfer.png, web015-history.png, web015-mobile.png. Build/TypeScript lulus; warning chunk MapLibre besar masih ada. Verifikasi produksi/Firebase/MFA dan kapasitas cloud belum termasuk.



Pemeriksaan UI akhir WEB-015: field filter memakai kontrol rounded/font yang konsisten dengan design system. Daftar awal hanya outlet aktif; filter status outlet membuka histori nonaktif. Histori seed dan popup edit terbaca, versi mobile390px tidak overflow, logout berhasil tanpa pageerror. Bukti: test-results/web015-final.cjs, web015-desktop-final.png dan web015-mobile-final.png. Build terakhir mencakup provenance penutupan dan label timeline.





## Penyelesaian implementasi lokal sisa M1 — WEB-016,019–024



18Oktober2026. Halaman Peta customer mempunyai filter area/sales/kanal/status, tabel seluruh outlet dalam scope termasuk tanpa koordinat/nonaktif, tombol fokus pin, posisi sales last-received beserta timestamp/source/accuracy/umur. GET /sales/last-positions memakai scope yang sama. Timestamp future/invalid tidak menjadi umur0. Tidak ada routing, ETA atau tracking Android yang dipalsukan. Basemap bisa diatur melalui MAP_TILE_URL dan MAP_ATTRIBUTION di environment; fallback OSM lokal tetap memerlukan provider/capacity acceptance. Error tile ditampilkan eksplisit; ilustrasi jalan CSS dihapus agar bukan pengganti basemap nyata. Tidak ada provider berbayar/key baru diaktifkan.



WEB-019: kontrak mapping sumber, CSV template, integer IDR exponent0, header/line/credit dan source-version ada di INVOICE_SOURCE_MAPPING.md. Adapter menerima CSV atau JSON, sumber asli privat R2 tetap ber-checksum/hold. Fixture sales end-to-end disalin ke tests/fixtures tanpa memasukkan transaksi masa depan ke D1 operasional. Sumber perusahaan dan semantik pajak/diskon/ongkir/net belum diverifikasi, sehingga integrasi sumber nyata tetap pending_input.



WEB-020: Produk & harga mendukung create/edit/archive produk dan kelompok, SKU unik/immutable, quantity_scale eksplisit, kelompok aktif dan harga efektif dengan sumber. UI form/pengaturan harga/arsip dalam popup, tombol di kanan atas. Harga lama ditutup dengan interval akhir eksklusif, tidak ditimpa; perubahan unit/scale yang mempunyai invoice/price history ditolak. Product import memakai group_code aktif yang sudah ada dan scale; produk legacy tanpa kelompok ditandai belum dipetakan. Stock dan credit eligibility tetap null/belum tersedia. Schema product memakai inactive sebagai arsip; group memakai archived.



WEB-021: dry-run terpisah dari commit; job menyimpan request/hash/source/refepoch/plan/error/summary, dan endpoint detail/errorCSV/validationJSON. Batas pilot512KiB,200record gabungan,100invoice; strict batch tanpa partial invoice commit. Mapping ambigu masuk needs_review. Commit memerlukan payload/hash/job/version sesuai validasi serta reference epoch belum berubah, memverifikasi ulang checksum sumber. Writes set-based satu transaksi bounded, bukan SQL per row; invoice/current flags/line/credit/source-event/audit/job/idempotency atomik. Maximum100invoice fixture teruji. Job merupakan staging sinkron lokal, bukan klaim worker queue/background scalable.



WEB-022: revisi immutable, satu versi berlaku per org/source/external-ID, credit unik dan berversi, linked-credit snapshot, net-includes-credit mencegah potong ganda. Retur merevisi periode invoice asal. Cancelled/draft/needs_review dikecualikan actual. Source header dan eligible net terpisah. finance_period_lock + finance_adjustment pending_review mendukung hook periode final; statement final belum dibangun, modul berikutnya wajib menulis lock dan mengonsumsi adjustment, bukan menganggap hook ini pembayaran/approval final. Line menyimpan unit/scale serta product/group snapshot; revisi credit/koreksi mempertahankan klasifikasi line historis.



WEB-023: attribution resolver mengutamakan Rep sumber sah, fallback assignment pada tanggal invoice, memeriksa area territory historis/role/scope/channel dan konflik owner. Konflik ditahan sebagai row review. Tidak ada atribusi ganda lintas kanal atau perubahan invoice lama ketika customer transfer. Versi sumber pilot harus integer positif monotonic; timestamp/non-numeric version memerlukan adapter sumber eksplisit. Payload sama pada versi sama/retry no-op; payload berbeda pada versi sama ditolak. Identical duplicates dalam batch tidak dihitung ulang.



WEB-024: daftar/detail/revision, periode/channel/area/rep/status filter, totals organisasi/kanal dan export admin. Detail root memakai ID current; histori tersedia melalui current/revisions dan dibatasi lagi menurut scope tiap versi. SQL actual pada dashboard/customer/status/timeline memakai is_current=1, tidak menjumlahkan revisi lama. List200terbaru, totals seluruh hasil, ekspor maksimal5000match, metadata periode/filter/timezone/scope/cutoff. Refresh/batch error tidak mengubah last successful sync. Original source cutoff dan commit time terlihat, mode manual tidak disebut real-time. Order belum menghasilkan actual.



Migration0015 menambah katalog/harga, invoice version/current identity/source ledger/line/credit/job/epoch/final-period hook;0016 product classification snapshots + indeks invoice current. Migrasi legacy menyimpan semua row, memilih row terakhir per identity sebagai current dan menandai collision needs_review agar tidak diam-diam menghitung ganda. Tidak mengklaim urutan source_version legacy sebagai versi sumber yang terbukti benar. Tidak ada remote migration/deploy.



Validasi:45/45automatedtests lulus. Fixture Rp160juta = lapangan Rp135juta + telesales Rp25juta, cancelled/retry/retur Rp5juta dan tanggal transfer owner lulus. Uji private source bytes/CSV/error/hash/stale snapshot/rollback/multi-tenant/scope/export/100invoice/credit cancellation/final-period adjustment/product group frozen lulus. Browser nyata Worker/D1/R2 lokal: kelompok→produk→harga→CSV(header+2line+credit)→dry-run/commit→revisi→export→mapfilter/focuspin, lebar320/390/768/1440 dan popup mobile tanpa pageerror. QA invoice dibatalkan melalui revision, master diarsipkan, total actual dikembalikan; source/revisions/credit/jobs/audits dipertahankan. Browser akhir membuktikan unknown customer masuk needs_review/errorCSV dan commit tidak tersedia, last-sync tidak berubah, map fallback bukan ilustrasi jalan, chart bar Overview tetap ada. Bukti test-results/m1-complete.cjs,m1-final.cjs beserta PNG. Build/TypeScript lulus; warning chunk MapLibre besar masih terbuka. Status keseluruhan M1 dan gate ada di M1_STATUS.json/md; baseline perencanaan tidak dipalsukan menjadi production accepted.



18Oktober2026 — perapihan data contoh:29nama master lokal demo-org yang berawalan QA diganti menjadi nama outlet/account/produk/kontak/cabang/area/kalender yang terbaca. Audit rename_demo_display dan manifest before/after berada di test-results/demo-name-changes.json; identitas/relasi/status arsip dan provenance transaksi tetap. Customer memakai kode eksternal sebagai identitas sekunder, tombol singkat Lihat/Edit/Arsipkan berjarak dengan aria-label nama, serta default outlet aktif. Katalog menyediakan filter Aktif/Diarsipkan/Semua, default aktif. Catatan sumber harga QA ditampilkan sebagai Daftar harga contoh; nilai provenance aslinya disimpan. Browser demo-names-ui.cjs lulus.



## Perencanaan 23 Oktober 2026 - Plan Visit Generator lokal

PRD, backlog MD/JSON dan status M4 mencatat WEB-069–074 sebagai M4 extension P1 Planned. Compute awal OSRM + Python OR-Tools pada komputer pribadi, agent outbound ke Workers; D1/R2 tetap, PostGIS/Cloudflare Containers belum diperlukan. Kontrak/data model, agent/routing, harian, bulanan/multi-sales, UI review/publish dan QA/operasi menjadi urutan pembangunan. Tidak ada pemasangan/runtime baru; tidak menambah gate pilot web atau Android. [Spesifikasi PVG](specifications/Plan_Visit_Generator_v1.md).


## WEB-063 tersedia lokal - 23 Oktober 2026

Pengaturan → Batas wilayah menyediakan import/resume draft dan review aktivasi dataset berversi. Backend: delapan operasi admin, migrasi 0035/enam tabel, R2 geometry privat/full topology/checksum, source/manifest count, ETag/idempotency/audit. 143 tests, build dan dua browser scenarios lulus; full D1/R2 restore termasuk batas wilayah lulus. Sampel enam kelurahan Gambir tetap draft; metadata/namespace/hak penggunaan/provider capacity belum diterima. Tidak mengubah customer/invoice/target/owner. WEB-064 overlay/matching berikutnya. [Runbook/evidence](WEB063_ADMIN_BOUNDARIES.md).


## WEB-067 — risiko pelanggan lokal, 24 Oktober 2026

Pengaturan kebijakan berversi dan popup, mode Risiko di Peta & Wilayah, immutable private evidence/history dan scoped customer drill tersedia. 183 tests, 3 browser scenarios, TypeScript/build dan recovery utama 96 tabel + QA 2 risk snapshots lulus. Pilot utama tetap tanpa policy/run risiko dan sumber nyata draft; fakta komersial tetap. Tidak ada cloud/production acceptance. Berikutnya WEB-068 pemerataan/simulasi beban. [Runbook/evidence](WEB067_RISK_DESIGN.md).

## WEB-068 — beban layanan dan simulasi wilayah lokal, 24 Oktober 2026

Pengaturan → Beban & kapasitas dan Distribusi sales → Beban & simulasi tersedia lokal. Policy bulanan eksplisit per kanal, seluruh portfolio sesuai scope, customer/kontak/menit/kapasitas terpisah, unknown/partial tidak menjadi spare capacity. Preview/save/history immutable/revisi dan apply satu batch WEB-065 lalu revalidate sisa, dengan tanggal efektif, scope/SPV/hash/epoch/ETag/idempotency/audit. 0041 menambah empat tabel; private R2 menyimpan bukti, tidak menduplikasi geometry. 276 operasi runtime terhubung kontrak. Histori fakta komersial tetap; pilot utama tanpa default policy/scenario dan sumber nyata draft. Recovery database/R2 serta browser diverifikasi lokal. Provider/cloud/human acceptance tetap pending. [Runbook](WEB068_WORKLOAD_DESIGN.md), [evidence](WEB068_EVIDENCE.json). Berikutnya WEB-069 kontrak dan model Plan Visit Generator.


## WEB-069 baseline desain dan persiapan WEB-070

37 operasi API desain dan 14 tabel draft, validator input/result/policy, state machine lease/fence/cancel/retry dan RBAC telah diverifikasi dengan 21 contract/model tests. Tidak ada endpoint/migrasi runtime generator. WEB-070 mulai readiness komputer; Docker tidak tersedia dan WSL belum terpasang. OSRM/solver belum dipasang; kapasitas graph belum terbukti. [Detail desain](WEB069_PLAN_VISIT_CONTRACT.md), [evidence](WEB069_EVIDENCE.json).


## WEB-070 progres kernel, 24 Oktober 2026

Doctor baca-saja, signed request P-256, challenge/jti atomik D1 prototype, transport loopback HTTP, graph-file verification dan adaptor OSRM table/cache/snap/cancel tersedia sebagai prototipe. 23 tes kernel/doctor dan 21 tes kontrak/model generator tercakup dalam 255 tes lulus. Tidak ada endpoint/migrasi generator, daemon agent, pairing nyata, graph atau OSRM/solver terpasang. WSL/Docker dan headroom disk masih perlu disiapkan sebelum preprocess nyata. [Detail dan sisa pekerjaan](WEB070_AGENT_PREPARATION.md), [evidence](WEB070_PROGRESS.json).
