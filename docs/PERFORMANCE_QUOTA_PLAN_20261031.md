> **Arsip rencana 31 Oktober.** Diagnosis dan angka di bawah merupakan catatan historis, bukan kondisi live saat ini. Urutan kerja serta asumsi teknis diperbarui pada [Rencana Penghematan Pembacaan D1 2 November](READ_EFFICIENCY_PLAN_20261102.md); pagination dan cache kini sudah tersedia, tetapi efektivitas serta gap-nya masih harus diukur.

# Rencana Perbaikan Beban Baca D1 & Kesiapan Data — NYALES

Tanggal: 2026-10-31
Status: rencana, belum dieksekusi (D1 sedang diblokir kuota sampai 00:00 UTC)

## Ringkasan eksekutif

Staging NYALES berjalan di **Cloudflare D1 free tier** (5 juta baris baca/hari).
Pemakaian hari ini **10,0 juta baris** (200%), sehingga D1 memblokir seluruh query
dan staging tidak bisa dipakai (login gagal, dashboard 503).

Akar masalahnya bukan volume data, melainkan **bentuk query**:

- `readCustomers()` memindai 12.120 `customer_outlet` + join area + join assignment
  + 12.120 baris `customer_status_snapshot` → ±25.000–30.000 baris per panggilan
- Fungsi itu dipanggil **3× per satu kali buka halaman** (dashboard, customers, map)
- Halaman Pelanggan hanya menampilkan 100 baris, tetapi API mengirim **12.120 baris**

Tabel `invoice` hanya berisi **80 baris**, jadi agregasi invoice bukan penyebab beban ini.

Rencana disusun dari intervensi paling murah dan berdampak paling besar, lalu naik ke
materialisasi bertahap. Setiap fase diukur sebelum lanjut.

## Prinsip yang dipakai

1. **Ukur sebelum optimasi.** Setiap fase punya angka sebelum/sesudah.
2. **Yang termurah lebih dulu.** Pagination dan cache sebelum faktur/materialized table.
3. **Jangan materialisasi yang belum terbukti mahal.** Fact table dibangun untuk kebutuhan
   yang nyata (laporan, tren, pertumbuhan volume), bukan sebagai spekulasi.
4. **Angka bisnis tidak boleh diam-diam berubah.** Setiap materialisasi wajib punya test
   rekonsiliasi terhadap query asli.
5. **Gagal dengan anggun.** Kalau D1 menolak query, sistem menyajikan data terakhir yang
   masih valid, bukan halaman error.

## Diagnosis (bukti)

| Bukti | Angka |
|---|---|
| Pemakaian reads 31 Okt | 10.023.459 baris |
| Batas free tier | 5.000.000 baris/hari |
| Pemakaian writes 31 Okt | 6.785 baris (dari 100.000) |
| Baris per request (14:00–15:00 WIB) | ±66.000 |
| Baris per request (16:00–17:00 WIB) | ±112.000 |
| `customer_outlet` | 12.120 baris |
| `invoice` | 80 baris |
| `visit_event` | 0 baris |
| Respons `/api/customers` (lokal) | seluruh populasi, bukan halaman |
| Halaman Pelanggan | `list.slice(page*100, …)` — pagination di browser |

Kesimpulan: beban = **proyeksi customer yang diulang**, bukan agregasi transaksi.

## Fase 0 — Stabilkan (keputusan sekarang)

**Masalah:** D1 memblokir semua query sampai 00:00 UTC (07:00 WIB). Staging tidak bisa dipakai.

Dua opsi:

| Opsi | Efek | Biaya |
|---|---|---|
| Tunggu reset 07:00 WIB | Staging mati sampai jam itu | Gratis |
| Upgrade Workers Paid | Limit reads 25 miliar/bulan, aktif langsung | ±$5/bulan |

Rekomendasi: **upgrade**. Dengan pemakaian saat ini (~10 juta/hari ≈ 300 juta/bulan),
paid tier masih 1,2% dari kuota, dan staging tidak lagi bergantung pada satu hari pemakaian.
Optimasi tetap dikerjakan — paid tier adalah asuransi, bukan pengganti perbaikan.

**Selesai bila:** `/api/auth/config` mengembalikan `mode: local`, login berhasil,
`staging:smoke` passed.

## Fase 1 — Pagination & projection di server (dampak terbesar, tanpa tabel baru)

**Tujuan:** halaman daftar hanya mengambil baris yang ditampilkan.

Pekerjaan:

- Tambah `limit`, `offset`/`cursor`, dan filter (`q`, `area_id`, `rep_id`, `status`, `channel`)
  ke `/api/customers`, dieksekusi **di SQL**, bukan setelah data ditarik
- Kembalikan `total` terpisah agar UI tetap bisa menampilkan `halaman X dari Y`
- Pilih kolom yang benar-benar dipakai daftar (projection), kolom berat hanya di endpoint detail
- Pertahankan urutan stabil (`ORDER BY name, id`) agar pagination tidak melompat
- Scope tetap diterapkan di query (`customerPredicate`), bukan di memori

Dampak yang diharapkan:

```
1 request daftar: 12.120 baris → 100 baris  (−99,2%)
1 buka halaman   : ~75.000 baris → ~5.000 baris
```

Kriteria selesai:

- Test kontrak: filter + pagination + scope isolation
- Test regresi: total & isi halaman sama dengan perilaku lama untuk data yang sama
- Tidak ada perubahan UI selain sumber data

Perkiraan usaha: 1 hari.

## Fase 2 — Verifikasi & pertajam cache (sudah terpasang, belum terukur)

Yang sudah ada: `src/server/cache.ts`, dipasang di `/api/dashboard`, `/api/customers`,
`/api/map`, `/api/telesales/queue`, key berbasis scope, TTL 60 detik, header
`X-NYALES-Cache: HIT|MISS|OFF`.

Pekerjaan:

- Ukur reads sebelum/sesudah 10 kunjungan (protokol di bawah)
- Kalau efektif: pertimbangkan TTL 120 detik untuk dashboard, 30 detik untuk daftar
- Tambah invalidasi berbasis versi (`cacheEpoch`) yang dinaikkan saat import/void/merge
- Pastikan kalau Cache API tidak berfungsi di `workers.dev`, sistem tetap benar (fallback sudah ada),
  lalu evaluasi pindah ke KV

Kriteria selesai:

- Header HIT terbukti di staging
- Reads per 10 kunjungan turun ≥70%

Perkiraan usaha: 0,5 hari.

## Fase 3 — Fact table untuk reporting & pertumbuhan

Dibangun **hanya** untuk kebutuhan yang tidak diselesaikan pagination + cache.

### 3a. `sales_fact_monthly` (tren, target, laporan)

Grain paling kasar yang cukup: bulan × area × rep × channel.
Perkiraan 5.000 baris/tahun. Melayani grafik 6/12 bulan tanpa memindai invoice.

### 3b. `customer_snapshot` (kondisi terkini per customer)

Satu baris per customer (12.120), berisi area, owner field/telesales, status, tier,
actual MTD, last invoice. Menggantikan `readCustomers()` untuk daftar & peta.

**Tidak dibangun:** `customer_fact_daily` per customer per hari (4,4 juta baris/tahun).
Tidak ada query di aplikasi yang membutuhkannya.

### Pipeline rebuild

- **Full rebuild** setelah import batch selesai (sekali per batch, bukan per baris)
- **Hook incremental** pada: void invoice, customer merge, perubahan territory/assignment,
  segmentation run baru
- **Cron harian** 02:00 WIB sebagai jaring pengaman (aktivasi 1 cron, biaya writes kecil)
- Biaya writes: rebuild penuh `customer_snapshot` = 12.120 writes ≈ 12% kuota harian free tier

Kriteria selesai:

- Test rekonsiliasi: hasil fact **identik** dengan query lama untuk dataset fixture
- Test anti-drift: void, merge, pindah territory, segmentasi baru → fact ikut berubah
- Dashboard membaca fact, bukan CTE

Perkiraan usaha: 3–4 hari.

## Fase 4 — Ketahanan & observabilitas

- **Stale-on-error:** kalau D1 menolak query (limit), sajikan respons cache terakhir yang
  masih valid dengan penanda `stale=true`, bukan 503
- **Anggaran baca:** catat estimasi baris terbaca per endpoint; alarm pada 60% kuota harian
- **Dashboard operasional:** tampilkan pemakaian reads/writes hari ini di halaman Observability
- **Runbook:** langkah saat kuota habis (mode read-only, cache TTL dinaikkan, komunikasi ke user)

Perkiraan usaha: 1–2 hari.

## Protokol pengukuran (dipakai setiap fase)

1. Catat baseline:

```graphql
viewer { accounts(filter:{accountTag:"<acct>"}) {
  d1AnalyticsAdaptiveGroups(filter:{date_geq:"<hari>", date_leq:"<hari>"}) {
    dimensions { datetimeHour } sum { rowsRead rowsWritten }
  }
} }
```

2. Lakukan 10 kunjungan dengan pola sama (login, buka Overview, Pelangi, Peta).
3. Catat delta reads/writes.
4. Bandingkan dengan baseline fase sebelumnya.

Ambang keputusan:

| Hasil | Tindakan |
|---|---|
| < 2 juta reads/hari | cukup; lanjut Fase 4 |
| 2–5 juta | pertajam cache (TTL, invalidasi) |
| > 5 juta | lanjut Fase 3 penuh |

## Yang sengaja tidak dilakukan

| Usulan | Alasan ditolak |
|---|---|
| `customer_fact_daily` per hari | 4,4 juta baris/tahun tanpa query yang memakainya |
| Materialisasi invoice sebagai prioritas utama | invoice hanya 80 baris; dampak ~0,3% |
| OLAP terpisah (BigQuery/ClickHouse) | belum ada kebutuhan reporting multi-tim |
| Rebuild per baris saat import | write amplification; rebuild per batch |
| Menghapus cron sepenuhnya | jaring pengaman rebuild hilang |

## Ringkasan urutan & dampak

| Fase | Usaha | Dampak reads | Risiko |
|---|---|---|---|
| 0. Stabilkan | menit | — | rendah (biaya) |
| 1. Pagination | 1 hari | **−90%+** untuk halaman daftar | rendah |
| 2. Cache | 0,5 hari | −70% untuk kunjungan berulang | rendah |
| 3. Fact table | 3–4 hari | −95% untuk dashboard/tren | sedang (drift) |
| 4. Observability | 1–2 hari | pencegahan, bukan pengurangan | rendah |

## Risiko utama

| Risiko | Mitigasi |
|---|---|
| Fact table drift | test rekonsiliasi wajib; rebuild harian sebagai jaring |
| Cache membocorkan scope | key memuat org+role+area+rep+channel+date; test isolasi |
| Pagination mengubah urutan | `ORDER BY name, id`; test regresi isi halaman |
| Kuota habis lagi | stale-on-error + alarm 60% |
| Perubahan besar sekaligus | tiap fase di-commit & di-deploy terpisah, diukur sebelum lanjut |