# WEB-067 — model fisik risiko pelanggan

24 Oktober 2026. Migrasi lokal `0040_customer_risk_policy_runs.sql`. [Detail kolom, indeks, foreign key dan triggers](ERD_WEB067_Implementation.json) diekstrak dari SQLite hasil migrasi; bukan revisi diam-diam pada model desain baseline.

`organization` memiliki banyak `customer_risk_policy_version`. Setiap policy memiliki revision unik per organisasi dan optimistic `version`. Konfigurasi beserta SHA-256, alasan, pembuat, waktu dan aktivator dipertahankan. Partial unique index mengizinkan satu policy aktif per organisasi. Draft dapat diedit memakai version; konfigurasi aktif terkunci, penggantian dilakukan dengan mengaktifkan draft baru dan meretire versi sebelumnya dalam satu batch. Policy tidak dihapus. Tidak ada kebijakan/ambang bawaan yang dipasang migrasi.

`customer_risk_run` mengacu ke policy version, `admin_boundary_dataset`, dan aktor melalui composite organization foreign keys. D1 menyimpan fingerprint scope, exact cache key, filter, daftar maksimal 200 canonical customer, cutoff, input revision, basis JSON, private storage key, ukuran/SHA-256 serta summary counts. Runs immutable. Unique organization/cache-key menjaga satu hasil tersimpan untuk input yang sama.

Payload `nyales-customer-risk-v1` berada di R2 privat: input invoice yang sah, source completeness, konfigurasi, pemetaan, hasil dan bukti. Maksimum 4 MiB; geometry tidak diduplikasi. Tidak ada raw input/private key dikirim oleh API hasil. Snapshot lama tidak memberi akses abadi: pembaca nonadmin harus aktor yang sama dan fingerprint scope sama, lalu customer visibility diperiksa kembali. Hasil yang dipangkas tidak membocorkan count awal. Perubahan rilis atau policy tidak mengubah snapshot historis.

Tiga trigger policy memperbarui `geo_distribution_epoch`; run tidak menaikkan epoch agar cache tidak membatalkan dirinya sendiri. Snapshot commit memeriksa epoch dan policy aktif/hash sekali lagi. D1 batch juga memuat audit/idempotency. Put R2 yang gagal/commit konflik tidak mengubah transaksi komersial; objek hanya dibersihkan setelah DB membuktikan tidak direferensikan.

Logical backup schema `0040` mencakup kedua tabel dan inventaris private risk objects. Full recovery lokal memisahkan bukti database/attachment/boundary pilot utama dari bukti pemulihan QA yang benar-benar berisi risk snapshots. Retensi/purge risiko otomatis belum diaktifkan. Provider restore/SLA belum diterima.
