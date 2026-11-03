# ERD implementasi ORS — 0050

`visit_ors_preview` mencatat permintaan yang dibatasi kuota, bukan agenda kunjungan.

| Kolom | Fungsi |
|---|---|
| id | UUID internal pratinjau |
| organization_id | FK organisasi; seluruh read/write dibatasi organisasi |
| actor_id | Pengguna Management/NSM yang menghitung |
| preflight_id | Referensi snapshot kesiapan tersimpan |
| idempotency_key, input_sha256 | Unik per organisasi + pengguna + key; isi berbeda ditolak |
| created_at | UTC; indeks untuk budget harian dan riwayat organisasi |
| status | pending / complete / failed |
| storage_key, result_sha256 | Bukti privat R2 yang diverifikasi saat dibaca |
| error_code | Kode stabil; bukan body/error provider |

Relasi logis: organization → visit_ors_preview → visit_planning_preflight →
snapshot R2; preview yang selesai → hasil R2 privat. Sumber invoice, pelanggan,
assignment, profil operasional dan work_plan tetap dibaca dari kontrak readiness.
Tidak ada relasi penulisan balik ke work_plan, activity, invoice atau target.

Pending yang melewati lease 180 detik tidak menghalangi permintaan baru, namun
tetap ikut budget harian. Bukti tidak dihapus otomatis dan belum diintegrasikan
ke retensi terjadwal; operator mengikuti kebijakan retensi organisasi yang berlaku.
