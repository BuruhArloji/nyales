# NYALES — paket dummy 10 sales

21 Oktober 2026. Dibuat atas permintaan pengguna untuk menuntaskan simulasi WEB-060 dan menyiapkan latihan WEB-061. Seluruh angka, area, role, approval dan tujuh nama tambahan adalah **data dummy**. Tiga nama awal dan PIC mengikuti pilihan pengguna; pembagian role di file ini tidak menetapkan jabatan nyata.

## File yang dipakai

- [source-data.json](source-data.json): sumber dummy utama, dapat dibaca dan dijadikan acuan latihan.
- [SUMMARY.json](rehearsal-20261021/SUMMARY.json): hasil rekonsiliasi dan angka kontrol.
- [customer-import.csv](rehearsal-20261021/customer-import.csv): 20 customer, header mengikuti import master aplikasi.
- [invoice-import.csv](rehearsal-20261021/invoice-import.csv): 80 header invoice dan 4 credit, tanpa SKU/line buatan.
- [training-identities.json](rehearsal-20261021/training-identities.json): sales, leader dummy dan rantai pelaporan; bukan akun login atau password.
- [manifest.json](rehearsal-20261021/manifest.json), [ledger ID](rehearsal-20261021/id-mapping.json), [sumber terpetakan](rehearsal-20261021/source-snapshot.json), [snapshot hasil database](rehearsal-20261021/nyales-snapshot.json).
- [laporan rekonsiliasi](rehearsal-20261021/reconciliation/reconciliation.json), [diff CSV](rehearsal-20261021/reconciliation/discrepancies.csv), [checksum](rehearsal-20261021/reconciliation/checksums.json), dan [jejak API](rehearsal-20261021/api-rehearsal.json).

Dataset: 8 sales lapangan, 2 telesales; masing-masing 2 customer; satu area dummy; histori Juni–September 2026; target September; cutoff 1 Oktober 2026 00:00 UTC. Novely/Didik/Mursal ditempatkan sebagai lapangan **hanya dalam skenario latihan**. Supervisor/Area Manager per kanal dan NSM/Management dummy membentuk hirarki; satu sales satu SPV. Kontak telepon, email, password dan API key tidak dibuat. Customer tanpa koordinat sengaja tetap ada.

## Angka yang harus cocok

| Ukuran | Kontrol |
| --- | ---: |
| Sales / customer / assignment | 10 / 20 / 20 |
| Invoice seluruh histori / credit current | 80 / 4 |
| Invoice September eligible / excluded | 18 / 2 |
| Actual September | Rp36.520.000 |
| Lapangan / telesales | Rp30.840.000 / Rp5.680.000 |
| Net seluruh histori eligible | Rp163.720.000 |
| Credit validated | Rp200.000 |
| Target leaf approved / reserve | Rp80.000.000 / Rp200.000 |
| Selisih per record | 0 |

Ada invoice draft dan cancelled untuk latihan pengecualian. Target reserve dipisahkan dari leaf. Header sudah termasuk credit ditandai eksplisit agar retur tidak terkurangi dua kali.

## Mengulang simulasi

```text
npm run pilot:demo -- --out test-results/demo-run-baru
npm run pilot:check -- --manifest test-results/demo-run-baru/manifest.json --out test-results/demo-review-baru
npm run training:check
```

Folder hasil harus baru. Rehearsal membaca sumber, menjalankan seluruh migrasi pada SQLite **in-memory**, menginisialisasi fixture master/hirarki, lalu memakai route aplikasi untuk dry-run/commit/retry invoice dan create/items/submit/approve target. Snapshot NYALES dibaca dari database yang diisi oleh route; tidak menyalin snapshot expected menjadi actual. Header/line master tidak diimpor melalui UI pada rehearsal ini. Identitas route diinjeksi harness; tidak menguji Firebase, login, perangkat fisik atau provider.

Perintah tidak menyentuh `.wrangler/state`, preview utama, organisasi bisnis, file sumber atau provider cloud. Role/area/customer dummy tidak otomatis muncul di browser utama. Untuk latihan UI, administrator harus menyiapkan **lingkungan latihan terpisah**, master dan identitas yang sesuai sebelum memakai CSV; jangan mengunggah CSV ini ke organisasi nyata. Satu file invoice berisi 84 financial record, di bawah batas 200 dan masing-masing 100 header/credit.

Paket pilot nyata di `pilot/pilot-01` tetap memiliki tiga nama dan tujuh slot terbuka. `production_accepted=false` serta `human_training_completed=false` pada hasil dummy disengaja. Panduan pelaksanaan ada di [training](../../docs/WEB061_TRAINING.md), [SOP](../../docs/WEB061_SOP.md), [support](../../docs/WEB061_SUPPORT.md) dan [handover](../../docs/WEB061_HANDOVER.md).
