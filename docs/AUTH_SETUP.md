# WEB-007 — identitas NYALES

Login email/password dan Google memakai Firebase client SDK, persistence per sesi browser, refresh ID token dari SDK, serta logout yang membongkar halaman dan state sebelumnya. Backend memeriksa signature RS256, issuer, audience, expiry, subject, iat dan auth_time. UID dipetakan ke app_user aktif dan satu assignment role efektif di D1; role/organisasi dari payload client tidak dipercaya. Akun tanpa mapping atau mapping ambigu ditolak. Tidak ada registrasi otomatis menjadi Management.

## Konfigurasi Firebase

1. Sediakan Firebase project NYALES dan web app; aktifkan Email/Password dan Google pada Authentication.
2. Tambahkan domain web/development yang diizinkan di Firebase Authentication.
3. Salin `.env.example` ke `.env.local` dan isi konfigurasi public Firebase web app.
4. Isi FIREBASE_PROJECT_ID di environment Worker dengan project yang sama. Production: APP_ENV=production dan LOCAL_AUTH=false. Jangan memakai credential ERP SUKE tanpa keputusan integrasi.
5. Setelah migrations, provision app_user.auth_subject memakai Firebase UID dan auth_role_assignment dengan role, organisasi dan tanggal efektif yang sah. Provisioning tersedia melalui User & Hirarki untuk Management/NSM; user baru dibuat nonaktif dan perlu role/hirarki yang sah sebelum aktivasi. Jangan memasukkan UID/password ke kode seed umum.

## Lokal

Demo memerlukan APP_ENV=local dan LOCAL_AUTH=true sekaligus. Klik “Masuk demo lokal”; token fixture hanya diterima dalam mode tersebut. Demo tidak menggunakan Firebase atau akun sungguhan. Mode lokal tetap mengharuskan login eksplisit; membuka endpoint tanpa token menghasilkan 401.

## Verifikasi dan batas

`npm test` memeriksa JWT valid/tidak valid, environment guard, endpoint tanpa identitas dan mapping. Browser test memeriksa login demo, reload sesi dan logout. Login Firebase nyata belum diverifikasi karena konfigurasi proyek belum diberikan. WEB-007 belum Accepted sampai pengujian akun Firebase aktif/nonaktif/tidak terdaftar pada proyek nyata selesai.

WEB-008 sudah memasang scope pada endpoint GET yang tersedia (customer, dashboard, map, telesales queue dan me). Request mutation/resource yang belum didukung tetap ditolak; pemeriksaan WEB-008 production dengan Firebase nyata belum dilakukan. `/api/me` tersedia bagi identitas terverifikasi. WEB-011 kini menambahkan binding sesi perangkat dan pencabutan di backend sebagaimana bagian berikut. MFA provider/enrollment serta pemulihan akun belum dikonfigurasi. Role dan hirarki bertanggal efektif tersedia melalui WEB-010.

Referensi: https://firebase.google.com/docs/auth/admin/verify-id-tokens dan https://firebase.google.com/docs/auth/web/start


## WEB-011 — sesi perangkat dan gate admin

Setelah Firebase identity diverifikasi dan dipetakan ke user aktif, browser mendaftarkan sesi melalui POST /api/device-sessions dengan device_id. Bootstrap ini memerlukan login baru (auth_time maksimum lima menit); semua endpoint domain berikutnya memerlukan Authorization: Bearer <Firebase ID token> **dan** X-Device-Session. Health/config tetap publik. Browser mengirim token sesi secara otomatis, menyimpannya di sessionStorage terikat Firebase UID, dan tidak mengirim bearer ke origin lain. Server menyimpan SHA-256 token acak 256-bit, tanpa menyimpan token asli dalam tabel atau audit. Token hanya dikembalikan sekali saat sesi dibuat. Jika respons bootstrap hilang, lakukan pendaftaran baru; endpoint bootstrap belum mempunyai replay token dengan Idempotency-Key. Batas 20 pendaftaran/user/10 menit melindungi pendaftaran berulang; batch SQL memeriksa batas dan revoke floor kembali secara atomik.

Sesi berlaku maksimum 12 jam (default pilot) dan selalu diperiksa pada request, termasuk subject, user dan organisasi. Last seen ditulis paling sering tiap 15 menit. GET /api/device-sessions menampilkan 200 sesi terbaru (has_more bila lebih); GET /api/device-sessions/:id menyediakan detail. User biasa hanya dapat membaca/mencabut sesinya sendiri. Management/NSM dapat membaca/mencabut sesi organisasi yang sama; akses ID di luar scope =404. POST /api/device-sessions/:id/revoke memerlukan reason dan If-Match versi, dengan audit atomik. Request ulang terhadap sesi yang sudah dicabut tidak menggandakan audit. Pencabutan tidak membatalkan sesi perangkat lain.

Pencabutan menolak sesi lama pada request berikutnya tanpa menunggu Firebase JWT kedaluwarsa. Token Firebase dari login yang sama/lebih lama dari sesi yang dicabut tidak dapat membuat binding baru, meskipun device_id diganti; login baru dengan auth_time lebih baru diperlukan. Ini bukan pencabutan refresh token Firebase global. Logout mencoba mencabut sesi backend, lalu mengakhiri Firebase/browser state. Jika jaringan gagal, browser tetap keluar dan menampilkan bahwa revoke server belum terkonfirmasi; sesi backend berlaku sampai dicabut/berakhir. Browser terbuka memeriksa /api/me setiap 30 detik saat terlihat serta saat focus; API tetap menolak langsung tanpa menunggu polling UI.

Halaman dan state domain dibongkar saat logout/pergantian identitas, provider React dikunci oleh organisasi/user/role/scope/sesi, dan respons akun lama ditolak bila identitas telah berubah. Draft dan outbox IndexedDB WEB-035 sudah tersedia dengan namespace org:user. Role/device UAT, shared-browser privacy dan retensi lokal tetap gate WEB-059; data tersimpan lokal tidak dianggap dienkripsi oleh aplikasi. Device ID bukan bukti kepemilikan perangkat keras; binding menggunakan secret sesi dan identitas Firebase.

**Gate produksi admin:** Management/NSM memerlukan klaim second factor Firebase yang telah diverifikasi pada JWT, bukan flag client. Tanpa klaim tersebut backend mengembalikan MFA_REQUIRED untuk seluruh domain API termasuk bootstrap. Local demo melewati gate hanya bila APP_ENV=local dan LOCAL_AUTH=true. Role approver tambahan harus masuk policy ini saat modul approval dibangun; saat ini belum ada role approver terpisah. Pencabutan sesi user lain juga memerlukan auth_time maksimum lima menit; bila kedaluwarsa, keluar dan masuk kembali.

**Provider dan prioritas gratis, diverifikasi 17 Oktober 2026:** dokumentasi [Firebase TOTP](https://firebase.google.com/docs/auth/web/totp-mfa) mensyaratkan upgrade Firebase Authentication with Identity Platform. [Firebase pricing](https://firebase.google.com/pricing) dan [Identity Platform pricing](https://cloud.google.com/identity-platform/pricing) membedakan plan/kuota dan biaya SMS; TOTP tidak mengirim SMS, tetapi kelayakan Spark, kuota MAU/DAU, entitlement dan billing proyek harus dicek pada proyek yang dipilih. [Authentication limits](https://firebase.google.com/docs/auth/limits) memuat batas Spark Identity Platform. Tidak ada upgrade/billing/provider/SMS yang diaktifkan pada pekerjaan ini. Status gate: **pending_project_verification**, bukan MFA aktif. Jalur enrollment/challenge/recovery MFA UI dan uji Firebase proyek nyata masih menjadi gate sebelum rollout admin penuh. Jangan menghapus gate backend untuk melewati konfigurasi tersebut.

Uji lokal: npm test (JWT termasuk signed second-factor, ownership/tenant, revoke, expiry, rate limit, reauth floor, gate MFA, audit tanpa secret); browser dua konteks menguji revoke remote, perangkat lain tetap aktif, logout token401, login ulang, reload, popup alasan dan responsif. Tidak ada deployment cloud atau verifikasi akun Firebase nyata.
