> Status terkini26 Oktober2026: WEB-070/071 In progress; profil operasional dan daily kernel teruji lokal. OSRM di komputer lain serta Generate/review/publish web belum tersedia. Rincian terbaru di akhir dokumen; bagian bertanggal sebelumnya adalah histori.

# NYALES — Plan Visit Generator dan komputasi lokal

Keputusan pengguna 23 Oktober 2026. Status: **WEB-069 design baseline verified; WEB-070 preparation**. Belum ada agent lokal, engine routing, solver, endpoint atau migrasi runtime generator yang berjalan. Acuan PRD v1.10 dan backlog WEB-069–074. Perluasan M4 P1 setelah fondasi GIS; bukan gate tambahan pilot web saat ini atau pembangunan Android.

## Tujuan dan batas scope

Susun usulan kunjungan sales lapangan untuk satu hari atau satu bulan berdasarkan pelanggan, histori invoice net, prioritas layanan, kalender dan waktu perjalanan melalui jaringan jalan. Mulai satu sales/satu hari, lalu satu sales/satu bulan, kemudian beberapa sales pada assignment masing-masing. Batas kelurahan membantu pengelompokan wilayah, sedangkan jaringan jalan menjadi dasar perjalanan; keduanya dataset berbeda.

Hasil merupakan draft yang harus ditinjau sebelum masuk agenda. Telesales tetap terpisah: callback/izin kontak/DNC dan janji lintas kanal menjadi batas koordinasi, tanpa mengubah antrean telesales menjadi rute lapangan. Generator tidak mengubah owner customer, target, forecast, achievement, invoice atau insentif. Tidak menghasilkan bukti visit, tracking GPS, navigasi langsung atau ETA berbasis traffic real-time.

## Keputusan hosting dan pembagian komponen

**PVG-01 — Komputer pribadi dahulu.** OSRM dan Python OR-Tools dijalankan pada komputer pribadi yang disetujui pemilik NYALES. OSRM memakai container Linux melalui Docker/WSL2 pada Windows, setelah kompatibilitas, lisensi tool dan kebutuhan perangkat diverifikasi. OR-Tools dapat berada pada container terpisah atau runtime Python lokal yang versinya dikunci. Agent lokal mengambil pekerjaan secara outbound dari API NYALES melalui HTTPS; browser tidak harus berada pada komputer penghitung. Tidak memerlukan port publik komputer atau tunnel sebagai baseline.

| Komponen | Tanggung jawab |
| --- | --- |
| Web React + Workers | Input, autentikasi/scope, validasi, status pekerjaan, review dan publish agenda |
| D1 | Aturan dan versinya, referensi kalender/assignment, antrean/status/lease, metadata input/hasil dan versi agenda |
| R2 privat | Snapshot input/hasil besar dan arsip dataset jalan sesuai retensi dan kuota |
| Disk/RAM komputer pribadi | Extract OSM dan graph OSRM siap pakai; komputasi routing dan solver |
| OSRM | Snap ke jaringan jalan, matriks jarak/waktu dan geometri rute sesuai profil |
| Python OR-Tools | Penempatan kunjungan ke hari kerja dan urutan harian dengan constraint yang disetujui |
| Agent lokal | Polling, heartbeat, claim/lease, checkpoint, menjalankan engine dan mengunggah hasil |

D1/R2 tetap layanan data NYALES; file graph jalan tidak dimuat ke D1 dan R2 bukan runtime OSRM. PostGIS dan Cloudflare Containers tidak diperlukan pada tahap ini. Tidak ada provisioning Oracle/Google Cloud atau server berbayar pada keputusan ini. Pemindahan agent ke server nanti mempertahankan kontrak pekerjaan yang sama dan melalui evaluasi kapasitas/biaya tersendiri.

Targetnya tanpa tambahan sewa compute cloud dengan perangkat yang tersedia. Listrik, internet, disk, pemeliharaan serta penggunaan D1/R2/Workers di atas kuota tetap diperhitungkan. RAM/CPU/disk komputer, wilayah pilot, jumlah pelanggan, profil perjalanan dan durasi proses **belum dibuktikan**; WEB-070/074 mengukur sebelum menyatakan kapasitas atau biaya Rp0. Nama operator dan spesifikasi komputer dicatat saat setup, tidak diasumsikan sudah ditentukan.

## Data dan kebijakan perencanaan

**PVG-02 — Input berversi dan kualitas data.** Snapshot membekukan organisasi, scope, sales/assignment bertanggal, periode dan zona waktu Asia/Jakarta, kalender kerja/cuti/hari libur, jam mulai/akhir/istirahat, titik mulai/akhir, koordinat customer yang tervalidasi, jam penerimaan/PIC, durasi layanan, frekuensi dan jarak minimum antarvisit, janji/handoff terkunci, histori invoice net beserta cutoff/kelengkapan sumber, last visit bermakna dan tugas jatuh tempo. Simpan versi kebijakan, graph/profil routing, engine/solver, batas waktu, seed bila didukung, checksum dan asal input.

Bobot prioritas dapat mempertimbangkan penjualan historis/tren, keterlambatan kunjungan/repeat, churn risk dan kewajiban layanan. Management/NSM mengatur bobot, ambang, frekuensi, batas runtime dan asumsi. Tidak menetapkan angka bisnis baru secara diam-diam. Minimnya histori customer baru tidak berarti potensi nol. Penjualan historis tidak otomatis disebut potensi pasar dan prioritas omzet tidak boleh menghapus kebutuhan layanan minimum customer kecil yang telah ditetapkan.

Koordinat, durasi, jam kerja atau data penting yang hilang menghasilkan daftar review/belum dapat dijadwalkan; default hanya boleh dipakai jika dikonfigurasi secara eksplisit dan ditandai sebagai asumsi. Ketiadaan invoice bukan otomatis nilai nol bila sumber belum lengkap. Jaringan jalan, tanggal extract, lisensi/atribusi dan profil transport dicatat. Profil mobil tidak boleh diberi label motor tanpa validasi kesesuaiannya.

**PVG-03 — Routing terukur.** Mulai dari extract OSM wilayah pilot ditambah cakupan jalan penghubung yang diperlukan, bukan seluruh Indonesia. Preprocess OSRM dilakukan lokal; pemutakhiran graph menghasilkan versi baru. Matriks boleh dicache berdasarkan koordinat, graph dan profil; perubahan input menginvalidasi cache yang terkait. Titik gagal snap, jalan tidak terhubung, arah satu jalur, penyeberangan dan lokasi di luar cakupan mempunyai hasil eksplisit. Waktu yang tidak tersedia tidak menjadi nol dan jarak lurus tidak menggantikan waktu jalan secara diam-diam. Estimasi perjalanan diberi label berbasis graph/profil, tanpa traffic real-time.

## Perhitungan harian dan bulanan

**PVG-04 — Harian.** Ambil customer eligible pada assignment sales/tanggal yang berlaku. Penuhi jam kerja/istirahat, jendela penerimaan, durasi layanan, titik awal/akhir, kapasitas, janji tetap dan pengecualian tidak dikunjungi. Pilih serta urutkan kunjungan menggunakan waktu jalan; tampilkan waktu layanan/perjalanan, sisa kapasitas, prioritas dan customer tidak terjadwal beserta alasan. Pisahkan batas wajib (hard constraint) dan preferensi (soft constraint), dengan penalti/bobot dapat dijelaskan. Hasil yang melanggar batas wajib tidak dapat dipublish.

**PVG-05 — Bulanan.** Alokasikan kebutuhan/frekuensi kunjungan ke hari kerja dengan jeda antarvisit, kalender/cuti, janji dan kapasitas harian; lanjutkan urutan rute setiap hari dan validasi ulang kelayakan harian. Jika penempatan dan rute tidak cocok, revisi penempatan secara terbatas atau laporkan kunjungan yang belum terpenuhi. Memecah menjadi tahap bulanan dan harian adalah strategi awal yang harus diuji, bukan jaminan optimum global. Multi-sales mempertahankan owner/assignment per tanggal; redistribusi owner menggunakan workflow territory terpisah.

Kunjungan selesai, agenda terkunci, hari yang telah berlalu dan janji tetap tidak digeser untuk memperbaiki KPI. Regenerate hanya bagian masa depan yang diizinkan. Hasil mencatat total demand, terjadwal, belum terjadwal, pelanggaran/relaksasi soft constraint, estimasi waktu dan kapasitas per hari/sales. Solver memakai batas waktu/cancel; status feasible, infeasible dan timeout dibedakan. Timeout yang mempunyai solusi feasible boleh ditinjau sebagai hasil terbatas; jangan memberi label optimum tanpa bukti solver dan model yang mendukungnya.

## Antrean, konektivitas dan keamanan

**PVG-06 — Pekerjaan asynchronous.** Alur: pengguna meminta generate → Workers memvalidasi izin dan membekukan input → job queued → agent claim → OSRM matrix → OR-Tools → upload tervalidasi → draft siap direview → publish terpisah. Request web tidak ditahan selama solver berjalan. State minimum dirancang sebagai queued, running, cancel_requested, completed, failed, cancelled dan expired, dengan heartbeat/last seen agent terlihat terpisah.

Saat komputer mati/sleep/WSL berhenti atau internet putus, UI menjelaskan **menunggu komputer penghitung** atau heartbeat terputus, bukan sukses. Job yang belum dimulai tetap antre sampai batas antrean yang dikonfigurasi; job terputus dapat diulang setelah lease habis. Gunakan idempotency key, attempt/fencing token dan validasi kepemilikan lease: agent lama tidak boleh menimpa hasil attempt baru, hasil sesudah cancel ditolak, dan retry tidak mempublish agenda dua kali. Checkpoint/upload sementara diverifikasi checksum; file parsial/orphan dibersihkan sesuai retensi. Cancel/expiry dan pembatalan input snapshot diterapkan juga pada retry.

Agent didaftarkan per environment/organisasi memakai identitas mesin berizin minimum dan dapat dicabut. Token disimpan lokal secara aman, tidak di browser/repo/log; tidak memberikan kredensial D1/R2 atau akun admin umum ke agent. API membatasi job, input dan upload hanya milik scope agent; URL unduh/unggah privat berumur terbatas. Output dianggap input tak tepercaya: backend memeriksa organisasi, referensi, versi, ukuran dan constraint sebelum menerima draft. Perubahan role atau assignment diperiksa lagi saat review/publish. Cache lokal tunduk retensi, pemisahan environment/organisasi dan prosedur pembersihan perangkat.

## UI, hak akses dan penerapan

**PVG-07 — Tinjau sebelum agenda berubah.** Tombol **Generate Plan** berada pada agenda/rencana kunjungan yang sudah ada. Dialog memilih periode harian/bulanan, sales yang boleh diakses, parameter yang diizinkan dan janji yang terkunci. Hasil berupa kalender, daftar urutan per hari dan peta rute dengan ringkasan kapasitas; peta tetap memakai basemap aplikasi. Tampilkan input kurang, asumsi, versi/cutoff, umur graph dan alasan customer tidak terjadwal. UI mengikuti pill/motion, tooltip hitam-putih, akses keyboard, mobile dan reduced motion NYALES.

Management/NSM mengelola pengaturan model serta agent. Sales Rep mengusulkan rencana miliknya; Supervisor/Area Manager meninjau dan menerapkan sesuai hirarki/scope yang sudah berlaku, Management/NSM sesuai izin nasional. Area Manager tidak melihat area lain. Kontrak otorisasi rinci wajib dibuat pada WEB-069; permission baru tidak memberi akses pengaturan umum kepada role operasional. Aksi publish memerlukan review yang berwenang, diff agenda sebelum–sesudah, alasan perubahan, ETag/versi input terbaru, idempotency dan audit.

Perubahan koordinat, assignment, kalender, aturan atau agenda sejak snapshot menandai hasil stale. Publish menuntut revalidasi/recompute bagian terdampak. Penerapan agenda berlangsung atomik atau memakai staging dan aktivasi versi atomik agar kegagalan tidak meninggalkan setengah jadwal aktif. Regenerasi tidak menggandakan visit/task, membuat aktivitas selesai atau mengubah histori. Simpan siapa meminta, engine/attempt yang menghitung, siapa mengubah, meninjau dan menerapkan; perubahan manual sesudah generate divalidasi ulang.

## Urutan pembangunan dan kontrak data

1. **WEB-069:** spesifikasi detail, input/constraint/policy, ERD/migrasi rancangan dan kontrak API/agent termasuk RBAC serta state machine.
2. **WEB-070:** setup agent lokal + OSRM wilayah pilot, pairing/heartbeat/retry dan benchmark graph/matrix.
3. **WEB-071:** solver satu sales/satu hari dan alasan ketidaklayakan.
4. **WEB-072:** satu sales/satu bulan lalu multi-sales dalam assignment yang ada; validasi rute tiap hari.
5. **WEB-073:** generate/review/edit/publish agenda melalui UI dengan stale/idempotency/audit guards.
6. **WEB-074:** uji end-to-end, kapasitas dan panduan operasi/pemulihan komputer pribadi.

WEB-069 mengikuti fondasi WEB-063–065, agenda WEB-030/031/039 dan pengamanan API WEB-008/058. WEB-066/067 dapat memasok indikator tambahan bila sudah tersedia; generator awal tidak menunggu semua analitik dan tidak mengarang indikator yang belum ada. WEB-068 tetap simulasi territory tanpa routing; generator ini adalah modul terpisah. Android tetap mengikuti gate web/API sebelumnya.

Entitas yang sudah ada seperti job, work_plan/plan_item, kalender dan assignment hanya dipakai ulang setelah semantiknya diperiksa. Storage policy version, input snapshot, agent/lease/attempt, matrix manifest, candidate plan dan publish history harus dirancang pada WEB-069; dokumen ini tidak menyatakan schema/endpoint sekarang sudah mendukungnya. Retensi tiap artefak dan batas ukuran ditetapkan sebelum agent digunakan dengan data nyata. Panduan operasi mencakup install/start/stop, pairing/revoke, update engine/graph, antrean/cancel, backup/restore dan pembersihan cache. Versi schema/API/engine harus kompatibel sebelum agent mengambil job.

## Acceptance tambahan

Baseline kontrak/model PVG-A01/A03 diuji in-memory; acceptance runtime/end-to-end seluruh PVG-A01–10 tetap Planned. Tidak mengubah 82 skenario UAT baseline atau acceptance GEO/GIS sebelumnya.

| ID | Hasil wajib | Backlog |
| --- | --- | --- |
| PVG-A01 | Kontrak/schema/state machine/RBAC tervalidasi; token agent tidak dapat membaca job organisasi/environment lain atau mengubah aturan/agenda | WEB-069, WEB-070 |
| PVG-A02 | Region/profil/versi graph jelas; titik di luar cakupan, gagal snap dan tidak terhubung menghasilkan alasan; jalan satu arah dihormati dan matriks cache tidak stale | WEB-070, WEB-071 |
| PVG-A03 | Input koordinat/durasi kosong, histori minim dan sumber invoice tidak lengkap tetap terlihat sebagai review/unknown atau asumsi eksplisit; tidak berubah menjadi nol | WEB-069, WEB-071 |
| PVG-A04 | Rencana harian mematuhi jam kerja/istirahat/jam toko/kapasitas/janji; infeasible dan timeout dibedakan; customer tidak terjadwal mempunyai alasan | WEB-071 |
| PVG-A05 | Satu bulan mematuhi frekuensi/jeda/cuti, tiap hari feasible; assignment per tanggal benar, hari lalu/visit selesai/janji terkunci tetap; multi-sales tidak memindahkan owner | WEB-072 |
| PVG-A06 | Komputer mati/sleep/internet putus, dua agent, lease habis, retry, cancel dan output terlambat: UI jujur, fencing benar, tidak kehilangan antrean atau menggandakan hasil/publish | WEB-070, WEB-074 |
| PVG-A07 | Scope SR/SPV/Area Manager/nasional benar; review menampilkan diff; input berubah menahan publish sampai validasi ulang; gagal publish tidak meninggalkan agenda parsial | WEB-073 |
| PVG-A08 | Hasil/checksum/versi dapat ditelusuri; snapshot, restore dan regenerate masa depan tidak mengubah invoice/target/insentif/visit historis atau menggandakan task | WEB-073, WEB-074 |
| PVG-A09 | Data uji satu hari → satu bulan → beberapa sales mencatat jumlah customer, RAM/CPU/disk, lama preprocess/matrix/solver, cache, ukuran R2 dan operasi D1; batas kapasitas didasarkan pengukuran | WEB-074 |
| PVG-A10 | UI desktop/mobile/keyboard/reduced motion lulus, status agent/job/cancel/provisional jelas; panduan install/start/stop/revoke/backup/restore/cache bisa diulang operator | WEB-073, WEB-074 |


## WEB-069 — baseline desain generator, 24 Oktober 2026

Kontrak `nyales-visit-generator-1`, data dictionary dan 14 tabel SQL draft telah diuji di in-memory SQLite. 37 operasi desain belum diregistrasikan; policy/units/unknown/required-monthly versus daily-candidate, scope, machine lease/fence/cancel/retry dan publish staging-activation ditetapkan. Native work_plan/revision dipakai hanya setelah publish sah, bukan import/job generic. 21 contract/model tests lulus; scope/crypto/lease runtime, OSRM/solver, graph, UI dan PVG end-to-end tetap WEB-070–074. Runtime tetap 276 operasi dan 100 tabel lokal. [Spesifikasi detail](../WEB069_PLAN_VISIT_CONTRACT.md), [API desain](visit-generator.design.openapi.json), [model](ERD_WEB069_Design.json), [evidence](../WEB069_EVIDENCE.json).


## Implementasi WEB-070 identitas komputer — 25 Oktober 2026

[Runbook pairing/vault/heartbeat/revoke](../WEB070_AGENT_IDENTITY.md), [ERD fisik 0042](ERD_WEB070_Implementation.md), [sembilan operasi API aktual](visit-agent-identity.m4.openapi.json), [bukti progres](../WEB070_PROGRESS.json). Hanya Management/NSM mengatur mesin dan izin 1–10 sales lapangan aktif. Kode sekali pakai 15 menit; credential 30 hari, perubahan izin/issue ulang mengganti generasi dan mencabut akses sebelumnya. Request mesin memakai signature/challenge terpisah dari sesi pengguna; vault Windows DPAPI menyimpan private key dan credential terenkripsi. Heartbeat saat ini manual, laporan kemampuan bukan bukti solver siap. Queue/lease/graph/solver/publish tetap rancangan. WEB-070 keseluruhan masih In progress.

Runtime total 285 operasi, semuanya terkait kontrak implementasi. Migrasi menambah tujuh tabel; 105 aplikasi/107 termasuk metadata D1. Draft SQL 14 tabel WEB-069 tidak boleh diterapkan utuh setelah 0042. Data komersial dan agenda tidak berubah melalui registrasi mesin. Tidak ada deployment cloud atau acceptance produksi.


## WEB-070 antrean diagnostik — 25 Oktober 2026

[Runbook antrean agent](../WEB070_AGENT_QUEUE.md), [kontrak aktual 11 operasi](visit-agent-queue.m4.openapi.json), [ERD fisik 0043](ERD_WEB070_Queue_Implementation.md). Management/NSM dapat mengirim probe koneksi, melihat status/riwayat dan membatalkannya. Agent Windows dapat polling foreground/once, claim, renew, checkpoint, complete, fail dan cancel-ack; expiry/retry/fencing membatasi hak proses lama. Hanya payload probe yang dibuat server, tanpa customer/koordinat/penjualan/agenda. Satu tugas pending per komputer, lease120 detik, tiga percobaan dan deadline15 menit. Polling idle60 detik; unattended quota/retention acceptance belum selesai.

Total runtime296 operasi, 108 tabel aplikasi/110 termasuk metadata D1. WEB-070 tetap In progress: planning snapshot/policy/graph dan penghubung ke transport, OSRM engine/graph nyata serta benchmark belum tersedia. Status completed probe bukan bukti rute atau jadwal. [Bukti progres](../WEB070_PROGRESS.json) membedakan tes lokal dan acceptance produksi. Bagian bertanggal sebelumnya adalah histori.


## WEB-070 kebijakan dan kesiapan — 25 Oktober 2026

[Runbook](../WEB070_PLANNING_READINESS.md), [14 operasi aktual](visit-planning-readiness.m4.openapi.json), [ERD fisik0044](ERD_WEB070_Readiness_Implementation.md), [bukti terkini](../WEB070_PROGRESS.json). Management/NSM dapat menyimpan/meninjau draft kebijakan, mengaktifkan dengan ETag/checksum/expected-active-id, mendaftarkan manifest graph sebagai metadata belum terverifikasi, serta menyimpan snapshot kesiapan privateR2. Snapshot berversi menyebut assignment/kalender/tanggal, observasi invoice/visit, sumber belum lengkap, asumsi dan penghambat. Epoch/source/agenda/policy/graph/date berubah menandai hasil historis; bytes/hash dan histori immutable.

Kesiapan bukan VisitSnapshot solver dan tidak masuk antrean agent. Nilai yang tidak diketahui tetapnull; tidak mengasumsikan histori visit lengkap atau mengonversi frekuensi lama/jam teks menjadi aturan baru. Engine/solver belum aktif, sehingga can_generate=false dan publishable=false. Kebijakan frekuensi/bobot/asumsi/runtime/retensi tidak dipasang default pada pilot utama. Form override khusus hanya menampilkan/mempertahankan/menghapus nilai yang sudah ada; API mendukung penambahan dengan validasi customer. UI pembuatan override customer terstruktur menjadi tindak lanjut.

Total310 operasi runtime semuanya terhubung kontrak, 112 tabel aplikasi/114 termasuk metadata D1. Business planning job/artifact/solver/publish, source operasional yang kurang, engine/graph OSRM nyata dan benchmark tetap pending. Aturan retensi belum menjadi job pembersihan snapshot readiness otomatis. Bagian bertanggal sebelumnya adalah histori slice terdahulu; WEB-070 tetap In progress.


## Status terbaru WEB-070/071 — 26 Oktober 2026

Data operasional berversi tersedia pada Pengaturan → Perencanaan kunjungan → Data operasional: titik awal/akhir sales, istirahat/absen yang ditinjau, durasi dan jam penerimaan pelanggan. Rentang inklusif, revisi immutable pada rentang yang sama, scope/role/calendar/timezone per tanggal dan invalidasi readiness melalui source_epoch. [Runbook](../WEB070_OPERATIONAL_PROFILES.md), [8API aktual](visit-operational-profiles.m4.openapi.json), [ERD0045](ERD_WEB070_Operational_Implementation.md), [evidence](../WEB070_PROGRESS.json). Runtime318operasi,114tabel aplikasi/116 dengan metadataD1. Pilot utama tanpa parameter/profile default; row bisnis lama main/QA tetap identik (QA hanya menambah fixture terpisah).

Pengguna tidak mempunyai akses administrator pada Windows saat ini; routing memakai komputer lain. WSL/Docker tidak dipasang di laptop ini. Paket setup dan CLI disiapkan dengan [petunjuk host](../../tools/visit-compute-kit/README.md); alamat/OS/operator/area graph tujuan belum tersedia. Windows DPAPI agent tetap Windows-only; standalone CLI Linux belum diuji dan bukan agent Linux yang sudah berfungsi.

OR-Tools9.15.6755 benar-benar terpasang di venv lokal dan menghitung daily kernel melalui matrix terkontrol, independent validation, adapter VisitSnapshot dan file/HTTP/solver CLI. [WEB-071](../WEB071_DAILY_KERNEL.md), [progres](../WEB071_PROGRESS.json). Total311tes lulus tanpa skip, typecheck/build dan2browser profile lulus/Axe0. Engine OSRM/road graph nyata belum diuji; builder sumber bisnis, job solver, agenda terlindungi/lintas kanal dan UI/review/publish masih pending. Readiness tetapcan_generatefalse; standalone artifact tetap publishablefalse. WEB-070/071 tetap In progress; bukan PVG end-to-end atau acceptance produksi. Bagian bertanggal sebelumnya adalah histori slice terdahulu.


## Keputusan perangkat26 Oktober2026 — paket pemasangan dahulu

Komputer penghitung lain **belum tersedia**. Pengguna meminta paket pemasangan disiapkan dahulu. Tidak memasang WSL/Docker di laptop sekarang dan tidak melakukan provisioning remote. Paket revisi2 menambah [Mulai di sini](../../tools/visit-compute-kit/START-HERE.md) dan pemeriksa `python check-installation.py` yang memvalidasi manifest/file serta mendeteksi Node/solver tanpa mengunduh dependensi atau memulai service. Dependency lockfile, installer solver lokal, CLI dan launcher loopback disertakan; runtime/road graph/data pelanggan/credential tidak disertakan.

Empat tes batas pemeriksa paket lulus; ZIP diekstrak dan seluruh checksum/import diperiksa. Dependensi atau Node yang terdeteksi tidak membuktikan routing siap; `ready_for_real_planning:false`. WEB-070/071 tetap In progress. Pengujian311 backend sebelumnya tetap bukti kernel/slice terkait, bukan uji OSRM pada komputer tujuan yang belum ada. Bukti paket terkini: `test-results/web071-kit-v2-verify.json` dan WEB071_PROGRESS.json.
