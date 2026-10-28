# Kontrak API Sales Operations Hub v1.2

16 Oktober 2026. Kontrak rancangan setelah audit berdasarkan PRD v1.10 dan ERD v1.2. Base path `/api/v1`. Artefak machine-readable: `Sales_Operations_API_v1_2.openapi.json` (OpenAPI 3.1). Kontrak ini belum mengimplementasikan atau men-deploy endpoint. Nama field API dapat berbeda dari field tabel selama mapping eksplisit.

## Perubahan pelanggan

Keputusan 18 Oktober 2026: pelanggan/toko adalah entitas utama, satu pelanggan = satu lokasi. Lapisan Account bisnis/legal dihapus dari schema aktif, UI, API dan import. Kontak, assignment kanal, transaksi, target dan histori mengacu langsung ke pelanggan. Kode ERP opsional pada input manual, wajib dan unik dalam organisasi untuk import pelanggan. Pengaturan tetap hanya Management/NSM. Istilah account untuk identitas login, kuota provider atau Android developer tidak berarti entitas pelanggan.

Migrasi lokal 0017 menyimpan master dan relasi Account lama sebagai snapshot audit, menghapus tabel account/kolom account_id, dan mewajibkan validasi ulang batch import pelanggan lama. Dokumen ini menggantikan baseline sebelumnya untuk arsitektur pelanggan; status produksi tetap terpisah.

Kontrak produk penuh memakai base path rancangan /api/v1; implementasi lokal aktif memakai /api dan slice kontrak di repository.

## 1. Konvensi identitas, scope dan izin

Client login ke Firebase, lalu mengirim `Authorization: Bearer <ID_TOKEN>` ke POST /device-sessions untuk membuat sesi perangkat. Request berikutnya juga membawa X-Device-Session. Backend memastikan sesi aktif milik identitas yang sama; revoke per perangkat tidak hanya mengandalkan JWT Firebase. Worker memverifikasi signature, issuer, audience, expiry dan status user internal. API menentukan organization dari mapping identitas; payload/query organization_id dari client tidak dipakai untuk memilih organisasi. Origin dev/staging/prod di-allowlist; token dan secrets tidak dicatat. CORS bukan kontrol otorisasi.

`GET /me` mengembalikan capability efektif. SR: pelanggan pada area atau assignment-nya, task dan transaksi mengikuti atribusi pribadi/kanal; SPV: team bawahannya; AM: area sendiri; Management/NSM: scope organisasi. Area yang diminta tidak menambah izin: filter query selalu diinterseksi dengan scope server. ID di luar scope mendapat 404 agar tidak membocorkan keberadaan resource; operasi terlarang atas resource dalam scope mendapat 403. Attachment, export, invoice dan angka nominal insentif memiliki pemeriksaan field/resource sendiri. Nominal insentif team tidak otomatis dibuka hanya karena supervisor bisa melihat dashboard.

Pengaturan user, hirarki, master customer, assignment, target, tier, integrasi dan insentif hanya Management/NSM. Pekerjaan operasional (visit, call, follow-up, handoff, estimasi) mengikuti assignment/hirarki. Penerima statement tidak boleh finalisasi statement miliknya. Jika hanya satu approver eligible, finalisasi ditahan sampai approver lain berwenang tersedia; jangan bypass self-approval.

## 2. Request dan response

Tanggal bisnis `YYYY-MM-DD`; timestamp RFC3339 UTC dengan offset/zone sumber dipertahankan bila perlu. Nominal IDR integer rupiah dalam batas safe integer JSON; rate dan achievement berupa decimal string (0.8 = 80%, 0.01 = tarif 1%). Koordinat E7 dan akurasi cm. Semua object menolak field asing. ID opaque; jangan menebak ID memakai nomor telepon.

Response sukses: `{data, meta}`; list menambah `next_cursor`. `meta.request_id` dan `server_time` wajib; sumber, sinkronisasi dan waktu kalkulasi hadir pada endpoint berbasis data transaksi. Detail resource versioned mengirim ETag `"7"` yang sama dengan field version. Pagination cursor opaque, terikat filter/scope dan stabil memakai urutan updated_at/id; maksimal 100, default 50. Cursor yang tidak cocok filter ditolak 400. Filter yang tersedia tercantum pada tiap operation; detail/profil tidak menerima filter generik. Cursor memakai snapshot tetap dan filter/scope terikat; snapshot kedaluwarsa menghasilkan 409 CURSOR_EXPIRED. Metadata memisahkan validation_state dan freshness_state.

Untuk PATCH-like action terhadap resource lama, kirim `If-Match` sesuai ETag. Versi salah menghasilkan 412 dan versi terbaru yang diizinkan; precondition wajib hilang menghasilkan 428. Client tidak mengirim actor, organization, approval actor, actual agregat atau payout final sebagai nilai yang dipercaya server.

Semua POST memakai `Idempotency-Key` (UUID atau random setara). Scope dedupe: organisasi, user, method dan path. Key+payload sama mengembalikan status/body/resource pertama; key sama payload berbeda = 409 IDEMPOTENCY_CONFLICT. Retensi HTTP dedupe usulan minimal tujuh hari; unique domain key invoice/event/entitlement tetap melindungi retry setelah jendela itu. Simpan record dedupe dan mutation secara atomik sesuai kemampuan storage. Finalize ulang setelah timeout mengembalikan statement sama, bukan approval/payout baru.

## 3. Job, import dan koreksi

Operasi besar menghasilkan 202 dengan data Job dan `Location: /api/v1/jobs/{id}`. Poll dengan backoff; job terminal memuat accepted/rejected dan resource hasil. Job belum sukses bukan tanda data committed. Dry-run tidak mengubah fact; commit menyertakan validation_batch_id yang terikat hash payload, source cutoff dan versi mapping. Payload berubah harus dry-run ulang. Maksimal 100 invoice/batch inline; file besar dipecah chunk ber-ID unik melalui proses import terkontrol.

Invoice header tidak digandakan oleh jumlah line. Unique org/source/invoice/source_version dan credit ID menjaga retry. `net_includes_credit` menentukan apakah credit note sudah tercakup; server merekonsiliasi definisi net dengan sumber, bukan menerima angka sembarang. Invoice yang tidak dapat diatribusi masuk needs_review; data itu tidak masuk actual final. Relasi Sales Rep sumber diprioritaskan bila valid; tanpa itu gunakan assignment pada tanggal invoice; konflik di-review. Satu invoice memiliki satu kanal primer, tidak diberi kredit lapangan dan telesales dua kali.

Revisi invoice menambah invoice_revision. Statement yang sudah final menyimpan input revision lama; recalculation menghasilkan revision statement dan adjustment, bukan menimpa statement sebelumnya. Ekspor bukan paid. POST payment-confirmations mencatat referensi pembayaran eksternal oleh Management/NSM; tidak melakukan transfer uang.

## 4. Target, forecast dan insentif

Target bottom-up dan top-down adalah alternatif. Draft target items dapat diedit Management, versi approved terkunci. Top-down hanya menulis draft; allocation menggunakan tiga bulan selesai sebelum periode, largest remainder dan reserve customer baru. Total alokasi plus reserve wajib sama parent; histori nol menghasilkan needs_review. Target onboarding diinput sebelum bulan berjalan; data bulan berjalan tidak mengubah target yang sudah disahkan. Approve memerlukan rekonsiliasi dan pemisahan pembuat/approver.

Forecast contribution menyimpan bucket eksklusif; invoice merealisasi nilai residual pada basis periode yang sama. API tidak menghitung order menjadi actual invoice. Simulasi insentif tidak membuat hak bayar; calculation run memakai plan_version, target_version, cutoff dan invoice_revision yang dikunci. Field cap null berarti belum aktif. Layer harus tidak overlap; rate tidak boleh negatif; plan role/kanal dan enrollment harus cocok. Manual finalize hanya pada hasil review bersih; backend menghitung dan membulatkan half-up rupiah, bukan menerima hasil hitung client. Revise menghasilkan draft versi baru, original tetap ada.

## 5. Android dan attachment

Endpoint android belum menjadi gate rilis web. Sesi web memakai /work-sessions; shift tracking Android memakai /shifts. Keduanya dimulai dari UI; Android berhenti mengambil lokasi secara lokal saat End walau offline. /sync/events juga melayani web offline; body membedakan event kind dan payload typed, session_id boleh null untuk draft tanpa shift. Sync batch memiliki event ID stabil, sequence, event time dan per-event hasil. HTTP 200 hanya berarti batch diproses; client menghapus outbox hanya untuk acknowledged/already_acknowledged setelah commit server. Error sementara dicoba ulang dengan key/event sama; rejected/needs_review tetap lokal sampai diselesaikan. Checkout terlambat dan event tak berurutan direkonsiliasi, tidak membuat durasi negatif. Versi akses server tetap diperiksa, event lama tidak otomatis meloloskan izin yang dicabut.

GPS batch maksimal 100 titik; duplicate event tidak menulis titik kedua, captured_at terpisah received_at dan latest position tidak mundur. Identitas user/shift harus cocok. Accuracy buruk bukan bukti fraud. GET last-positions hanya mengembalikan posisi nyata berikut timestamp/source, tidak menganggap assignment sebagai posisi saat ini.

Upload intent terikat user, org, tujuan, MIME, size dan checksum; R2 tetap privat. Finalize memverifikasi object sesungguhnya, bukan hanya checksum client. URL berumur pendek (usulan 10 menit), upload orphan dibersihkan oleh job. Batas 10 MB di schema adalah batas transport draft; foto visit memiliki limit konfigurasi lebih kecil. GET /attachments/{attachment_id}/download memeriksa scope lalu memberi URL terbatas waktu; metadata attachment menyediakan version/ETag untuk finalize.

## 6. Error dan freshness

Error memakai `application/problem+json` dengan status, code, request_id, detail aman, dan field_errors opsional. 400 format/cursor; 401 identitas; 403 izin operasi; 404 resource di luar scope; 409 konflik bisnis/idempotensi; 412 versi; 422 validasi; 428 precondition; 429 rate limit dengan Retry-After; 503 sumber/storage unavailable. Tidak memuat token, password atau nomor pribadi penuh dalam log/error.

Data tidak tersedia = null plus state, bukan nol. Persentase dengan denominator nol = null/not applicable. Refresh halaman tidak memperbarui last_successful_sync_at. Data manual menampilkan umur dan data-sampai; threshold stale sesuai konfigurasi sumber, bukan janji real-time. Metrik dashboard dan drill-down memakai filter/cutoff/versi yang sama.

## 7. Katalog endpoint inti

Policy `management` = Management/NSM; `scoped_read` = baca sesuai hirarki; `scoped_work` = pekerjaan operasional sesuai scope; `assigned_actor` = pelaksana yang ditugaskan; `statement_read` = hak nominal statement, termasuk milik sendiri. Policy khusus lease/attachment/field mengikuti kepemilikan resource. Policy tidak boleh diubah menjadi akses hanya karena user bisa menebak ID.

| Method | Path setelah /api/v1 | Fungsi | Policy | Tahap |
| --- | --- | --- | --- | --- |
| GET | `/me` | Identitas, organisasi dan capability efektif | authenticated | web |
| GET | `/branches` | Daftar branches | scoped_read | web |
| POST | `/branches` | Buat branches | management | web |
| GET | `/areas` | Daftar areas | scoped_read | web |
| POST | `/areas` | Buat areas | management | web |
| GET | `/users` | Daftar users | scoped_read | web |
| POST | `/users` | Tambahkan user dengan identitas provider yang sudah ada | management | web |
| GET | `/hierarchy-assignments` | Daftar hierarchy-assignments | scoped_read | web |
| POST | `/hierarchy-assignments` | Buat assignment hirarki efektif | management | web |
| GET | `/customers` | Daftar customers | scoped_read | web |
| POST | `/customers` | Buat outlet/customer | management | web |
| GET | `/customers/{customer_id}` | Detail customer | scoped_read | web |
| PUT | `/customers/{customer_id}` | Revisi customer | management | web |
| GET | `/customers/{customer_id}/timeline` | Timeline interaksi | scoped_read | web |
| POST | `/customers/{customer_id}/assignments` | Pindahkan/beri assignment customer | management | web |
| GET | `/customers/{customer_id}/assignments` | Histori assignment | scoped_read | web |
| POST | `/customer-tier-rules` | Buat versi aturan klasifikasi | management | web |
| GET | `/customer-tier-rules` | Daftar versi rule | scoped_read | web |
| GET | `/activities` | Daftar aktivitas | scoped_read | web |
| POST | `/activities` | Catat pekerjaan yang ditugaskan | assigned_actor | web |
| POST | `/visits/{activity_id}/check-in` | check-in kunjungan | assigned_actor | web |
| POST | `/visits/{activity_id}/check-out` | check-out kunjungan | assigned_actor | web |
| GET | `/tasks` | Daftar task/callback | scoped_read | web |
| POST | `/tasks` | Buat tindak lanjut pada scope kerja | scoped_work | web |
| POST | `/tasks/{task_id}/complete` | Selesaikan task | assigned_actor | web |
| POST | `/handoffs` | Ajukan handoff antar kanal | scoped_work | web |
| GET | `/handoffs` | Daftar handoff | scoped_read | web |
| POST | `/handoffs/{handoff_id}/accept` | Handoff accept | handoff_actor | web |
| POST | `/handoffs/{handoff_id}/decline` | Handoff decline | handoff_actor | web |
| POST | `/handoffs/{handoff_id}/complete` | Handoff complete | handoff_actor | web |
| POST | `/telesales/queue/claim` | Ambil lease customer eligible | telesales_actor | web |
| POST | `/telesales/queue/{queue_item_id}/complete` | Selesaikan lease dengan outcome | lease_holder | web |
| POST | `/invoice-imports` | Dry-run/commit batch invoice | management | web |
| GET | `/jobs/{job_id}` | Status dan hasil job | scoped_read | web |
| GET | `/invoices` | Daftar invoice pada revisi efektif | scoped_read | web |
| GET | `/invoices/{invoice_id}` | Detail invoice efektif | scoped_read | web |
| POST | `/invoices/{invoice_id}/revisions` | Revisi invoice tanpa menimpa histori | management | web |
| GET | `/invoices/{invoice_id}/revisions` | Histori revision invoice | scoped_read | web |
| POST | `/target-plans` | Buat draft plan/versi target | management | web |
| GET | `/target-plans` | Daftar target plan/versi | scoped_read | web |
| POST | `/target-versions/{target_version_id}/items` | Isi target bottom-up pada draft | management | web |
| GET | `/target-versions/{target_version_id}/items` | Item target | scoped_read | web |
| POST | `/target-versions/{target_version_id}/allocations` | Kalkulasi draft alokasi top-down | management | web |
| POST | `/target-versions/{target_version_id}/submit` | Target submit | management | web |
| POST | `/target-versions/{target_version_id}/approve` | Target approve | management_no_self_approval | web |
| POST | `/target-versions/{target_version_id}/revise` | Target revise | management | web |
| GET | `/targets` | Target dan scope yang berlaku | scoped_read | web |
| GET | `/forecast-contributions` | Kontribusi forecast | scoped_read | web |
| POST | `/forecast-contributions` | Input estimasi pekerjaan sendiri | scoped_work | web |
| GET | `/dashboard/summary` | Ringkasan actual, target, forecast, customer | scoped_read | web |
| POST | `/incentive-plans` | Buat plan role/kanal dan versi draft | management | web |
| GET | `/incentive-plans` | Daftar plan insentif | statement_read | web |
| POST | `/incentive-plan-versions/{plan_version_id}/approve` | Plan insentif approve | management_no_self_approval | web |
| POST | `/incentive-plan-versions/{plan_version_id}/revise` | Plan insentif revise | management | web |
| POST | `/incentive-enrollments` | Daftarkan penerima ke plan/target | management | web |
| POST | `/incentive-simulations` | What-if tanpa entitlement | management | web |
| POST | `/incentive-calculations` | Jalankan calculation run | management | web |
| GET | `/incentive-statements` | Statement sesuai izin nominal | statement_read | web |
| GET | `/incentive-statements/{statement_id}` | Detail statement | statement_read | web |
| POST | `/incentive-statements/{statement_id}/finalize` | Statement finalize | management_no_self_approval | web |
| POST | `/incentive-statements/{statement_id}/revise` | Statement revise | management_no_self_approval | web |
| POST | `/incentive-exports` | Export statement revision yang disahkan | management | web |
| POST | `/attachment-intents` | Buat upload intent privat | scoped_work | web |
| POST | `/attachments/{attachment_id}/finalize` | Verifikasi object dan kaitkan bukti | attachment_owner | web |
| GET | `/sales/last-positions` | Posisi terakhir yang benar-benar diterima | scoped_read | web |
| POST | `/shifts` | Mulai sesi tracking dari UI | field_actor | android |
| POST | `/shifts/{shift_id}/end` | Akhiri sesi | field_actor | android |
| POST | `/sync/events` | Sinkronisasi event Android per-event ack | assigned_actor | web-and-android |
| POST | `/locations/batches` | Batch GPS Android | field_actor | android |
| GET | `/branches/{id}` | Detail branches | scoped_read | web |
| PUT | `/branches/{id}` | Revisi branches | management | web |
| POST | `/branches/{id}/archive` | Arsipkan branches | management | web |
| GET | `/areas/{id}` | Detail areas | scoped_read | web |
| PUT | `/areas/{id}` | Revisi areas | management | web |
| POST | `/areas/{id}/archive` | Arsipkan areas | management | web |
| GET | `/contacts` | Daftar contacts | scoped_read | web |
| POST | `/contacts` | Buat contacts | management | web |
| GET | `/contacts/{id}` | Detail contacts | scoped_read | web |
| PUT | `/contacts/{id}` | Revisi contacts | management | web |
| POST | `/contacts/{id}/archive` | Arsipkan contacts | management | web |
| GET | `/products` | Daftar products | scoped_read | web |
| POST | `/products` | Buat products | management | web |
| GET | `/products/{id}` | Detail products | scoped_read | web |
| PUT | `/products/{id}` | Revisi products | management | web |
| POST | `/products/{id}/archive` | Arsipkan products | management | web |
| GET | `/product-groups` | Daftar product-groups | scoped_read | web |
| POST | `/product-groups` | Buat product-groups | management | web |
| GET | `/product-groups/{id}` | Detail product-groups | scoped_read | web |
| PUT | `/product-groups/{id}` | Revisi product-groups | management | web |
| POST | `/product-groups/{id}/archive` | Arsipkan product-groups | management | web |
| GET | `/calendars` | Daftar calendars | scoped_read | web |
| POST | `/calendars` | Buat calendars | management | web |
| GET | `/calendars/{id}` | Detail calendars | scoped_read | web |
| PUT | `/calendars/{id}` | Revisi calendars | management | web |
| POST | `/calendars/{id}/archive` | Arsipkan calendars | management | web |
| GET | `/campaigns` | Daftar campaigns | scoped_read | web |
| POST | `/campaigns` | Buat campaigns | management | web |
| GET | `/campaigns/{id}` | Detail campaigns | scoped_read | web |
| PUT | `/campaigns/{id}` | Revisi campaigns | management | web |
| POST | `/campaigns/{id}/archive` | Arsipkan campaigns | management | web |
| GET | `/scripts` | Daftar scripts | scoped_read | web |
| POST | `/scripts` | Buat scripts | management | web |
| GET | `/scripts/{id}` | Detail scripts | scoped_read | web |
| PUT | `/scripts/{id}` | Revisi scripts | management | web |
| POST | `/scripts/{id}/archive` | Arsipkan scripts | management | web |
| GET | `/approval-policies` | Daftar approval-policies | scoped_read | web |
| POST | `/approval-policies` | Buat approval-policies | management | web |
| GET | `/approval-policies/{id}` | Detail approval-policies | scoped_read | web |
| PUT | `/approval-policies/{id}` | Revisi approval-policies | management | web |
| POST | `/approval-policies/{id}/archive` | Arsipkan approval-policies | management | web |
| POST | `/device-sessions` | Register sesi perangkat | authenticated | web |
| GET | `/device-sessions` | Sesi milik user | session_owner | web |
| GET | `/device-sessions/{session_id}` | Detail sesi | session_owner_or_management | web |
| POST | `/device-sessions/{session_id}/revoke` | Cabut sesi perangkat | session_owner_or_management | web |
| GET | `/users/{user_id}` | Detail user | scoped_read | web |
| PUT | `/users/{user_id}` | Revisi role/status user | management | web |
| POST | `/users/{user_id}/deactivate` | Nonaktifkan user | management | web |
| GET | `/hierarchy-assignments/{assignment_id}` | Detail hirarki | scoped_read | web |
| POST | `/hierarchy-assignments/{assignment_id}/end` | Akhiri hirarki efektif | management | web |
| POST | `/customers/{customer_id}/merge` | Merge terkontrol | management | web |
| GET | `/customer-tier-rules/{rule_id}` | Detail rule | scoped_read | web |
| POST | `/customer-tier-rules/{rule_id}/approve` | Sahkan rule tier | management_no_self_approval | web |
| GET | `/contacts/{contact_id}/preferences` | Riwayat preferensi kontak | scoped_read | web |
| POST | `/contacts/{contact_id}/preferences` | Catat preferensi/permintaan DNC | contact_preference_actor | web |
| POST | `/master-imports` | Dry-run/commit master | management | web |
| GET | `/jobs/{job_id}/errors` | Error per baris | scoped_read | web |
| GET | `/jobs/{job_id}/download` | Unduh output private | scoped_read | web |
| GET | `/target-versions/{target_version_id}` | Versi target dan ETag | scoped_read | web |
| GET | `/incentive-plan-versions/{plan_version_id}` | Versi plan dan ETag | statement_read | web |
| PUT | `/incentive-plan-versions/{plan_version_id}` | Edit versi draft plan | management | web |
| POST | `/incentive-plan-versions/{plan_version_id}/submit` | Ajukan plan | management | web |
| GET | `/incentive-statements/{statement_id}/sources` | Input invoice revision statement | statement_read | web |
| POST | `/incentive-statements/{statement_id}/disputes` | Ajukan keberatan | statement_owner | web |
| GET | `/disputes/{dispute_id}` | Detail keberatan | statement_read | web |
| POST | `/disputes/{dispute_id}/resolve` | Selesaikan keberatan | management | web |
| POST | `/incentive-statements/{statement_id}/submit` | Ajukan statement untuk review | management | web |
| POST | `/incentive-statements/{statement_id}/payment-confirmations` | Catat pembayaran eksternal tanpa transfer uang | management | web |
| GET | `/attachments/{attachment_id}` | Status dan ETag attachment | attachment_owner_or_scoped_read | web |
| GET | `/attachments/{attachment_id}/download` | Download attachment privat | attachment_scoped_read | web |
| GET | `/activities/{activity_id}` | Detail aktivitas dan ETag | scoped_read | web |
| POST | `/activities/{activity_id}/revisions` | Koreksi activity beralasan | scoped_work | web |
| GET | `/tasks/{task_id}` | Detail task dan ETag | scoped_read | web |
| PUT | `/tasks/{task_id}` | Reschedule task berhistori | scoped_work | web |
| POST | `/tasks/{task_id}/cancel` | Batalkan task beralasan | scoped_work | web |
| GET | `/handoffs/{handoff_id}` | Detail handoff dan ETag | scoped_read | web |
| POST | `/handoffs/{handoff_id}/cancel` | Batalkan handoff | handoff_actor | web |
| POST | `/telesales/queue/{queue_item_id}/renew` | Perpanjang lease aktif | lease_holder | web |
| GET | `/work-plans` | Daftar work-plans | scoped_read | web |
| POST | `/work-plans` | Buat work-plans | scoped_work | web |
| GET | `/work-plans/{id}` | Detail work-plans | scoped_read | web |
| PUT | `/work-plans/{id}` | Revisi work-plans | scoped_work | web |
| GET | `/plan-items` | Daftar plan-items | scoped_read | web |
| POST | `/plan-items` | Buat plan-items | scoped_work | web |
| GET | `/plan-items/{id}` | Detail plan-items | scoped_read | web |
| PUT | `/plan-items/{id}` | Revisi plan-items | scoped_work | web |
| GET | `/leads` | Daftar leads | scoped_read | web |
| POST | `/leads` | Buat leads | scoped_work | web |
| GET | `/leads/{id}` | Detail leads | scoped_read | web |
| PUT | `/leads/{id}` | Revisi leads | scoped_work | web |
| GET | `/exceptions` | Daftar exceptions | scoped_read | web |
| POST | `/exceptions` | Buat exceptions | scoped_work | web |
| GET | `/exceptions/{id}` | Detail exceptions | scoped_read | web |
| PUT | `/exceptions/{id}` | Revisi exceptions | scoped_work | web |
| GET | `/coaching` | Daftar coaching | scoped_read | web |
| POST | `/coaching` | Buat coaching | supervisor_scope | web |
| GET | `/coaching/{id}` | Detail coaching | scoped_read | web |
| PUT | `/coaching/{id}` | Revisi coaching | supervisor_scope | web |
| POST | `/exceptions/{id}/resolve` | Selesaikan exception | scoped_work | web |
| GET | `/orders` | Daftar order | scoped_read | web |
| POST | `/orders` | Buat draft order | assigned_actor | web |
| GET | `/orders/{order_id}` | Detail order | scoped_read | web |
| PUT | `/orders/{order_id}` | Edit draft order | assigned_actor | web |
| POST | `/orders/{order_id}/submit` | Order submit | assigned_actor | web |
| POST | `/orders/{order_id}/approve` | Order approve | management_no_self_approval | web |
| POST | `/orders/{order_id}/reject` | Order reject | management_no_self_approval | web |
| POST | `/orders/{order_id}/cancel` | Order cancel | scoped_work | web |
| POST | `/orders/{order_id}/external-confirmations` | Konfirmasi order backoffice | management | web |
| GET | `/opportunities` | Daftar opportunity | scoped_read | web |
| POST | `/opportunities` | Buat opportunity | scoped_work | web |
| GET | `/opportunities/{opportunity_id}` | Detail opportunity | scoped_read | web |
| PUT | `/opportunities/{opportunity_id}` | Transisi stage dan revisi | scoped_work | web |
| GET | `/forecast-contributions/{contribution_id}` | Detail forecast | scoped_read | web |
| PUT | `/forecast-contributions/{contribution_id}` | Revisi kategori/estimasi | scoped_work | web |
| GET | `/notifications` | Notifikasi user | session_owner | web |
| GET | `/notifications/{notification_id}` | Detail notifikasi | session_owner | web |
| POST | `/notifications/{notification_id}/read` | Tandai dibaca | session_owner | web |
| GET | `/audit-events` | Audit terfilter | audit_read | web |
| POST | `/report-exports` | Export laporan scoped | scoped_export | web |
| POST | `/work-sessions` | Mulai sesi kerja web | assigned_actor | web |
| GET | `/work-sessions` | Daftar sesi kerja | scoped_read | web |
| GET | `/work-sessions/{session_id}` | Detail sesi | scoped_read | web |
| POST | `/work-sessions/{session_id}/end` | Akhiri sesi web | assigned_actor | web |
| GET | `/shifts/{shift_id}` | Detail shift Android | scoped_read | android |
| GET | `/sales/{user_id}/gps-history` | Segmen perjalanan dari hot/archive | scoped_read | android |

## 8. Contoh request

POST /api/v1/incentive-simulations

```json
{"plan_version_id":"plan-field-v1","target_minor":1000000000,"actual_minor":1020000000}
```

Contoh response untuk bonus dasar Rp500 ribu, tarif 80–100% 1% dan di atas 100% 2%:

```json
{"data":{"achievement":"1.02","base_bonus_minor":500000,"tier_payout_minor":2400000,"payout_minor":2900000},"meta":{"request_id":"req-demo-01","server_time":"2026-10-16T08:00:00Z"}}
```

Header Authorization dan Idempotency-Key tetap wajib. Contoh tidak menjalankan pembayaran atau kalkulasi pada server nyata.

## 9. Cakupan versi 1.1 dan aturan tambahan

Endpoint web kini mencakup master, kalender, campaign/script, DNC/preference, lease renew, plan/lead/order/approval, opportunity, revision invoice, target, forecast, insentif/dispute/payment confirmation, audit, notification, report export, device revoke dan attachment download. GPS history serta shift native tetap stage Android. Setiap operasi web ditautkan ke item backlog melalui x-backlog-id; ini peta implementasi, bukan tanda kode selesai.

Import credit-only diperbolehkan; commit wajib validation_batch_id. Rincian product line menyimpan unit_code/quantity_scale; customer tak dikenal dapat masuk staging dengan source_customer_code. Mutasi draft/approve/finalize punya GET versi dan ETag; If-Match pada assignment/customer preference merujuk parent aggregate. Detail revisi invoice mencakup perubahan dimensi yang sah, bukan hanya nilai net; histori tetap immutable.

Plan insentif memiliki parameter conditional per model. Flat meminta rate; milestone meminta bonus nominal dan mode; progressive meminta tiers; threshold_progressive meminta threshold, bonus dasar dan tiers. Payload dengan field model lain ditolak. Constraint antar lapisan (overlap, urutan, upper > lower), tanggal, approver dan dimensi target tetap divalidasi backend. Role/kanal source dan enrollment harus cocok. Customer tier custom terbatas pada bands sales tervalidasi; percentile cohort = seluruh customer dalam scope rule/cutoff, tie policy dibekukan saat aktivasi.

Policy tambahan: contact_preference_actor dapat mencatat permintaan DNC pada customer assigned; mencabut DNC hanya Management/NSM dengan bukti. supervisor_scope dibatasi subtree dan area; handoff_actor diverifikasi per action (sender cancel, recipient accept/decline/complete, supervisor escalation beralasan). scoped_work tidak mengizinkan perubahan master/target/insentif. Pencatatan rejection atau status caller tidak dipercaya tanpa pemeriksaan transisi server.

Endpoint lain menggunakan semantic mapping ke ERD: customer_id → customer_outlet.id; target user scope SR/SPV/AM → target_item.user_id dengan subtree snapshot; source_invoice_id+source_system unik per organisasi. Body invoice tidak memilih organisasi. Assignment date memakai tanggal bisnis [from,to), bukan timestamp intrahari yang tidak tersedia pada invoice_date. Nilai net/retur dan ID sumber final dicocokkan ke data nyata saat implementasi.

Batas teknis (batch, file, expiry, provider quota) adalah default rancangan yang perlu diuji beban. D1 binding menggunakan prepared statements dan batch kecil sesuai batas parameter/CPU; setiap job mempunyai checkpoint. Rate limit numerik dan konfigurasi provider bukan bukti kapasitas produksi.

## 10. Verifikasi dan gate implementasi

OpenAPI 3.1 dan JSON Schema diperiksa dengan validator standar. Uji positif/negatif schema yang telah dijalankan meliputi lima model insentif, parameter wajib/asing, pencampuran model, invoice valid/staging, customer hilang, nilai negatif, tanggal tidak valid, dan kanal tidak dikenal. Import commit, credit-only, target nol, evidence kunjungan, serta aturan lintas record tetap membutuhkan contract tests implementasi. Laporan Evaluasi_Paket_Spesifikasi_v1.md serta specification_review_checks.json menyimpan hasil aktual. Reference coverage ERD/API/backlog diperiksa terpisah dari runtime. Authorization, concurrency, temporal overlap, query D1, SLA, backup dan MFA masih harus dibuktikan dalam aplikasi nyata.

## WEB-065 runtime — 24 Oktober 2026

Empat operasi distribution admin-only tersedia pada [kontrak runtime](distribution-api.m4.openapi.json). Request strict/Zod, subset kosong berbeda dari absent, active source, reason/date, epoch/hash/If-Match/Idempotency-Key dan batas batch. Inventory kini 249 operasi terhubung; kontrak bukan bukti deployment.

## WEB-066 runtime — 24 Oktober 2026

Tiga operasi GET analitik/source/CSV tersedia pada [kontrak request/response](regional-analytics-api.m4.openapi.json). Source kind customers/invoices/activities/targets/sales; exact snapshot dan actor/scope, tanggal bisnis organisasi dan current-read mapping. Inventory 252 operasi terhubung. Export null/status/observed/alokasi bersifat eksplisit; bukan template import atau laporan tersimpan permanen.


## Implementasi lokal WEB-067 — 24 Oktober 2026

Risiko pelanggan nyales-risk-1 tersedia lokal: mendekati churn, repeat order terlambat dan penurunan invoice dengan ambang/histori minimum yang diisi Management/NSM. Policy aktif immutable dan tidak dipasang default; perubahan melalui draft/aktivasi berversi. Mode Risiko menampilkan bukti, source/cutoff/scope dan snapshot historis; data minim tidak disebut aman. Near-churn perusahaan menjadi unknown bila akses sejarah perusahaan tidak sah. Tidak menulis status/owner/target/aktivitas atau menghubungi customer otomatis. Akses dan guard kontak/DNC/campaign/lease existing tetap berlaku. D1 menyimpan metadata dan R2 privat menyimpan bukti; recovery keduanya diuji lokal. [Definisi dan evidence](../WEB067_RISK_DESIGN.md), [ERD fisik](ERD_WEB067_Implementation.md), [10 operasi API](customer-risk-api.m4.openapi.json). GIS-A03/A04 diverifikasi lokal, bukan sign-off manusia/provider. Model desain baseline tidak otomatis menjadi endpoint /api/v1 yang sudah deployed.


## Implementasi lokal WEB-068 — 24 Oktober 2026

GIS-ANA-03/GIS-A05 kini mempunyai kebijakan layanan bulanan berversi, sumber seluruh portfolio yang diizinkan, before/after per kanal dan skenario immutable. Angka kosong tetap unknown, kapasitas adalah alokasi layanan tanpa travel/absensi individu, histori invoice tidak dipindahkan. Management/NSM meninjau popup konfigurasi dan transfer; role lain membaca scope parsial. Apply satu batch atomik memakai WEB-065, kemudian sisa wajib dipreview dan disimpan menjadi revisi baru. D1 empat tabel baru dan private R2 evidence, hash/epoch/If-Match/idempotency/audit serta backup/restore diuji lokal. Pilot utama tidak dipasangi parameter bisnis otomatis. [Runbook](../WEB068_WORKLOAD_DESIGN.md), [ERD fisik](ERD_WEB068_Implementation.md), [14 operasi API](workload-scenarios-api.m4.openapi.json), [evidence](../WEB068_EVIDENCE.json). WEB-069–074 generator tetap pengembangan terpisah; bukan routing yang telah aktif atau production acceptance.


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

## Respons direktori — 28 Oktober 2026

Tanpa endpoint impor publik baru: /api/me menambah directory_data; payload /api/map dan /api/geo/map menambah reference_points/reference_point_count/keterangan scope. Referensi hanya pada scope organisasi Management/NSM tanpa filter area, rep atau status customer. Customer impor tanpa bukti kelengkapan riwayat tetap Unknown/provisional. [Detail](../POINT_DIRECTORY_IMPORT.md).
