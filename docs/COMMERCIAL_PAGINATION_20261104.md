Pagination pipeline, order dan forecast

GET `/api/leads`, `/api/opportunities`, `/api/orders` dan
`/api/forecast-contributions` menerima opt-in `limit=1..100`,
`offset=0..1000000` (default 0), dan `customer_id` opsional. Filter customer
serta scope tenant/area/pemilik diterapkan sebelum `LIMIT limit+1 OFFSET`.
Urutan tetap `created_at DESC,id`; satu sentinel menentukan `has_more` tanpa
COUNT seluruh hasil. Query invalid mengembalikan 422. Tanpa query, respons
legacy tetap maksimal 200 baris.

Respons paged tetap `{data:[...]}` dengan tambahan
`meta.pagination={limit,offset,has_more,consistency:"live_offset"}`. Perubahan
record di sela perpindahan halaman dapat menggeser offset; ini daftar live,
bukan snapshot export.

Commercial memakai default 50, pilihan 50/100, hanya mengambil tab daftar aktif.
Customer picker tidak memuat master customer lengkap. Daftar referensi
opportunity/order di popup diambil terpisah per customer (100 baris per page),
sehingga referensi tidak bergantung pada halaman tabel yang sedang terlihat.
Invoice realisasi diminta per customer, kanal dan bulan, dengan pagination
100 baris. Pilihan invoice yang sudah ada tetap disimpan ketika page berubah.

Forecast review merupakan perhitungan terpisah. Semua kontribusi berizin pada
bulan yang diminta tetap masuk total; batas 200 yang semula ikut memotong
perhitungan dihapus pada review saja. Tabel tetap paged. Preview next-actions
tetap batas legacy 200 dan tidak menjadi dasar nominal forecast. Review tidak
diminta ulang hanya karena pengguna berpindah page tabel.

Tiga tes domain memeriksa 251 record, halaman tanpa duplikat, batas 50/100,
scope pemilik, filter customer sebelum pagination, query invalid serta total
review 251 kontribusi yang tetap sama sebelum/sesudah membaca page. Tidak
ada seed, query staging, benchmark provider, atau uji browser dalam slice ini.
