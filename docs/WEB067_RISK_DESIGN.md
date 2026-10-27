# WEB-067 — desain risiko customer dan repeat order

24 Oktober 2026. **Implementasi dan verifikasi lokal selesai.** Engine, kebijakan berversi, API, snapshot privat D1/R2, pengaturan popup, mode Risiko, bukti/customer drill, invalidasi cache dan recovery tersedia. Parameter browser hanya di QA sintetis port 5193; pilot utama port 5183 tidak mempunyai policy/run aktif. Sumber batas nyata masih draft. Tidak menyatakan cloud atau acceptance bisnis selesai.

## Kebijakan

Definisi engine `nyales-risk-1`, schema konfigurasi 1. Tidak ada kebijakan/ambang bisnis default yang aktif, dan parameter fixture tests tidak dipasang sebagai kebijakan. Management/NSM harus mengisi secara eksplisit setiap indikator yang diaktifkan. Indikator disabled hanya menyimpan `enabled:false`; tidak memerlukan angka contoh tersembunyi. Setidaknya satu indikator aktif.

Basis keuangan adalah `authorized_invoice_scope`: current/validated IDR invoice yang memang boleh dibaca menurut historical area/rep/channel/filter. Canonical customer dan alias diselesaikan sebelum engine. Net tersimpan sudah mengandung pengaruh retur; tidak mengurangi credit dua kali. Batal, revisi lama, tanggal masa depan dan mata uang lain tidak dihitung. ID invoice current ganda dan aggregate integer overflow menolak evaluasi.

Near-churn memakai tanggal invoice perusahaan, bukan tanggal invoice pada kanal parsial. Hanya dihitung jika backend memiliki izin membaca sejarah perusahaan yang diperlukan dan window rolling 90 hari lengkap. Jika scope finansial/kanal hanya parsial, tidak menganggap customer mendekati churn; indikator menjadi `company_history_not_authorized` sampai ada basis sah. Status aktif/churn/new/unknown yang berwenang diteruskan apa adanya, tidak ditulis ulang oleh layer risiko. Konflik tanggal/status menghasilkan belum cukup data. Churn yang sudah terjadi diberi not-applicable pada indikator *mendekati* churn, bukan diubah aktif.

## Indikator dan bukti

**Mendekati churn:** ambang hari sejak invoice terakhir 1–90 wajib dikonfigurasi, tetap di dalam window aktif yang berlaku. Window source yang tidak lengkap/status unknown/tidak ada histori tidak menjadi aman. Bukti memuat tanggal, elapsed days, threshold dan definisi window.

**Repeat overdue:** lookback 90–730 hari, minimum 3–60 tanggal pembelian dan multiplier integer milli 1000–10000 wajib dipilih. Satu tanggal bisnis dengan beberapa invoice dihitung sekali; tanggal hanya menjadi purchase date jika net gabungannya positif. Baseline memakai median selisih hari antartanggal pembelian. Overdue jika elapsed days **lebih besar** daripada median × multiplier. Perbandingan memakai integer/rational, termasuk median setengah hari, tanpa error floating point pada threshold. Source harus meliputi seluruh lookback; histori kurang menjadi belum cukup data. Bukti memuat tanggal berurutan, interval kronologis, median, tanggal pembelian terakhir dan threshold.

**Penurunan sales:** threshold 1–10000 basis points, minimum baseline rupiah >0 dan minimum 1–31 tanggal pembelian pada baseline wajib dipilih. Mode `completed_months` membandingkan dua bulan penuh yang sudah selesai; pada cutoff 24 Oktober membandingkan September dengan Agustus. Mode `comparable_mtd` memakai jumlah tanggal bisnis yang sama pada bulan cutoff dan bulan sebelumnya; contoh 31 Oktober memakai 1–30 Oktober dan 1–30 September. Rentang aktual selalu dibawa pada bukti. Source kedua rentang harus lengkap; baseline nol/negatif/kecil atau histori minim menjadi belum cukup data. Keputusan threshold memakai BigInt cross-multiplication. Bukti menyimpan observed net kedua rentang, order dates count dan pembilang/penyebut perbandingan eksak.

State hasil: `attention`, `attention_with_gaps`, `insufficient_data`, `no_flag_observed`. Tidak ada label *aman* dari absennya flag. Setiap indikator mempunyai state disabled/not_applicable/insufficient_data/flag/no_flag dan kode alasan/evidence. Ranking awal tidak memakai bobot angka yang belum disetujui, AI atau provider berbayar.

## Model penyimpanan yang diimplementasikan

Migrasi lokal **0040_customer_risk_policy_runs.sql** sudah diterapkan pada pilot dan QA. D1 menyimpan `customer_risk_policy_version` (revision/config/hash/draft-active-retired/actor/timestamp/optimistic version) dan `customer_risk_run` (policy/dataset/scope/filter/input revision/cutoff/checksum/byte-count/private object reference/summary counts). Hanya satu policy aktif per organisasi. Config versi yang sudah aktif immutable; perubahan melalui versi draft baru lalu aktivasi eksplisit. Run immutable dan ditautkan ke config/version yang dipakai, sehingga aktivasi berikutnya tidak mengubah bukti lama.

Payload snapshot lengkap berada di **R2 privat**, berformat `nyales-customer-risk-v1`, memuat input canonical/financial yang diizinkan, source coverage, mapping/boundary basis, config hash, scope fingerprint, output/evidence dan timestamp. Geometry tidak diduplikasi. D1 tidak menyimpan jejak invoice besar per run. Checksum/byte-count diverifikasi saat membaca. Tidak ada raw input R2 yang dikirim ke browser tanpa pembatasan scope; endpoint biasa hanya mengembalikan hasil/evidence yang sah.

Cache hanya boleh dipakai bila actor/scope fingerprint, filter/cutoff, policy version, dataset dan input revision masih sama. Perubahan setelah review meminta evaluasi ulang. Saat membaca snapshot lama, izin customer/finance saat ini tetap diperiksa; histori tersimpan bukan grant akses abadi. Snapshot rilis boundary yang sudah retired diberi label dan daftar bukti, tidak diam-diam dipasang pada polygon aktif yang berbeda.

Batas runtime yang ditegakkan: maksimum 200 customer per run, maksimum 50.000 invoice input, maksimum 4 MiB payload. Scope lebih besar ditolak dengan instruksi mempersempit atau memilih subset eksplisit, bukan sukses dengan truncation. Batas ini pengaman teknis lokal; kapasitas Free Worker/D1/R2 belum dibuktikan. Tidak menjanjikan skala nasional/SLA.

## API dan transaksi

Policy list/create/update/activate/retire berada pada API pengaturan Management/NSM. Update draft memerlukan If-Match; aktivasi meninjau config hash, expected active version, alasan dan konfirmasi eksplisit. Unique active policy, input revision guard, audit dan idempotency diterapkan atomik. Tidak membuat ambang bisnis secara otomatis saat instalasi.

Evaluasi risiko memakai endpoint terpisah dari write API geography: scoped POST menghasilkan snapshot baru atau replay idempotent. Ini tidak melonggarkan gate management-only untuk mapping/membership/policy. GET membaca run/status/hasil berizin, tidak memicu evaluasi berat atau menulis fakta komersial diam-diam. R2 put dan D1 commit harus mempunyai pengaman orphan: hanya hapus object bila terbukti tidak direferensikan run; kegagalan pengecekan tidak boleh menghapus bukti yang mungkin sudah committed.

Sepuluh endpoint diregistrasikan pada [implementation OpenAPI](specifications/customer-risk-api.m4.openapi.json) dan inventory: policy list/create/update/activate/retire, policy metadata, evaluation POST, current GET, history list dan saved run GET. Total runtime 262 operasi, semuanya mempunyai link kontrak. D1 logical backup harus menyertakan policy/run; full restore harus menyertakan R2 snapshot selain lampiran/boundary. Retensi/purge belum boleh diaktifkan tanpa kebijakan organisasi dan pemeriksaan legal hold yang sesuai.

## UI dan tindakan

Mode **Risiko** tersedia pada Peta & Wilayah setelah rilis batas aktif. Pengaturan → Risiko pelanggan menyediakan create/edit draft, salin versi, review aktivasi dan nonaktif dalam popup. GET Kondisi saat ini tidak mengeksekusi engine/menyimpan run; pengguna menekan Evaluasi filter saat ini. Tanpa policy aktif menampilkan **Kebijakan risiko belum diatur**, bukan risiko nol. Konfigurasi dibuka melalui tombol/popup pengaturan yang sudah menjadi pola NYALES, bukan form selalu terbuka. Panel/daftar menampilkan flag dan alasan, source completeness, policy version, cutoff/basis serta state belum cukup data. Unknown memakai label/pola; tidak hanya warna.

Drill-down ke customer/task/visit/telesales mempertahankan filter dan scope. Tidak otomatis menghubungi customer atau membuat queue. Telesales tetap memerlukan assignment, contact permission/DNC, jam kontak, campaign dan lease. Engine tidak memindahkan owner, menulis target/insentif atau mengubah status customer.

## Bukti lokal lengkap

[Validator](../src/shared/customer-risk.ts), [engine](../src/server/risk-engine.ts), [kebijakan](../src/server/customer-risk.ts), [evaluasi](../src/server/risk-evaluations.ts), [model fisik](specifications/ERD_WEB067_Implementation.md), [evidence](WEB067_EVIDENCE.json).

- 183 unit/integration tests dan TypeScript/build lulus. Engine sembilan kasus; policy/evaluation memeriksa RBAC, scope/replay, versi/hash, concurrency, source gaps, retur/pembatalan, median, comparable dates, baseline nol, overflow, integritas R2, cache dan kontrak respons.
- Tiga browser scenarios lulus: popup tanpa default, draft/aktivasi eksplisit, evaluasi, bukti, customer 360 dan kembali, history, invalidasi saat source revision, reload, keyboard, responsive 390/768/1440 serta axe 0. Basemap browser memakai style deterministik; geometry tetap dari API/R2 QA.
- Recovery utama: 96 tabel, 1 PDF dan 1 boundary chunk dipulihkan di namespace baru; schema/rows/guards/FK/integrity dan query Wrangler cocok. Karena utama belum mempunyai run, bukti QA terpisah memulihkan 96 tabel beserta 2 objek risk nonempty dan membaca keduanya melalui risk router terhadap database/bytes yang dipulihkan. QA proof tidak mengklaim seluruh objek boundary/attachment QA dipulihkan.
- 13 tabel komersial/geography utama dibandingkan sebelum–sesudah: identik. Tetap 20 customer, 80 invoice, 12 aktivitas, observed Oktober Rp36.520.000. Policy/run utama = 0; batas nyata tetap draft.

GIS-A03/A04 diuji lokal melalui engine, runtime scope/guards, browser drill dan regresi workflow yang sudah ada. Tidak ada fitur panggilan atau penulisan task baru dari engine. Human training, role Firebase/device acceptance, legal/source rights, provider capacity/restore dan production acceptance tetap pending. Chunk client sekitar 1,97 MB masih warning build yang diketahui; batas 200/50.000/4 MiB bukan jaminan Free Worker CPU.
