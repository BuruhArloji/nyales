# ERD WEB-070 — antrean pengiriman agent

25 Oktober 2026. [Inventaris fisik](ERD_WEB070_Queue_Implementation.json) diperoleh dari eksekusi seluruh DDL dan introspeksi SQLite. Migrasi 0043 menambah tiga tabel. Total 108 tabel aplikasi, 110 termasuk metadata D1 lokal.

- `visit_agent_queue_job`: tugas `connection_probe` yang payloadnya dibuat server; org/environment/target agent/generasi, requester, izin sales yang dibekukan, payload/checksum, state/version, attempt/fence, lease credential/expiry, checkpoint, hasil hash dan deadline. Satu tugas pending per target komputer.
- `visit_agent_queue_attempt`: satu baris per percobaan/fence, kredensial/generasi pemilik, claim/heartbeat/end dan status. FK komposit memastikan organisasi/lingkungan sama dengan job dan kredensial.
- `visit_agent_queue_event`: event immutable per versi job, actor user/machine/scheduler dan detail alasan/status. Detail API menampilkan sampai 100 kejadian terakhir secara kronologis dan memberi tanda bila riwayat sebelumnya masih ada.

State/version dan payload immutable dijaga trigger; CAS job serta perubahan attempt/event/cache response ditulis dalam batch. Mesin memerlukan credential/generation aktif, field grants aktif, attempt/fence/hash/version cocok, lease/deadline belum habis. Expiry diperiksa lagi di SQL saat commit, sehingga kelambatan antara validasi request dan transaksi tidak memperpanjang hak pemilik lama.

Selesai hanya berarti probe koneksi selesai. Tabel ini adalah lapisan transport diagnostik, berbeda dari `visit_generator_job` pada rancangan WEB-069 yang akan membawa snapshot bisnis. Hubungan planning snapshot/graph/policy ke delivery queue perlu diimplementasikan sebelum solver; draft SQL 14 tabel tetap tidak diterapkan utuh. Tidak ada perubahan assignment, customer, invoice, target, visit, insentif atau agenda.

Recovery logis mencakup ketiga tabel ini. Store nonce/rate/idempotency respons mesin tetap ephemeral. Restore drill hanya checksum/jumlah baris; setelah restore operator harus mencabut identitas dan pairing ulang sebelum menghidupkan proses komputer.
