# Google login dan akses portofolio

Owner didikpriyoutomo05@gmail.com mengikuti verified Google, mapped role, device session, tanpa Authenticator dan tanpa batas durasi portofolio. Email request tidak dipercaya: role hanya berdasarkan Firebase JWT verified signature/issuer/audience/expiry, provider google.com dan email_verified=true.

Pengunjung mendapat 20 menit TOTAL per Google account sejak admission pertama. portfolio_access menyimpan SHA-256 project + verified Google email yang dinormalisasi, bukan email mentah/token. Logout, perangkat baru, UID Firebase baru dan login ulang tidak memperpanjang expiry. Deadline diperiksa setiap request server. Trigger mencegah perubahan/penghapusan admission.

## Dataset sama dan hak berbeda

Keputusan terbaru pengguna: pengunjung melihat data staging yang sama. Tidak ada D1 portofolio terpisah. PORTFOLIO_ORGANIZATION_ID harus eksplisit. Actor app_user portfolio-<hash> bernama Pengunjung Portofolio dibuat tanpa auth_subject/role assignment, berbeda dari owner. Wrapper memberikan role tampilan Management hanya setelah verifikasi dan admission; mapped auth biasa tidak memberi hak kepada actor ini.

CRUD/HTTP mutation ditolak kecuali bootstrap/logout sesi pengunjung dan dua perhitungan preview:

- POST /api/visit-generator/daily/runs
- POST /api/visit-generator/ors/previews

Preview boleh membuat run/R2 artifact dan memanggil ORS, tetapi tidak menerapkan agenda. /daily/runs/:id/apply dan semua update customer/invoice/target/policy/role tetap ditolak. Maksimal LIMA percobaan preview total per akun, dibagi kedua endpoint, direservasi atomik di portfolio_preview_budget. Percobaan gagal tetap dihitung. Budget global/provider existing tetap berlaku.

GET settings/config biasa tetap terlihat. Credential, machine pairing, audit mentah, raw export, Street View dan directory detail diblokir. JSON menghapus email, phone, auth_subject, secret/token dan storage key, termasuk dalam JSON-string. Detail kalkulasi tetap tersedia. Read-model GET dapat membuat snapshot/cache/access log teknis existing; itu bukan hak edit bisnis pengunjung.

## Integrasi

1. Terapkan migration 0055_portfolio_access.sql pada D1 staging.
2. PORTFOLIO_ENABLED=true, PORTFOLIO_ORGANIZATION_ID=organisasi yang diizinkan, LOCAL_AUTH=false, project Firebase benar. Local bypass dengan portfolio ditolak.
3. createPortfolioGate(()=>scopedRoutes) dipasang sebelum identity/session biasa, setelah endpoint public config/auth dan machine yang memverifikasi diri. Lazy getter menghindari deklarasi router terlalu awal.
4. Auth config Firebase mode, google_only:true dan portfolio_enabled. Google provider dan authorized domain harus siap. Owner tetap melewati mapped identity, device session existing. Mode PORTFOLIO_ENABLED=true memakai Google-only tanpa MFA aplikasi; mode non-portofolio tetap memerlukan MFA admin seperti sebelumnya.
5. Identity visitor berisi read_only, can_preview_routes, portfolio_preview_limit, portfolio_expires_at dan portfolio_remaining_seconds. Frontend Google-only menandai read-only dan mengizinkan hanya dua preview, sesi/logout. Server tetap otoritas. Expiry mengembalikan PORTFOLIO_ACCESS_EXPIRED dan tidak bisa direset lewat login ulang.

Binding ORS/R2 dipakai untuk preview yang diizinkan; secret tidak dikembalikan ke frontend. Tidak ada provisioning/seed D1 baru. Tidak perlu seed portofolio; data pilot yang sama dibaca sesuai izin pengguna.

## Validasi

Tes mencakup provider/email verified, owner, deadline immutable, exact expiry, UID recreation, guest actor bukan owner/tanpa auth-role, shared-data read, lima preview termasuk dua endpoint, apply/CRUD/provider lain ditolak, setting GET terlihat dan redaksi data sensitif. Subagent tidak menjalankan deploy, perubahan Firebase atau browser test.

## Riwayat pengunjung

Email Google terverifikasi dan nama dicatat saat identitas /api/me dimuat. Hanya owner terverifikasi yang dapat membaca Pengaturan â†’ Pengunjung (/api/portfolio-visitors), dengan pagination 50/100 tanpa total COUNT atau polling. Akun lain, termasuk pengunjung dengan role tampilan Management, ditolak.

Jumlah kunjungan menghitung sesi login Google baru berdasarkan auth_time, bukan setiap request atau heartbeat. Waktu terakhir diperbarui paling sering sekali per lima menit pada pemeriksaan identitas. Login ulang tidak menambah jatah 20 menit. Riwayat tidak mengandung token, IP, OTP atau kunci MFA. Pengunjung anonim sebelum login tidak diidentifikasi; pencatatan dimulai setelah fitur ini diaktifkan, tanpa mengarang email kunjungan lama.

## Domain

Custom Domain nyales.biz.id mengarah ke Worker nyales-staging pada akun Cloudflare yang sama. Domain juga diizinkan di Firebase nyales-staging; alamat workers.dev tetap tersedia. Nameserver IDwebhost sudah menunjuk ke Cloudflare, sehingga record aplikasi dikelola di Cloudflare. Google-only diterapkan di server portfolio dan MFA Firebase proyek dinonaktifkan sesuai keputusan pengguna; faktor TOTP owner dihapus melalui Admin API tanpa mengganti provider Google atau mapping identitas.
