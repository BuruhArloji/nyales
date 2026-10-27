# NYALES M1 status

18 Oktober 2026. Seluruh item M1 mempunyai implementasi lokal. Penerimaan produksi dan integrasi sumber nyata tetap terpisah.

| Item | Fitur | Implementasi | Gate tersisa |
|---|---|---|---|
| WEB-007 | Login Firebase dan mapping user internal | Terimplementasi lokal | Firebase project and real-account login/provisioning not configured. |
| WEB-008 | Scope access middleware dan field permissions | Terimplementasi lokal | Real multi-user provider UAT pending; future resources require their own authorization tests. |
| WEB-009 | Master organisasi, cabang, area dan kalender | Terimplementasi lokal | SLA job integration belongs to later workflow modules. |
| WEB-010 | User, role dan hirarki bertanggal efektif | Terimplementasi lokal | Uji lokal lulus; UAT produksi belum dilakukan. |
| WEB-011 | Sesi perangkat, revoke dan proteksi admin | Terimplementasi lokal | MFA provider/enrollment/recovery, budget and production setup pending; nonlocal admin access remains gated. |
| WEB-012 | Master pelanggan/toko dan kontak | Terimplementasi lokal | Uji lokal lulus; UAT produksi belum dilakukan. |
| WEB-013 | Import customer/produk dan laporan error | Terimplementasi lokal | Organization retention policy pending; original sources held; no cloud R2 provisioned. |
| WEB-014 | Deduplikasi dan merge berhistori | Terimplementasi lokal | Uji lokal lulus; UAT produksi belum dilakukan. |
| WEB-015 | Assignment, transfer owner dan territory | Terimplementasi lokal | Uji lokal lulus; UAT produksi belum dilakukan. |
| WEB-016 | Tabel dan peta distribusi customer | Terimplementasi lokal | Basemap provider key/capacity review pending; local fallback uses OSM; tile network failures explicitly shown. |
| WEB-019 | Mapping source invoice dan template final | Terimplementasi lokal | Actual company invoice source, mappings and tax/discount/freight/net semantics pending. |
| WEB-020 | Master produk, unit, kelompok dan harga | Terimplementasi lokal | Uji lokal lulus; UAT produksi belum dilakukan. |
| WEB-021 | Pipeline invoice import dry-run/commit | Terimplementasi lokal | Real source integration/acceptance and production capacity pending. |
| WEB-022 | Revisi invoice, retur dan credit note | Terimplementasi lokal | Real source integration/acceptance and production capacity pending. Later statement finalization must write finance_period_lock and consume finance_adjustment; no final statement/payroll module active. |
| WEB-023 | Atribusi rep dan kanal invoice | Terimplementasi lokal | Real source integration/acceptance and production capacity pending. |
| WEB-024 | Daftar/detail invoice dan rekonsiliasi actual | Terimplementasi lokal | Real source integration/acceptance and production capacity pending. |

WEB-017 dan WEB-018 berada pada M2 di baseline; tidak dimasukkan ke M1 hanya karena nomor berurutan. Target, forecast, tier terkonfigurasi, insentif, visit/call operasional dan Android belum dianggap selesai.

Validasi baru:48tests lulus, termasuk fixture Rp160juta = Rp135juta lapangan + Rp25juta telesales; uji browser Worker/D1/R2 lokal, CSV source bytes, mapping/error export, commit/revision/credit dan arsip QA; responsive320/390/768/1440; build dan TypeScript lulus. Gunakan BUILD_STATUS.md untuk rincian historis dan batas implementasi.

## Arsitektur pelanggan saat ini

Keputusan 18 Oktober 2026: pelanggan/toko adalah entitas utama, satu pelanggan = satu lokasi. Lapisan Account bisnis/legal dihapus dari schema aktif, UI, API dan import. Kontak, assignment kanal, transaksi, target dan histori mengacu langsung ke pelanggan. Kode ERP opsional pada input manual, wajib dan unik dalam organisasi untuk import pelanggan. Pengaturan tetap hanya Management/NSM. Istilah account untuk identitas login, kuota provider atau Android developer tidak berarti entitas pelanggan.

Migrasi lokal 0017 menyimpan master dan relasi Account lama sebagai snapshot audit, menghapus tabel account/kolom account_id, dan mewajibkan validasi ulang batch import pelanggan lama. Dokumen ini menggantikan baseline sebelumnya untuk arsitektur pelanggan; status produksi tetap terpisah.

48 tes otomatis lulus. Rekonsiliasi migrasi: 13 pelanggan, 6 kontak, 6 invoice tetap sama; 11 Account lama tersimpan pada audit. Bukti: test-results/account-removal-reconciliation.json.
