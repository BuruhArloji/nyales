# Generator kunjungan harian

Alur Pekerjaan Lapangan: Mulai hari → konfirmasi titik awal → Buat usulan rute →
tinjau urutan, waktu, alasan prioritas dan kekurangan → Gunakan rencana.
Management/NSM mengatur kebijakan; sales hanya memakai konfigurasi tersimpan.
Tidak ada kalender bulanan yang diterbitkan otomatis.

## Kebijakan dan batas

- Target awal 15, dapat diatur 1–20 kunjungan per hari, satu sales per perhitungan.
- Slot 30–120 menit. Minimum 30 mengikuti trigger benturan agenda existing;
  durasi profil yang lebih lama tetap diperhitungkan.
- Kalender kerja dipilih eksplisit. Hari libur dan hari kerja mengikuti kalender;
  absensi dan istirahat dari profil sales yang berlaku diutamakan.
- Bobot Wallet Size, Last Visit, penjualan 90 hari, follow-up dan kedekatan lokasi
  berjumlah 100%. Nilai uang dinormalisasi logaritmik agar skala berbeda tidak
  dibandingkan langsung dengan hari/jarak. Kedekatan koordinat adalah heuristik
  shortlist, sementara ORS menghitung waktu/jarak jalan.
- Gap menggunakan maksimum aturan minimum kebijakan dan frekuensi customer.
  Last Visit memakai kunjungan field berstatus done; visit apa pun yang sudah
  tercatat hari ini tidak digandakan. Pelanggan churn tetap eligible selama
  master aktif dan penugasan field pada tanggal layanan masih berlaku.
- Maksimum 1.000 pelanggan assigned dibaca untuk satu sales; jika lebih, berhenti
  dengan pesan untuk mempersempit scope. Maksimum 40 kandidat dikirim ke ORS,
  termasuk janji tetap, maksimum 42 node matriks dengan dua depot. Ini batas
  internal, bukan pernyataan kuota provider.
- Tidak ada fallback diam-diam untuk lokasi/jam buka: Management harus memilih
  izin koordinat belum diverifikasi dan asumsi jam kerja sebagai jam layanan.
  Profil pelanggan yang sudah ditinjau mengalahkan asumsi tersebut.
- Slot task yang jatuh pada jam rute menjadi waktu yang direservasi. Agenda manual
  dan janji mendatang yang sudah ada wajib dipertahankan pada waktunya; provider
  yang tidak dapat memuatnya ditolak. Kunjungan aktif harus diselesaikan dahulu.

## ORS dan penerapan

ORS matrix + VROOM + directions tetap server-side pada api.heigit.org, key di
header. Nama pelanggan/sales tidak dikirim. Satu perhitungan pending per sales,
maksimum internal 60 upaya per organisasi per hari UTC. Pengiriman eksternal
memerlukan konfirmasi eksplisit. Tidak ada traffic langsung. Kegagalan geometry
ditampilkan melalui geometry_available; tidak mengarang garis jalan.

Preview disimpan di R2 dengan SHA-256 dan metadata tenant/environment, berlaku
20 menit. Policy version, source/agenda epoch dan geography epoch ditinjau ulang
sebelum hasil disimpan dan saat apply. Preview tidak mengubah agenda. Apply
menggunakan satu transaksi D1 untuk agenda, link urutan, riwayat pembatalan,
audit dan idempotency. Hak akses diperiksa lagi saat replay.

Jumlah kunjungan selesai hari ini mengurangi sisa target; tidak dihitung ulang sebagai target baru.
Atur ulang sisa rute memuat run applied sebelumnya, mengganti hanya agenda
generator yang masih mendatang dan belum memiliki actual activity. Agenda selesai
serta manual dipertahankan. Run lama ditandai superseded; kunjungan dan invoice
tidak dihapus. Riwayat dibatasi 10 hasil terbaru hari ini tanpa polling.

## Penggunaan dan keterbatasan

Sesudah migration 0054, simpan pengaturan melalui Pekerjaan Lapangan → Pengaturan.
Pilih kalender, target, durasi, gap, istirahat dan bobot. Izin Sales Rep publish
dipilih Management; bila tidak diizinkan, hasil dapat ditinjau Management sebelum
Gunakan rencana. Tidak ada pengaturan organisasi atau GPS palsu yang di-seed.

Untuk data directory pilot yang belum diverifikasi, opsi koordinat belum
diverifikasi perlu ditinjau sebelum perhitungan. Preview tanpa kandidat akan
menjelaskan prasyarat yang belum tersedia. Perencanaan harian ini tidak menjamin
optimasi global bulanan atau semua pelanggan dapat dilayani. Pelanggan layak di
luar shortlist dilaporkan jumlahnya; unassigned ORS dan kandidat dikecualikan
memiliki penjelasan terpisah.

Wallet popup kini berada dalam `.map-popup-body` dan ikut scroll, pada peta utama
maupun overview. Tidak ada perubahan terhadap perhitungan wallet.

Tes domain memakai respons provider sintetis, bukan memanggil ORS nyata. Meliputi
15 kunjungan/shortfall, scope, stale policy/source, expiry, publish permission,
janji tetap, idempotensi/replay, kegagalan provider, dan penggantian sisa rute.
Pengguna melakukan pengujian tampilan dan perjalanan rute nyata.

## Jam kerja khusus owner

Hanya akun Google owner terverifikasi didikpriyoutomo05@gmail.com yang mendapat opsi jam kerja khusus hari ini (`custom_work_hours: true`). Rentang harus di masa depan, dalam tanggal lokal yang sama, dan maksimal 12 jam. Pengecualian hanya untuk kalender kerja pada permintaan tersebut; kalender tim, jam buka pelanggan, absensi, agenda tetap, dan batas akses sales tidak berubah. Penerapan rute dengan jam khusus juga dibatasi ke owner.

Pada UI jam khusus, pilihan awal adalah Mulai sekarang. Waktu berangkat dihitung ulang saat membuat usulan dengan jeda teknis 2 menit, dibulatkan ke menit berikutnya. Atur jam tetap tersedia. Selesai diberi saran 4 jam dari waktu sekarang, dibatasi 23:59 hari yang sama; pengguna tetap dapat menggantinya.


## Settings placement and per-route priorities (2026-11-09)

Organization defaults are edited in **Pengaturan → Perencanaan kunjungan → Generator harian** (the default planning section). Calendar, visit target, service duration, minimum gap, break, coordinate policy, unknown opening-hour fallback, publishing permission and default priority weights retain Management/NSM authorization, optimistic version checks and audit history. Viewing this section does not save or activate anything. Other planning tooling is loaded only when its section is selected.

**Aktivitas Lapangan → Susun rute harian / Mulai hari → Bobot prioritas rute** lets an authorized field user override only the five priority weights for this preview, with a reset to organization defaults. Each weight is an integer 0–100 and all five must total 100. The optional `weights` object on `POST /api/visit-generator/daily/runs` is validated server-side; omitting it preserves the existing organization defaults. A run records its effective weights in the immutable snapshot and stored result. Weights participate in the idempotency input hash; they never change the organization policy, eligibility, assignments, visit cadence or authority to apply a plan. No agenda changes occur before explicit application of the plan.
