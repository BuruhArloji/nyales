# Rencana dan aktivitas kunjungan

Implementasi lokal, 7 November 2026. Belum dideploy ke staging.

## Pembagian halaman

- **Rencana kunjungan**: urutan berdasarkan waktu jadwal, pelaksana, tujuan, status pelaksanaan terkait, dan aksi mulai/lihat pelaksanaan/lihat hasil. Menjadi tab awal untuk akun Sales.
- **Aktivitas kunjungan**: kunjungan berjalan ditampilkan lebih dahulu; riwayat menampilkan check-in/out, durasi, hasil, keterkaitan rencana, dan detail. Kunjungan tanpa tautan agenda dilabeli Di luar rencana.
- Mulai dari rencana membuat aktivitas tertaut melalui mekanisme antrean/sinkronisasi yang sudah ada, lalu berpindah ke pelaksanaan. Menjalankan check-in tetap tindakan eksplisit, bukan bukti yang dibuat otomatis. Draf yang sudah tertaut dibuka kembali, tidak dibuat ulang oleh tombol rencana.
- Pengguna hanya mendapat aksi pelaksanaan untuk aktivitas miliknya. Atasan melihat hasil sesuai scope. Akun portofolio read-only tetap tidak memperoleh aksi perubahan.
- Filter sales tersembunyi secara default; tanggal adalah kontrol utama. Batas 50/100 baris tetap berlaku. Tombol Lihat semua mengembalikan daftar setelah membuka tautan satu rencana/hasil.

## Sumber angka

Ringkasan berasal dari seluruh fakta pada tanggal dan scope terpilih, bukan potongan halaman. Tidak ada invoice/visit baru karena membuka halaman.

- Terjadwal mengecualikan usulan dan pembatalan; usulan ditampilkan terpisah.
- Rencana selesai memerlukan aktivitas tertaut berstatus done. Rencana legacy yang hanya ditandai done tidak diklaim sebagai kunjungan nyata; tampil sebagai hasil belum tertaut.
- Lewat jadwal berarti belum mulai lebih dari 30 menit setelah jadwal. Tidak mengubah status, membuat alfa, atau membatalkan rencana.
- Aktivitas selesai menghitung catatan pelaksanaan done; berbeda dari metrik visit compliance yang menghitung pelanggan unik per hari.
- Hasil produktif berasal dari outcome productive, bukan perkiraan invoice.
- Rata-rata durasi hanya memakai aktivitas done yang punya check-in/out valid, dihitung dari detik timestamp. Aktivitas tanpa waktu tetap tidak diasumsikan berdurasi nol.
- Kunjungan yang dimulai sebelumnya dan masih berjalan tetap muncul pada tampilan hari ini.
- Tanggal diproses pada timezone organisasi. Form jadwal dikonversi dari timezone yang ditampilkan, tidak bergantung timezone perangkat.

## API dan penyimpanan

Rute lama tetap kompatibel. Mode baru memakai GET /api/work-plans atau /api/activities dengan limit, offset, date=YYYY-MM-DD, channel=field; opsional user_id dan id. Filter activity_kind=visit tetap diterima. Mode tanggal hanya untuk kedua daftar tersebut dan tidak digabung dengan filter status.

Response menambahkan meta.date, timezone, summary, overdue_tolerance_minutes dan pagination. Baris menambahkan identitas pelaksana, tautan plan/activity yang cocok organisasi-pelanggan-pelaksana, waktu event, lokasi event, dan maksimum 20 metadata lampiran ready. Storage key tidak dikirim. Unduhan tetap melalui endpoint privat yang sudah ada.

Migrasi 0060 menambah indeks waktu rencana, tautan activity-plan, event kunjungan dan lampiran. Hanya diterapkan pada prototype lokal pada pekerjaan ini. Tidak ada perubahan customer, invoice, kunjungan, agenda atau batas wilayah staging.

## Pemeriksaan

523 tes lokal lulus, 8 tes dilewati oleh suite. Pengujian fokus mencakup scope, pagination, rekonsiliasi rencana/aktual, pergantian tanggal Jakarta, pekerjaan berjalan lintas hari, metadata bukti, dan konversi waktu Jakarta/Makassar/Jayapura. Navigasi rencana → hasil → rencana serta screenshot desktop/mobile sudah diperiksa pada prototype sintetis; tidak ditemukan error JavaScript atau overflow halaman mobile.

Sampel biaya baca aktual dari log emulator lokal (fixture 5 rencana / 4 aktivitas): daftar lama rencana 23 rows_read / 5 statement, tampilan hari 113 / 7; daftar lama aktivitas 19 / 5, tampilan hari 93 / 7. Keduanya 0 rows_written. Tambahan baca berasal dari ringkasan dan relasi/event yang sebelumnya tidak ditampilkan. Ini bukan klaim penghematan atau estimasi produksi. Data dimuat berdasarkan tanggal dan halaman; tidak ada polling API otomatis. Timer berjalan memperbarui tampilan lokal saja.

Bukti pengujian dan screenshot: .nyales-agent/staging/visit-day-*. Prinsip UI yang diterapkan: apple-hig-review, layout.md › Visual hierarchy (pelaksanaan berjalan di atas riwayat); segmented-controls.md › Best practices (dua sudut pandang terkait); color.md › Best practices (hasil produktif dan toko tutup tidak memakai arti warna yang sama). Susunan jadwal dan metrik merupakan keputusan desain untuk workflow NYALES, bukan ketentuan native Apple.
