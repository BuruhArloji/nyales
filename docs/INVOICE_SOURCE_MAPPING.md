# Kontrak sumber invoice M1

Status18Oktober2026: adapter CSV/JSON dan fixture sintetis teruji lokal. Nama sistem sumber, file invoice perusahaan, mapping pajak/diskon/ongkir dan definisi net aktual belum tersedia. Tidak ada koneksi ERP atau sinkronisasi otomatis yang diaktifkan.

Nilai IDR disimpan sebagai integer rupiah penuh, currency_exponent=0. Nama teknis `*_minor` mengikuti kontrak, tetapi pada IDR pilot ini tidak berarti sen. Maksimum1triliun per nilai. Tidak ada pembulatan atau pengubahan format ribuan/desimal secara diam-diam. quantity_scaled / quantity_scale menghasilkan jumlah unit; scale maksimum1juta, harus sama dengan master produk. Tidak ada konversi unit otomatis.

Identitas invoice: organisasi + source_system + source_invoice_id. source_version untuk adapter awal adalah string bilangan bulat positif maksimal15digit dan harus meningkat. Sumber bertimestamp/non-numerik memerlukan adapter mapping yang disepakati sebelum integrasi. Payload/hash versi yang sama harus sama. Header identical berulang dalam batch/retry menjadi no-op; header berbeda untuk ID sama dalam satu batch menjadi error. Nomor invoice sama pada sumber berbeda tetap invoice terpisah.

## CSV

UTF8/BOM, separator koma/titik koma/tab; quoted multiline didukung. Maksimum512KiB/200baris data. Jumlah keseluruhan invoice + line + credit maksimal200, invoice/credit masing-masing maksimal100. Form mengunggah sumber asli privat ke R2, lalu mapping nama kolom dan dry-run. Seluruh batch ditahan jika ada error; perbaiki CSV atau master lalu validasi ulang. Commit memerlukan hash payload yang sama, job ID dan If-Match. Perubahan referensi/assignment/finance setelah dry-run membuat snapshot kedaluwarsa.

| record_type | Field | Aturan |
|---|---|---|
| invoice | source_invoice_id, source_version, customer_code, invoice_date, currency, channel, status, net_minor, net_includes_credit | Satu header per invoice/version. Tanggal ISO; IDR; field/telesales; validated/draft/cancelled; true/false eksplisit. |
| invoice | rep_id, area_id | Opsional; jika diberikan wajib cocok dengan mapping tanggal invoice. |
| line | source_invoice_id, source_version, source_line_id, sku, quantity_scaled, quantity_scale, unit_code, line_net_minor | Merujuk tepat satu header pada file sama; line ID unik; SKU/unit/scale cocok master; jumlah net line sama header. |
| credit | source_credit_id, source_invoice_id, source_version, credit_date, credit_amount_minor, status | ID credit unik per sumber; referensi invoice tetap; validated/cancelled. Credit mempunyai versi sendiri. |

Kolom yang tidak relevan untuk sebuah record dibiarkan kosong. Header tidak diulang untuk setiap SKU. Tanpa rincian sumber, invoice header-only sah; tidak dibuat line sintetis. Sumber/versi awal/line/product-group snapshot tetap tersimpan. Kelompok produk yang berubah sesudah transaksi tidak menulis ulang klasifikasi line lama. Data lama tanpa snapshot klasifikasi ditandai unknown.

## Retur dan revisi

`net_includes_credit=false`: net eligible = net header dikurangi jumlah credit validated terbaru yang terkait. `true`: nilai sumber sudah memperhitungkan credit, sehingga tidak dikurangi lagi. Mengirim perubahan credit ketika flag true wajib bersama versi header net baru. Credit tidak boleh sebelum tanggal invoice, melebihi net sebelum credit, atau dipindah ke invoice lain. Credit cancelled versi baru mengembalikan dampaknya. Tidak ada nilai negatif yang dipaksa menjadi nol tanpa review.

Setiap perubahan membuat invoice revision baru. Hanya satu revisi current yang masuk actual. Draft/cancelled tidak masuk actual. Revisi credit memakai tanggal/periode invoice asal. Histori menyimpan net sumber, net eligible, snapshot credit, line, rep/area/channel dan alasan. Invoice lama tidak ditimpa nominalnya. Tabel `invoice_source_event` menyimpan dedupe versi sumber walau revisi tambahan berasal dari credit.

Hook periode final tersedia melalui `finance_period_lock` dan `finance_adjustment(pending_review)`. Modul statement final belum dibangun. Modul tersebut kelak harus menulis lock/referensi dan memproses adjustment; hook M1 ini tidak berarti payroll/insentif final sudah berjalan.

## Atribusi

Rep sumber valid diutamakan; bila kosong gunakan customer assignment pada tanggal invoice dan kanal yang sama. Konflik dengan owner tanggal itu, area territory historis, role/kanal atau scope area masuk needs_review. Tidak menebak kanal dari order, tidak memberi kredit dua kanal. Alias customer diterima bila identitas tidak ambigu; invoice tetap menyimpan ID fisik yang menjadi sumbernya. Riwayat assignment dan territory dipakai menurut tanggal invoice, bukan owner saat ini.

## Rekonsiliasi dan batas

Fixture `tests/fixtures/sales-end-to-end.json` membuktikan actual Oktober2026 Rp160juta, field Rp135juta dan telesales Rp25juta, termasuk credit Rp5juta, retry, invoice cancelled serta perpindahan owner C02. Waktu uji dimajukan secara terkontrol di harness; fixture masa depan tidak dimasukkan ke D1 operasional.

List memakai200baris terbaru, totals seluruh hasil filter. Ekspor admin maksimal5000baris; persempit filter bila lebih besar. Tanggal filter inklusif. Ekspor membawa periode/filter/scope/timezone/cutoff/waktu ekspor; CSV error dan ekspor melindungi formula spreadsheet. Mode manual menampilkan last successful commit/cutoff; refresh dan batch gagal tidak mengubah waktu tersebut. Data demo masih provisional sampai source acceptance.

Commit finansial set-based dan atomik, dengan epoch organisasi untuk mendeteksi perubahan referensi. Epoch konservatif dapat meminta validasi ulang walaupun perubahan master tidak menyentuh row tertentu. Tidak ada queue eksternal atau job background; job di sini merupakan staging/checkpoint bounded request. Kapasitas Cloudflare produksi belum dibuktikan.
