# Penghematan request frontend — 2 November 2026

Dua perbaikan kecil diterapkan pada Customer dan Monitoring. Tujuannya menghilangkan pengambilan data yang belum diperlukan atau tidak berubah ketika filter diganti. Tidak ada perubahan query server, schema, aturan penjualan, role, atau provider.

## Hasil browser lokal

Diukur melalui aplikasi asli dengan `npm run ui:prototype`, Chrome desktop 1440×1000 dan mobile 390×844, D1 lokal serta data sintetis. Angka di bawah menghitung request GET tertentu, **bukan rows read D1, waktu respons, atau persentase penghematan harian**.

| Perjalanan | Sebelum | Sesudah |
|---|---|---|
| Customer: satu perubahan pencarian setelah initial load selesai | Customer + kontak + area: 3 request | Customer saja: 1 request |
| Monitoring: membuka halaman tanpa membuka form | Ada 1 request seluruh customer untuk pilihan form | Tidak ada request customer untuk pilihan form |
| Monitoring: membuka form coaching/exception | Menggunakan pilihan dari initial load | Meminta pilihan saat form dibuka |

Pengukuran sebelum perubahan Customer tercatat pada `test-results/read-frontend/customer-filter-before.json`: kontak dan area masing-masing naik dari 1 menjadi 2 setelah pencarian. Sesudah perubahan keduanya tetap 1; request customer naik dari 1 menjadi 2. Monitoring sebelum perubahan teramati meminta `/api/customers` saat awal; sesudahnya 0, menjadi 1 ketika form dibuka. Summary Monitoring tetap meminta data bisnis yang dibutuhkannya.

## Perilaku dan batas

- Kontak dan area Customer dimuat pada awal halaman, lalu dipakai kembali selama komponen tersebut masih terpasang. Filter/pagination customer tidak mengambil ulang keduanya. Pencarian lokal pada tab Kontak tidak meminta directory customer.
- Setelah penyimpanan atau pengarsipan berhasil, data pendukung dimuat ulang agar nama customer dan kontak tidak dibiarkan usang. Uji browser mensimulasikan acknowledgement penyimpanan tanpa mengubah database sintetis.
- Kegagalan pemuatan awal dapat dicoba ulang. Request referensi yang sedang berlangsung dapat dibagi oleh pemuatan komponen yang bersamaan; kegagalan tidak disimpan sebagai cache sukses.
- Respons daftar yang lebih lama tidak menimpa respons request terbaru atau komponen yang sudah dilepas.
- Monitoring tetap mengambil area, user, dan cabang untuk filter. Pilihan customer hanya diminta untuk form tambah coaching/exception, dan diminta lagi setiap form tersebut dibuka.
- Form belum dapat disimpan ketika pilihan customer masih dimuat atau gagal. Ada indikator loading dan tombol coba ulang. Respons/error yang datang sesudah form ditutup tidak mengisi halaman atau dialog lain.
- Data referensi tidak dipindahkan ke localStorage, cache global, atau penyimpanan lintas akun. Server tetap memeriksa sesi dan scope setiap request/mutasi.

**Batas tersisa:** pilihan customer saat form dibuka masih memakai endpoint directory penuh. Pencarian lookup dengan hasil terbatas menjadi pekerjaan berikutnya (READ-003). Ini belum menyelesaikan seluruh READ-006 atau program penghematan read. Perubahan ini juga tidak mengklaim sinkronisasi langsung terhadap perubahan referensi yang dilakukan pengguna lain selama halaman tetap terbuka.

## Validasi

- Sebelum perubahan: `npm ci`, TypeScript, suite 357 test (349 lulus, 8 dilewati, 0 gagal), dan build lulus.
- Sesudah perubahan: TypeScript, suite 357 test (349 lulus, 8 dilewati, 0 gagal), dan build lulus.
- Enam test browser lulus: request filter Customer, retry referensi, refresh setelah acknowledgement save, pemuatan form Monitoring, kegagalan/retry/late error, dan form exception mobile tanpa horizontal overflow. Tidak ada page error.
- Screenshot desktop form coaching dan mobile exception diperiksa. Tata letak siap pakai tetap menggunakan komponen/form yang sama.
- Seluruh pengujian fitur berjalan lokal. Tidak ada benchmark atau mutasi data staging.

Artefak lokal: `test-results/read-frontend/`, log `read-frontend-after-*`, dan `browser-results.json`. Trace serta screenshot tidak dimasukkan Git. Jalankan ulang dengan:

```powershell
node node_modules/@playwright/test/cli.js test --config playwright.read-efficiency.config.cjs
```

Konfigurasi menghidupkan `npm run ui:prototype` atau memakai prototipe yang sudah berjalan di loopback 5190. Tidak menerima URL staging untuk suite ini. Status push/deployment dicatat terpisah dalam bukti GitHub Actions; hasil lokal di atas tidak menggantikan smoke test staging.
