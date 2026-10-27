# WEB-061 — checklist penerimaan operasional

21 Oktober 2026. Gunakan bersama [register](WEB061_REGISTER.json). Bagian materi/simulasi telah disiapkan; kolom pemilik provider, petugas dukungan dan bukti training manusia tetap harus diisi oleh pihak yang benar-benar menerima. **Tidak ada nilai secret dalam dokumen.**

## Inventaris yang diserahkan

| Komponen | Lokasi/bukti yang tersedia | Penerimaan nyata |
| --- | --- | --- |
| Source React/Hono dan migrasi D1 | `src/client`, `src/server`, `migrations`; [build status](BUILD_STATUS.md) | IT menentukan repository/commit rilis dan akses pemilik |
| Spesifikasi | [PRD/ERD/API/backlog](specifications/README.md) dan runtime contracts | PO/QA cocokkan versi implementasi dan keputusan produk |
| Build/test | `npm test`, `npm run check`, `npm run build`; file evidence di `test-results` | Catat build hash/commit, waktu dan lingkungan yang benar-benar diuji |
| Paket dummy | [sumber dan hasil rehearsal](../pilot/demo-10-sales/README.md) | Finance/QA gunakan angka kontrol; bukan data operasional |
| Training dan SOP | [Panduan](WEB061_TRAINING.md), [SOP](WEB061_SOP.md), [support](WEB061_SUPPORT.md) | Fasilitator/evaluator mencatat peserta dan hasil per kasus |
| Konfigurasi lingkungan | `wrangler.jsonc`, `.dev.vars.example`, `.env.example`, [auth](AUTH_SETUP.md) | IT melengkapi environment/domain/binding dan ownership provider organisasi |
| Cloudflare Workers/D1/R2 | Stack dan konfigurasi source tersedia; penerimaan cloud belum ada | Pemilik akun, akses admin/cadangan, quota/billing, backup dan domain dicatat |
| Firebase/MFA | Integrasi source dan gate privileged tersedia | Enrollment/challenge/recovery, pemilik project serta identitas nyata diuji |
| Peta dan panorama opsional | OpenFreeMap/MapLibre dan konfigurasi Google Embed | Provider/network/coverage/referrer/API restriction ditinjau; tidak menyalin key ke file latihan |
| Recovery/retensi | [Runbook WEB-057](WEB057_RECOVERY.md) | Full restore database + attachment bytes, RPO/RTO dan kebijakan organisasi diterima |

## Pelaksanaan serah terima

1. PIC menominasikan penerima tiap fungsi, termasuk pengganti saat pemilik utama tidak tersedia. Rizky Aditya mengoordinasikan; L1/L2/Finance tidak diasumsikan sama dengan PIC.
2. Penerima meninjau akses source, build, environment dan provider melalui akunnya sendiri. Tidak membagi akun/pasangan password melalui chat atau file latihan. Register hanya menyimpan referensi lokasi penyimpanan secret dan jalur recovery yang disetujui, bukan isinya.
3. Operator mengulang perintah lokal dan rehearsal dengan folder baru. Menjalankan dummy membuktikan domain route dan rekonsiliasi, bukan bahwa mereka memiliki akses cloud atau menyelesaikan UAT perangkat.
4. Fasilitator menjalankan kasus relevan per role; peserta mencoba alur dan error recovery sendiri. Evaluator lain mencatat evidence yang disamarkan. Kasus fails tetap terbuka sampai retest, bukan dicentang dari hasil test otomatis.
5. IT menjalankan latihan insiden/revoke dan **actual restore terpisah** yang disetujui. Rekonsiliasi row/net/scope/attachment, catat waktu dan putuskan apakah writes boleh dibuka kembali. Jangan menghapus preview/outbox/invoice sebagai cara mengulang latihan.
6. Finance menerima definisi net/retur/tier insentif, review cutoff, dispute dan delta setelah finalisasi. Konfirmasi settlement hanya pencatatan; tidak ada transfer/payroll otomatis.
7. Lengkapi register handover dan sign-off dengan penerima, waktu, keputusan serta evidence. Penerimaan training tidak otomatis menjadi go-live WEB-062. Risiko/gate tertunda dicatat secara terbuka.

## Format pencatatan yang digunakan

Untuk tiap kasus training, isi `executions` dengan participant, role, evaluator, performed_at ISO timestamp, result pass/fail dan path evidence lokal. Evaluator harus berbeda dari peserta. Untuk handover, isi recipient, accepted_at dan evidence setelah benar-benar diterima. Untuk dukungan, isi owner/cadangan L1/L2, Finance, kanal, jam layanan dan kebijakan respons yang telah disetujui.

```text
npm run training:check
```

Command memeriksa file materi dan melaporkan gate manusia/dukungan/handover yang belum tersedia. Exit 0 menyatakan materi tersedia, **bukan training atau handover sudah lulus**. Jika `human_training_completed=true` diklaim saat evidence/gate belum lengkap, pemeriksaan gagal. `production_accepted` tetap false; keputusan go-live ditangani WEB-062.

Evidence dummy boleh menjadi bahan demonstrasi, tetapi tidak boleh dilabel sebagai bukti peserta, login nyata, provider restore atau acceptance perusahaan. Biarkan status pending bila tidak ada penerima/evidence yang sah.
