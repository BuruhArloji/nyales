# WEB-007 — identitas NYALES

Login email/password dan Google memakai Firebase client SDK, persistence per sesi browser, refresh ID token dari SDK, serta logout yang membongkar halaman dan state sebelumnya. Backend memeriksa signature RS256, issuer, audience, expiry, subject, iat dan auth_time. UID dipetakan ke app_user aktif dan satu assignment role efektif di D1; role/organisasi dari payload client tidak dipercaya. Akun tanpa mapping atau mapping ambigu ditolak. Tidak ada registrasi otomatis menjadi Management.

## Konfigurasi Firebase

1. Untuk staging pilot, Firebase belum diperlukan: gunakan `APP_ENV=staging` dan `LOCAL_AUTH=true`.
2. Untuk production atau rollout admin penuh, sediakan Firebase project NYALES dan web app; aktifkan Email/Password dan Google pada Authentication.
3. Tambahkan domain web/development yang diizinkan di Firebase Authentication bila jalur Firebase digunakan.
4. Isi FIREBASE_PROJECT_ID dengan project yang sama untuk jalur Firebase. Production: `APP_ENV=production` dan `LOCAL_AUTH=false`. Jangan memakai credential ERP SUKE tanpa keputusan integrasi.
5. Setelah migrations, provision app_user.auth_subject memakai Firebase UID dan auth_role_assignment dengan role, organisasi dan tanggal efektif yang sah. Provisioning tersedia melalui User & Hirarki untuk Management/NSM; user baru dibuat nonaktif dan perlu role/hirarki yang sah sebelum aktivasi. Jangan memasukkan UID/password ke kode seed umum.

## Lokal dan staging pilot

Demo memerlukan `LOCAL_AUTH=true` dan hanya diterima pada `APP_ENV=local` atau staging pilot. Klik “Masuk sebagai Management”; staging memilih Management aktif pertama dari D1 NYALES Pilot, lalu tetap membuat device session dan menjalankan scope server-side. Jalur ini tidak menggunakan Firebase, tetapi hanya untuk staging/pilot dan tidak boleh diaktifkan pada production. Membuka endpoint tanpa token atau tanpa device session menghasilkan 401.

## Verifikasi dan batas

`npm test` memeriksa JWT valid/tidak valid, environment guard, endpoint tanpa identitas dan mapping. Browser test memeriksa login demo, reload sesi dan logout. Login Firebase nyata belum diverifikasi karena konfigurasi proyek belum diberikan. WEB-007 belum Accepted sampai pengujian akun Firebase aktif/nonaktif/tidak terdaftar pada proyek nyata selesai.

WEB-008 sudah memasang scope pada endpoint GET yang tersedia (customer, dashboard, map, telesales queue dan me). Request mutation/resource yang belum didukung tetap ditolak; pemeriksaan WEB-008 production dengan Firebase nyata belum dilakukan. `/api/me` tersedia bagi identitas terverifikasi. WEB-011 kini menambahkan binding sesi perangkat dan pencabutan di backend sebagaimana bagian berikut. MFA provider/enrollment serta pemulihan akun belum dikonfigurasi. Role dan hirarki bertanggal efektif tersedia melalui WEB-010.

Referensi: https://firebase.google.com/docs/auth/admin/verify-id-tokens dan https://firebase.google.com/docs/auth/web/start


## WEB-011 — sesi perangkat dan gate admin

Setelah Firebase identity diverifikasi dan dipetakan ke user aktif, browser mendaftarkan sesi melalui POST /api/device-sessions dengan device_id. Bootstrap ini memerlukan login baru (auth_time maksimum lima menit); semua endpoint domain berikutnya memerlukan Authorization: Bearer <Firebase ID token> **dan** X-Device-Session. Health/config tetap publik. Browser mengirim token sesi secara otomatis, menyimpannya di sessionStorage terikat Firebase UID, dan tidak mengirim bearer ke origin lain. Server menyimpan SHA-256 token acak 256-bit, tanpa menyimpan token asli dalam tabel atau audit. Token hanya dikembalikan sekali saat sesi dibuat. Jika respons bootstrap hilang, lakukan pendaftaran baru; endpoint bootstrap belum mempunyai replay token dengan Idempotency-Key. Batas 20 pendaftaran/user/10 menit melindungi pendaftaran berulang; batch SQL memeriksa batas dan revoke floor kembali secara atomik.

Sesi berlaku maksimum 12 jam (default pilot) dan selalu diperiksa pada request, termasuk subject, user dan organisasi. Last seen ditulis paling sering tiap 15 menit. GET /api/device-sessions menampilkan 200 sesi terbaru (has_more bila lebih); GET /api/device-sessions/:id menyediakan detail. User biasa hanya dapat membaca/mencabut sesinya sendiri. Management/NSM dapat membaca/mencabut sesi organisasi yang sama; akses ID di luar scope =404. POST /api/device-sessions/:id/revoke memerlukan reason dan If-Match versi, dengan audit atomik. Request ulang terhadap sesi yang sudah dicabut tidak menggandakan audit. Pencabutan tidak membatalkan sesi perangkat lain.

Pencabutan menolak sesi lama pada request berikutnya tanpa menunggu Firebase JWT kedaluwarsa. Token Firebase dari login yang sama/lebih lama dari sesi yang dicabut tidak dapat membuat binding baru, meskipun device_id diganti; login baru dengan auth_time lebih baru diperlukan. Ini bukan pencabutan refresh token Firebase global. Logout mencoba mencabut sesi backend, lalu mengakhiri Firebase/browser state. Jika jaringan gagal, browser tetap keluar dan menampilkan bahwa revoke server belum terkonfirmasi; sesi backend berlaku sampai dicabut/berakhir. Browser terbuka memeriksa /api/me setiap 30 detik saat terlihat serta saat focus; API tetap menolak langsung tanpa menunggu polling UI.

Halaman dan state domain dibongkar saat logout/pergantian identitas, provider React dikunci oleh organisasi/user/role/scope/sesi, dan respons akun lama ditolak bila identitas telah berubah. Draft dan outbox IndexedDB WEB-035 sudah tersedia dengan namespace org:user. Role/device UAT, shared-browser privacy dan retensi lokal tetap gate WEB-059; data tersimpan lokal tidak dianggap dienkripsi oleh aplikasi. Device ID bukan bukti kepemilikan perangkat keras; binding menggunakan secret sesi dan identitas Firebase.

**Gate produksi admin:** Management/NSM memerlukan klaim second factor Firebase yang telah diverifikasi pada JWT, bukan flag client. Tanpa klaim tersebut backend mengembalikan MFA_REQUIRED untuk seluruh domain API termasuk bootstrap. Staging pilot dapat memakai login lokal hanya ketika `APP_ENV=staging` dan `LOCAL_AUTH=true`; production tetap `LOCAL_AUTH=false` dan memakai Firebase/MFA. Role approver tambahan harus masuk policy ini saat modul approval dibangun; saat ini belum ada role approver terpisah. Pencabutan sesi user lain juga memerlukan auth_time maksimum lima menit; bila kedaluwarsa, keluar dan masuk kembali.

**Provider dan prioritas gratis, diverifikasi 17 Oktober 2026:** dokumentasi [Firebase TOTP](https://firebase.google.com/docs/auth/web/totp-mfa) mensyaratkan upgrade Firebase Authentication with Identity Platform. [Firebase pricing](https://firebase.google.com/pricing) dan [Identity Platform pricing](https://cloud.google.com/identity-platform/pricing) membedakan plan/kuota dan biaya SMS; TOTP tidak mengirim SMS, tetapi kelayakan Spark, kuota MAU/DAU, entitlement dan billing proyek harus dicek pada proyek yang dipilih. [Authentication limits](https://firebase.google.com/docs/auth/limits) memuat batas Spark Identity Platform. Tidak ada upgrade/billing/provider/SMS yang diaktifkan pada pekerjaan ini. Status gate: **pending_project_verification**, bukan MFA aktif. Jalur enrollment/challenge/recovery MFA UI dan uji Firebase proyek nyata masih menjadi gate sebelum rollout admin penuh. Jangan menghapus gate backend untuk melewati konfigurasi tersebut.

Uji lokal: npm test (JWT termasuk signed second-factor, ownership/tenant, revoke, expiry, rate limit, reauth floor, gate MFA, audit tanpa secret); browser dua konteks menguji revoke remote, perangkat lain tetap aktif, logout token401, login ulang, reload, popup alasan dan responsif. Tidak ada deployment cloud atau verifikasi akun Firebase nyata.


## Staging: aktivasi Management pertama dan Authenticator

Aktivasi pertama hanya aktif pada `APP_ENV=staging` bila operator memberikan `FIRST_ADMIN_EMAIL` dan `FIRST_ADMIN_ORGANIZATION_NAME` secara eksplisit. Tanpa konfigurasi itu, `POST /api/auth/first-admin` mengembalikan 404. Tidak ada allowlist atau role default di source. Organisasi sementara adalah `NYALES Pilot`.

Endpoint memverifikasi JWT Firebase, email verified yang cocok dengan allowlist, provider Google, klaim second factor dan login maksimal lima menit. Body tidak diterima; UID/email/role tidak berasal dari payload client. Sebelum MFA berhasil tidak ada organisasi, user, role atau audit baru yang ditulis. Satu D1 batch membuat organisasi, user aktif, assignment Management kanal NULL, dan audit. Guard memeriksa organisasi/user/assignment masih kosong; race atau kegagalan menggagalkan seluruh batch. Tenant yang sudah ada tidak dapat diadopsi. Replay UID aktif yang sama hanya membaca receipt audit; akun nonaktif tidak diaktifkan ulang. Setelah aktivasi nyata terverifikasi, hapus kedua variable bootstrap dan deploy ulang.

Frontend menangani akun belum terpetakan, menampilkan UID milik pengguna dan tombol memeriksa akses kembali. Sesi bisnis yang dicabut tetap dibongkar. Untuk akun awal terpilih, frontend mencoba aktivasi yang dikunci allowlist; server meminta MFA bila belum terpenuhi.

UI Authenticator mendukung verifikasi email, QR lokal dan kunci manual, enrollment TOTP, challenge enam digit, pilihan beberapa faktor, pembatalan, dan provider yang belum aktif. Secret/QR/kode tidak ditulis ke storage, API NYALES atau log. Setelah enrollment pengguna wajib login ulang dan menyelesaikan challenge. Faktor SMS tidak dipicu. Faktor yang belum didukung tetap ditolak.

TOTP memerlukan Firebase Authentication with Identity Platform dan provider TOTP aktif. UI bukan bukti entitlement proyek atau enrollment akun nyata. Tidak ada upgrade billing otomatis. Pemulihan/penggantian MFA tetap melalui provider/operator, tanpa bypass atau unenrollment dari UI ini.

Tes mencakup first-admin rollback/race/replay, klaim email/Google/MFA, kebijakan sesi, dan browser fixture lokal untuk enrollment, login ulang, OTP salah/benar, cancel/secret cleanup, provider disabled, akun unmapped dan unsupported factor. SDK provider pada browser fixture dimock; ini bukan acceptance akun nyata. Referensi: [Firebase TOTP web](https://firebase.google.com/docs/auth/web/totp-mfa).


28 Oktober 2026: otorisasi Firebase CLI terisolasi diverifikasi ke akun pemilik yang dipilih dan project number `82528400427`. PATCH resmi hanya pada `mfa.providerConfigs` berhasil; read-back menunjukkan TOTP ENABLED, adjacentIntervals 1. `subtype` masih FIREBASE_AUTH, global mfa.state DISABLED dan enabledProviders kosong; jangan menganggap receipt konfigurasi ini membuktikan entitlement/runtime enrollment. Tidak memanggil initializeAuth, mengaktifkan SMS atau menautkan billing. Cloud Billing read-only API merespons 403 sehingga status billing tidak diverifikasi. Pengguna perlu menyelesaikan enrollment/challenge nyata untuk memastikan kesiapan akun. Kredensial CLI berada di `.nyales-agent/firebase-auth` yang diabaikan Git.

Validasi implementasi: 321 regresi lulus, 8 platform/dependency skip, typecheck/build/dry-run lulus; 3 browser fixture lulus. Kontrak core API dan inventory kini memuat 319 operasi dan membedakan setup staging yang dinonaktifkan (404) dari setup aktif tanpa bearer (401). Generator rencana kunjungan tetap ditunda.


Deployment alur aktivasi/MFA berhasil pada GitHub Actions run [40695915785](https://github.com/BuruhArloji/nyales/actions/runs/40695915785), commit `bfd8068ff51b753ade65ebf781fcc3325f95b4ed`. Enam smoke runtime dan empat pemeriksaan first-admin (no bearer, demo token, client-supplied claims/body, cross-origin) lulus pada origin staging nyata. Read-only D1 setelah deploy masih menunjukkan organization=0, app_user=0, roles=0 dan bootstrap audit=0. Aktivasi akun nyata tetap menunggu Google sign-in dan enrollment/challenge yang dilakukan pemilik akun pada perangkatnya. Jangan menandai `privileged_mfa_verified` atau production acceptance sebelum ada bukti tersebut.


## Aktivasi pertama terverifikasi — 28 Oktober 2026

Pemilik akun mengonfirmasi dashboard terbuka setelah Google sign-in dan flow Authenticator. Read-only D1 memverifikasi satu organisasi `NYALES Pilot`, satu user aktif dengan assignment `MANAGEMENT` kanal NULL, satu audit `bootstrap_first_admin`, dan satu sesi perangkat aktif. Firebase Admin read-only lookup pada akun yang dipilih memverifikasi email verified, provider Google, tidak disabled, serta satu faktor TOTP. Ini merupakan bukti runtime enrollment/login, bukan hanya receipt konfigurasi provider. Status subtype/global mfa state yang dicatat sebelumnya tidak mencegah enrollment/challenge akun ini.

Dua variable bootstrap `FIRST_ADMIN_EMAIL` dan `FIRST_ADMIN_ORGANIZATION_NAME` dihapus dari GitHub Environment staging dan diverifikasi read-back. Deployment penutupan endpoint dijalankan setelahnya; sebelum deployment itu selesai endpoint masih mengacu konfigurasi Worker sebelumnya. Pengguna dan assignment yang sudah dibuat dipertahankan. Tidak mencabut sesi atau mengubah MFA pengguna. Aktivasi ini hanya membuktikan Management awal; role/area UAT lainnya, recovery MFA/provider dan production acceptance tetap terpisah.


Penutupan bootstrap selesai melalui GitHub Actions run [40697201262](https://github.com/BuruhArloji/nyales/actions/runs/40697201262), deployed commit `ba3464c18a846a7024ce23ec75cba9e8e8c66bcf`. Setelah kedua variable bootstrap dihapus, build/deploy/smoke success. Pemeriksaan live tanpa bearer maupun dengan token demo mengembalikan 404 `NOT_FOUND` untuk `POST /api/auth/first-admin`, dan keenam smoke aplikasi tetap lulus. Akun/role/MFA pengguna yang sudah terdaftar tidak dicabut. Aktivasi Management pertama selesai; endpoint tetap terdapat dalam source tetapi nonaktif tanpa konfigurasi operator, bukan dihapus dengan migrasi data.
