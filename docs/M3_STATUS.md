# NYALES M3 — insentif dan monitoring lokal

18 Oktober 2026. **WEB-046–055 tersedia sebagai pilot lokal; belum Accepted produksi.** Tidak ada deployment, database remote, provisioning provider berbayar, transfer uang, potongan payroll, atau finalisasi otomatis. M1/M2 tetap dipertahankan.

## Kemampuan dan batas per item

| Backlog | Implementasi / batas pilot |
|---|---|
| WEB-046 | Wizard plan/version, lima model P0, enrollment leaf beku, role/kanal dan cap nonaktif default; one primary per peserta/periode, preview wajib dan approval independen. Aktivasi langsung dari submitted setelah approval; tidak ada prorata diam-diam. |
| WEB-047 | Engine BigInt rational, threshold bonus + progressive, flat, whole-basis, progressive dan milestone highest/cumulative. Half-up total rupiah; breakdown exact numerator/denominator dan decimal disimpan pada run immutable. |
| WEB-048 | Simulasi what-if + boundary bawah/tepat/atas dan perbandingan whole/progressive. Estimasi pribadi tidak membuat run/entitlement; statement menampilkan target/actual/credited source/rule/cap/exclusion, sumber historis diproyeksikan ulang menurut izin saat dibaca. |
| WEB-049 | Prepared → under_review → finalize manual, ETag/idempotensi, creator/submitter/beneficiary tidak self-approve. Dispute open/accepted run sama menahan approval. Deadline dispute pilot tujuh hari, belum configurable. Tidak membayar uang. |
| WEB-050 | Recalculation draft membuat revision baru, final lama tidak berubah; return/revision menghitung ulang dengan rule/target periode asli dan menyimpan entitlement delta. Export JSON batch+checksum dapat diulang sebagai copy; konfirmasi finance terpisah. |
| WEB-051 | Monitoring empat pilar, filter periode/cabang/area/team/sales/kanal, lapangan/telesales/gabungan dan record drill-down; sumber invoice terpisah dari aktivitas. Cohort pelanggan memakai master aktif dan scope saat ini, bukan historical cohort snapshot. |
| WEB-052 | KPI definition nyales-kpi-1, coverage unique meaningful 13/20=65%, denominator nol=null, source belum lengkap=provisional/null dengan observed terpisah. Invoice gabungan tidak ganda; koneksi PIC manual bukan verified provider. |
| WEB-053 | Exception prioritas/owner/due/resolution audit dan coaching summary/next action/close sesuai scope. Visit belum checkout >12 jam masuk job; mapping/order/sync dapat dicatat manual dan job tersedia untuk SLA/overdue. |
| WEB-054 | In-app notification unik trigger+rule version, callback/SLA/approval/sync conflict, read owner-only; policy quiet hours Management/NSM. Zona penerima memakai satu cabang efektif bila tersedia, fallback zona kebijakan bila ambigu. Cron perlu deploy untuk otomatis. |
| WEB-055 | Freshness sumber terpisah dari UI read time; audit metadata tanpa raw before/after PII, sensitive-access audit, private report CSV R2/checksum/cutoff/filter/timezone/KPI version, expire 24 jam. Ekspor umum hanya Management/NSM pada pilot. |

## Alur penggunaan

1. Management/NSM membuat skema dengan target approved, role, kanal dan model. Tidak dapat memakai target draft. Default contoh bonus dasar nol harus diganti menurut keputusan perusahaan.
2. Tambahkan peserta dan leaf target yang sah pada role/scope beku. SR/telesales mengikuti atribusi primer; SPV memakai snapshot hirarki target dan AM memakai area efektif. Satu skema utama per peserta pada periode beririsan.
3. Jalankan simulasi, simpan preview batas, ajukan dan minta Management/NSM lain menyetujui. Pembuat, pengaju dan penerima tidak boleh menyetujui sendiri. Role konfigurasi bukan pengecualian self-approval.
4. Estimasi berjalan tidak menghasilkan payout. Setelah cutoff periode, buat calculation run menggunakan invoice current/validated dan source coverage yang dikonfirmasi. Missing/zero target, source belum lengkap, basis produk ambigu, exception atau periode belum ditutup menahan finalisasi.
5. Ajukan review statement, selesaikan keberatan dengan alasan. Keberatan accepted pada run lama menunggu koreksi sumber dan recalculation. Finalisasi manual mengunci hak bruto sebelum pajak/payroll.
6. Ekspor statement berupa JSON batch dengan checksum dan revision ID; ekspor ulang adalah salinan. Konfirmasi finance membutuhkan referensi unik dan nominal yang cocok dengan payable delta. Status exported tidak berarti paid, dan status paid_confirmed hanya mencatat pernyataan finance.
7. Retur/revisi invoice setelah final membuat revision entitlement menggunakan aturan/target asli. Nilai penuh dan selisih terhadap hak terakhir yang difinalkan disimpan terpisah. Nilai negatif dibawa ke proses settlement manual, tidak memotong gaji otomatis.

## Formula pilot yang direkonsiliasi

Target Rp1 miliar; bonus dasar B; ambang 80%; lapisan 80–100% tarif 1%; bagian di atas 100% tarif 2%. Tepat 80% = B, 81% = B + Rp100.000, 102% = B + Rp2.400.000. Tes memakai B=Rp500.000 sehingga hasil 102%=Rp2.900.000. Setelah realisasi direvisi ke81%, hak baru Rp600.000 dan delta -Rp2.300.000; statement awal tidak diubah.

Tarif/achievement disimpan sebagai basis point (1%=100 bps). Engine memakai BigInt rational, bukan floating point untuk hasil finansial. Exact numerator/denominator dan decimal sebelum rounding disimpan. Half-up dilakukan satu kali pada total peserta/plan/periode, setelah cap; komponen tidak dibulatkan sendiri-sendiri. Tarif model seluruh basis berbeda dengan progresif dan ditampilkan sebagai pilihan terpisah.

Plan yang aktif tidak diedit. Revisi periode sama memerlukan pilihan eksplisit dan review dampak; periode parsial yang beririsan ditolak karena prorata di luar pilot. Versi baru tidak menambah hak penuh kedua di atas hak lama: calculation mengacu baseline entitlement peserta/periode sebelumnya. Bukti agregat SPV/AM dapat memakai invoice yang sama, tetapi biaya insentif adalah entitlement penerima terpisah, bukan actual organisasi tambahan.

## Monitoring dan privasi

Menu Monitoring menampilkan pelanggan, actual, target dan tenaga sales beserta drill-down. Filter kanal menyediakan lapangan, telesales dan gabungan. Coverage adalah unique customer bermakna dibagi current active customer scope; kunjungan toko tutup/tanpa PIC tidak dihitung sebagai meaningful coverage. Ini bukan retrospective historical-cohort snapshot dan tidak mengklaim sebab-akibat aktivitas terhadap hasil.

Unknown tidak disamakan dengan nol: actual final null saat coverage sumber belum lengkap, observed actual ditandai provisional, denominator nol null, koneksi provider verified null. Panggilan manual tetap declared/manual_unverified. UI refresh mempunyai timestamp sendiri dan tidak memajukan source cutoff. Nilai invoice, order, forecast, dan insentif tidak dicampur. Grafik batang Overview enam bulan tetap tersedia.

Nominal insentif hanya Management/NSM organisasi atau penerima statement sendiri. SPV/AM dapat memantau pekerjaan team/area, tetapi tidak otomatis membuka nominal rekan. Finance role terpisah belum ditambahkan ke mapping auth runtime; fungsi konfirmasi finance pilot melalui Management/NSM berwenang. Sumber invoice historis diproyeksikan ulang terhadap izin baca saat ini. Audit UI menampilkan metadata perubahan, bukan raw payload/token/kontak. Sensitive statement/plan/export reads dicatat tersendiri.

## Kontrak dan penyimpanan

[OpenAPI M3 aktual](specifications/m3-api.openapi.json), [ERD implementasi](specifications/ERD_M3_Implementation.md), [inventaris fisik JSON](specifications/ERD_M3_Implementation.json). Request schema diturunkan dari Zod; cross-field/state/scope juga divalidasi server dan tes. Response masih envelope dinamis sesuai proyeksi role, belum kontrak response SDK lengkap. Full `/api/v1` v1.2 tetap rancangan produk; runtime memakai `/api`.

Migrations0031–0032 diterapkan lokal setelah export before-m3.sql. D1 menyimpan aturan, enrollment, immutable run, statement/revision/dispute/export/payment metadata, coaching/notification/audit/report metadata. R2 menyimpan byte CSV report privat. Export CSV membawa filter, cutoff, timezone, source coverage dan KPI definition version; berlaku24jam kemudian metadata expired dan byte dibersihkan job. Statement export JSON dipertahankan sebagai snapshot audit dan hanya dapat dibaca API autentikasi Management/NSM.

Tidak ada Account bisnis/legal baru. Invoice/customer/assignment lama tidak dimigrasikan ulang. Backup/export test-results lokal dapat memuat sesi dan bukan artefak publik.

## Batas operasional

Maksimal200 leaf target/enrollment dan200 statement/batch export; calculation sumber2000invoice; Monitoring kini memakai agregasi SQL, preview50 dan rincian maksimal100record/halaman; ekspor lengkap maksimal10.000baris/5MiB, target/workforce tetap guard2000. Data lebih besar ditolak dengan kebutuhan mempersempit scope, bukan ditampilkan sebagai total lengkap yang dipotong. Preview Monitoring maksimal50record per dataset; drill-down keyset maksimal100record per halaman; ekspor lengkap maksimal10.000baris/5MiB. Tier maksimal30; dispute window tujuh hari; orphan visit threshold12jam; report24jam.

Notif hanya in-app, tanpa SMS/WA/email. Trigger+rule version unik, read hanya pemilik. Quiet hours menggunakan satu timezone cabang penerima jika tidak ambigu, fallback policy timezone. Cron hourly hanya otomatis setelah deploy. Job menambahkan callback/SLA/order/statement review dan sync conflict, tanpa membuat task/alert duplikat dari trigger yang sama. Approval plan, draft/mapping error dan coaching masih dilihat pada daftar terkait atau exception manual; bukan seluruh event menjadi push otomatis.

Plan primary ditolak bila peserta overlap, tidak ada split lintas kanal. Tarif menurun diperbolehkan tetapi harus disimulasikan dan ditinjau. Bonus milestone highest/cumulative didukung; tambahan campaign stacking lintas plan, scorecard, per-unit, team-pool, proration dan payroll adalah P1/lanjutan, bukan pilot ini. Target reserve/basis produk yang tidak dapat direkonsiliasi tetap ditahan sesuai M2.

## Verifikasi dan gate

82 tes otomatis lulus; TypeScript/build lulus dengan warning bundle client besar yang sudah ada. Bukti unit/route: tests/m3-incentives.test.ts dan tests/m3-monitoring.test.ts ditambah seluruh regresi M1/M2. Fixture role menggunakan route Hono yang sama, SQLite dan R2 memory, bukan login Firebase nyata.

Browser Worker/D1/R2 lokal menguji filter gabungan/lapangan/telesales, responsive320/390/768/1440, record sumber, private CSV export, exception create/resolve, coaching create/review/close, policy quiet hours/audit, wizard insentif missing-approved-target gate, invoice lama dan bar chart serta logout. Browser hanya Management demo; enrollment/independent approval/finalization/revision/dispute/payment diuji pada route fixtures, bukan dipalsukan dengan bypass auth browser. Data target demo lokal masih draft sehingga wizard memang menahan pembuatan plan sampai target disahkan. Bukti test-results/m3-browser.json.

Sebelum produksi: dua akun Firebase nyata dan MFA admin; target serta tarif/skema disahkan oleh pemilik bisnis; sumber ERP/coverage dan review finance riil; UAT role/area/team/timezone/perangkat; load/capacity D1 dan snapshot volume besar; kebijakan retensi serta backup/restore; cloud R2/D1/cron provision/deploy. Android baru dimulai setelah exit gate web diterima.

Rekonsiliasi lokal before/after M3: seluruh64tabel asal mempertahankan baris lamanya,59tabel identik dan5tabel hanya bertambah (migration/audit/idempotency/device session/exception contoh). Terdapat12tabel M3 baru; FK check bersih dan integrity_check ok. Bukti test-results/m3-reconciliation.json. Scheduled handler lokal berhasil dipanggil HTTP200; cloud cron belum diaktifkan.

Preview build terakhir: http://127.0.0.1:5181/; health API200 environment local. [Laporan verifikasi alur](M3_VERIFICATION.md).

## Dataset visual tambahan

Setelah pengujian M3 di atas, pengguna meminta data dummy. Dataset `showcase-v1-` kini menambahkan target approved dan statement finalized **sintetis** untuk visualisasi; ini tidak mengubah gate Firebase/approval nyata. Pernyataan target demo masih draft pada laporan pengujian di atas merujuk keadaan sebelum seeding. Lihat [DEMO_DATA.md](DEMO_DATA.md).
