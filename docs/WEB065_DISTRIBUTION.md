# WEB-065 — pembagian kelurahan/desa dan sales

24 Oktober 2026. Implementasi dan verifikasi lokal selesai. [Bukti terstruktur](WEB065_EVIDENCE.json). Sumber nyata masih draft; acceptance bisnis/provider/cloud terpisah.

## Cara menggunakan

Buka **Pelanggan → Distribusi sales → Atur pembagian wilayah** sebagai Management/NSM. Alternatif: pilih kelurahan aktif di Peta & Wilayah lalu Atur pembagian wilayah. Draft dapat dipreview pada peta, tidak dapat dipakai menerapkan pembagian.

Pilih kelurahan, area tujuan, tanggal efektif hari ini atau mendatang dan alasan. Tindakan awal **Hanya pembagian wilayah ke area** tidak memindahkan customer, membuka scope area atau menugaskan PIC. Pilih lapangan/telesales/kedua kanal untuk meninjau penugasan customer. PIC kosong berarti melepas PIC pada kanal yang ditinjau. Transfer antararea wajib meninjau kedua kanal; perubahan satu kanal pada area sama mempertahankan kanal lain.

Preview menampilkan sebelum–sesudah, cohort terkonfirmasi, pengecualian, konflik dan konteks invoice. Checkbox/polygon/preview tidak menulis. Bila cohort melebihi 25, aktifkan pilihan khusus customer lalu preview ulang. Tanpa pilihan khusus seluruh cohort diproses; pilihan khusus kosong berarti tidak ada customer wilayah, tetapi exception eksplisit tetap ditinjau. Customer di luar cohort wajib dipilih terpisah dan beralasan. Stale/unmapped/inactive tidak ikut diam-diam.

Setelah preview sah, konfirmasi lalu Terapkan. Perubahan data/hirarki/role/koordinat/mapping/release/finance/timezone membatalkan preview. Retry dengan key/input/ETag sama mengembalikan hasil sebelumnya. Membership, assignment, audit dan run disimpan atomik. Perubahan mendatang terjadwal; histori fakta tetap. Riwayat tersedia setelah reload.

## Kontrak dan batas

Empat endpoint admin: GET daftar/rincian dan POST preview/commit `/api/geo/distribution`. [Kontrak runtime](specifications/distribution-api.m4.openapi.json). Commit memerlukan Idempotency-Key, If-Match basis_epoch (termasuk 0), hash preview dan confirmed=true. Scope/stale/conflict ditolak tanpa perubahan parsial.

Satu request maksimum 50 kelurahan, 16 chunk geometry checksum-verified, 25 customer termasuk exception, 600 SQL statements termasuk envelope. Snapshot organisasi maksimum 2.000 customer canonical. Melebihi batas ditolak dan pilihan harus dipersempit. Histori menampilkan 200 membership/50 run terbaru dengan indikator masih ada; seluruh record tetap tersimpan, rincian dapat dibaca berdasarkan ID.

Rupiah konteks hanya **observed** invoice net IDR current/validated dari cohort aktif dengan mapping confirmed, bulan berjalan sampai tanggal bisnis organisasi. Seluruh kanal, canonical alias sekali; exception tidak termasuk. Stored net sudah memperhitungkan retur. Bukan klaim kelengkapan sumber atau potensi pasar. Mapping memakai keadaan saat preview; invoice/target/visit/insentif historis tidak ditulis ulang. Membership rilis sebelumnya diberi label basis lama.

Profil route fixture 25 customer: preview 17 binding D1 + 1 R2; commit 19 + 1 R2, dengan 255 SQL statements. Binding invocation, SQL statement dan billing berbeda. Profil ini tidak mencakup bearer/device/telemetry aplikasi penuh; belum membuktikan CPU/concurrency/kuota Free cloud. [Batas provider resmi](https://developers.cloudflare.com/d1/platform/limits/) harus diperiksa saat deployment. Tidak ada jaminan gratis/SLA dari hasil lokal.

## Verifikasi

156 unit/integration tests lulus termasuk enam distribusi dan restore seed Unicode immutable. Browser menguji API → D1/R2 → preview readonly → stale ditolak → preview ulang → commit → reload; dua flow distribusi dan dua regresi peta. Role non-management ditolak, concurrent commit satu pemenang, future transfer dan preservasi fakta diuji. Synthetic QA terpisah dari main pilot. Keyboard/Esc, axe dan viewport 390/768/1440 diperiksa.

Full restore schema 0038: 94 tabel, satu PDF dan satu chunk batas cocok. Body/response/manifest backup diselaraskan. Seed merakit field Unicode besar melalui staging fragmen sebelum INSERT lengkap; tidak menonaktifkan constraint atau UPDATE immutable history sesudah INSERT.

Main pilot tetap 20 customer, 80 invoice, 12 aktivitas dan net Oktober Rp36.520.000. Perbandingan 18 tabel master/komersial/geography sebelum–sesudah sama. Tidak ada run pembagian nyata. Enam kelurahan Gambir masih draft: review hak penggunaan/metadata/namespace pending. Baseline 82 UAT tetap; synthetic QA bukan pembagian area nyata atau sign-off. Berikutnya WEB-066, disusul risiko/simulasi dan generator sesuai dependensi.
