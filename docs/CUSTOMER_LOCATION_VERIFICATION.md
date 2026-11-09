# Pengajuan pelanggan, verifikasi titik dan radius kunjungan

Implementasi 9 November 2026. Berlaku untuk web Sales lapangan; telesales tidak
menggunakan check-in lokasi. Pengaturan generator harian dan bobot tetap terpisah.

## Status yang berdiri sendiri

- Hubungan komersial: **Leads** / **Pernah bertransaksi**, berdasarkan histori
  invoice yang boleh dibaca. Transaksi tidak membuktikan lokasi fisik.
- Segmentasi transaksi: Aktif/Churn/New/Unknown memakai definisi histori yang
  sudah berlaku. Tidak diubah oleh pengajuan lokasi.
- Lokasi acuan: missing/unverified/verified. Hanya lokasi verified bisa menjadi
  acuan geofence yang tervalidasi; masuk polygon bukan verifikasi toko fisik.
- Hasil kunjungan: outcome produktif/follow-up/dll tetap terpisah dari penilaian
  lokasinya. Coverage operasional tidak ditulis ulang. Rekap lokasi tervalidasi
  dan lokasi pelanggan menunggu verifikasi disajikan secara terpisah.

## Pengajuan

Sales mengajukan pelanggan baru atau koreksi lokasi pelanggan yang terlihat dalam
scope-nya. Nama/alamat koreksi lokasi diambil server dari master. Pengajuan berisi
GPS beserta waktu dan akurasi, catatan lapangan, serta foto toko. GPS saat pengajuan
maksimal 10 menit dan akurasi maksimal 100 m. UI mengambil timestamp dari browser,
bukan membuat koordinat terverifikasi dengan mengetik angka.

Pengajuan berstatus pending tidak mengubah master, penugasan, invoice atau agenda.
Foto PNG/JPEG maksimum 2 MiB memakai penyimpanan privat R2 dan checksum SHA-256.
Alternatif koreksi lokasi dapat memakai lampiran foto kunjungan milik pengaju
yang sudah berstatus ready dan terikat pelanggan tersebut. Foto baru melalui
PUT dipindai batas ukuran streaming, MIME dan signature. Detail/foto tetap scoped.

Supervisor/Area Manager/Regional Manager dalam scope atau Management/NSM dapat
meninjau. Pengaju tidak boleh menyetujui/menolak pengajuan sendiri, termasuk owner
yang mengajukan saat mencoba sebagai Sales lalu kembali ke akun Management.
Catatan keputusan wajib; foto diperlukan untuk persetujuan. Payload bukti dan
pengajuan yang sudah diputuskan tidak boleh diedit/dihapus melalui workflow ini.

Persetujuan memeriksa ulang versi customer, rilis batas aktif, full polygon
containment (bukan bbox saja), keunikan kelurahan, membership area, pemilik kelurahan
bertanggal efektif, scope reviewer, dan duplikat nama+alamat aktif. Kandidat duplikat
terlihat dibatasi akses; deteksi lintas-scope tidak membocorkan nama pelanggan lain.
Nama sama di koordinat dekat juga ditampilkan sebagai kandidat untuk ditinjau.

Pelanggan baru yang disahkan dibuat atomik bersama penugasan ke sales pemilik
kelurahan dan mapping administratif terkonfirmasi. Tidak membuat invoice, target,
order atau kunjungan secara otomatis. Satu kelurahan tetap satu Sales lapangan;
telesales tidak dialihkan. Transfer kelurahan yang sudah dijadwalkan perlu ditinjau
melalui workflow territory, bukan diberi penugasan tanpa batas diam-diam.

Koreksi titik lama hanya mengubah koordinat/status lokasi dengan audit dan revisi
mapping. Koreksi yang memerlukan pindah area/pemilik masuk workflow transfer
penugasan; tidak memindahkan invoice historis. Kunjungan aktif harus selesai dahulu.
Penolakan tidak membuat atau mengubah pelanggan.

## Validasi check-in/check-out

Management/NSM mengatur radius (10–1.000 m), akurasi maksimum (5–500 m), usia fix
(30–600 detik), izin kunjungan pada titik belum diverifikasi, dan izin pengecualian.
Nilai bawaan: radius 100 m, akurasi 100 m, usia fix 120 detik; kedua izin aktif.
Kebijakan yang sudah disimpan versioned dan diaudit.

Server menghitung jarak Haversine dan mengikutsertakan lingkaran ketidakpastian GPS:

- `distance + accuracy <= radius`: di dalam radius (`inside`).
- `distance - accuracy > radius`: di luar radius (`outside`).
- Selain itu: batas belum pasti (`uncertain`).
- Fix buruk/lama/tidak ada dan koordinat pelanggan belum ada/belum terverifikasi
  mendapat status tersendiri, tidak diubah menjadi lokasi valid.

Check-in di luar aturan membutuhkan alasan dan mengikuti izin pengecualian. Lokasi
pelanggan belum terverifikasi boleh dikunjungi jika kebijakan mengizinkan; pencatatan
itu tidak otomatis memverifikasi master. Check-out tetap dapat diselesaikan dengan
alasan ketika GPS bermasalah agar kunjungan aktif tidak terkunci; kasusnya ditinjau.

Lokasi kunjungan `location_validated=true` hanya jika kedua event memiliki timestamp
fix, sama-sama inside, dan memakai titik acuan customer yang sama. Snapshot penilaian,
radius, versi kebijakan dan titik acuan disimpan pada event/metadata. Server menghitung
ulang saat submit; preview browser bukan izin yang dapat dipakai untuk melewati aturan.
Transaksi menolak perubahan titik/kebijakan yang bersamaan selama penilaian.

Event historis tidak diklasifikasi ulang. Klien lama tanpa captured_at masih dapat
mengirim event dengan pengecualian kompatibilitas, tetapi tidak memperoleh klaim lokasi
tervalidasi. Bukti GPS browser adalah posisi yang dilaporkan perangkat; web tidak
memberikan jaminan anti-spoofing atau bukti bahwa orang tertentu berada di sana.

## Kontrak API ringkas

Semua endpoint memakai autentikasi/scope organisasi. Mutasi memerlukan
Idempotency-Key; perubahan versi memakai If-Match. Visitor portofolio tetap read-only.

| Metode dan endpoint | Hasil / aturan |
|---|---|
| GET `/api/customer-proposals` | status pending/approved/rejected; limit default50 maks100, offset; has_more |
| POST `/api/customer-proposals` | kind new_customer/location, customer_id|null, name/address/area_id, GPS e7/accuracy_cm/captured_at/notes, optional evidence_attachment_id; Sales lapangan |
| GET `/api/customer-proposals/:id` | pengajuan, calon duplikat scoped, hasil wilayah, master terkini |
| PUT `/api/customer-proposals/:id/photo` | PNG/JPEG raw, Content-Type, X-Content-SHA256, Content-Length; pengaju, pending, versi sesuai |
| GET `/api/customer-proposals/:id/photo` | gambar privat; tidak mengekspos object key |
| POST `/api/customer-proposals/:id/review` | decision approve/reject, reason minimal8; reviewer independen scoped |
| GET/PUT `/api/visit-location/policy` | config radius_m/max_accuracy_m/max_age_seconds/allow_unverified_visits/allow_outside_exception |
| GET `/api/visits/:id/location-check` | query GPS e7/accuracy_cm/captured_at; preview status/distance/radius/can_check_in/requires_reason |
| POST `/api/visits/:id/check-in` dan `/check-out` | captured_at tambahan opsional untuk kompatibilitas; server menilai GPS ulang |

Kode kegagalan mencakup SELF_REVIEW_FORBIDDEN, PHOTO_REQUIRED, CUSTOMER_CHANGED,
DUPLICATE_CUSTOMER_REVIEW_REQUIRED, TERRITORY_ASSIGNMENT_REQUIRED,
VILLAGE_OWNER_CHANGED, LOCATION_TRANSFER_REQUIRES_ASSIGNMENT_WORKFLOW,
VISIT_LOCATION_NOT_ALLOWED dan VISIT_LOCATION_REASON_REQUIRED.

## ERD dan migrasi

Migration `0063_customer_location_verification.sql` menambah:

- `visit_location_policy`: satu config versioned per organization, updated_by.
- `customer_proposal`: organisasi, pelanggan opsional, area, proposed_by (Sales),
  submitted_by (aktor asli), bukti GPS/foto, versi customer saat pengajuan, status,
  reviewer dan alasan. Indeks antrean per status/area atau pengaju.

Menggunakan relasi existing customer_assignment, village_sales_owner,
area_admin_membership, admin_boundary_dataset/admin_boundary, customer_admin_location,
evidence_attachment, visit_event, activity dan master_audit. Tidak mengubah identitas
master lama atau tabel finansial. Sejarah persetujuan/mapping dipertahankan.

## Verifikasi penerimaan

Unit/integration: radius/akurasi/batas, GPS lama/tidak ada, titik belum tepercaya,
persetujuan oleh orang lain, penolakan, scoped photo, checksum/ukuran/versi, duplikat,
lubang polygon, wilayah tanpa pemilik, stale customer, kunjungan aktif, serta
rekonsiliasi invoice/assignment yang tidak berubah. UI diuji melalui prototype lokal
desktop/mobile. Deployment tidak membuat pengajuan, mengesahkan titik, atau seed data.


### Evidence penghematan read dan prototipe

Probe read-only pada satu nama/alamat di snapshot staging membandingkan pencarian
umum dengan predicate pelanggan aktif yang menggunakan `customer_duplicate_address`.
Hasilnya identik (digest sama): 57.331 vs 2 rows_read, 1.105,72 vs 1,52 ms. Ini
pengukuran satu probe, bukan benchmark seluruh workflow. Antrean baru memakai
pagination default50/maks100 dengan indeks; foto tetap di R2, bukan kolom blob D1.

Logical recovery mencakup tabel pengajuan dan aturan radius; foto yang sudah diunggah ikut pemeriksaan checksum objek R2. Bukti lama tidak ditimpa oleh persetujuan baru.
