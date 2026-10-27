# WEB-057 — pemeriksaan isi berkas backup

28 Oktober2026. Lanjutan backlog Recovery yang dapat dikerjakan tanpa komputer routing. Pengguna menunda pemasangan routing dan pengembangan generator yang bergantung padanya. Slice ini menambahkan pemeriksaan isi berkas pada endpoint drill yang sudah ada; tidak menambah tabel, migrasi atau operasi API. Runtime tetap318operasi dan114tabel aplikasi/116 termasuk metadataD1.

## Perilaku

`POST /api/recovery/drills` menerima `verify_objects` boolean opsional. Opsi tidak dikirim/false mempertahankan pemeriksaan metadata saja dan mencatat `objects.status:not_requested`. True membaca file R2 yang dirujuk baris di dalam backup beku, memeriksa panjang byte dan SHA256. Sumber diambil dari backup yang checksum-nya cocok, bukan referensi dari query atau URL pengguna.

Lima keluarga referensi: lampiran evidence yang ready, chunk batas administrasi, snapshot risiko pelanggan, revisi simulasi territory dan snapshot kesiapan. Pengembangan generator tetap ditunda; snapshot kesiapan yang sudah ada hanya diperlakukan sebagai referensi backup. Referensi duplikat dengan key/hash/size sama dibaca sekali; referensi konflik ditolak. Namespace produsen per jenis sumber diperiksa sebelum GET: evidence/{org}/ untuk lampiran, {encodedOrg}/admin-boundaries/ untuk chunk, serta {org}/risk/, {org}/scenario/ dan {org}/visit-readiness/ untuk snapshot. Path/ukuran/hash dan organisasi juga diperiksa. Pemeriksaan pilot dengan lampiran yang sudah ada menemukan perbedaan namespace evidence ini; validator dan fixture disesuaikan dengan produsen aplikasi, bukan merelokasi data. Lampiran non-ready dilewati secara eksplisit; bukan dianggap file tersimpan.

Batas teknis:64object,8MiB perobject,32MiB total ukuran yang dideklarasikan, dan8MiB manifest sumber untuk mode uji berkas. Inventory yang terlalu besar ditolak tanpa pembacaan objek anak; tidak dipotong menjadi hasil tampak lengkap. Streaming body berhenti/cancel bila melebihi ukuran yang diharapkan. R2 missing/size mismatch/checksum mismatch/unavailable menjadi hasil terpisah. Detail tidak mengembalikan storagekey, isi file atau pesan internal provider.

Metadata/source checksum yang lolos tetap dilaporkan benar meskipun berkas anak gagal. Drill keseluruhan menjadi failed/HTTP422 dengan `RECOVERY_DRILL_FAILED` dan detail ramah pengguna. JSON hasil disimpan pada `recovery_drill.reconciliation_json`; tabel bisnis dan berkas tidak diubah. Tidak ada copy R2, restore ke namespace baru, deletion, rollback otomatis atau claim bahwa seluruh database telah dapat dipulihkan. Laporan sementara, sumber import dan objek di luar lima keluarga tidak tercakup; logical backup tetap allowlist slice, bukan snapshot database penuh.

## UI

Menu Recovery & retensi: tombol Buat backup dan Uji backup di toolbar; form dalam popup, bisa memilih jenis/versi backup serta alasan. Pemeriksaan berkas aktif secara eksplisit pada popup uji; dapat dimatikan untuk metadata-only. Rincian hasil menampilkan cek metadata dan setiap file, jumlah/byte yang terverifikasi, lampiran non-ready yang dilewati dan batas/cakupan. Riwayat hasil dapat dipilih dan tetap tersedia setelah reload. Failed tidak lagi ditampilkan sebagai belum diuji; metadata-only tidak disebut isi berkas telah lulus.

Hak akses tetap Management/NSM di organisasi yang sama. Tidak memasukkan credential, token atau URL provider ke UI. RPO/RTO yang ditampilkan tetap target kebijakan, bukan capaian produksi.

## Verifikasi dan batas bukti

Bukti akhir: `docs/WEB057_OBJECT_EVIDENCE.json`. Tes unit/integrasi menguji lima keluarga, hilang/rusak/salah ukuran/provider failure, tenant/path/conflict/batas, deduplikasi/non-ready, stream cancel, compatibility metadata-only, status persisted, role/scope dan preservasi fakta. Browser actualQA membuat backup metadata lampiran dan menjalankan drill melalui UI; status nyata dan jumlah file harus dibaca dari proof, termasuk jika jumlahnya nol. Skenario UI missing-file memakai respons summary sintetis dan tidak memalsukan objek/DB pilot. Perbandingan hash18tabel bisnis main/QA dilakukan sebelum/sesudah.

Regresi akhir penuh menjalankan 318 tes tanpa gagal atau skip; log `test-results/web057-final-full-tests.log`. Perintah standar `npm test` membatasi konkurensi dua file tes agar solver native tidak saling berebut resource. Ini perbaikan harness, bukan klaim engine/routing sudah berjalan.

Tidak ada pemasangan WSL/Docker, provisioning komputer, deployment cloud atau production/provider/human acceptance pada pekerjaan ini. Scope routing/generator ditunda sesuai instruksi pengguna.
