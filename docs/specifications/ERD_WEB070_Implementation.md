# ERD implementasi WEB-070 — identitas komputer

25 Oktober 2026. [Inventaris kolom/FK/index/trigger](ERD_WEB070_Implementation.json) diekstrak setelah menjalankan seluruh migrasi pada SQLite kosong. Migrasi `0042_visit_agent_identity.sql` menambah tujuh tabel aplikasi; total 105 tabel aplikasi, atau 107 termasuk `d1_migrations` dan `_cf_METADATA` pada D1 lokal. Draft WEB-069 tidak diterapkan utuh.

- `visit_generator_agent`: organisasi, lingkungan, nama, status, izin maksimal 10 sales lapangan, generasi kredensial, versi konfigurasi, public key, heartbeat terakhir dan laporan kemampuan.
- `visit_generator_pairing`: hash kode sekali pakai, generasi, batas waktu, pencabutan/pemakaian dan pembuat. Kode asli tidak disimpan.
- `visit_generator_credential`: hash secret, thumbprint public key, generasi, masa berlaku/pencabutan. Private key berada dalam vault Windows terenkripsi.
- `visit_generator_agent_nonce`: challenge dan proof-jti yang diikat ke request, kredensial, lingkungan dan generasi; replay ditolak.
- `visit_generator_agent_event`: kejadian pairing/heartbeat immutable dengan identitas mesin/generasi.
- `visit_generator_agent_operation`: respons heartbeat untuk retry idempotent; akses terkini diperiksa sebelum replay.
- `visit_generator_agent_rate`: bucket per menit berbasis hash untuk pembatasan pairing/mesin; tidak memuat raw IP atau secret.

FK komposit mengikat agent, pairing, credential dan event ke organisasi/lingkungan. Perubahan konfigurasi memakai version guard; perubahan izin atau penerbitan kode mengganti generasi dan mencabut akses lama. Status aktif hanya berarti identitas sudah dipasangkan, bukan bukti OSRM/solver siap. Daftar izin sales divalidasi ulang di transaksi; pemilik customer/scope harus diperiksa kembali saat job dibangun.

Logical backup menyertakan empat tabel identitas/audit dengan hash saja. Nonce, rate dan cache heartbeat ephemeral tidak ikut backup. Restore drill saat ini memeriksa checksum/jumlah, bukan restore produksi. Sebelum mengaktifkan komputer hasil restore, cabut kredensial dan pairing ulang; jangan mengaktifkan polling secara otomatis.

Job, graph release, attempt, lease, candidate, publish dan agenda epoch belum menjadi tabel runtime. Tidak ada perubahan invoice, target, assignment, visit, insentif atau agenda melalui slice identitas ini.
