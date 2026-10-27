# WEB-057 Recovery, rollback, dan retensi

WEB-057 menambahkan migration `0034_recovery_retention.sql` dan endpoint Management/NSM di `/api/recovery/*`. Semua endpoint memakai scope organisasi dari `resolveScope`; user sales menerima 403. Tidak ada endpoint yang menghapus invoice, customer, accepted order, outbox, atau audit bisnis.

## Backup

`POST /api/recovery/backups` membuat manifest logical atau attachment_metadata dari allowlist tabel organisasi, menghitung row count, byte UTF-8 dan SHA-256, lalu menyimpan payload pada private R2. Organization row memakai kolom id; tabel organisasi lainnya memakai organization_id. Kegagalan membaca tabel yang ada menggagalkan backup. Tabel allowlist yang belum ada dilewati. `device_session` dan token sesi tidak masuk payload.

Attachment disimpan sebagai metadata storage_key, size, mime, sha256 dan status; bytes attachment tidak disalin oleh endpoint ini. Batas payload 50 MiB dan expiry mengikuti backup_days policy. Manifest menyimpan checksum, cutoff, row/attachment counts, storage key privat dan expiry.

Backup saat ini merupakan **logical allowlist slice**, bukan complete/consistent point-in-time database snapshot. Snapshot seluruh state bisnis, provider backup, cross-region durability, attachment bytes dan restore nyata masih menjadi gate sebelum production. Penulisan R2 dan manifest bukan bukti seluruh database dapat dipulihkan.

## Restore drill

`POST /api/recovery/drills` hanya dry-run: membaca object R2, memverifikasi SHA-256, format/kind/tenant, allowlist tabel dan tenant setiap row, byte/row/attachment counts terhadap manifest, lalu membandingkan row count dengan D1 saat ini. Hasil tersimpan dalam recovery_drill. Missing object, perubahan checksum atau metadata tidak cocok menghasilkan failed.

Tidak ada write-back. Perbedaan current count dapat terjadi setelah backup dan ditampilkan untuk review; bukan otomatis bukti restore sukses. Target RPO 15 menit / RTO 4 jam belum diukur pada deployment.

## Policy, legal hold, dan privacy

`POST /api/recovery/policy` mencatat interval backup, RPO/RTO, retensi umum, detail GPS, attachment, backup dan legal hold requirement. Update policy membutuhkan If-Match versi saat ini; create pertama tidak. Mutation guard, idempotency dan audit berada dalam batch D1.

`POST /api/recovery/holds` dan `/holds/:id/release` mencatat active/released hold. Release memerlukan If-Match dan replay idempotent. Hold customer/invoice/activity/attachment/backup/privacy subject merupakan pencatatan review kebijakan; tidak ada retensi otomatis atas fakta bisnis tersebut.

Report-retention menghormati active report_export hold. Job mengklaim ready → deleting dalam D1 dengan pengecekan hold atomik. Pembuatan hold juga memeriksa report masih ready: hold yang datang setelah deletion claim ditolak 409. Kegagalan R2 meninggalkan deleting untuk retry; keberhasilan berakhir expired. Hold tidak dapat menjanjikan pemulihan bytes yang sudah diproses.

Privacy requests mendukung access/correction/erasure dengan review versioned dan diaudit. Completion hanya boleh dari approved. Completion merupakan pencatatan hasil manual, bukan pelaksanaan penghapusan customer/invoice. Rekonsiliasi legal/finance tetap perlu dilakukan sebelum operator mencatat selesai.

## Retensi dan rollback

`POST /api/recovery/retention/preview` hanya menghitung kandidat report yang expired dan ready attachment melewati attachment_days, tanpa active hold terkait. Tidak menghapus object atau row. Job report-retention tetap menangani expiry report; ready evidence, GPS dan data bisnis belum dihapus oleh policy ini.

`POST /api/recovery/migration-rollback/plan` hanya menghasilkan rencana dry-run. Endpoint tidak menjalankan DROP, menonaktifkan foreign key, menghapus outbox, atau menulis ulang accepted order. Operator harus mengambil backup lengkap yang sudah diverifikasi, menghentikan writes/jobs, menguji inverse SQL di staging dan merekonsiliasi data sebelum membuka writes kembali.

## Validasi lokal dan gate

`tests/recovery.test.ts` dan `tests/security-regression.test.ts` menguji checksum/tamper/source-read failure, policy, hold/release/retry, privacy review/concurrency, retention claim, rollback dry-run, role denial dan tenant isolation. Kontrak aktual: [m4-recovery-api](specifications/m4-recovery-api.openapi.json). Rincian review: [WEB058_SECURITY_REVIEW](WEB058_SECURITY_REVIEW.md).

RPO/RTO produksi, complete staging restore, durability provider, restore lintas region, privacy/legal approval dan kebijakan deletion aktual belum diterima. Tidak ada cloud deployment.


## Pembaruan26 Oktober2026 — isi berkas

[Slice pemeriksaan object](WEB057_OBJECT_VERIFICATION.md) menambahkan verify_objects opsional, pembacaan terbatas dan hasil ukuran/checksum/missing/provider failure yang tersimpan. Metadata-only tetap kompatibel. Tersedia popup jenis/versi backup serta riwayat hasil di UI. Ini pemeriksaan referensi R2 saat ini, bukan pemulihan/copy object atau snapshot penuh; gate produksi di atas tetap berlaku.


## Status terkini — 28 Oktober 2026

`verify_objects` dan UI pemeriksaan isi berkas tersedia lokal. Evidence final ada di [WEB057_OBJECT_EVIDENCE.json](WEB057_OBJECT_EVIDENCE.json): 318 test penuh, 3 browser scenario, dan satu lampiran pilot lokal 73 byte cocok checksum. Data bisnis lama tetap sama. Logical backup tetap allowlist slice; complete restore, provider durability, RPO/RTO, legal/privacy execution dan production acceptance masih terbuka.
