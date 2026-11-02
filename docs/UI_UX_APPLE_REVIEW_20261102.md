# Design review: NYALES

Tanggal: 2 November 2026. Penilaian keseluruhan: **Needs work**.

## Summary

NYALES membantu management, supervisor, sales lapangan, dan telesales melihat pelanggan, aktivitas, penjualan serta pencapaian. Ciri visual yang layak dipertahankan adalah teal, permukaan netral, chart yang tenang, dan navigasi kapsul yang membuka horizontal. Prioritas berikutnya adalah keterbacaan mobile, akses ke informasi utama, konsistensi perpindahan, serta pengendalian penggunaan glass; tidak perlu mengganti identitas visual.

## Scope dan bukti

- Skill terpasang: `apple-design` dari emilkowalski/skills, commit `a81dbca07f2217b7103e510c0f13f8d5b017afc9`; `apple-hig-review` dari dickwu/apple-design-skill, commit `ff4ebddf0488598723a82bfdce1afb04de0b1c44`. Nama skill kedua diubah pada frontmatter lokal untuk menghindari benturan; isi panduan tidak diubah.
- Aplikasi React web; prinsip aksesibilitas, layout, material, dan interaksi diterapkan untuk web. Konvensi menu native macOS, API SwiftUI, dan perangkat Apple khusus bukan syarat NYALES.
- Inspeksi sumber dan browser Chrome dengan data sintetis lokal: Overview, Target, Hirarki, Peta pada 1440×1000 dan 390×844; tambahan Peta 320×740.
- Delapan pemeriksaan Axe WCAG A/AA terpilih tidak melaporkan pelanggaran; tidak ada overflow horizontal halaman atau JavaScript error pada putaran itu. Pemeriksaan awal Hirarki desktop menangkap loading, sehingga diulang setelah `.org-canvas` siap; Axe ulang juga tanpa temuan. Ini bukan sertifikasi aksesibilitas seluruh aplikasi.
- Modal Tambah pelaporan: fokus masuk dialog, Escape menutup. Preferensi reduced-motion menonaktifkan animasi kartu. Pergantian grup dan pembesaran root text diuji terpisah.
- Artefak lokal di `test-results/apple-design-review-20261102/`: audit.json, interactions.json, preferences.json dan screenshot. Snapshot statis tidak membuktikan frame rate; Safari/iPhone fisik, screen reader, browser zoom 200%, semua role/form belum diuji.
- Ada hambatan build lokal: `package.json` pada HEAD memiliki UTF-8 BOM; Vite gagal saat pencarian konfigurasi PostCSS. TypeScript lulus, build klien gagal. Browser audit memakai config sementara `.git/apple-audit.vite.mts` dengan PostCSS kosong dan port5194, API prototipe lokal5191. Tidak ada perubahan kode produk, deploy, impor, atau upgrade provider pada audit ini.

## Critical

Tidak ada temuan yang cukup terbukti untuk dilabeli Critical pada cakupan ini. Ukuran font kecil dan target sentuh di bawah rekomendasi44px dilaporkan High; ukuran tersebut sendiri bukan bukti pelanggaran WCAG karena WCAG mempunyai aturan dan pengecualian tersendiri.

## Improvements

### UI-A01 — High: teks navigasi mobile terlalu kecil dan tidak mengikuti pengaturan ukuran teks

**What.** `src/client/mobile.css:12`: label bottom dock8px/line-height11px. Browser mengonfirmasi8px; saat root text diubah menjadi200%, body menjadi32px tetapi label tetap8px. Beberapa catatan KPI10px (`src/client/theme.css:38`).

**Why.** `typography.md › Ensuring legibility`: “Use font sizes that most people can read easily.” `accessibility.md › Vision` meminta dukungan teks lebih besar. Angka pt native tidak disamakan otomatis dengan CSSpx.

**Fix.** Pertahankan Inter. Label dock awal11–12px berbasisrem, badan mobile16px, label/sekunder12–14px sebagai target desain NYALES. Longgarkan lebar dock sesuai viewport; pada pembesaran teks izinkan tinggi bertambah atau beralih ke daftar navigasi yang dapat dibaca. Uji browser zoom200%, text-only scaling dan320px. Ini rekomendasi desain, bukan angka wajib Apple untuk web.

### UI-A02 — High: sasaran sentuh utama masih sekecil ikon

**What.** Tombol rincian KPI28×28px, kontrol peta29×29px, rentang grafik94×36px. Pengukuran mobile tercatat di audit.json; aturan `.metric-corner-action` pada `src/client/theme.css` dan aturan kontrol MapLibre/styles.

**Why.** `accessibility.md › Mobility`: “Offer sufficiently sized controls.”44px adalah sasaran nyaman mobile yang diadopsi untuk NYALES, bukan klaim semua kontrol ini melanggar WCAG.

**Fix.** Buat hit area44×44px dengan ikon visual tetap18–20px. Sisakan jarak antarkontrol; jangan memperluas pseudo-element ke atas tombol tetangga. Tombol sudut KPI tetap membawa ke detail; angka tetap membuka nominal penuh. Uji tap dekat tepi dan keyboard.

### UI-A03 — High: filter mengalahkan konten utama pada mobile

**What.** Di320×740, `.geo-filters` tingginya637,69px dan awal `.geo-stage` berada pada y1252,25px. Di390px, enam filter peta berbaris vertikal sebelum peta. Target juga menempatkan empat filter di atas pencapaian.

**Why.** `layout.md › Visual hierarchy`: “Order content by relative importance.” Bagian yang sama menyarankan progressive disclosure. Tujuan halaman peta adalah melihat lokasi; ini penilaian tugas NYALES, bukan aturan jumlah filter Apple.

**Fix.** Tampilkan pencarian dan tombol `Filter` beserta jumlah filter aktif; pindahkan filter lanjutan ke sheet/dialog mobile. Simpan chip ringkasan filter aktif dan aksi reset. Desktop tetap boleh menampilkan toolbar filter. Sasaran penerimaan: peta/hasil utama terlihat pada viewport pertama390×844 setelah header tanpa menghapus scope pengguna.

### UI-A04 — High: glass belum punya kebijakan keterbacaan yang menyeluruh

**What.** `src/client/ChannelContribution.tsx:14` memakai `card contribution-card glass-card`: glass ada pada kontainer data. `.app-dialog` dan header sama-sama diblur9px (`src/client/theme.css:139`–149). Dock memakai putih9% dan refraction; emulasi `prefers-contrast: more` masih mempertahankannya. Fallback reduced-transparency hanya menangani dock (`src/client/mobile.css:53`), bukan semua permukaan kaca.

**Why.** `liquid-glass.md › The two layers` membedakan konten dan kontrol; `liquid-glass.md › Review checklist` meminta restraint dan accessibility states. `color.md › Best practices` meminta warna yang bekerja pada increased contrast. Preferensi pengguna untuk glass tetap sah; rekomendasi ini mengatur penempatannya.

**Fix.** Jadikan kartu KPI/chart/tabel permukaan netral stabil. Sisakan glass untuk dock, toolbar dan elemen sementara. Buat token `surface-content`, `surface-glass`, `surface-glass-strong`; untuk increased contrast atau reduce transparency gunakan fill hampir solid dan border jelas pada seluruh keluarga glass. Refraction tetap aksen opsional, bukan syarat agar navigasi bisa dibaca. Kontras teks di atas semua latar bergerak belum diukur: tidak ada klaim rasio gagal.

### UI-A05 — Medium: pergantian grup melupakan halaman sebelumnya

**What.** Setelah Monitoring → grup Pelanggan → grup Analitik, halaman kembali ke Overview. `src/client/main.tsx:60` selalu memilih halaman pertama grup, bukan halaman terakhir.

**Why.** `tab-bars.md › Best practices` menjelaskan perpindahan bagian sambil mempertahankan navigation state. Untuk web ini prinsip predictability, bukan kewajiban memakai tab bar native.

**Fix.** Simpan `lastPageByGroup` dalam shell/session; validasi tetap ada dalam capabilities saat kembali. URL tetap sumber navigasi/back-forward. Default pertama masih Overview; tidak mengubah urutan yang disepakati.

### UI-A06 — Medium: animasi tampak halus tetapi masih terlalu banyak orkestrasi

**What.** Kartu masuk0,55detik dengan stagger sampai240ms (`src/client/theme.css:179`–199); total sampai790ms. Sidebar dan LiquidTabs memakai CSS0,55detik, sedangkan WorkspaceNavButton memakai spring (`src/client/LiquidNav.tsx:4,54`). Tidak ada input lock yang ditemukan; frame time tidak diprofilkan.

**Why.** `motion.md › Providing feedback`: “Aim for brevity and precision in feedback animations.” Emil `apple-design › Interruptibility` meminta retarget dari nilai saat ini. CSS pada klik biasa bukan otomatis salah; drag/gesture memerlukan pendekatan lain.

**Fix.** Pertahankan buka/tutup horizontal. Satukan parameter motion, gunakan spring tanpa overshoot yang terasa mengganggu untuk selected control. Kurangi entrance rutin menjadi180–280ms tanpa stagger panjang; sisakan satu entrance yang tenang saat pertama membuka workspace. Semua nilai ini target prototipe NYALES, bukan ukuran wajib Apple. Uji klik cepat A→B→C dan reversal sebelum menyimpulkan fluidity.

### UI-A07 — Medium: tabel dan ruang kosong perlu bentuk mobile tersendiri

**What.** Target pada390px bergantung pada scroll tabel horizontal; beberapa kolom yang penting berada di luar area baca awal. Pada Overview, area `Belum ada lokasi sales` mempertahankan ruang panel besar. Tidak ada overflow halaman; tabel scroll internal bekerja.

**Why.** `layout.md › Adaptability` meminta informasi tetap berguna saat ruang berubah. Penilaian bentuk ringkasan berikut merupakan keputusan produk.

**Fix.** Pada mobile, ringkas pencapaian sebagai baris/kartu Sales, Actual/Target, achievement dan status; detail lengkap dibuka peritem. Panel lokasi tanpa data menjadi empty-state ringkas. Desktop tetap mempertahankan tabel komparatif dan ukuran peta yang stabil saat data tersedia.

### UI-A08 — Medium: detail lokasi panjang lebih cocok sheet pada ponsel

**What.** Sumber `src/client/MapView.tsx:84` membatasi popup pada ruang sisi titik atau tinggi canvas; foto/header/footer dapat menyisakan body pendek. Temuan ini inspeksi sumber serta screenshot staging terdahulu dalam chat, bukan pengujian popup direktori nyata pada audit lokal sintetis ini.

**Why.** `popovers.md › Mobile (iOS, iPadOS)` menyarankan penyesuaian presentasi pada compact views. Terjemahannya untuk web: pertahankan konteks peta sambil memberi ruang baca detail.

**Fix.** Desktop tetap popup360px. Mobile membuka detail sebagai bottom sheet/dialog dengan foto, nama, metadata status/PIC, dan dua aksi tetap; map tetap pada titik yang dipilih. Ada tombol tutup dan Escape; gesture dismiss hanya ditambah jika dapat diuji aksesibel. Ini proposal desain, belum diimplementasikan.

## Craft notes

Teal dipakai untuk data dan penekanan, hitam untuk selected state, permukaan netral untuk informasi. Kombinasi ini sudah sesuai karakter aplikasi monitoring. Jangan menambah glass atau bounce pada semua kartu. Investasi visual berikutnya paling berguna pada tipografi, komposisi mobile, dan konsistensi gerakan. Tidak perlu mengganti font menjadi SF Pro; Inter tetap pilihan yang sesuai untuk web lintas platform.

## What works

- Angka ringkas dengan akses nominal penuh, serta tombol rincian KPI yang mempunyai nama aksesibel.
- Pengelompokan5 area utama; bottom dock tetap tersedia saat berpindah halaman.
- Inter, ikon Lucide, kontras selected state hitam-putih, teal pada data.
- Form tambah disembunyikan dalam modal; fokus modal dan Escape bekerja pada skenario yang diuji.
- Skip link, ARIA pada navigasi, panah/Home/End pada LiquidTabs, serta reduced-motion yang sudah ada.
- Bagan hirarki dan histori dalam canvas: pertahankan, perbaiki area sentuh dan keterbacaan tanpa mengubah model organisasi.

## Urutan pekerjaan yang direkomendasikan

1. Perbaiki BOM package.json dan jalankan build ulang sebelum mengubah visual; backup perubahan yang ada. Jangan menyatakan prototipe/build standar sehat sebelum pemeriksaan itu lulus.
2. UI-A01/A02: type scale dan hit area; baseline320/390/768/1440px, keyboard, zoom dan data panjang.
3. UI-A03/A07/A08: filter sheet, daftar mobile, dan detail lokasi mobile; validasi tidak mengubah scope/angka.
4. UI-A04: satukan token material dan fallback aksesibilitas sambil mempertahankan karakter teal/glass yang disepakati.
5. UI-A05/A06: ingat halaman pergrup, satukan spring dan evaluasi reversal/rapid navigation.
6. Review nyata bersama pengguna pada data customer, sales lapangan dan telesales; baru deploy setelah verifikasi. Audit ini tidak mengesahkan produksi atau mengubah backlog delivery yang sebelumnya masih terbuka.

## Referensi yang digunakan

- Emil skill: https://github.com/emilkowalski/skills/tree/main/skills/apple-design
- HIG skill: https://github.com/dickwu/apple-design-skill
- `accessibility.md › Vision/Mobility`: https://developer.apple.com/design/human-interface-guidelines/accessibility
- `typography.md › Ensuring legibility/Supporting Dynamic Type`: https://developer.apple.com/design/human-interface-guidelines/typography
- `layout.md › Visual hierarchy/Adaptability`: https://developer.apple.com/design/human-interface-guidelines/layout
- `color.md › Best practices/Liquid Glass color`: https://developer.apple.com/design/human-interface-guidelines/color
- `motion.md › Providing feedback`: https://developer.apple.com/design/human-interface-guidelines/motion
- `tab-bars.md › Best practices`: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- `popovers.md › Mobile (iOS, iPadOS)`: https://developer.apple.com/design/human-interface-guidelines/popovers
- `liquid-glass.md › The two layers/Review checklist`: curated reference pada skill apple-hig-review. Panduan native diterjemahkan sebagai prinsip untuk web, bukan klaim kepatuhan native Apple.


## Pelaksanaan rekomendasi — 2 November 2026

UI-A01/A02: label dock menjadi0.6875rem (11px pada mobile16px), metadata ringkas0.75rem; ukuran sentuh tombol KPI/kontrol peta dan pilihan utama minimal44px. Pada root text200%, label dock22px. Tidak ada perubahan font merek, nominal atau rumus.

UI-A03: FilterPanel menggunakan satu set input; desktop tetap toolbar, mobile membuka dialog bawah dengan ringkasan/count pilihan, Reset filter dan Lihat hasil. Nilai filter langsung diterapkan dan bertahan saat dialog ditutup; tombol tutup/Escape bukan Undo. Peta/Target memakai state dan endpoint yang sama. Peta mobile390px mulai terlihat sekitar596px dalam uji, sebelumnya1252px pada320px (ukuran viewport berbeda, bukan benchmark satu banding satu).

UI-A04: kartu kontribusi menjadi surface konten; dialog/header tidak menumpuk blur. Token content/glass/strong dan fallback seluruh keluarga glass ditambah untuk reduced-transparency dan increased-contrast; dock tetap glass pada mode normal. Ini pendekatan CSS web, bukan material native iOS.

UI-A05/A06: shell mengingat halaman terakhir pergrup selama sesi komponen hidup, tetap memeriksa capabilities, default mengikuti urutan grup. Refresh belum menyimpan posisi grup ke storage; URL/history tetap bekerja. Indicator LiquidTabs memakai spring yang sama dengan WorkspaceNavButton. Sidebar tetap buka/tutup horizontal CSS dengan waktu320ms untuk navigasi klik, bukan gesture drag. Entrance kartu240ms tanpa stagger panjang; reduced-motion tetap menonaktifkannya.

UI-A07: pencapaian target mobile menjadi kartu ringkas Actual/Target/Pencapaian/Gap, nama dan periode; desktop tetap tabel. Panel lokasi kosong dipadatkan sementara panel berisi data tetap dibatasi dan digulir.

UI-A08: detail lokasi pada viewport mobile membuka native HTML dialog bawah. Konten foto/fakta dan footer Street View/Google Maps dipertahankan; Escape/tutup dan fokus kembali diuji. Desktop tetap popup360px. Transisi resize kembali ke desktop melepas sheet. Gesture swipe tidak ditambah.

Build BOM diperbaiki tanpa mengubah nilai package. Backup sumber sebelum perubahan berada di `.nyales-agent/ui-apple-20261102/` (privat, tidak dikomit). Pemeriksaan React: hooks top-level dengan cleanup media query/observer, tidak ada dependensi baru, tidak ada pemanggilan mutation bisnis; rincian sumber tetap menggunakan textContent dan URL http(s) yang sudah dibatasi. Verifikasi memakai prototipe sintetis standar5190/5191 setelah build diperbaiki.

Validasi: TypeScript lulus; build standar lulus (peringatan chunk besar dan anotasi dependency tetap ada). Enam tes direktori/popup serta delapan tes navigasi/hirarki/responsif lulus. Uji browser→API lokal mengonfirmasi filter kanal peta/target,10 kartu target, memori grup, tidak ada overflow320/390/768/1440px, label11→22px, reduced-motion/increased-contrast, Axe tanpa temuan pada halaman yang diuji, tanpa pageerror. Sesi uji dicabut. Artefak `test-results/apple-design-implementation/`. Uji fisik iOS/Safari dan seluruh role belum dilakukan. Tidak ada perubahan DB/migration/import atau authentication. Status deployment dicatat terpisah di BUILD_STATUS/STAGING_STATUS.

Deploy pertama41395031753 berhenti sebelum migrasi/publikasi karena satu tes lama mengasumsikan dashboard masih Oktober sedangkan clock sudah November. Test merge ditetapkan ke15 Oktober2026 memakai mock Date pertest; invoice/target/sistem runtime tidak diubah. Enam tes m2-foundation lulus setelah perbaikan.

Verifikasi staging menemukan Cloudflare503 `Worker exceeded resource limits` pada `/api/geo/map`, di luar popup sumber yang sempat lulus. Penyebab terkonfirmasi dari kode: setiap pin memakai `all.find` terhadap seluruh customer, sehingga penggabungan12.100 titik dapat melakukan puluhan juta perbandingan. Diganti Map berdasarkanID dan mapping terbaru; jumlah/filter/scope tidak dibatasi. Tes endpoint15.000 customer memverifikasi kelengkapan, urutan dan batas akses identitas agar pemindaian kuadratik terdeteksi; tujuh tes geography lulus. Menunggu deploy follow-up serta verifikasi ulang endpoint nyata.

Final: workflow41396170233/CI41396166198 sukses, commit1d710da. Enam public smoke dan browser staging nyata lulus. Peta/filter yang semula503 sudah lulus setelah optimasi join; jumlah data tidak dipangkas. Scope pengujian live mencakup kartu target, navigasi grup, preferensi kontras/reduced-motion, text scaling dan viewport320/390/768/1440. Respons409 ACTIVE_DATASET_REQUIRED analitik tetap merupakan prasyarat data batas aktif yang belum dipenuhi, bukan error UI yang disembunyikan. Popup sumber nyata desktop/mobile lulus pada release UI sebelumnya dan tidak diubah oleh optimasi backend terakhir. Produksi/iOS fisik belum diterima.
