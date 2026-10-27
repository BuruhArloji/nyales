# Dukungan, insiden dan serah terima NYALES

21 Oktober 2026. **Rizky Aditya adalah koordinator PIC pilot**, bukan otomatis petugas IT, Finance atau approver seluruh transaksi. Penanggung jawab L1/L2/Finance/reviewer harus ditunjuk pada register; jangan menganggap jabatan atau SLA sudah disahkan dari dokumen ini. Tidak ada email/WhatsApp otomatis dikirim.

## Pembagian tanggung jawab

| Fungsi | Tanggung jawab | Hak dan keputusan |
| --- | --- | --- |
| Sales/pelapor | Jelaskan masalah, record/waktu, dampak dan hasil yang diharapkan; pertahankan draft/file | Tidak mengganti angka, role atau versi untuk melewati error |
| L1 Sales Ops | Triage, scope/assignment, status sumber, panduan, kumpulkan request ID dan reproduksi aman | Eskalasi data/akses ke L2; perubahan master tetap Management/NSM |
| L2 IT/aplikasi | Diagnosis API/log/job, containment, perbaikan, recovery uji dan retest | Akses sesuai otorisasi; tidak meminta token/password lewat tiket |
| Finance/reviewer insentif | Net/retur/target, statement revision dan settlement confirmation | Meninjau angka; bukan transfer uang oleh aplikasi |
| PIC Rizky Aditya | Koordinasi peserta, prioritas, jadwal dan keputusan penerimaan pilot bersama fungsi terkait | Tidak mengisi sign-off peserta atau mengabaikan gate data/security |
| Management/NSM pemilik layanan | Otorisasi role/config, provider ownership, kebijakan dan keputusan operasional | Persetujuan perubahan berisiko dan go-live dicatat terpisah |

## Tingkat insiden dan tindakan

| Tingkat | Contoh | Tindakan awal dan kriteria selesai |
| --- | --- | --- |
| P0 kritis | Kebocoran lintas organisasi/area, kehilangan data, double actual/settlement yang berdampak bisnis | Hentikan proses terkait, koordinasikan containment dengan IT/pemilik layanan; simpan bukti minimal. Buka kembali setelah perbaikan, scope/net rekonsiliasi, retest dan persetujuan tercatat. |
| P1 tinggi | Impor/sync gagal meluas, hak akses tidak sesuai, actual/target tidak cocok, operasi utama terhenti | Tahan commit/finalisasi yang terdampak. Eskalasi L2 dan Finance bila angka; identifikasi luas dampak dan workaround aman. Selesai setelah sumber serta hasil server cocok dan backlog event diperiksa. |
| P2 sedang | Satu draft/visit/lease bermasalah, kendala perangkat dengan workaround | L1 ikuti SOP; jangan duplikasi input. Eskalasi jika bertambah luas atau berdampak angka/akses. |
| P3 rendah | Pertanyaan UI, dokumentasi, kosmetik tanpa pengaruh angka/akses | Catat dan jadwalkan; tidak menunda incident data/keamanan. |

Jam dukungan, kontak utama/cadangan, target respons dan pemulihan **belum disetujui**. Isi `support` pada register sebelum pilot nyata. Tidak menjanjikan layanan 24/7. Target recovery aplikasi RPO15m/RTO4h masih perlu pengukuran provider; bukan SLA yang telah tercapai.

## Alur tiket

1. Pelapor membuat ID tiket pada sarana internal yang disepakati; klasifikasikan P0–P3 dan cantumkan record/user/org yang perlu saja.
2. L1 mengonfirmasi penerimaan, scope, dampak, waktu mulai (Asia/Jakarta), kondisi jaringan/perangkat dan langkah reproduksi. Mask data kontak/customer bila screenshot dibagikan.
3. L2 menyelidiki request ID, build, endpoint/job/version dan log yang sudah disanitasi. 409/412 umumnya konflik/stale reference: muat ulang/validasi ulang, bukan retry buta. 401/403 periksa identitas/scope/revoke; 413/422 periksa batas/payload; 503 periksa sumber/storage/provider dan retry terkontrol.
4. Pemilik layanan menyetujui containment/perbaikan bila diperlukan. Koreksi invoice/target melalui revisi yang diaudit, bukan SQL langsung pada fakta accepted.
5. QA/Finance/PIC memeriksa acceptance, bukti net/scope/outbox dan regresi. Komunikasikan dampak dan tindakan melalui kanal yang ditentukan pengguna.
6. Tutup dengan root cause, solusi, evidence, validator dan tindakan pencegahan. Reopen bila data/akses belum cocok. Tiket selesai tidak otomatis menjadi persetujuan produksi.

Template tiket: ID, waktu/zona, severity, environment/build, org/role/area, resource/job/request ID, gejala/expected, langkah, dampak/jumlah pengguna, status offline/outbox, screenshot disamarkan, owner/cadangan, tindakan, keputusan, validator dan waktu penutupan. Jangan lampirkan bearer/session token, cookies, OTP, key, password atau full dump.

## Serah terima

1. Pemilik layanan menerima lokasi source repository, commit/build yang diuji, kontrak API/ERD/PRD/backlog serta hasil test. Source/build tidak sama dengan URL produksi aktif.
2. IT menerima daftar provider milik organisasi: Cloudflare Worker/D1/R2, Firebase/MFA, domain serta Google Maps opsional. Daftar lingkungan, billing/quota/ownership dan jalur recovery dicatat; tidak menyalin nilai secret ke register. Local demo tidak memiliki ownership provider nyata.
3. Management/NSM menerima prosedur user/role/hirarki/area dan pencabutan sesi. Kontrol approver berbeda dari pembuat/penerima harus tetap berlaku.
4. Finance menerima definisi sumber/net/retur/target/insentif dan rekonsiliasi. Input final tidak ditimpa; dispute/revision/delta dan settlement confirmation dijelaskan.
5. IT/QA menerima backup lengkap, attachment bytes, restoration test, rollback dan retensi yang disahkan. Checksum drill WEB-057 saja belum memenuhi full restore.
6. L1/L2/Finance/PIC menandatangani bagian yang dimiliki dengan evidence; nama kosong tetap pending. Training register, attendance dan defect diterima per role.

Gunakan [WEB061_REGISTER.json](WEB061_REGISTER.json) untuk daftar penerima, case dan gate. Paket dummy hanya memberi bukti domain rehearsal; akses provider, MFA, perangkat fisik, restore dan training manusia tidak disimulasikan sebagai selesai.
