# SOP operasional NYALES

21 Oktober 2026. Berlaku sebagai panduan pilot; kebijakan organisasi, PIC pelaksana dan kalender harus disahkan sebelum operasional nyata. Role serta tindakan mengikuti implementasi, bukan memberi akses baru.

| ID | Kejadian | Langkah operator | Bukti/hasil yang harus diperiksa |
| --- | --- | --- | --- |
| SOP-01 | Customer salah/duplikat | Hentikan order/visit baru; cocokkan kode ERP, alamat, PIC dan koordinat. Sales lapor, Management/NSM review. Merge hanya jika benar satu lokasi; simpan alias dan alasan. Jangan menggabungkan nomor kontak saja. | ID sebelum/sesudah, merge preview, dampak assignment/target/forecast; histori invoice tidak ditulis ulang. |
| SOP-02 | GPS ditolak/akurasi buruk | Periksa izin dan koneksi/perangkat; ambil lokasi ulang sekali bila masuk akal. Jika tetap gagal, catat alasan dan jalur exception. | Waktu kejadian, accuracy/source atau permission_denied; reviewer independen. Tidak memalsukan pin/kehadiran. |
| SOP-03 | Offline/response hilang | Simpan draft/periksa outbox org:user. Jangan klik input baru untuk transaksi sama. Sambungkan jaringan; gunakan Sinkronkan dan ID event yang sama. Needs_review/rejected diselidiki. | Event pending→synced dan satu record server. Status perangkat bukan bukti server; lihat rincian error. |
| SOP-04 | Upload bukti gagal | Pertahankan file sumber privat; periksa ukuran/MIME/akses/jaringan. Retry sesuai attachment/intent yang masih valid; expiry membutuhkan langkah baru yang terkontrol. | Ready/checksum server, activity ID dan attachment ID. Jangan mengirim foto/token ke grup publik. |
| SOP-05 | Retur/revisi invoice | Finance cocokkan source invoice/credit ID, versi, tanggal dan net_includes_credit. Dry-run versi baru; review atribusi/lock; commit; rekonsiliasi. | Current revision satu; retur mengurangi invoice asal hanya sekali; cancelled credit memulihkan dampaknya. Statement final memakai revision/delta. |
| SOP-06 | Duplicate import/angka berbeda | Pertahankan file asli/checksum. Tinjau mapping dan row errors. Payload sama/versi sama harus retry/no-op; payload berbeda perlu versi sumber baru. Jangan hapus row untuk membuat total cocok. | Job ID, source cutoff/hash, ETag, row counts dan per-record diff nol. Stale reference: dry-run ulang. |
| SOP-07 | Revisi target | Management/NSM buat versi baru dengan alasan dan review dampak. Pastikan customer/rep/area/channel, leaf + reserve = parent. Top-down perlu histori lengkap/onboarding. Submit dan approver berbeda. | Versi approved jelas; jangan menjumlah parent dan child. Perubahan periode berjalan ditinjau terhadap insentif. |
| SOP-08 | Dispute insentif | Penerima ajukan alasan/bukti melalui alur dispute. Pengelola meninjau actual, target beku, cutoff, retur, tier dan exception. Selesaikan dengan keputusan beralasan. | Calculation detail, aturan/versi, rounding rupiah, reviewer berbeda. Recalculate/revision bila diperlukan; bukan edit statement final atau pembayaran otomatis. |
| SOP-09 | Scope/role salah atau sesi hilang | Hentikan akses yang tidak semestinya. Management/NSM cocokkan role/area/hirarki/assignment tanggal efektif. Revoke sesi yang perlu; verifikasi ulang dengan identitas terkait. | User ID/org/role/time/request ID; jangan mengubah token atau mengambil data area lain untuk diagnosis. |
| SOP-10 | Telesales DNC/lease/callback | Hormati permission/DNC/jam kontak/batas attempt. Lease kedaluwarsa diambil ulang sesuai aturan, bukan bypass. Catat nomor salah/non-PIC dan callback jujur. | Disposition, qualification, script version dan callback original deadline; koneksi manual bukan provider verified. |
| SOP-11 | Exception/coaching/notifikasi | Cocokkan exception ke fakta server dan bukti input sales. Tunjuk tindakan/owner/deadline; reviewer independen menyelesaikan sesuai scope. | Exception bukan sekadar data input bebas. Reminder in-app bukan bukti email/WA atau pesan sudah dibaca. |
| SOP-12 | Recovery/rollback/retensi | Hentikan mutasi yang berdampak bila insiden. Pertahankan evidence; operator IT ikuti runbook WEB-057. Backup logical/drill checksum belum sama dengan actual full restore. | Full snapshot/attachment bytes, checksum, row/net control, scope, waktu pulih dan persetujuan sebelum buka writes. Tidak DROP/reset/outbox delete untuk percobaan. |

## Checklist impor dan rekonsiliasi

**Sebelum:** tentukan lingkungan/org, source system, cutoff, histori, periode, mapping canonical/alias, source net dan credit flag, role/area/hirarki. Simpan sumber asli beserta SHA-256. Periksa bahwa file dummy diberi label synthetic. Tidak ada guessing ID dari nama.

**Validasi:** master CSV UTF-8 maksimal 512 KiB/200 row. Invoice JSON/CSV maksimal 200 financial record, header/credit masing-masing maksimal 100. Header-only diperbolehkan; jangan membuat SKU/line sintetis. Line harus mengacu satu header dan totalnya cocok. Bagi file dengan menjaga keluarga header/line; jangan memotong data diam-diam. Pilih strict commit untuk pilot; partial master import hanya dengan review tertulis dan ledger baris diterapkan/ditolak.

**Commit:** review job/mapping/hash/error/ETag; referensi berubah berarti validasi ulang. Simpan hasil dan lakukan replay terkontrol agar tidak ganda. Tidak mengubah data di file sumber untuk mengikuti hasil aplikasi.

**Sesudah:** ekstrak seluruh snapshot terpetakan independen dari fakta NYALES; periksa pagination/has_more. Bandingkan tiap customer, owner historis, invoice, credit dan target, bukan hanya total. Run baru wajib memakai folder baru. Selisih satu rupiah/record yang belum dijelaskan menahan penerimaan. PIC/Finance/QA meninjau laporan dan evidence sebelum pilot dipakai nyata.

## Perangkat bersama dan akhir sesi

Draft/outbox memakai namespace organisasi:user. Sinkronkan dan periksa status sebelum mengganti akun; jangan membersihkan IndexedDB/cache saat event belum selesai. Logout online lalu periksa pencabutan server; admin dapat meninjau Sesi perangkat. Jika offline, keluar dari browser dapat terjadi tanpa konfirmasi revoke server. Lapor L1/L2 untuk mencabut sesi dan menangani data lokal melalui kebijakan perangkat, bukan sekadar menghapus riwayat.

Tidak meminta password, OTP, bearer token, session token, key provider atau seluruh database melalui tiket. Akun/secret diserahkan lewat pemilik provider dan saluran aman. Baca [bantuan](WEB061_SUPPORT.md), [recovery](WEB057_RECOVERY.md), dan [setup auth](AUTH_SETUP.md).
