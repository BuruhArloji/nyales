> Status terkini26 Oktober2026: WEB-070/071 In progress; profil operasional dan daily kernel teruji lokal. OSRM di komputer lain serta Generate/review/publish web belum tersedia. Rincian terbaru di akhir dokumen; bagian bertanggal sebelumnya adalah histori.

# Backlog Pembangunan Web NYALES v1.2



18 Oktober 2026. Acuan PRD v1.10, ERD/API v1.2. Implementasi lokal dan acceptance produksi dibedakan. M2 tersedia sebagai pilot lokal; acceptance produksi dan perbedaan terhadap rancangan tercatat pada M2_STATUS.md.



Keputusan 18 Oktober 2026: pelanggan/toko adalah entitas utama, satu pelanggan = satu lokasi. Lapisan Account bisnis/legal dihapus dari schema aktif, UI, API dan import. Kontak, assignment kanal, transaksi, target dan histori mengacu langsung ke pelanggan. Kode ERP opsional pada input manual, wajib dan unik dalam organisasi untuk import pelanggan. Pengaturan tetap hanya Management/NSM. Istilah account untuk identitas login, kuota provider atau Android developer tidak berarti entitas pelanggan.



Migrasi lokal 0017 menyimpan master dan relasi Account lama sebagai snapshot audit, menghapus tabel account/kolom account_id, dan mewajibkan validasi ulang batch import pelanggan lama. Dokumen ini menggantikan baseline sebelumnya untuk arsitektur pelanggan; status produksi tetap terpisah.



## WEB-001 - Baseline scope dan decision register



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** 



**Deliverable:** Scope web, role matrix dan daftar ambiguitas tersisa



**Acceptance:** PRD v1.10 menjadi acuan; invoice/kanal/90 hari/target/finalisasi konsisten. Aturan lama yang bertentangan dicatat dan diselesaikan tanpa meminta ulang keputusan yang sudah final. Pilot nyata dan sumber invoice boleh pending sampai gate integrasi.



**Requirements:** RBAC-01, TGT-01, INC-14



**API:** 



**Data:** 



## WEB-002 - Lengkapi ERD fisik dan migration plan



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** WEB-001



**Deliverable:** DDL D1, data dictionary, indeks dan migration berurutan



**Acceptance:** ERD v1.2 telah menambah persistence yang kurang; turunkan ke DDL/migration dengan composite FK organisasi, snapshot dimensi invoice, credit revision, unit scale dan pembulatan decimal. Uji temporal overlap/cycle, referential integrity dan migration tetap wajib sebelum Accepted.



**Requirements:** RBAC-01, RBAC-03, OFF-02



**API:** 



**Data:** 



## WEB-003 - Implementasikan kontrak API v1.2 dan contract tests



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** WEB-001, WEB-002



**Deliverable:** OpenAPI lengkap untuk fitur web P0 dan contract test plan



**Acceptance:** Kontrak v1.2 telah diperluas dan divalidasi statis; bangun contract tests runtime per endpoint web. Mutation dengan ETag memiliki read path; authorization, state machine, replay, partial sync dan source semantics dibuktikan pada implementasi. Spesifikasi tervalidasi tidak berarti API sudah berjalan.



**Requirements:** INT-01, ORD-01, TEL-07, CRM-02



**API:** 



**Data:** `work_plan`, `plan_item`, `lead`, `script_version`, `exception_case`, `coaching_note`, `notification`, `automation_rule`, `job`, `import_row`, `approval_policy`, `approval_request`, `idempotency_record`



## WEB-004 - Desain layar per role dan state



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** WEB-001



**Deliverable:** Prototipe navigasi dan komponen web responsif



**Acceptance:** Keempat area wajib terlihat: distribusi customer, invoice, target, tenaga sales. Loading/empty/error/conflict/offline/needs-review dapat dibedakan; alur form, keyboard dan mobile diuji.



**Requirements:** SUP-01, SUP-05, NFR-11



**API:** 



**Data:** 



## WEB-005 - Setup repo, quality checks dan environment



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** WEB-001



**Deliverable:** React/TS/Vite, Hono Worker dan konfigurasi dev/staging/prod



**Acceptance:** Build/typecheck/lint dan checks relevan berjalan; D1/R2 resource terpisah; secrets tidak masuk git/client; CI default ke staging. Produksi tidak otomatis dipublikasikan oleh tugas dokumentasi.



**Requirements:** SEC-02



**API:** 



**Data:** 



## WEB-006 - Fixture dan test harness bisnis



Milestone: M0 | Prioritas: P0 | Status: Planned



**Dependensi:** WEB-002, WEB-005



**Deliverable:** Seed sintetis dan unit/integration harness



**Acceptance:** Fixture Rp160 juta, 9 aktif/1 churn, target Rp200 juta dan insentif role dapat diulang. Tambahkan kasus customer belum pernah invoice, assignment overlap, duplicate import dan batas pembulatan. Expected output terpisah dari implementasi.



**Requirements:** INC-11, NFR-07



**API:** 



**Data:** 



## WEB-007 - Login Firebase dan mapping user internal



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-003, WEB-005



**Deliverable:** Login/logout, me dan verifikasi ID token



**Acceptance:** Issuer/audience/signature/expiry diverifikasi; org dari mapping server; user nonaktif ditolak; tidak ada token di log. SR tidak dapat mendaftarkan diri sebagai Management.



**Requirements:** SEC-01, RBAC-01



**API:** `GET /me`



**Data:** 



**Gate produksi:** Firebase project and real-account login/provisioning not configured.



## WEB-008 - Scope access middleware dan field permissions



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-007, WEB-002



**Deliverable:** Authorization semua resource, ekspor dan attachment



**Acceptance:** SR dapat melihat pelanggan dalam area atau assignment-nya; transaksi/aktivitas pribadi tetap memakai atribusi dan scope kanal; SPV team; AM area sendiri; Management/NSM pengaturan. Uji negatif list/search/detail/export lintas scope dan tenant lulus; nama ID valid tidak memperluas izin.



**Requirements:** RBAC-01, SEC-02, NFR-07



**API:** 



**Data:** 



**Gate produksi:** Real multi-user provider UAT pending; future resources require their own authorization tests.



## WEB-009 - Master organisasi, cabang, area dan kalender



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-008, WEB-004



**Deliverable:** Halaman konfigurasi Management dan kalender hari kerja



**Acceptance:** Timezone/hari libur/jam kerja dipakai SLA; AM tidak mengubah area atau melihat area lain. Timestamp disimpan UTC dan tanggal bisnis dihitung timezone cabang.



**Requirements:** CRM-04, AUT-03



**API:** `GET /branches`, `POST /branches`, `GET /areas`, `POST /areas`, `GET /branches/{id}`, `PUT /branches/{id}`, `POST /branches/{id}/archive`, `GET /areas/{id}`, `PUT /areas/{id}`, `POST /areas/{id}/archive`, `GET /calendars`, `POST /calendars`, `GET /calendars/{id}`, `PUT /calendars/{id}`, `POST /calendars/{id}/archive`



**Data:** 



**Gate produksi:** SLA job integration belongs to later workflow modules.



## WEB-010 - User, role dan hirarki bertanggal efektif



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-009



**Deliverable:** Pengelolaan SR/SPV/AM/Management/NSM dan kanal telesales



**Acceptance:** Satu SR satu SPV aktif; tidak ada cycle/overlap; perubahan tidak mengubah histori. SPV/AM tidak diwajibkan visit. Telesales terpisah dari lapangan.



**Requirements:** RBAC-03, CUS-03



**API:** `GET /users`, `POST /users`, `GET /hierarchy-assignments`, `POST /hierarchy-assignments`, `GET /users/{user_id}`, `PUT /users/{user_id}`, `POST /users/{user_id}/deactivate`, `GET /hierarchy-assignments/{assignment_id}`, `POST /hierarchy-assignments/{assignment_id}/end`



**Data:** `organization`, `branch`, `area`, `app_user`, `role`, `user_role`, `user_scope`, `reporting_assignment`, `calendar`, `device_session`



**Verifikasi lokal:** lulus; UAT produksi terpisah.



## WEB-011 - Sesi perangkat, revoke dan proteksi admin



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-007, WEB-008



**Deliverable:** Daftar sesi, pencabutan akses dan kontrol approver



**Acceptance:** Revoke efektif di backend; cache akun terisolasi. Mekanisme MFA admin/approver dan opsi provider diverifikasi terhadap prioritas gratis; jika belum tersedia status gate jelas, bukan klaim MFA aktif. Firebase TOTP memerlukan Identity Platform; verifikasi metode MFA dan budget aktual sebelum produksi, tanpa otomatis mengaktifkan paket berbayar. Device session binding mendukung revoke per perangkat.



**Requirements:** SEC-01, OFF-06



**API:** `POST /device-sessions`, `GET /device-sessions`, `GET /device-sessions/{session_id}`, `POST /device-sessions/{session_id}/revoke`



**Data:** 



**Gate produksi:** MFA provider/enrollment/recovery, budget and production setup pending; nonlocal admin access remains gated.



## WEB-012 - Master pelanggan/toko dan kontak



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-004, WEB-008, WEB-009



**Deliverable:** CRUD master dan validasi lokasi



**Acceptance:** Satu pelanggan/toko satu lokasi; tidak ada lapisan Account bisnis/legal. Input manual langsung nama, alamat dan area; kode ERP opsional. Kontak/nomor dinormalisasi. Koordinat hilang ditandai tanpa mengurangi total pelanggan. Hanya Management/NSM mengubah pengaturan. Histori invoice, assignment dan alias tetap utuh.



**Requirements:** CUS-01



**API:** `GET /customers`, `POST /customers`, `GET /customers/{customer_id}`, `PUT /customers/{customer_id}`, `GET /customers/{customer_id}/timeline`, `GET /contacts`, `POST /contacts`, `GET /contacts/{id}`, `PUT /contacts/{id}`, `POST /contacts/{id}/archive`, `POST /customers/{customer_id}/merge`



**Data:** `customer_outlet`, `contact`, `customer_assignment`, `segmentation_rule`, `customer_status_snapshot`, `contact_preference`



**Verifikasi lokal:** lulus; UAT produksi terpisah.



## WEB-013 - Import customer/produk dan laporan error



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-012, WEB-003



**Deliverable:** Template, dry-run, mapping dan commit batch



**Acceptance:** Field wajib/tipe/tanggal/ID diperiksa; hasil parsial terlihat; retry tidak menggandakan record; error per baris dapat diunduh sesuai scope. File sumber asli disimpan sesuai retensi. Import pelanggan hanya membutuhkan kode ERP unik, nama, alamat dan area aktif; batch schema lama wajib divalidasi ulang.



**Requirements:** INT-01, CUS-02



**API:** `POST /master-imports`



**Data:** 



**Gate produksi:** Organization retention policy pending; original sources held; no cloud R2 provisioned.



## WEB-014 - Deduplikasi dan merge berhistori



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-012, WEB-013



**Deliverable:** Candidate review, merge dan alias ID



**Acceptance:** Kode eksternal unik di org; nomor sama tidak otomatis merge; relasi transaksi/timeline tetap dapat ditelusuri setelah merge.



**Requirements:** CUS-02



**API:** 



**Data:** 



**Verifikasi lokal:** lulus; UAT produksi terpisah.



## WEB-015 - Assignment, transfer owner dan territory



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-010, WEB-012



**Deliverable:** Daftar pembagian customer dan reassignment efektif



**Acceptance:** Pelanggan assigned/unassigned dapat difilter; hanya satu owner primer aktif; telesales assignment bukan owner lapangan; transfer tanggal tertentu tidak memindahkan invoice historis.



**Requirements:** CUS-03, RBAC-03



**API:** `POST /customers/{customer_id}/assignments`, `GET /customers/{customer_id}/assignments`



**Data:** 



**Verifikasi lokal:** lulus; UAT produksi terpisah.



## WEB-016 - Tabel dan peta distribusi customer



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-015



**Deliverable:** Marker, filter area/sales dan pin lokasi



**Acceptance:** Tidak ada routing/ETA. Atribusi basemap ditampilkan; customer tanpa koordinat tetap masuk daftar/perbaikan. Posisi sales hanya data lokasi diterima dengan umur/akurasi. Peta termasuk scope web karena keputusan eksplisit pengguna walau INT-05 awal P1.



**Requirements:** INT-05, SUP-05



**API:** `GET /sales/last-positions`



**Data:** 



**Gate produksi:** Basemap provider key/capacity review pending; local fallback uses OSM; tile network failures explicitly shown.



## WEB-017 - Status aktif rolling 90 hari



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-024, WEB-012



**Deliverable:** Snapshot status dan job harian



**Acceptance:** Batas 90/91 hari benar; tanggal invoice dan cutoff timezone dipakai; belum pernah transaksi dibedakan dari churn; source belum lengkap = provisional/unknown.



**Requirements:** CUS-06



**API:** 



**Data:**



**Implementasi lokal:** Rolling 90 hari tanggal invoice, revisi/retur current, status Unknown bila sumber belum lengkap; New memerlukan bukti histori lengkap. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-018 - Konfigurasi Low/Mid/High dan versi rule



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-017, WEB-008



**Deliverable:** Nominal, percentile dan custom rule tervalidasi



**Acceptance:** Basis hanya angka sales; metode/threshold/periode dapat diatur Management; custom memakai DSL terbatas, bukan eksekusi kode bebas; snapshot lama tetap.



**Requirements:** CUS-06



**API:** `POST /customer-tier-rules`, `GET /customer-tier-rules`, `GET /customer-tier-rules/{rule_id}`, `POST /customer-tier-rules/{rule_id}/approve`



**Data:**



**Implementasi lokal:** Nominal/percentile/custom rentang angka; rule versi approved, scope area override dan snapshot immutable. Custom bukan kode bebas. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-019 - Mapping source invoice dan template final



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-003, WEB-013



**Deliverable:** Mapping header/line/credit/rep/channel dan data contoh sumber



**Acceptance:** Invoice ID/tanggal/net/retur/source-version didefinisikan; net termasuk credit tidak dipotong lagi. Bila sumber nyata belum ada, adapter memakai fixture dan pekerjaan integrasi nyata ditandai menunggu input, bukan selesai.



**Requirements:** INT-02, ORD-06



**API:** 



**Data:** 



**Gate produksi:** Actual company invoice source, mappings and tax/discount/freight/net semantics pending.



## WEB-020 - Master produk, unit, kelompok dan harga



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-008, WEB-013



**Deliverable:** Katalog dasar dan unit tervalidasi



**Acceptance:** SKU unik per org; unit/quantity scale eksplisit; harga efektif dan sumber terlihat. Stok/kredit tanpa sumber tidak diisi tersedia/lolos.



**Requirements:** ORD-01, ORD-04



**API:** `GET /products`, `POST /products`, `GET /products/{id}`, `PUT /products/{id}`, `POST /products/{id}/archive`, `GET /product-groups`, `POST /product-groups`, `GET /product-groups/{id}`, `PUT /product-groups/{id}`, `POST /product-groups/{id}/archive`



**Data:** 



**Verifikasi lokal:** lulus; UAT produksi terpisah.



## WEB-021 - Pipeline invoice import dry-run/commit



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-019, WEB-020



**Deliverable:** Batch job idempotent dan row errors



**Acceptance:** Commit memerlukan hasil validasi/hash sesuai payload; header tidak dikali line; duplicate invoice/credit tidak dihitung ulang; mapping ambigu masuk review, bukan actual final.



**Requirements:** INT-01, INT-02, ORD-05



**API:** `POST /invoice-imports`, `GET /jobs/{job_id}`, `GET /jobs/{job_id}/errors`, `GET /jobs/{job_id}/download`



**Data:** `product`, `import_batch`, `sales_order`, `order_line`, `invoice`, `invoice_revision`, `invoice_line`, `credit_note`, `order_invoice_link`, `product_group`, `credit_note_revision`, `invoice_revision_credit`



**Gate produksi:** Real source integration/acceptance and production capacity pending.



## WEB-022 - Revisi invoice, retur dan credit note



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-021



**Deliverable:** Revision immutable dan kalkulasi net eligible



**Acceptance:** Credit unik/ref invoice asal; invoice batal tidak actual; period invoice asal direstate dengan versi. Setelah statement final, revision memicu adjustment terkontrol.



**Requirements:** INC-15, ORD-06



**API:** `POST /invoices/{invoice_id}/revisions`, `GET /invoices/{invoice_id}/revisions`



**Data:** 



**Gate produksi:** Real source integration/acceptance and production capacity pending.; Later statement finalization must write finance_period_lock and consume finance_adjustment; no final statement/payroll module active.



## WEB-023 - Atribusi rep dan kanal invoice



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-015, WEB-021



**Deliverable:** Resolver atribusi dan needs-review queue



**Acceptance:** Rep invoice valid diprioritaskan; fallback assignment pada tanggal invoice; konflik area/owner ditahan untuk review. Satu invoice satu kanal primer; total kanal sama organisasi.



**Requirements:** CUS-03, COO-04



**API:** 



**Data:** 



**Gate produksi:** Real source integration/acceptance and production capacity pending.



## WEB-024 - Daftar/detail invoice dan rekonsiliasi actual



Milestone: M1 | Prioritas: P0 | Status: Implemented locally



**Dependensi:** WEB-022, WEB-023



**Deliverable:** Tampilan invoice/revision, totals dan drill-down



**Acceptance:** Fixture net Rp160 juta, lapangan Rp135 juta, telesales Rp25 juta. Filter/export konsisten; draft order tidak masuk actual invoice. Histori total dapat direkonsiliasi ke sumber/revision.



**Requirements:** ORD-02, ORD-06, SUP-05



**API:** `GET /invoices`, `GET /invoices/{invoice_id}`



**Data:** 



**Gate produksi:** Real source integration/acceptance and production capacity pending.



## WEB-025 - Plan target periode/basis/kanal



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-024, WEB-010



**Deliverable:** Draft target dan version workflow



**Acceptance:** Hanya Management/NSM mengatur target; basis invoice IDR; periode, dimensi dan metode jelas; zero/missing target needs review untuk insentif.



**Requirements:** TGT-01, TGT-02, INC-01



**API:** `POST /target-plans`, `GET /target-plans`



**Data:** `target_plan`, `target_version`, `target_item`, `target_allocation`, `forecast_contribution`, `forecast_realization`, `forecast_snapshot`, `forecast_snapshot_item`



**Implementasi lokal:** Periode, kanal dan versi plan; basis leaf customer/rep dengan revenue/produk/group. Satu approved plan per kanal pada periode beririsan adalah batas pilot. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-026 - Bottom-up customer dan Sales Rep



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-025



**Deliverable:** Editor target dan rollup hirarki



**Acceptance:** Customer target/SR target tidak overlap basis; parent tidak dijumlahkan bersama child; jumlah leaf+reserve cocok parent. Perubahan setelah approval membuat versi baru.



**Requirements:** TGT-01, TGT-02



**API:** 



**Data:**



**Implementasi lokal:** Bottom-up customer atau rep, mencegah leaf/basis beririsan; snapshot area/rep/hirarki dan reserve terpisah. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-027 - Top-down historis tiga bulan dan onboarding



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-025



**Deliverable:** Allocation run draft, override dan rincian baseline



**Acceptance:** Gunakan tiga bulan kalender selesai; baseline baru hanya bulan selesai yang tersedia; tanpa histori pakai onboarding input. Largest remainder deterministik; target anak+reserve tepat parent; zero denominator tidak dibagi otomatis. Normalisasi customer baru memakai jumlah bulan penuh tersedia; bobot mapan memakai tiga bulan. Reserve tidak dihitung dua kali.



**Requirements:** FRC-07, TGT-01



**API:** 



**Data:**



**Implementasi lokal:** Tiga bulan kalender selesai, normalisasi bulan 1/2/3, onboarding tetap, largest remainder. Zero history/unknown age membutuhkan input/review. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-028 - Submit, approve dan lock target



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-026, WEB-027, WEB-008



**Deliverable:** Target version disahkan dan dikunci



**Acceptance:** Tidak self-approve; tidak mengubah target saat actual masuk; revision menyimpan original dan berlaku; metode alternatif tidak dijumlahkan.



**Requirements:** RBAC-02, TGT-02



**API:** `POST /target-versions/{target_version_id}/items`, `GET /target-versions/{target_version_id}/items`, `POST /target-versions/{target_version_id}/allocations`, `POST /target-versions/{target_version_id}/submit`, `POST /target-versions/{target_version_id}/approve`, `POST /target-versions/{target_version_id}/revise`, `GET /target-versions/{target_version_id}`



**Data:**



**Implementasi lokal:** Submit/approve independen, ETag, approved lock dan revisi berhistori; UAT dua akun Firebase nyata masih pending. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-029 - Achievement dan gap yang bisa ditelusuri



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-028, WEB-024



**Deliverable:** Ringkasan target/actual/gap per scope



**Acceptance:** Unit/basis/periode sama; denominator nol = tidak berlaku; negative adjustment terlihat; filter sales/team/area/kanal akurat.



**Requirements:** TGT-01, FRC-02



**API:** `GET /targets`



**Data:**



**Implementasi lokal:** Actual invoice current dan retur sesuai basis; ambigu produk/merge ditahan review. Reserve tidak mengarang actual atau achievement. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-030 - Agenda lapangan dan snapshot rencana



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-015, WEB-009, WEB-004



**Deliverable:** Agenda mingguan/berulang dan reschedule beralasan



**Acceptance:** SPV mengatur pekerjaan kunjungan scope team; SR dapat usul; kapasitas/jam outlet/hari kerja terlihat; perubahan setelah deadline tidak memperbaiki completion historis diam-diam.



**Requirements:** FLD-01, CUS-04, TGT-03



**API:** `GET /work-plans`, `POST /work-plans`, `GET /work-plans/{id}`, `PUT /work-plans/{id}`, `GET /plan-items`, `POST /plan-items`, `GET /plan-items/{id}`, `PUT /plan-items/{id}`



**Data:**



**Implementasi lokal:** Agenda, usulan/approval, recurrence 1-12 minggu, snapshot jadwal asli dan reschedule reason; slot collision tetap 30 menit pada pilot. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-031 - Sesi kerja dan pengecualian kehadiran



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-010, WEB-030



**Deliverable:** Start/end sesi web dan exception



**Acceptance:** Tidak menjanjikan tracking background; kehadiran, visit dan cuti/training dibedakan. End sesi memeriksa visit aktif; SPV/AM tidak diwajibkan sesi kunjungan.



**Requirements:** FLD-05, FLD-06, SEC-04



**API:** `POST /work-sessions`, `GET /work-sessions`, `GET /work-sessions/{session_id}`, `POST /work-sessions/{session_id}/end`



**Data:**



**Implementasi lokal:** Sesi work/leave/training, waktu server dan larangan end saat visit aktif. Bukan payroll atau pembuktian kehadiran otomatis. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-032 - Check-in/out dan kualitas lokasi



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-031, WEB-003



**Deliverable:** Visit event web dengan lokasi/akurasi/sumber



**Acceptance:** Satu visit aktif sesuai policy; GPS buruk/ditolak masuk exception dan dapat diperbaiki; checkout lebih dulu direkonsiliasi; no fraud otomatis; last position tidak dianggap current tanpa timestamp.



**Requirements:** FLD-02, FLD-03



**API:** `POST /visits/{activity_id}/check-in`, `POST /visits/{activity_id}/check-out`



**Data:**



**Implementasi lokal:** Check-in/out berpasangan, GPS browser + accuracy/client/server time; denied/out-of-order review, last position monotonic. Bukan GPS background. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-033 - Outcome visit dan next action



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-032



**Deliverable:** Form hasil, checkout dan follow-up wajib



**Acceptance:** Outcome terstruktur; incomplete tidak completed; follow-up memiliki PIC/tenggat; kunjungan tutup/tanpa PIC tidak counted meaningful coverage.



**Requirements:** FLD-04, CRM-03



**API:** `GET /activities`, `POST /activities`, `GET /activities/{activity_id}`, `POST /activities/{activity_id}/revisions`



**Data:**



**Implementasi lokal:** Outcome, catatan dan next action; visit productive bukan order atau actual invoice. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-034 - R2 upload/download evidence privat



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-008, WEB-005, WEB-032



**Deliverable:** Upload intent, finalize dan signed download



**Acceptance:** Checksum/size/MIME diverifikasi; upload gagal tidak hilangkan form; akses download scoped; orphan cleanup dan expiry terkontrol; tidak ada URL publik permanen.



**Requirements:** SEC-02, OFF-05



**API:** `POST /attachment-intents`, `POST /attachments/{attachment_id}/finalize`, `GET /attachments/{attachment_id}`, `GET /attachments/{attachment_id}/download`



**Data:**



**Implementasi lokal:** Intent/upload/finalize/private download R2, checksum/magic/size/scope. Implementasi memakai authenticated proxy, belum signed URL desain produk. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-035 - Draft web offline dan retry persisten



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-032, WEB-033, WEB-003



**Deliverable:** IndexedDB outbox/draft dan status sync



**Acceptance:** Persist sebelum label saved-locally; restart browser memulihkan draft yang tersimpan; client event ID/retry stabil; pergantian akun login terisolasi; pending/rejected/review berbeda. Batas storage/eviction browser dijelaskan, tidak menjanjikan ketahanan Android/Room. Ukur P95 ack maksimal 60 detik setelah batch dikirim pada koneksi/sesi valid; waktu tunggu batch dilaporkan terpisah.



**Requirements:** OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, NFR-05



**API:** `POST /sync/events`



**Data:** `sync_event`, `integration_outbox`, `attachment`, `activity_attachment`, `last_position`



**Implementasi lokal:** Draft IndexedDB dan outbox per owner, stable client event, satu event/request, retry/review. Satu sampel ack bukan bukti P95/mobile SLA. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-036 - Campaign, script dan queue telesales



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-015, WEB-003



**Deliverable:** Workbench dan konfigurasi campaign oleh Management



**Acceptance:** Urutan callback/overdue/lead/SLA/reorder deterministik; script versi dan qualification lengkap; telesales tidak disamakan dengan owner lapangan.



**Requirements:** TEL-01, TEL-02, TEL-08



**API:** `GET /campaigns`, `POST /campaigns`, `GET /campaigns/{id}`, `PUT /campaigns/{id}`, `POST /campaigns/{id}/archive`, `GET /scripts`, `POST /scripts`, `GET /scripts/{id}`, `PUT /scripts/{id}`, `POST /scripts/{id}/archive`



**Data:**



**Implementasi lokal:** Campaign/script create/edit/archive, qualification dan script snapshot saat claim, workbench berprioritas. Ranking masih formula pilot tetap. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-037 - Lease queue dan proteksi kontak/DNC



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-036, WEB-008



**Deliverable:** Atomic claim/renew/expire, cooldown dan suppression



**Acceptance:** Dua agent tidak mendapat item sama; DNC berlaku sebelum claim/call baru; jam kontak/attempt limit dan alasan override dicatat. Visit aktif menahan campaign sesuai policy.



**Requirements:** TEL-02, TEL-03, TEL-07, SEC-03, COO-02



**API:** `POST /telesales/queue/claim`, `POST /telesales/queue/{queue_item_id}/complete`, `GET /contacts/{contact_id}/preferences`, `POST /contacts/{contact_id}/preferences`, `POST /telesales/queue/{queue_item_id}/renew`



**Data:**



**Implementasi lokal:** Lease unik per customer, renew/expiry, DNC/permission/attempt/callback/active visit holds. Multi-tab race diuji di route fixture, UAT device nyata pending. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-038 - Click-to-call, disposition dan callback



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-037, WEB-009



**Deliverable:** Call manual, callback calendar dan hasil kontak



**Acceptance:** Open dialer bukan connected verified; non-PIC dibedakan; reschedule overdue tetap menyimpan keterlambatan; slot luar jam layanan ditolak/diusulkan alternatif.



**Requirements:** TEL-04, TEL-05, TEL-06



**API:** 



**Data:**



**Implementasi lokal:** Tel link hanya sesudah renew; disposition manual_unverified, qualification dan callback kalender. Tidak ada CTI/provider call verification. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-039 - Task, handoff dan kalender lintas kanal



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-033, WEB-038



**Deliverable:** Task lifecycle, handoff accept/decline dan SLA



**Acceptance:** Handoff ditolak kembali ke pengirim/supervisor; tidak transfer owner/kredit otomatis; kalender scoped menghindari tabrakan; tugas tidak hilang saat penerima berubah.



**Requirements:** COO-03, COO-05, CRM-03, CRM-04



**API:** `GET /tasks`, `POST /tasks`, `POST /tasks/{task_id}/complete`, `POST /handoffs`, `GET /handoffs`, `POST /handoffs/{handoff_id}/accept`, `POST /handoffs/{handoff_id}/decline`, `POST /handoffs/{handoff_id}/complete`, `GET /tasks/{task_id}`, `PUT /tasks/{task_id}`, `POST /tasks/{task_id}/cancel`, `GET /handoffs/{handoff_id}`, `POST /handoffs/{handoff_id}/cancel`



**Data:** `work_session`, `activity`, `visit`, `call_attempt`, `campaign`, `queue_item`, `task`, `handoff`, `opportunity`



**Implementasi lokal:** Task start/complete/cancel/reschedule dan handoff accept/decline/complete/cancel; jadwal asli dipertahankan. Reassign task antar PIC belum tersedia; gunakan cancel + create/handoff. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-040 - Customer 360, timeline dan catatan terbatas



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-024, WEB-039



**Deliverable:** Halaman customer lengkap dan field-level permissions



**Acceptance:** Activity/order/invoice/task/next-action lintas kanal dapat ditelusuri; sumber/freshness terlihat; catatan sensitif terbatasi; data kosong bukan nol.



**Requirements:** CUS-05, COO-01



**API:** 



**Data:**



**Implementasi lokal:** Customer 360 menambah timeline aktivitas/task/handoff/order/forecast menurut scope. Data sumber tetap invoice; order diberi label bukan actual. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-041 - Lead dan opportunity stage gates



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-040, WEB-003



**Deliverable:** Lead qualification, stage pipeline dan lost reasons



**Acceptance:** Qualified/Proposal/Won memenuhi syarat; lost alasan wajib; Won tanpa invoice bukan actual; follow-up SLA dan stagnasi tujuh hari kerja masuk exception.



**Requirements:** CRM-01, CRM-02, CRM-04, CRM-05



**API:** `GET /leads`, `POST /leads`, `GET /leads/{id}`, `PUT /leads/{id}`, `GET /opportunities`, `POST /opportunities`, `GET /opportunities/{opportunity_id}`, `PUT /opportunities/{opportunity_id}`



**Data:**



**Implementasi lokal:** Lead/opportunity tujuh stage, proposal/qualified/won/lost gates dan reopen. SLA berdasarkan kalender dan aktivitas bermakna. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-042 - Draft order web dan snapshot komersial



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-020, WEB-035, WEB-003



**Deliverable:** Editor order/line dan draft offline



**Acceptance:** SKU/unit/qty/harga/diskon/pajak dan sumber lengkap; draft belum validated; harga/stok/kredit divalidasi ulang online; retry client_order_id tidak duplikat.



**Requirements:** ORD-01, ORD-04, ORD-05, OFF-04



**API:** 



**Data:**



**Implementasi lokal:** Order draft snapshot SKU/unit/harga/diskon/pajak, integer rupiah, 50 lines dan client order id; tidak otomatis dikirim ERP. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-043 - Approval order dan konfirmasi backoffice



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-042, WEB-008



**Deliverable:** Workflow approval, status pending dan external reference



**Acceptance:** Rule konfigurasi Management; tidak self-approve; perubahan material reapprove; timeout ambigu tetap pending; confirmed order terpisah invoice. Tidak mengirim ERP otomatis di rilis awal.



**Requirements:** ORD-02, ORD-03, ORD-06, INT-02



**API:** `GET /approval-policies`, `POST /approval-policies`, `GET /approval-policies/{id}`, `PUT /approval-policies/{id}`, `POST /approval-policies/{id}/archive`, `GET /orders`, `POST /orders`, `GET /orders/{order_id}`, `PUT /orders/{order_id}`, `POST /orders/{order_id}/submit`, `POST /orders/{order_id}/approve`, `POST /orders/{order_id}/reject`, `POST /orders/{order_id}/cancel`, `POST /orders/{order_id}/external-confirmations`



**Data:**



**Implementasi lokal:** Policy diskon/harga, review stok/kredit manual independen, approval/reject/revisi/konfirmasi backoffice. Data stok/kredit provider belum tersambung. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-044 - Forecast invoice residual dan repeat estimate



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-041, WEB-029, WEB-043



**Deliverable:** Worksheet per sales dan kategori eksklusif



**Acceptance:** Actual+C/B/P tidak overlap; repeat estimate tidak menggandakan opportunity; forecast yang terealisasi mengurangi residual sama besar; expected invoice date eligible pada periode.



**Requirements:** CRM-06, FRC-01, FRC-02, FRC-03, FRC-04, FRC-05



**API:** `GET /forecast-contributions`, `POST /forecast-contributions`, `GET /forecast-contributions/{contribution_id}`, `PUT /forecast-contributions/{contribution_id}`



**Data:**



**Implementasi lokal:** Forecast sales dan alternatif manager terpisah, actual + residual, canonical basket dan revisi/merge review; committed wajib evidence. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-045 - Review forecast menjadi tindakan



Milestone: M2 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-044, WEB-039



**Deliverable:** Gap drill-down dan estimasi manager alternatif



**Acceptance:** Gap membuka customer/next-action/PIC; manager alternatif tidak ditambah ke estimasi SR; task baru tidak otomatis menaikkan forecast; resource data belum eligible terlihat. Hubungan aktivitas/hasil, hambatan dan potensi tampil tanpa klaim sebab-akibat otomatis.



**Requirements:** FRC-06, FRC-07, SUP-07



**API:** 



**Data:**



**Implementasi lokal:** Review kategori/gap/next action membuat task, tidak menambah forecast otomatis. Gap hanya target approved dengan basis sebanding. Bukti dan gate: [M2_STATUS](../M2_STATUS.md). Kontrak aktual: [M2 /api](m2-api.openapi.json). Endpoint /api/v1 yang tercantum di atas tetap rancangan produk.





## WEB-046 - Konfigurasi plan, role, kanal dan layer



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-028, WEB-003, WEB-008



**Deliverable:** Wizard plan versions dan enrollment



**Acceptance:** Role/kanal punya parameter sendiri; threshold+bonus, flat, whole-basis, progressive dan milestone P0; layer tidak overlap; cap default nonaktif; active plan tidak ditimpa; missing target ditahan.



**Requirements:** INC-01, INC-02, INC-03, INC-04, INC-05, INC-09, TGT-04



**API:** `POST /incentive-plans`, `GET /incentive-plans`, `POST /incentive-plan-versions/{plan_version_id}/approve`, `POST /incentive-plan-versions/{plan_version_id}/revise`, `POST /incentive-enrollments`, `GET /incentive-plan-versions/{plan_version_id}`, `PUT /incentive-plan-versions/{plan_version_id}`, `POST /incentive-plan-versions/{plan_version_id}/submit`



**Data:**



**Implementasi lokal:** Wizard plan/version, lima model P0, enrollment leaf beku, role/kanal dan cap nonaktif default; one primary per peserta/periode, preview wajib dan approval independen. Aktivasi langsung dari submitted setelah approval; tidak ada prorata diam-diam. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-047 - Engine deterministic dan progressive pilot



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-046, WEB-024, WEB-006



**Deliverable:** Calculation library dan persisted run inputs



**Acceptance:** 80% bonus B, 81% B+Rp100 ribu dan 102% B+Rp2,4 juta untuk target Rp1 miliar/rate contoh; per-role berbeda; half-up rupiah; stacking dan credited basis eksplisit. Tidak memakai float atau forecast untuk hasil final. Pilot tidak memiliki split lintas kanal; supervisor/AM memakai target agregat dan entitlement biaya terpisah. Nilai breakdown decimal disimpan sebelum rounding total.



**Requirements:** INC-06, INC-07, INC-10, INC-11, INC-12, INC-20



**API:** `POST /incentive-calculations`



**Data:** `incentive_plan`, `incentive_plan_version`, `incentive_tier`, `incentive_enrollment`, `calculation_run`, `incentive_statement`, `statement_source`, `statement_component`, `incentive_adjustment`, `export_batch`, `export_item`, `audit_event`, `statement_dispute`



**Implementasi lokal:** Engine BigInt rational, threshold bonus + progressive, flat, whole-basis, progressive dan milestone highest/cumulative. Half-up total rupiah; breakdown exact numerator/denominator dan decimal disimpan pada run immutable. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-048 - Simulasi, estimasi dan statement drill-down



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-047, WEB-029



**Deliverable:** Preview lapisan dan statement input/output



**Acceptance:** What-if tidak menghasilkan payout; source invoice revision tersimpan; breakdown target/achievement/eligible/tarif/exclusion jelas; data nominal rekan dibatasi.



**Requirements:** INC-08, INC-12, INC-13, INC-19



**API:** `POST /incentive-simulations`



**Data:**



**Implementasi lokal:** Simulasi what-if + boundary bawah/tepat/atas dan perbandingan whole/progressive. Estimasi pribadi tidak membuat run/entitlement; statement menampilkan target/actual/credited source/rule/cap/exclusion, sumber historis diproyeksikan ulang menurut izin saat dibaca. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-049 - Review, dispute dan finalisasi manual



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-048, WEB-008



**Deliverable:** Prepared/review/disputed/final workflow



**Acceptance:** Management/NSM menekan finalize; unresolved exception/dispute menahan approval; self-approval ditolak; versi terkunci dan retry tidak finalisasi dua kali; tidak membayar uang.



**Requirements:** INC-02, INC-14, RBAC-02



**API:** `GET /incentive-statements`, `GET /incentive-statements/{statement_id}`, `POST /incentive-statements/{statement_id}/finalize`, `POST /incentive-statements/{statement_id}/revise`, `GET /incentive-statements/{statement_id}/sources`, `POST /incentive-statements/{statement_id}/disputes`, `GET /disputes/{dispute_id}`, `POST /disputes/{dispute_id}/resolve`, `POST /incentive-statements/{statement_id}/submit`, `POST /incentive-statements/{statement_id}/payment-confirmations`



**Data:**



**Implementasi lokal:** Prepared → under_review → finalize manual, ETag/idempotensi, creator/submitter/beneficiary tidak self-approve. Dispute open/accepted run sama menahan approval. Deadline dispute pilot tujuh hari, belum configurable. Tidak membayar uang. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-050 - Revisi retur dan export statement



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-049, WEB-022



**Deliverable:** Revision chain, entitlement delta dan export batches



**Acceptance:** Retur menurunkan achievement dengan rule periode asli; statement original tetap; export retry bukan hak bayar baru; exported bukan paid; referensi finance/pembayaran tetap terpisah.



**Requirements:** INC-15, INC-16, INC-19, INC-20



**API:** `POST /incentive-exports`



**Data:**



**Implementasi lokal:** Recalculation draft membuat revision baru, final lama tidak berubah; return/revision menghitung ulang dengan rule/target periode asli dan menyimpan entitlement delta. Export JSON batch+checksum dapat diulang sebagai copy; konfirmasi finance terpisah. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-051 - Dashboard empat pilar dan distribusi beban



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-016, WEB-018, WEB-029, WEB-040, WEB-045



**Deliverable:** Dashboard customer/sales/target/tenaga sales



**Acceptance:** Filter periode/area/team/SR/kanal konsisten; statistik customer/activity dan invoice terpisah; klik angka membuka record sumber; last-position web bukan live tracking Android. Tiga tampilan lapangan, telesales dan gabungan tersedia; customer dan transaksi lintas kanal tidak dihitung ganda.



**Requirements:** SUP-01, SUP-05, TGT-03, SUP-06



**API:** `GET /dashboard/summary`



**Data:**



**Implementasi lokal:** Monitoring empat pilar, filter periode/cabang/area/team/sales/kanal, lapangan/telesales/gabungan dan record drill-down; sumber invoice terpisah dari aktivitas. Cohort pelanggan memakai master aktif dan scope saat ini, bukan historical cohort snapshot. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-052 - KPI, cohort dan rekonsiliasi agregat



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-051, WEB-024, WEB-006



**Deliverable:** Definitions version dan query KPI



**Acceptance:** Contoh coverage 65% lulus; denominator nol tidak berlaku; unknown tidak nol; declared/verified dibedakan; sumber invoice vs order tidak tercampur; agregasi antar kanal tidak ganda.



**Requirements:** COO-04, SUP-05, FRC-05



**API:** 



**Data:**



**Implementasi lokal:** KPI definition nyales-kpi-1, coverage unique meaningful 13/20=65%, denominator nol=null, source belum lengkap=provisional/null dengan observed terpisah. Invoice gabungan tidak ganda; koneksi PIC manual bukan verified provider. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-053 - Exception inbox, coaching dan tindak lanjut



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-039, WEB-041, WEB-051



**Deliverable:** Inbox severity/owner/due/action dan coaching review



**Acceptance:** Visit belum checkout, callback/SLA, mapping, order pending dan sync gagal dapat ditangani. SPV dapat mengelola pekerjaan team tanpa hak mengubah parameter bisnis; reason/resolution diaudit.



**Requirements:** SUP-02, SUP-03, SUP-04



**API:** `GET /exceptions`, `POST /exceptions`, `GET /exceptions/{id}`, `PUT /exceptions/{id}`, `GET /coaching`, `POST /coaching`, `GET /coaching/{id}`, `PUT /coaching/{id}`, `POST /exceptions/{id}/resolve`



**Data:**



**Implementasi lokal:** Exception prioritas/owner/due/resolution audit dan coaching summary/next action/close sesuai scope. Visit belum checkout >12 jam masuk job; mapping/order/sync dapat dicatat manual dan job tersedia untuk SLA/overdue. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-054 - Reminder, automation dan quiet hours



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-053, WEB-009



**Deliverable:** In-app notification dan Cron checkpoint jobs



**Acceptance:** Rule version+trigger ID idempotent; retry tidak membuat task/alert ganda; callback, SLA, approval, sync notification tersedia; quiet hours timezone penerima; tidak bergantung SMS/WA berbayar.



**Requirements:** AUT-01, AUT-02, AUT-03



**API:** `GET /notifications`, `GET /notifications/{notification_id}`, `POST /notifications/{notification_id}/read`



**Data:**



**Implementasi lokal:** In-app notification unik trigger+rule version, callback/SLA/approval/sync conflict, read owner-only; policy quiet hours Management/NSM. Zona penerima memakai satu cabang efektif bila tersedia, fallback zona kebijakan bila ambigu. Cron perlu deploy untuk otomatis. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-055 - Freshness, audit search dan export umum



Milestone: M3 | Prioritas: P0 | Status: Implemented local pilot; production acceptance pending



**Dependensi:** WEB-052, WEB-050, WEB-008



**Deliverable:** Timestamp sumber, state, audit explorer dan export job



**Acceptance:** Refresh UI tidak memajukan source sync; null/zero/stale/provisional benar; export membawa filter/cutoff/timezone/versi, scoped dan private; log akses sensitif tidak membuka token/PII berlebihan.



**Requirements:** SUP-05, SEC-02, INC-19, NFR-06, NFR-10



**API:** `GET /audit-events`, `POST /report-exports`



**Data:**



**Implementasi lokal:** Freshness sumber terpisah dari UI read time; audit metadata tanpa raw before/after PII, sensitive-access audit, private report CSV R2/checksum/cutoff/filter/timezone/KPI version, expire 24 jam. Ekspor umum hanya Management/NSM pada pilot. Bukti/gate: [M3_STATUS](../M3_STATUS.md). Kontrak aktual: [M3 /api](m3-api.openapi.json). API /api/v1 yang tercantum pada item tetap rancangan produk.





## WEB-056 - Observability, capacity dan budget gratis



Milestone: M4 | Prioritas: P0 | Status: Implemented local pilot; production capacity gates pending



**Dependensi:** WEB-055, WEB-005, WEB-054



**Deliverable:** Metrik API/job/queue, budget dan alert owner



**Acceptance:** Profil data/concurrency pilot tertulis; ukur D1 read/write/storage/CPU/R2/maps, termasuk query dashboard dan indexes. Alert 70/85/95%; tidak auto-upgrade/auto-delete bisnis. Host/provider akun milik organisasi.



**Requirements:** NFR-01, NFR-02, NFR-03, NFR-10



**API:** 



**Data:** 



**Implementasi lokal 19 Oktober 2026:** Metrik API/job per jam, subtotal meta D1 dan percobaan operasi R2, profil pilot/owner, snapshot manual provider serta alert 70/85/95 dengan deduplikasi. Panel Kesehatan sistem hanya Management/NSM; tidak ada auto-upgrade/auto-delete. Monitoring kini memakai agregasi SQL, preview terbatas dan drill-down keyset; ekspor lengkap menegakkan batas 10.000 baris/5MiB tanpa truncation. CPU dan kuota akun shared belum diukur di cloud; target/workforce guard 2.000 tetap. Profil lokal 1.000 customer/10.000 invoice/5.000 aktivitas lulus regresi, tetapi provider gate produksi tetap pending. [Status M4](../M4_STATUS.md), [runbook WEB056](../WEB056_OPERATIONS.md), [kontrak aktual](m4-observability-api.openapi.json).



## WEB-057 - Backup, restore, rollback dan retensi



Milestone: M4 | Prioritas: P0 | Status: Implemented local recovery slice; production restore/retention gates pending



**Dependensi:** WEB-056, WEB-002



**Deliverable:** Runbook, restore drill dan migration rollback



**Acceptance:** RPO15m/RTO4h diuji, bukan diasumsikan karena ada Time Travel; attachment/metadata direkonsiliasi. Retensi+legal hold+privacy request terkontrol; rollback tidak hapus outbox/accepted order. Jika free tier gagal target, tandai blocker dan revisi desain/kapasitas sebelum rollout.



**Requirements:** NFR-04, SEC-05, OFF-06



**API:** 



**Data:** 



## WEB-058 - Security review dan contract/integration regression



Milestone: M4 | Prioritas: P0 | Status: Local security review and regression complete; production verification pending



**Dependensi:** WEB-055, WEB-057, WEB-011



**Deliverable:** Bukti uji per-role, API, importer dan workflow



**Acceptance:** Lintas tenant/area, IDOR, CSRF sesuai mode auth, CORS, token revoke, injection/file upload, idempotency, concurrency dan finalizer teruji. Tidak menggunakan data pribadi produksi dalam fixture publik.



**Requirements:** RBAC-01, RBAC-02, SEC-01, SEC-02, NFR-07



**API:** 



**Data:** 



**Implementasi lokal 20 Oktober 2026:** Same-origin/browser guard, batas byte stream aktual, legal hold/deletion claim dengan retry R2, recovery concurrency/replay/provenance, dependency patches dan inventory 232 operasi API. Seluruh 230 operasi nonpublik menolak bearer kosong sebelum DB; 119 test lokal dan build menjadi gate source. Firebase/MFA/deployment, UAT dan provider recovery/capacity masih terbuka. [Review WEB058](../WEB058_SECURITY_REVIEW.md), [inventory aktual](runtime-api.inventory.json).



## WEB-059 - UAT web, browser, mobile dan aksesibilitas



Milestone: M4 | Prioritas: P0 | Status: Local automated UAT evidence complete; named role/device acceptance pending



**Dependensi:** WEB-058, WEB-004



**Deliverable:** 82-skenario applicability register dan evidence web



**Acceptance:** UAT web P0 lulus pada browser/perangkat yang disepakati; P1/Android bertanda deferred sesuai fitur, bukan dianggap pass. Keyboard/screen reader/kontras, error recovery, 4G dan offline diuji; bug kehilangan/duplikasi data atau akses menjadi blocker.



**Requirements:** NFR-02, NFR-08, NFR-11, OFF-01



**API:** 



**Data:** 




**Implementasi lokal (20 Oktober 2026):** 121 regression test, production build dan 11 browser check Chrome/Edge PASS. Register 82 skenario tetap utuh (53 web, 8 integrasi/P1, 21 Android); named business sign-off 0. Gate perangkat/role/provider dan actual restore tetap terbuka. [Laporan UAT](../WEB059_UAT.md), [register](../WEB059_UAT_REGISTER.json), [browser evidence](../WEB059_BROWSER_EVIDENCE.json).

## WEB-060 - Migrasi pilot dan rekonsiliasi data nyata



Milestone: M4 | Prioritas: P0 | Status: Completed user-requested synthetic rehearsal; real-data migration deferred



**Dependensi:** WEB-059, WEB-019



**Deliverable:** Dry-run actual data, mapping ID dan sign-off



**Acceptance:** PIC dan peserta pilot dipilih pengguna; seed sintetik bukan data pilot; jumlah customer/owner/invoice/retur/target dan total net disahkan. Selisih tak terjelaskan = blocker; data sumber tidak dihapus.



**Requirements:** INT-01, INT-02



**API:** 



**Data:** 




**Persiapan lokal (20 Oktober 2026):** PIC Rizky Aditya; peserta awal Novely, Didik, Mursal; kapasitas maksimal 10 sales, tujuh slot terbuka. Checker read-only membandingkan dua snapshot independen dan ledger ID per record beserta net/retur/target, histori tiga bulan, scope/cutoff dan checksum sumber. 129 test dan build PASS. Data nyata belum diimpor/disahkan; source adapter, scope/role/ID dan Finance/PIC sign-off menunggu input. [Runbook pilot](../WEB060_PILOT.md), [manifest](../../pilot/pilot-01/manifest.json).


**Pembaruan 21 Oktober 2026:** Pengguna meminta dummy di file terpisah: paket 10 sales, 20 customer, 80 invoice, 4 credit dan 2 target tersedia. Rehearsal route invoice/target serta snapshot fakta database cocok per record, retry tidak ganda. Scope dummy selesai; migrasi nyata tidak dilakukan. [Paket](../../pilot/demo-10-sales/README.md). 133/133 tests, TypeScript dan production build PASS.

## WEB-061 - Training, SOP dan support handover



Milestone: M4 | Prioritas: P0 | Status: Training materials, SOP and handover package complete; human execution/acceptance pending



**Dependensi:** WEB-060



**Deliverable:** Panduan role, SOP dan jalur incident



**Acceptance:** Latihan customer salah, GPS buruk, offline, retur, duplicate import, target revisi dan dispute insentif; L1/L2 dan owner insiden jelas; akun, source, secrets recovery dan dokumentasi diserahkan.



**Requirements:** SUP-03, SEC-04



**API:** 



**Data:** 




**Pembaruan 21 Oktober 2026:** Panduan per role, 12 SOP, support/severity/eskalasi, handover, 15 kasus latihan dan register penerimaan tersedia. Tidak menandai training manusia, L1/L2/provider/recovery atau sign-off selesai. [Training](../WEB061_TRAINING.md), [SOP](../WEB061_SOP.md), [support](../WEB061_SUPPORT.md), [handover](../WEB061_HANDOVER.md). 133/133 tests, TypeScript dan production build PASS.

## WEB-062 - Pilot, stabilisasi dan keputusan go-live web



Milestone: M4 | Prioritas: P0 | Status: Local operational pilot and full restore verified; real pilot/go-live pending



**Dependensi:** WEB-014, WEB-034, WEB-056, WEB-057, WEB-061



**Deliverable:** Evidence pilot, blocker register dan gate go-live



**Acceptance:** Seluruh empat pilar digunakan dalam pekerjaan nyata; angka reconciled; support/restore tersedia; no open critical data/security defect. Go-live dicatat terpisah dari build/source. Android belum dimulai sebelum web/API gate diterima.



**Requirements:** NFR-03, NFR-04



**API:** 



**Data:** 



Pembaruan 21 Oktober 2026: pilot dummy lokal terisolasi di http://127.0.0.1:5183, 10 sales, 20 pelanggan, 80 invoice dan 4 retur. Browser login/data/order/reload serta 12 halaman PASS; 134/134 unit/integration tests dan TypeScript PASS. Cakupan ini tidak menerima pekerjaan nyata atau go-live. Lihat [runbook](../WEB062_LOCAL_PILOT.md) dan [evidence](../WEB062_PILOT_EVIDENCE.json).


Pembaruan 22 Oktober: rehearsal kunjungan/telesales dan role scope lulus, 12 aktivitas/coverage 40%/8 posisi dipublikasikan ke pilot dummy. Full D1 lokal 86 tabel dan satu lampiran R2 dipulihkan serta diverifikasi. 135/135 tests, TypeScript dan browser operasional PASS. Human training, Firebase/perangkat/provider dan cloud go-live tetap pending. [Evidence](../WEB062_STABILIZATION.json).

## Addendum 22 Oktober 2026 — wilayah administrasi

Pembagian awal menggunakan batas kelurahan/desa sesuai [GEO-01–08](GIS_Admin_Kelurahan_v1.md). WEB-009/015/016 tetap berstatus implementasi sebelumnya; perluasan berikut belum dibangun. Acceptance GEO-A01–08 adalah tambahan terpisah dari 82 skenario UAT baseline.

## WEB-063 - Master dan versi batas administrasi kelurahan/desa

Milestone: M4 | Prioritas: P0 | Status: Implemented local; real-source activation/usage-rights review pending

**Dependensi:** WEB-009, WEB-004

**Deliverable:** Validasi dan pengambilan snapshot sumber batas desa/kelurahan Indonesia yang dipilih, lisensi/cakupan pilot, DDL lima entitas wilayah, import berversi dan kontrak API

**Acceptance:** Sumber awal Geoportal Kementerian Pertanian layer ADMINISTRASI_DESAKELURAHAN_AR (BIG menurut metadata; acuan Semester 1 Tahun 2025). Validasi metadata rilis, namespace, ketentuan penggunaan/atribusi; ekspor snapshot GeoJSON bertahap dengan jumlah record/pagination dan checksum terkontrol. Pelanggan/wilayah tanpa polygon atau kode masuk review. Sumber, namespace kode, hierarki, lisensi/atribusi/checksum direview; Polygon/MultiPolygon valid, bbox dan R2 tervalidasi; nama sama tidak disamakan; draft tidak aktif otomatis; histori versi tetap; tidak memuat nasional tanpa profiling kuota. Kontrak request/response dan migrasi diuji sebelum aktivasi.

**Requirements:** CUS-04, GEO-01, GEO-02, GEO-07, GEO-08

**Data:** admin_boundary_dataset, admin_boundary_chunk, admin_unit, admin_boundary, area_admin_membership, customer_admin_location

**API:** boundary_get_config, boundary_get_datasets, boundary_post_datasets, boundary_get_datasets__id_, boundary_post_datasets__id__chunks, boundary_post_datasets__id__activate, boundary_get_datasets__id__boundaries, boundary_get_datasets__id__chunks__index_. [OpenAPI aktual](admin-boundaries-api.m4.openapi.json).

**Pembaruan 23 Oktober 2026:** Pengaturan → Batas wilayah, import/resume draft, validasi topology, checksum/manifest dan review/aktivasi berversi tersedia lokal; migrasi 0035 dan backup/restore teruji. Sampel enam kelurahan dari sumber nasional tetap draft. Review namespace/metadata/hak penggunaan dan kapasitas provider pending; WEB-064/065 tetap Planned. [Runbook](../WEB063_ADMIN_BOUNDARIES.md), [evidence](../WEB063_EVIDENCE.json).

## WEB-064 - Overlay kelurahan/desa dan review pemetaan pelanggan

Milestone: M4 | Prioritas: P0 | Status: Implemented local; real-source activation and production acceptance pending

**Dependensi:** WEB-063, WEB-016, WEB-013

**Deliverable:** Peta & Wilayah dalam kelompok Pelanggan: overlay/filter, mode Sebaran, panel rincian desktop/mobile, matching koordinat/kode, review dan histori mapping

**Acceptance:** Geometry penuh untuk matching, simplified hanya display; titik batas/hole/overlap/outside dan kode konflik masuk review; customer tanpa koordinat tetap dihitung; mapping manual beralasan; aggregate/list/export tidak melewati scope. Pembaruan rilis menghasilkan preview, tanpa transfer owner atau histori otomatis. Rename Peta customer menjadi Peta & Wilayah tanpa kelompok sidebar baru; tinggi peta tetap, daftar/panel scroll, panel kanan desktop dan bawah mobile. Filter/konteks bertahan saat drill-down, kembali dan fullscreen; keyboard/fokus/Esc/reduced motion lulus. Teal bertingkat dengan legend/tooltip hitam-putih; unknown abu-abu berpola, berbeda dari nol. Mode Kinerja/Coverage mengikuti WEB-066 dan Risiko WEB-067, bukan data tiruan pada WEB-064. GIS-U01–02 dan GEO-A03/04/07/08 lulus.

**Requirements:** CUS-04, GEO-03, GEO-06, GEO-07, GEO-08, GIS-UX-01, GIS-UX-02

**Data:** admin_unit, admin_boundary, customer_admin_location, customer_outlet

**UI/UX:** [Spesifikasi GIS](GIS_UX_dan_Analitik_v1.md)

**API:** [Lima operasi implementasi lokal](geography-api.m4.openapi.json), ditambah filter scoped pada /api/customers. Analitik/ekspor wilayah mengikuti WEB-066.

**Implementasi 24 Oktober 2026:** Overlay dan pencarian hierarki, panel desktop/mobile, matching penuh dan review beralasan dengan histori revisi, scoped drilldown, URL/context dan fullscreen teruji lokal. Enam kelurahan sumber nyata tetap draft; publish hanya melalui review pada rilis aktif. 149 tests, dua browser flows dan full restore lokal lulus. [Runbook](../WEB064_GEOGRAPHY.md), [evidence](../WEB064_EVIDENCE.json). WEB-065 dan analitik WEB-066 tetap Planned.

## WEB-065 - Pembagian awal area dan sales berdasarkan kelurahan/desa

Milestone: M4 | Prioritas: P0 | Status: Implemented local; real-source/provider/business acceptance pending

**Dependensi:** WEB-063, WEB-064, WEB-015

**Deliverable:** Pemilihan kumpulan kelurahan, membership area bertanggal dan preview/commit assignment sales per kanal; alur Distribusi sales dan preview sebelum–sesudah

**Acceptance:** Satu area dapat beberapa kelurahan; membership satu unit ke dua area pada tanggal sama ditolak; preview menunjukkan pelanggan, owner, kanal, unresolved dan konflik tanpa menulis. Commit Management/NSM memvalidasi role/area/SPV, satu owner per kanal, ETag/idempotency dan audit; override beralasan; invoice/target/kunjungan/insentif historis tetap. GEO-A01–08 lulus sebelum acceptance. GIS-UX-03/GIS-U03: pilih kelurahan → penerima per kanal → preview pelanggan/konflik/jumlah dan konteks penjualan historis → tanggal efektif/alasan → commit. Klik polygon tidak menulis data. Preview stale harus direvalidasi; geografi/penjualan historis tetap jelas sebagai referensi. Simulasi bobot beban lanjut bukan scope WEB-065, melainkan WEB-068.

**Requirements:** CUS-03, CUS-04, RBAC-03, GEO-01, GEO-04, GEO-05, GEO-07, GIS-UX-03

**Data:** area_admin_membership, customer_admin_location, customer_assignment, reporting_assignment, geo_distribution_epoch, geo_distribution_run

**UI/UX:** [Spesifikasi GIS](GIS_UX_dan_Analitik_v1.md)

**API:** GET daftar/rincian dan POST preview/commit `/api/geo/distribution`. [Kontrak](distribution-api.m4.openapi.json).

**Implementasi:** 0037/0038; epoch/hash/ETag/idempotency/audit, max 25 customer dan exception beralasan. [Evidence](../WEB065_EVIDENCE.json). Source nyata tetap draft.

## Addendum UI/UX dan analisis GIS — 22 Oktober 2026

WEB-064/065 diperinci mengikuti [GIS-UX-01–03](GIS_UX_dan_Analitik_v1.md). WEB-066 kinerja/coverage didahulukan; risiko dan simulasi beban menyusul. Analitik baru adalah M4 extension P1, bukan gate wajib pilot tim saat ini. Staging/login per role tetap paralel. Penetrasi produk dan akuisisi pasar belum ditiketkan pada scope ini.

## WEB-066 - Analisis kinerja dan coverage per kelurahan

Milestone: M4 | Prioritas: P1 | Status: Implemented local; real-source/provider/business acceptance pending

**Dependensi:** WEB-064, WEB-051, WEB-052

**Deliverable:** Mode Kinerja/Coverage, agregasi kelurahan dan bucket belum terpetakan, drill-down/tindakan scoped, ringkasan Overview/Monitoring serta kontrak metrik/API

**Acceptance:** GIS-ANA-01 dan GIS-U02/GIS-A01–02 lulus. Total kelurahan + belum terpetakan direkonsiliasi terhadap scope; pelanggan dua kanal unik, invoice primer tidak ganda. Cohort/source completeness/cutoff/versi geography dan basis as-of vs cutoff eksplisit. Denominator nol=null, unknown/provisional bukan nol. Achievement hanya jika target punya dasar alokasi kelurahan/customer yang sah; target SR lintas kelurahan tidak dibagi diam-diam. Perbandingan periode sebanding, link/ekspor mempertahankan filter dan scope. Celah layanan memakai pelanggan tercatat, bukan klaim pangsa pasar.

**Requirements:** GIS-ANA-01, GIS-UX-02, GEO-06, SUP-05

**Data:** invoice, activity, customer_outlet, customer_admin_location, admin_boundary, target_version, target_item, geo_distribution_epoch, customer_assignment, customer_source_coverage

**UI/UX:** [Spesifikasi GIS](GIS_UX_dan_Analitik_v1.md)

**API:** GET summary/sources/CSV `/api/geo/analytics`. [Kontrak request/response](regional-analytics-api.m4.openapi.json).

**Implementasi:** 0039, basis mapping saat read-cutoff, 164 tests dan browser/restore lokal. [Runbook](../WEB066_REGIONAL_ANALYTICS.md), [evidence](../WEB066_EVIDENCE.json). Sumber nyata tetap draft.

## WEB-067 - Peta risiko pelanggan dan keterlambatan repeat order

Milestone: M4 | Prioritas: P1 | Status: Implemented and verified local; real-source/provider/human acceptance pending

**Dependensi:** WEB-066

**Deliverable:** Mode Risiko, kebijakan indikator berversi, penjelasan risiko per customer, drill-down dan follow-up sesuai role/kanal; desain penyimpanan kebijakan/evidence dan kontrak API

**Acceptance:** GIS-ANA-02 dan GIS-A03–04 lulus. Mendekati churn, repeat overdue dan penurunan pembelian memakai aturan/ambang/histori minimum/versi yang eksplisit sebelum aktif. Status aktif/churn rolling 90 hari tetap. Data kurang=belum cukup data; retur/pembatalan/source completeness dan perbandingan hari/periodenya benar. Setiap flag menjelaskan bukti; tidak perlu AI/provider berbayar. Customer/task/visit/telesales mengikuti scope, assignment, izin kontak, DNC, jam/campaign/lease; tidak otomatis menghubungi atau memindahkan owner.

**Requirements:** GIS-ANA-02, GIS-UX-02, CUS-06, SUP-05

**Data:** customer_outlet, customer_status_snapshot, invoice, customer_admin_location, activity, task, customer_risk_policy_version, customer_risk_run

**UI/UX:** [Spesifikasi GIS](GIS_UX_dan_Analitik_v1.md)

**API:** 10 operasi runtime /api untuk policy/version/activation, evaluation/current/history; [implementation OpenAPI](customer-risk-api.m4.openapi.json). Same-origin bearer + device session; settings Management/NSM; hasil scoped, input R2 privat tidak dibagikan.

**Tahap awal engine (historis):** konfigurasi tanpa default bisnis dan sembilan unit tests menjadi dasar implementasi lengkap di bawah.

**Implementasi lokal WEB-067 (24 Oktober):** Engine nyales-risk-1; pengaturan indikator berversi, aktivasi eksplisit, API 10 operasi, mode Risiko/evidence/customer drill/history dan cache revision tersedia. 183 tests, 3 browser scenarios, TypeScript/build, backup utama 96 tabel serta QA recovery 2 risk snapshots lulus. Tidak ada policy default di pilot utama; data komersial tetap dan sumber nyata draft. [Runbook](../WEB067_RISK_DESIGN.md), [evidence](../WEB067_EVIDENCE.json), [ERD fisik](ERD_WEB067_Implementation.md), [API](customer-risk-api.m4.openapi.json).

## WEB-068 - Pemerataan beban sales dan simulasi perubahan territory

Milestone: M4 | Prioritas: P1 | Status: Implemented and verified local; real-source/provider/human acceptance pending

**Dependensi:** WEB-065, WEB-066

**Deliverable:** Perbandingan beban sales/kelurahan, skenario sebelum–sesudah berversi, asumsi/bobot dan validasi ulang, integrasi penerapan melalui transfer yang sudah sah; desain data skenario dan kontrak API

**Acceptance:** GIS-ANA-03 dan GIS-A05 lulus. Pelanggan/frekuensi/durasi layanan/kapasitas hari kerja/histori sales dibedakan satuannya; durasi kosong=unknown. Beban lapangan dan telesales tidak disamakan; histori sales bukan otomatis potensi pasar. Skenario mencatat cutoff/mapping/boundary/input/parameter, preview tidak menulis, stale memerlukan validasi ulang. Commit Management/NSM melalui WEB-065 dengan tanggal efektif, satu owner per kanal, scope/SPV/audit serta histori invoice/target/insentif tetap. Tidak ada routing/ETA/waktu perjalanan dari jarak lurus.

**Requirements:** GIS-ANA-03, GIS-UX-03, GEO-04, GEO-05, GEO-07

**Data:** workload_policy_version, territory_scenario, territory_scenario_revision, territory_scenario_application, area_admin_membership, customer_assignment, customer_admin_location, app_user, reporting_assignment, work_calendar, invoice

**UI/UX:** [Spesifikasi GIS](GIS_UX_dan_Analitik_v1.md)

**API:** [14 operasi runtime, request/response dan cross-field guards](workload-scenarios-api.m4.openapi.json). Preview read-only, save revisi eksplisit dan apply satu batch atomik melalui planner WEB-065, lalu revalidate sisa. Total runtime 276 operasi, seluruhnya terhubung kontrak.

**Implementasi lokal:** kebijakan bulanan per kanal dengan popup/pengaturan khusus, sumber seluruh portofolio sesuai scope, before/after/unknown/capacity meter, immutable D1/R2 revisions, optimistic version/hash/epoch/If-Match/idempotency/audit, history/reload dan recovery lokal. Tidak ada travel/routing atau default bisnis pada pilot utama. [Runbook](../WEB068_WORKLOAD_DESIGN.md), [ERD fisik](ERD_WEB068_Implementation.md), [evidence](../WEB068_EVIDENCE.json). WEB-069 berikutnya.

## Addendum 23 Oktober 2026 - Plan Visit Generator di komputer pribadi

Keputusan pengguna: routing OSRM dan optimasi Python OR-Tools berjalan pada komputer pribadi; agent mengambil pekerjaan outbound dari Workers. D1 menyimpan aturan/status/hasil agenda, R2 snapshot besar, graph aktif pada disk/RAM komputer. PostGIS dan Cloudflare Containers belum diperlukan. [Spesifikasi PVG-01 sampai PVG-07 dan acceptance PVG-A01 sampai PVG-A10](Plan_Visit_Generator_v1.md). Seluruh item berikut M4 extension P1 Planned; tidak menambah gate pilot web, staging/login atau Android.

## WEB-069 - Kontrak, kebijakan dan model data Plan Visit Generator

Milestone: M4 | Prioritas: P1 | Status: Design baseline and executable contracts verified; runtime WEB-070–074 pending

**Dependensi:** WEB-063, WEB-064, WEB-065, WEB-030, WEB-031, WEB-039, WEB-008, WEB-058

**Deliverable:** Input/constraint/policy version, ERD/data dictionary/migration plan dan kontrak API/agent termasuk job state machine serta RBAC

**Acceptance:** PVG-01/02/06/07 dan PVG-A01/A03: input berversi, hard/soft constraints, aturan missing data, izin konfigurasi Management/NSM, operasi scoped dan matriks role disepakati. Model agent/lease/attempt/snapshot/hasil/publish, retensi, checksum, idempotency, fencing, cancel, stale dan aktivasi agenda atomik dirancang sebelum coding. Tidak menganggap tabel job/work_plan atau API yang ada sudah kompatibel.

**Requirements:** PVG-01, PVG-02, PVG-06, PVG-07

**Data:** visit_generator_agenda_epoch, visit_generator_agent, visit_generator_agent_nonce, visit_generator_artifact, visit_generator_attempt, visit_generator_candidate_revision, visit_generator_credential, visit_generator_graph_release, visit_generator_job, visit_generator_pairing, visit_generator_plan_link, visit_generator_policy_version, visit_generator_publish_batch, visit_generator_publish_item, work_plan, work_plan_revision, work_calendar, customer_assignment

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** Kontrak schema/API/agent diturunkan pada WEB-069 sebelum implementasi; belum ada endpoint runtime baru.

**Baseline detail 24 Oktober:** [policy/snapshot/state machine/RBAC/retention/atomic publish](../WEB069_PLAN_VISIT_CONTRACT.md), [37 operasi desain, tidak diregistrasikan](visit-generator.design.openapi.json), [14 tabel SQL draft/data dictionary](ERD_WEB069_Design.json), [evidence](../WEB069_EVIDENCE.json). 21 contract/model tests; actual OSRM/agent/solver/UI dan PVG end-to-end tetap WEB-070–074. Runtime 276 operasi dan database lokal 100 tabel tidak berubah oleh desain ini.

## WEB-070 - Agent komputer pribadi dan routing OSRM wilayah pilot

Milestone: M4 | Prioritas: P1 | Status: Ditunda pengguna; implementasi lokal yang sudah ada dipertahankan

**Dependensi:** WEB-069

**Deliverable:** Runbook setup lokal Windows Docker/WSL2 atau runtime yang tervalidasi, pairing agent, antrean outbound HTTPS, OSRM graph/matrix berversi dan benchmark awal

**Acceptance:** PVG-01/03/06 dan PVG-A01/A02/A06: agent berizin minimum per org/environment, revoke/heartbeat/lease/fencing/checkpoint/retry/cancel diuji. Komputer mati/sleep/internet putus terlihat menunggu/terputus; output attempt lama ditolak. Tidak membuka port publik atau memakai kredensial D1/R2/admin umum. Profil kendaraan/cakupan/lisensi/checksum graph jelas; snap gagal/unreachable bukan nol; cache memakai versi graph/profil/koordinat. Ukur RAM/CPU/disk/preprocess sebelum memilih cakupan.

**Requirements:** PVG-01, PVG-03, PVG-06

**Data:** job, customer_outlet

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** 42 operasi aktual: 9 identitas,11 diagnostic,14 readiness dan8 operational profiles. Job bisnis/solver/review/publish belum diregistrasikan.

**Progres 24 Oktober:** doctor baca-saja, proof P-256 dan challenge/jti D1 prototype, outbound transport loopback fixture, graph-file verification dan OSRM table parser/cache teruji. Belum ada engine, pairing nyata, secure credential persistence, graph atau daemon agent yang terpasang; bukan PVG-A01/A02/A06 end-to-end. [Detail](../WEB070_AGENT_PREPARATION.md), [evidence](../WEB070_PROGRESS.json).

**Progres 25 Oktober:** [runbook](../WEB070_AGENT_IDENTITY.md), [bukti](../WEB070_PROGRESS.json), [ERD runtime](ERD_WEB070_Implementation.md). Identitas/pairing/DPAPI/heartbeat/revoke teruji lokal; queue dan OSRM berikutnya. 267 tes backend dan 2 browser lolos. Total runtime 285 operasi; 0042 menambah 7 tabel. WEB-070 belum selesai keseluruhan.

**Progres antrean:** [runbook](../WEB070_AGENT_QUEUE.md), [ERD fisik 0043](ERD_WEB070_Queue_Implementation.md), [11 operasi transport diagnostik](visit-agent-queue.m4.openapi.json). CLI run/once dan lease/retry/cancel/checkpoint tersedia; belum membawa planning snapshot. Total296 operasi dan 108 tabel aplikasi. Rincian identitas/267 tes di atas adalah bukti tahap sebelumnya; hasil terbaru ada di WEB070_PROGRESS.json.

**Verifikasi akhir slice antrean:** 282 tes backend dan 2 skenario browser exit0, Axe0, tiga viewport; 18 tabel bisnis per database tetap identik. WEB-070 masih In progress untuk snapshot planning dan OSRM.

**Slice0044:** [runbook kesiapan](../WEB070_PLANNING_READINESS.md), [14operasi](visit-planning-readiness.m4.openapi.json), [ERD](ERD_WEB070_Readiness_Implementation.md). Total310operasi; policy/manifest/readiness tersedia, bukan snapshot solver. Bukti final ada pada WEB070_PROGRESS.json.

**Verifikasi akhir slice kesiapan:** 293tes backend dan2browser exit0, Axe0, tiga viewport; 18tabel bisnis per database tetapidentik. Runtime310operasi; kebijakan/graph/preflight tidak membuat jadwal. Bukti terbaru WEB070_PROGRESS.json.

## WEB-071 - Optimasi kunjungan satu sales satu hari dengan OR-Tools

Milestone: M4 | Prioritas: P1 | Status: Ditunda pengguna; implementasi lokal yang sudah ada dipertahankan

**Dependensi:** WEB-070

**Deliverable:** Solver harian Python OR-Tools, matriks OSRM, draft urutan/estimasi waktu dan daftar customer tidak terjadwal

**Acceptance:** PVG-02/03/04 dan PVG-A02/A03/A04: assignment tanggal, jam kerja/istirahat/jam toko, durasi, titik awal/akhir, janji dan pengecualian dipenuhi. Prioritas/bobot eksplisit; missing data direview atau asumsi ditandai. Tidak memakai jarak lurus sebagai waktu jalan. Runtime dibatasi, cancel didukung, feasible/infeasible/timeout dibedakan, alasan unscheduled dan versi/input tersimpan; tidak mengklaim optimum tanpa bukti.

**Requirements:** PVG-02, PVG-03, PVG-04

**Data:** customer_outlet, customer_assignment, work_calendar, work_plan/revision, invoice, operational profiles, policy/graph

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** Kontrak schema/API/agent diturunkan pada WEB-069 sebelum implementasi; belum ada endpoint runtime baru.

## WEB-072 - Optimasi jadwal bulanan dan beberapa sales

Milestone: M4 | Prioritas: P1 | Status: Ditunda pengguna; implementasi lokal yang sudah ada dipertahankan

**Dependensi:** WEB-071

**Deliverable:** Alokasi frekuensi kunjungan ke hari kerja, urutan feasible per hari, ringkasan kapasitas dan kebutuhan layanan belum terpenuhi

**Acceptance:** PVG-05 dan PVG-A05: satu sales satu bulan sebelum multi-sales; frekuensi/jeda, cuti/libur, janji tetap dan kapasitas dipenuhi. Penempatan bulanan divalidasi kembali memakai rute harian; infeasible direvisi terbatas atau dilaporkan. Riwayat/hari lalu/visit selesai/agenda terkunci tidak digeser, regenerate hanya masa depan. Owner tetap per assignment tanggal; telesales terpisah; tidak menjanjikan optimum global.

**Requirements:** PVG-02, PVG-04, PVG-05

**Data:** customer_assignment, calendar, work_plan, plan_item, activity, task

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** Kontrak schema/API/agent diturunkan pada WEB-069 sebelum implementasi; belum ada endpoint runtime baru.

## WEB-073 - UI generate, review dan publish agenda kunjungan

Milestone: M4 | Prioritas: P1 | Status: Ditunda pengguna; implementasi lokal yang sudah ada dipertahankan

**Dependensi:** WEB-072, WEB-030, WEB-064

**Deliverable:** Dialog Generate Plan harian/bulanan pada agenda, status job/agent, kalender/daftar/peta rute, review/edit/diff dan publish berversi

**Acceptance:** PVG-06/07 dan PVG-A07/A08/A10: hanya scope sah, SR mengusulkan miliknya, reviewer SPV/Area Manager sesuai scope; konfigurasi Management/NSM. Preview tidak menulis agenda; stale input/assignment/kalender/rules menuntut revalidasi. Edit manual dicek constraint. Publish version guard/idempotency/audit serta staging/aktivasi atomik; retry tidak menggandakan plan/task, tidak mengubah fakta target/invoice/insentif. UI keyboard/mobile/reduced motion, progress/cancel/unknown dan alasan unscheduled jelas.

**Requirements:** PVG-06, PVG-07

**Data:** job, work_plan, plan_item, customer_assignment, audit_event

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** Kontrak schema/API/agent diturunkan pada WEB-069 sebelum implementasi; belum ada endpoint runtime baru.

## WEB-074 - Uji end-to-end dan operasi generator di komputer pribadi

Milestone: M4 | Prioritas: P1 | Status: Ditunda pengguna; implementasi lokal yang sudah ada dipertahankan

**Dependensi:** WEB-073, WEB-056, WEB-057, WEB-058

**Deliverable:** Evidence PVG-A01 sampai PVG-A10, profil kapasitas/kuota, panduan operator dan backup/restore input/hasil/graph/konfigurasi

**Acceptance:** PVG-A01 sampai PVG-A10 lulus pada fixture satu hari, satu bulan dan beberapa sales. Uji sleep/reboot/offline, lease race, revoke, cancel/output terlambat, hasil rusak, stale, publish gagal dan restore. Rekonsiliasi demand vs terjadwal vs unscheduled serta histori tetap. Ukur RAM/CPU/disk/runtime/graph/matrix/cache/D1/R2/Workers dan tetapkan batas operasional; belum menjamin Rp0 atau skala nasional. Komputer/operator dicatat saat setup tanpa mengarang identitas; SLA/kapasitas dan business acceptance dilaporkan terpisah.

**Requirements:** PVG-01, PVG-02, PVG-03, PVG-04, PVG-05, PVG-06, PVG-07

**Data:** job, work_plan, plan_item

**Spesifikasi:** [Plan Visit Generator](Plan_Visit_Generator_v1.md)

**API:** Kontrak schema/API/agent diturunkan pada WEB-069 sebelum implementasi; belum ada endpoint runtime baru.


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


## Pilihan backlog26 Oktober2026 — routing ditunda, lanjut WEB-057

Pengguna meminta melewati pemasangan routing dan melanjutkan backlog lain. WEB-070–074 dicatat execution_status deferred_by_user; implementasi/kernel/paket yang sudah ada dipertahankan sebagai bukti, tidak ditandai selesai. Tidak ada provisioning atau pemasangan OS.

WEB-057 dilanjutkan dengan opsi pemeriksaan isi berkas pada restore drill: lampiran ready, chunk batas, bukti risiko, revisi simulasi dan bukti kesiapan. Metadata/source checksum diverifikasi dahulu; kemudian ukuran/hash berkas saat ini, dengan batas64object/8MiB perfile/32MiB total/8MiB manifest modeberkas, scope organisasi dan hasil hilang/rusak/unavailable eksplisit. UI memakai tombol/popup, pemilihan backup/riwayat dan rincian kegagalan. Tidak menyalin/memulihkan/menghapus data; logical backup tetap slice, bukan snapshot penuh. [Runbook](../WEB057_OBJECT_VERIFICATION.md), [evidence](../WEB057_OBJECT_EVIDENCE.json), [API](m4-recovery-api.openapi.json). Runtime318operasi,114tabel aplikasi; tidak ada migrasi baru. Production restore/RPO/RTO/retensi tetap memerlukan verifikasi terpisah.
