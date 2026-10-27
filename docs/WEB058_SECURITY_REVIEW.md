# WEB-058 — Security review dan contract/integration regression

20 Oktober 2026. **Local source review and regression complete; production verification remains open.** Review ini menggunakan fixture sintetis di SQLite in-memory dan R2 memory adapter. Tidak memakai data pelanggan produksi, tidak menjalankan serangan pada layanan pihak ketiga, dan tidak melakukan deployment.

## Hasil dan perbaikan

| Temuan | Perbaikan | Bukti |
| --- | --- | --- |
| Belum ada penolakan Origin/Fetch Metadata eksplisit | API hanya menerima browser same-origin; foreign/null Origin dan `Sec-Fetch-Site: cross-site` ditolak 403, termasuk preflight. Tidak ada wildcard CORS atau credential cookie. Native client tanpa Origin tetap wajib bearer dan sesi. | `security-regression.test.ts` same-origin/cookie tests |
| Batas body belum berlaku menyeluruh | Setelah auth/session, byte stream aktual dibatasi: JSON/default 2 MiB, multipart CSV 600 KiB envelope dengan file 512 KiB, bukti 5 MiB. Content-Length palsu tidak melewati batas. | Full-app size tests |
| Retention report belum memperhitungkan legal hold | Claim D1 `ready → deleting` memeriksa hold secara atomik. Pembuatan hold report hanya berhasil ketika masih ready. Pemenang pertama menentukan hasil; hold terlambat ditolak 409. Gagal/hilang respons R2 tetap retryable dari deleting, selesai menjadi expired. | Hold/release, deletion-race, R2 failure/retry tests |
| Recovery policy/review/release rentan lost update dan replay setelah status terminal | If-Match saat update policy, hold release dan privacy review; SQL mutation guard dan audit/idempotency dalam batch. Privacy completion membutuhkan status approved. | Privacy race, release replay dan regression WEB-057 |
| Backup dapat melewati error baca dan tidak mengambil organization row | Organization memakai kolom id; read failure pada tabel yang ada menggagalkan backup. Drill memeriksa format, kind, tenant, allowlist tabel/row, checksum, manifest bytes/row/attachment counts. | Backup failure/tamper tests |
| Advisory dependency | Drizzle ORM 0.44.7 → 0.45.4; override gRPC ke patched 1.x (`^1.13.6`, lockfile 1.14.6). Firebase tetap 13.0.0. Audit sebelum perbaikan melaporkan 5 affected dependency entries; audit sesudahnya 0. | `package-lock.json`, `test-results/web058-npm-audit.json` |
| Kontrak aktual belum mencakup seluruh route | Tambah core identity/master/people contract, recovery contract dari Zod, dan inventory seluruh 232 operasi runtime. Regresi memeriksa drift inventory, request schema, local refs, operation IDs dan parameter path. | `api-contract.test.ts`, `scripts/generate-security-contract.ts` |

## Matriks pengujian

| Risiko/alur | Evidence suite |
| --- | --- |
| Seluruh 230 operasi nonpublik menolak bearer kosong sebelum DB | `api-contract.test.ts` melalui full app |
| Tenant, area, hirarki, kanal, customer assigned dan proyeksi field | `scope`, `customers`, `people`, `assignments`, `m3-monitoring`, `monitoring-capacity`, `security-regression` |
| IDOR pada customer, sumber impor, invoice/job, attachment, statement, sesi dan recovery manifest | `customers`, `finance`, `imports-merges`, `sessions`, `m2-workflows`, `m3-incentives`, `recovery`, `security-regression` |
| Signed JWT issuer/audience/signature/expiry, second-factor claim dan local-auth production denial | `auth`, `sessions` |
| Revoke sesi langsung, fresh-login floor, cross-user binding, expiry dan bootstrap rate limit | `sessions` |
| CSRF sesuai bearer+device-session, cookie-only denial, Origin/CORS, response no-store/nosniff | `security-regression` |
| SQL payload tetap data, strict unknown fields, CSV formula escape dan parser batas | `security-regression`, `imports-merges`, `finance` |
| Upload MIME/signature/checksum/size, owner/scope, private download | `m2-workflows`, `imports-merges`, `finance`, `security-regression` |
| Concurrent customer replay/edit, invoice commit retry, telesales claim | `security-regression`, `finance` |
| Independent finalizer bersamaan, satu statement/period lock/audit; self approval/dispute ditolak | `m3-incentives` |
| Import tamper/stale mapping/source/assignment dan atomic rollback | `imports-merges`, `finance`, `assignments` |
| Job failures/log sanitization/metrics/account owner dan quota alerts | `observability` |
| Backup/retention/privacy audit, tenant isolation, legal hold dan retry | `recovery`, `security-regression` |

SQL memakai bound values; identifier dinamis berasal dari mapping/allowlist. Tidak ditemukan eval/Function atau React dangerouslySetInnerHTML pada source. Popup map meng-escape teks dinamis sebelum innerHTML. Ini pemeriksaan source dan regresi lokal, bukan sertifikasi keamanan menyeluruh.

## Cara mengulang

```text
npx tsx scripts/generate-security-contract.ts
npm test
npm run check
npm run build
npm audit --json
```

Evidence lokal: `test-results/web058-test-suite.txt`, `web058-targeted.txt`, `web058-build.txt`, `web058-npm-audit.json`. Seluruh suite 119 test; 16 test baru WEB-058 (11 security, 3 contract, 1 invoice concurrency, 1 finalizer concurrency). Kontrak runtime memiliki 232 operasi; 2 operasi publik health/config. Semua operasi terhubung ke kontrak implementasi. Link kontrak bukan klaim bahwa setiap respons sudah menjadi SDK schema yang lengkap; respons dan aturan lintas field masih diuji di runtime. `/api/v1` pada desain produk tetap berbeda dari implementasi `/api`.

## Gate yang masih terbuka

- Firebase organisasi nyata: enrollment/challenge/recovery MFA, dua akun/role nyata, revoke end-to-end dan origin deployment/proxy. Pengujian session/JWT lokal bukan acceptance provider.
- WEB-059: browser/device UAT, keyboard/screen reader, jaringan/offline dan IndexedDB/outbox lintas akun/perangkat.
- WEB-056: kapasitas Cloudflare, shared-account quotas dan pengukuran CPU/rows provider.
- WEB-057: backup allowlist saat ini merupakan logical slice, belum seluruh state bisnis atau consistent point-in-time DB snapshot. Attachment bytes, provider backup, RPO/RTO, restore staging dan cross-region durability belum diterima. Checksum drill bukan bukti actual restore.
- Privacy review merupakan pencatatan approval/completion manual, bukan pelaksanaan erasure. Retensi detail GPS/ready evidence/business facts belum dijalankan; hold pada jenis tersebut dicatat untuk review kebijakan. Otomasi deletion dalam implementasi ini terbatas report export/orphan pending evidence, bukan customer/invoice/order.
- Validasi deployment headers/CDN, provider configuration dan review keamanan independen sebelum go-live. Source review tidak membuktikan layanan produksi aman tanpa pengujian deployment.

Tidak ada critical data/security failure yang tersisa pada skenario lokal yang diuji. Gate di atas tetap terbuka; tidak ada klaim cloud deployed atau production accepted.

## Status terkini — 28 Oktober 2026

Regresi penuh terbaru berjumlah 319 test dan lulus tanpa gagal/skip setelah WEB-057 object verification dan WEB-062 release gate ditambahkan. Typecheck/build lulus. Ini tetap bukti lokal; Firebase/provider/deployment review independen dan production acceptance belum dilakukan.
