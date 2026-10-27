# WEB-070 — antrean diagnostik dan proses agent

25 Oktober 2026. **Antrean pengiriman probe koneksi tersedia lokal; generator jadwal belum beroperasi.** Slice ini melanjutkan [identitas komputer](WEB070_AGENT_IDENTITY.md), dengan [kontrak 11 endpoint](specifications/visit-agent-queue.m4.openapi.json) dan [ERD fisik 0043](specifications/ERD_WEB070_Queue_Implementation.md). Bukti terkini ada di [WEB070_PROGRESS.json](WEB070_PROGRESS.json).

## Alur operator

Pengaturan → Komputer penghitung → Antrean komputer → Uji antrean. Pilih komputer yang sudah pairing, tulis alasan dan konfirmasi. Server membuat payload probe; form tidak menerima customer, koordinat, URL, graph atau jadwal. Satu tugas pending per komputer, maksimal tiga percobaan, deadline 15 menit. Task terikat organisasi, lingkungan, komputer dan generasi kredensial saat dibuat.

Pada komputer yang mempunyai vault Windows miliknya, jalankan:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/visit-agent.ts run .nyales-agent/pilot.agent.dpapi.json --once
```

Agent mengirim heartbeat, mengambil atau melanjutkan tugas miliknya, memeriksa jenis/scope/checksum input, memperbarui lease, melaporkan checkpoint diterima/terverifikasi dan menyelesaikan probe. Kembalilah ke web dan pilih Muat ulang antrean. Saat ada tugas pending, panel web juga memeriksa status setiap 15 detik selama tab terlihat. Riwayat menampilkan percobaan, status serta sampai 100 kejadian terakhir secara kronologis, dengan tanda apabila ada kejadian terdahulu.

`run` tanpa `--once` melakukan polling foreground setiap 60 detik, heartbeat berkala setiap menit saat koneksi normal dan backoff transient sampai 60 detik. Ctrl+C/SIGTERM menghentikan proses; tidak memasang service Windows, autostart atau port publik. Kredensial ditolak menyebabkan proses berhenti, bukan retry tanpa batas. Proses yang mati saat memegang tugas melepaskan haknya lewat expiry/reaper; tugas baru kemudian dapat diklaim ulang. CLI hanya melaporkan status/nomor percobaan, bukan payload atau credential.

Gunakan `--once` untuk rehearsal pilot. Polling terus-menerus dan jumlah komputer paralel tetap memerlukan pengukuran kuota/perangkat serta keputusan retensi event sebelum dipakai unattended. Batas gratis tidak disimpulkan dari keberhasilan localhost. Dokumen ini tidak mengaktifkan service di komputer secara otomatis.

## Lease, retry dan pembatalan

Lease berlaku 120 detik dan selalu dibatasi deadline job. Renew/checkpoint/hasil harus cocok pada org/environment, current credential/generation, izin sales lapangan aktif, pemilik lease, attempt, fence, hash payload dan versi job. Pemeriksaan expiry diulang pada SQL commit. Batch CAS job, attempt, event dan response cache bersifat atomik.

Lease habis menaikkan fence: proses sebelumnya tidak dapat memperbarui atau menyelesaikan tugas, termasuk lewat cache retry. Reaper mengembalikan tugas ke antrean sampai tiga percobaan, kemudian gagal. Deadline mengakhiri tugas secara permanen. Reaper memproses sampai 50 job per pemanggilan, pada claim/list/status dan checkpoint maintenance yang sudah ada. Pencabutan/perubahan generasi komputer menghentikan probe yang terikat generasi lama; pairing baru memerlukan tugas baru.

Batalkan uji memerlukan alasan dan versi terkini. Tugas belum diambil langsung dibatalkan; tugas berjalan menjadi `cancel_requested`. Agent mengakui pembatalan atau menunggu lease/deadline, dan completion ditolak sejak permintaan cancel tersimpan. Hasil tersimpan tetapi respons hilang tidak membuat attempt/completion kedua pada polling berikutnya.

Idempotency request memakai key dan payload yang sama, dengan nonce/proof baru. Replay mesin memeriksa credential/generation dan attempt/fence terkini. Lease/version yang sudah maju direspons dengan status terkini atau konflik, bukan memberi hak kepada proses lama.

## Batas yang belum dilampaui

`completed` berarti uji koneksi selesai, bukan jadwal feasible atau rute tervalidasi. Kapabilitas daily/monthly tetap false dan graph/solver belum terpasang. Payload probe hanya berisi metadata scope/komputer dan UUID tantangan; tidak ada pelanggan, penjualan, koordinat atau agenda.

Tabel transport `visit_agent_queue_*` berbeda dari business planning job WEB-069. Sumber/policy/graph snapshot yang sah, integrasi job planning ke lapisan transport, artifact besar/R2, graph OSRM nyata, benchmark, solver harian/bulanan dan review/publish tetap harus dibangun. Draft SQL WEB-069 tidak diterapkan utuh.

Tidak ada perubahan master/customer assignment/invoice/target/visit/insentif/work_plan melalui probe. Logical backup mencakup ketiga tabel queue beserta identity hash-only; nonce/rate/cache respons dikecualikan. Restore drill hanya checksum/jumlah baris, bukan restore produksi. Setelah restore operator perlu mencabut kredensial lama dan pairing ulang sebelum menjalankan agent.
