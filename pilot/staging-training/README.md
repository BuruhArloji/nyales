# Dataset latihan NYALES staging

Paket ini adalah turunan sintetis dari `pilot/demo-10-sales/source-data.json`. Sumber asli dipertahankan. Persetujuan pengguna untuk melanjutkan pengisian staging memakai data dummy diterapkan pada organisasi latihan `NYALES Pilot`, sesudah login Management nyata berhasil.

- 1 cabang Jakarta simulasi, 1 area simulasi, kalender kerja latihan.
- 8 sales lapangan dan 2 telesales; Novely, Didik, Mursal mengikuti nama peserta awal. Tujuh nama tambahan dan seluruh peran adalah skenario latihan.
- 2 supervisor, 2 area manager, 1 NSM/reviewer dan PIC Rizky Aditya sebagai leader latihan. Keenam leader tidak memiliki akun Firebase.
- 20 customer dengan kode DUMMY dan koordinat sintetis Jakarta.
- 80 invoice Juli–Oktober 2026, 4 credit, 2 target approved, serta produk contoh.
- Actual Oktober Rp36.520.000; target leaf Rp80.000.000 dan reserve Rp200.000 (target parent Rp80.200.000). Sales bertransaksi Oktober 9; total anggota sales 10, satu anggota tidak mempunyai invoice eligible pada bulan itu.
- Riwayat sumber dinyatakan lengkap hanya dalam skenario sintetis hingga tanggal cutoff 28 Oktober; ini bukan deklarasi kelengkapan transaksi produksi. Segmen rolling 90 hari memiliki 20 customer aktif pada cutoff.

`staging-pilot-prepare.ts` hanya menyiapkan file dan menjalankan rehearsal in-memory dengan route domain; tidak mengakses cloud. File context dengan organization_id/operator_id berada di `.nyales-agent/staging/` dan tidak dicommit. Perintah:

```text
node node_modules/tsx/dist/cli.mjs scripts/staging-pilot-prepare.ts --context <context-privat.json> --out <folder-baru>
```

File `source-data.json`, `seed.sql`, PREPARED dan rekonsiliasi di folder tujuan merupakan artefak review. Prefix record `training-v1-` dan audit `training_dataset/staging-pilot-10-sales` membedakannya dari operator nyata. SQL tidak mengganti organisasi, Firebase UID, role, MFA atau sesi operator. Guard menolak organisasi selain yang dipilih, master bisnis yang sudah terisi dan pengulangan seed. Buat backup sebelum import; file source/seed/backup lokal tetap diabaikan Git.

Setelah deploy, marker server `/api/me.training_data` menyalakan banner simulasi pada staging saja; login tetap Firebase/MFA, LOCAL_AUTH=false. Tidak membuat password atau akun provider, tidak menyimpan bearer/OTP dalam fixture, dan tidak mengubah role riil anggota tim. Jangan mengisi dataset latihan ini ke organisasi produksi atau mengklaim approved target/role fixture sebagai persetujuan manusia.

Pengisian cloud dilakukan terpisah setelah verifikasi binding/account dan backup, melalui SQL yang persis sama dengan seed yang lulus restore. `prepare` bukan bukti import cloud; status actual disimpan di `docs/STAGING_STATUS.json`. Tidak ada seed otomatis pada workflow deploy. Produk dan kalender hanya pelengkap latihan, bukan konfigurasi bisnis final. Tidak memasang graph routing atau data batas kelurahan palsu.
