> Pembaruan slice berikutnya pada 25 Oktober 2026: antrean probe koneksi dan CLI run/once kini tersedia. Lihat [runbook antrean](WEB070_AGENT_QUEUE.md). Keterangan queue belum tersedia pada uraian identitas di bawah adalah histori slice0042; planning job/graph/solver tetap pending.

# WEB-070 — registrasi dan pairing komputer penghitung

25 Oktober 2026. **Slice identitas tersedia dan teruji lokal. WEB-070 keseluruhan masih In progress.** Registrasi, pairing satu kali, kredensial Windows, heartbeat dan pencabutan tersedia; queue/claim/lease, daemon, graph OSRM, solver dan hasil jadwal belum berjalan. [Progres/evidence](WEB070_PROGRESS.json), [kontrak aktual](specifications/visit-agent-identity.m4.openapi.json), [ERD fisik](specifications/ERD_WEB070_Implementation.md).

## Pengaturan web

Buka Pengaturan → Komputer penghitung sebagai Management/NSM. Tambah komputer melalui tombol kanan atas; pilih 1–10 sales lapangan aktif dan tulis alasan. Tidak menerima telesales atau sales organisasi lain. Data pilot utama tidak diisi komputer/default secara otomatis.

Terbitkan kode dengan alasan dan konfirmasi, versi `If-Match`, serta idempotency key. Di luar demo lokal, penerbitan kode/perubahan izin/pencabutan memerlukan login yang berumur maksimal lima menit. Kode hanya tampil sekali selama 15 menit; popup ditutup berarti kode tidak dapat dibaca kembali. Jika respons hilang atau penyimpanan komputer gagal, terbitkan kode baru. Retry issuance tidak mengembalikan secret dari cache.

Penerbitan ulang, perubahan pengaturan atau pencabutan menaikkan generasi akses dan mencabut credential serta kode sebelumnya. Pairing mengikat public key P-256 dan organisasi/lingkungan. Secret mesin berlaku 30 hari, hanya hash disimpan di server. Penggantian kredensial saat ini melalui pairing ulang, belum ada rotasi otomatis.

## Client Windows

Jalankan dari root `sales-operations` pada akun Windows yang akan memakai komputer. Tidak ada Windows service/autostart terpasang. Command berikut untuk lingkungan latihan lokal saja:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/visit-agent.ts pair http://127.0.0.1:5183 local "Komputer Sales" .nyales-agent/pilot.agent.dpapi.json --local-loopback
node node_modules/tsx/dist/cli.mjs scripts/visit-agent.ts status .nyales-agent/pilot.agent.dpapi.json
node node_modules/tsx/dist/cli.mjs scripts/visit-agent.ts heartbeat .nyales-agent/pilot.agent.dpapi.json
```

Perintah pair meminta kode melalui stdin tersembunyi pada terminal interaktif. Jangan masukkan kode sebagai argumen, environment variable, chat atau file plaintext. Path vault harus baru; file lama tidak ditimpa. Kode harus berasal dari lingkungan/origin yang sama. Produksi menggunakan HTTPS, tanpa `--local-loopback`.

Vault dilindungi Windows DPAPI `CurrentUser`, sehingga akun Windows lain tidak dapat membuka isinya menggunakan DPAPI biasa. Private key diimpor kembali sebagai nonextractable. DPAPI melindungi penyimpanan, bukan proses yang berjalan pada akun Windows yang sudah disusupi. Referensi [Microsoft ProtectedData](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=windowsdesktop-9.0). Proteksi/dekripsi mengirim bytes melalui pipe, bukan argv/env/log. Tidak ada salinan credential plaintext di repo atau server.

Status/heartbeat menggunakan kredensial mesin dengan signature terikat origin, method, path/query, body, idempotency key, generasi, lingkungan, timestamp, challenge dan jti. Keduanya tidak memakai bearer Management. Heartbeat di client ini dijalankan manual satu kali, bukan daemon berkala. Kemampuan solver dilaporkan belum terpasang; status Terpasang pada web berarti pairing, bukan kesiapan routing.

## Pembatasan, pemulihan dan audit

Pairing dibatasi 20 percobaan per menit per sumber IP tepercaya/lingkungan; demo loopback memakai bucket bersama. Request mesin ber-proof valid dibatasi 120/menit per kredensial/lingkungan. Body maksimum 64 KiB. Rate-store gagal menyebabkan request ditolak. Replay heartbeat memeriksa kredensial/generasi terkini, termasuk bila pencabutan terjadi setelah proof dikonsumsi.

Tujuh tabel identitas runtime ada pada migrasi 0042. Scheduled checkpoint keenam membersihkan maksimal 500 baris kedaluwarsa pada masing-masing nonce, cache heartbeat dan bucket rate. Tabel identitas/audit tidak dihapus. Retensi event heartbeat untuk daemon masa depan masih perlu diputuskan sebelum mengaktifkan polling terus-menerus.

Logical backup memuat identitas, pairing, credential dan event; yang tersimpan hanya hash/public key. Replay/nonce/rate ephemeral dikecualikan. Restore drill memeriksa checksum dan jumlah baris, bukan klaim restore produksi. Setelah restore, lakukan pencabutan dan pairing ulang sebelum mengaktifkan proses komputer. Tidak ada autostart yang mempercayai backup lama.

## Bukti dan batas hasil

Tes mencakup API aplikasi → SQLite, konkurensi pairing sekali pakai, reissue/expiry, scope/tenant/channel, recent-login, ETag/idempotency, revoke saat replay, perubahan status sales sebelum transaksi, rate/body limits, backup hash-only dan vault DPAPI nyata. Browser memakai Worker/D1 lokal QA, membuat mesin sintetis, pairing ke vault terenkripsi, menjalankan CLI status/heartbeat, memuat ulang web dan mencabut akses. Axe serta viewport 390/768/1440 diperiksa. Trace/video/screenshot otomatis saat kode ditampilkan dimatikan. Dua percobaan awal selector browser gagal; diagnostic kode sintetis sudah disanitasi dan seluruh fixture aksesnya dicabut. Run final tidak menyimpan kode.

Backup SQLite memakai online backup sebelum migrasi. Sesudah migrasi/pengujian, integrity/FK dan hash 18 tabel bisnis diperiksa pada pilot utama dan QA. Bukti ada di `test-results/web070-commercial-preservation.json`; tidak ada cloud deployment atau penerimaan produksi.

Tahap berikutnya adalah runtime queue claim/lease/attempt/fence/retry/cancel serta polling. Setelah itu pemilihan wilayah/profile kendaraan, instalasi runtime OSRM, graph/preprocess dan benchmark pada komputer ini; solver harian WEB-071 dan bulanan WEB-072 tetap menyusul.
