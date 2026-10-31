# Design review: NYALES (web, staging + local prototype)

Tanggal: 2026-10-31
Metode: Apple Design (WWDC fluid-interface principles) + Apple HIG review, diuji pada app berjalan
(`http://127.0.0.1:5190`, login Management, data prototipe lokal).
Alat: Playwright + axe-core (WCAG 2.1 A/AA), pengukuran computed style untuk target sentuh, ukuran teks,
dan kontras; 10 halaman × 2 viewport (1440×1000 dan 390×844) = 20 render, 20 screenshot.

## Summary

**Rating: Good — Needs work pada aksesibilitas & skala tipografi.**

NYALES punya titik pandang yang jelas: utilitas tenang berwarna teal/mint dengan satu headline display
per halaman ("Setiap target, lebih dekat."), dan elemen signature berupa dock kaca yang memakai filter
refraksi SVG. Itu bukan template generik.

Masalahnya ada di lapisan yang paling sering dipakai: **94% teks berukuran di bawah 14px** (22,6% hanya
10px), **63% kontrol di mobile tingginya di bawah 44px**, dan ada **2 jenis kegagalan aksesibilitas**
yang lolos ke build. Secara visual rapi dan konsisten; secara craft belum selesai di tingkat teks dan
sentuhan — justru bagian yang paling menentukan dipakai atau tidaknya aplikasi ini di lapangan.

## Critical

### 1. Nama aksesibel tidak memuat teks yang terlihat (WCAG 2.5.3)
- **What**: 46 node di 3 halaman (Overview, Monitoring, User & Hirarki) gagal `label-content-name-mismatch`.
  Contoh: tombol metrik punya teks terlihat `Rp36,52 jt` tapi `aria-label="Actual penjualan: Rp 36.520.000"`;
  kolom grafik punya teks terlihat `36,52 jt` di tooltip tapi nama `Okt: Rp 36.520.000`.
- **Why**: `accessibility.md › Label in Name` — nama aksesibel harus memuat label yang terlihat, supaya
  pengguna voice control/screen reader bisa mengucapkan apa yang mereka lihat.
- **Fix**: `main.tsx:43` → `aria-label={`${label}: ${display.short} (${display.full})`}`;
  `main.tsx:84` → sertakan nilai ringkas di nama, nilai penuh lewat `aria-describedby`.

### 2. Region yang bisa di-scroll tidak bisa difokus keyboard
- **What**: 2 node (`Target & pencapaian` @mobile, `Distribusi sales` @mobile) — `.table-wrap` overflow
  horizontal tanpa `tabindex`.
- **Why**: `accessibility.md › Keyboard` — semua area yang bisa di-scroll harus dapat dijangkau keyboard.
- **Fix**: `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabel …">`.

## Improvements

### High — Skala tipografi jauh di bawah HIG
- **What**: 2.011 node teks terukur: 39% < 12px, 94% < 14px, 22,6% tepat 10px, 12,7% 11px, 2,9% 9px.
  Body/tabel 12px, label filter 10–11px, footer 9px.
- **Why**: `typography.md` — desktop default 13pt (≈17px), minimum 10pt (≈13px); mobile default 17pt,
  minimum 11pt (≈15px). Aplikasi ini dipakai di HP, di luar ruangan, sambil berdiri.
- **Fix**: skala 5 langkah berbasis `rem` (12 / 13 / 15 / 20 / 34), body minimum 14px, label minimum 12px,
  dan naikkan `--muted` satu tingkat saat dipakai di bawah 13px.

### High — Target sentuh mobile di bawah 44pt
- **What**: `Pelanggan` 46/51 kontrol < 44px, `Peta & Wilayah` 43/49, `User & Hirarki` 22/26,
  `Aktivitas lapangan` 8/8, `Telesales` 3/7. Sebagian besar 34–42px (di atas minimum 28, di bawah default 44).
- **Why**: `accessibility.md › Touch targets` — mobile default 44×44pt; jarak antar kontrol sama pentingnya.
- **Fix**: `min-height:44px` untuk semua kontrol mobile; aksi baris tabel (`Lihat`/`Edit`) jadi 44×44;
  `.text-button` padding 12px.

### High — Atribusi peta & toggle org chart hampir tidak bisa ditepuk
- **What**: link atribusi OpenFreeMap/OpenStreetMap 10px tinggi; toggle "Lipat tim"/"Buka tim" 11–16px tinggi;
  "React Flow" 9px dengan kontras 2,69:1.
- **Why**: `accessibility.md › Touch targets` (minimum 28pt) + `color.md` (kontras 4,5:1 untuk teks kecil).
- **Fix**: beri hit area 44px (padding transparan) atau pindahkan atribusi ke sheet "Tentang peta";
  hapus/rebrand atribusi React Flow, atau beli lisensi tanpa watermark.

### Medium — Tab workspace hanya ikon saat tidak aktif
- **What**: `LiquidNav` menyembunyikan label (`opacity:0`, `aria-hidden`) kecuali tab aktif. Di layar
  desktop terlihat 6 ikon tanpa nama.
- **Why**: `tab-bars.md` — label tab selalu terlihat; ikon saja tidak cukup untuk wayfinding.
- **Fix**: pertahankan label pendek (≤2 kata) untuk semua tab, atau tampilkan label saat hover/focus
  dengan `aria-label` tetap ada.

### Medium — Filter peta mendahului peta itu sendiri
- **What**: di 390px, 7 filter bertumpuk (~600px) sebelum kanvas peta muncul.
- **Why**: `layout.md` + prinsip Simplicity — tampilkan jalur umum dulu, opsi lanjutan satu lapis lebih dalam.
- **Fix**: ringkas filter jadi satu baris chip + tombol "Filter" yang membuka sheet; peta naik ke atas.

### Medium — Kaca ditumpuk di atas kaca
- **What**: `.glass-card` `rgba(255,255,255,.34)` + `blur(9px)` dipakai pada kartu konten, dan beberapa
  kartu berada di dalam kartu lain di atas latar gradien.
- **Why**: `materials.md` — jangan menumpuk permukaan transparan terang di atas permukaan transparan terang;
  legibilitas kolaps. Kaca untuk lapisan fungsional yang mengambang, bukan untuk konten.
- **Fix**: kartu konten pakai permukaan nyaris solid; sisakan kaca untuk dock, top bar, dan sheet.

### Medium — `prefers-contrast: more` tidak ditangani
- **What**: `prefers-reduced-motion` ✅, `prefers-reduced-transparency` ✅, `prefers-contrast` ❌.
- **Why**: `accessibility.md` — ketiganya harus punya jawaban.
- **Fix**: media query yang menaikkan opasitas permukaan ke ~0,98 dan memberi border kontras.

### Medium — Tidak ada appearance gelap
- **What**: tidak ada `prefers-color-scheme: dark`.
- **Why**: `color.md` — semantik warna harus punya jawaban light & dark.
- **Fix**: token warna ganda (canvas/ink/muted/teal) + satu blok media query; prioritaskan karena
  penggunaan malam hari di lapangan.

### Medium — Token warna ganda & kontras borderline
- **What**: `theme.css` memakai `--muted:#626a67`, `styles.css` menulis `#6a706e` langsung. `#6a706e`
  di atas `--canvas #e7e9e8` terukur **4,14:1** (di bawah 4,5 untuk teks < 18px).
- **Why**: `color.md` — satu warna satu makna, jangan hard-code; `typography.md` — kontras 4,5:1 untuk teks kecil.
- **Fix**: satu token `--muted` di ~`#5a625f`, hapus nilai hard-code, verifikasi ulang.

### Low — Label tabel & sub-teks 10px
- **What**: `th` 11px, sub-teks sel 10px, teks status 10px. Zebra baris sangat tipis.
- **Fix**: `th` 12px, sub-teks 11px, naikkan kontras zebra dari `#f5f5f2` ke `#f0f1ee`.

### Low — Copy
- **What**: "menunjukan" → "menunjukkan"; "Belum ada rilis batas aktif." ambigu; "React Flow" watermark.
- **Fix**: perbaiki ejaan, ganti kalimat jadi menyebut aksi berikutnya.

## Craft notes

**Point of view**: ada. Teal/mint + headline display + dock kaca ber-refraksi adalah bahasa yang konsisten
dan tidak terasa template. Warna berasal dari produk, bukan tren.

**Yang melemahkan**: hierarki tipografinya gepeng. Satu-satunya tempat yang punya karakter adalah `h1`
(34px, `letter-spacing:-.055em`). Sisanya 10–12px dengan warna muted, sehingga identitas visual hilang
tepat di tempat orang menghabiskan 95% waktunya (tabel, filter, metrik).

**Restraint**: baik. Satu aksen, satu keluarga font, radius konsisten 20–28px. Tidak ada dekorasi berlebih.
"Remove one accessory": tidak ada yang mencolok untuk dibuang; masalahnya bukan kelebihan elemen,
tapi ukuran elemen.

## What works

- **0 horizontal overflow** di 20 render (desktop & 390px) — layout benar-benar responsif.
- **0 tombol ikon tanpa nama** — semua punya `aria-label`/`title`.
- `focus-visible`, skip link, `prefers-reduced-motion`, `prefers-reduced-transparency`, dan
  `env(safe-area-inset-*)` sudah dipakai; dock memberi padding bawah 112px sehingga konten tidak tertutup.
- Tabel semantik + fallback data grafik (`<details>` berisi tabel) — jarang ada, ini bagus untuk screen reader.
- Loading state punya spinner + teks ("Memuat peta sesuai scope…") bukan layar kosong.

## Platform notes

- Ini web app, bukan app native: konvensi iOS (tab bar, sheet, toolbar) hanya berlaku sebagian.
  Yang saya nilai sebagai "High" adalah foundation (aksesibilitas, tipografi, target sentuh), bukan
  pelanggaran konvensi platform.
- Desktop: target sentuh sudah memenuhi minimum HIG (28px) hampir di semua tempat; yang gagal hanya
  atribusi peta dan toggle org chart.
- Mobile: masalah utama ada di tinggi kontrol (34–42px) dan ukuran teks, bukan di layout.

## Batasan audit

- Data yang dipakai adalah data prototipe/dummy, bukan staging dengan 12.100 customer.
- Beberapa modul (peta, ringkasan wilayah) tertangkap saat masih memuat; penilaian visual pada area itu
  terbatas pada keadaan loading.
- Kontras diukur dari computed color dan komposit latar, bukan dari piksel screenshot; kartu dengan
  `backdrop-filter` dan gradien bersifat perkiraan (ditandai di `contrast.json`).
- Tidak ada pengujian screen reader nyata (NVDA/VoiceOver) maupun perangkat fisik.

## Artefak

- `audit.json` — 20 render: axe violations, overflow, target sentuh, ukuran teks, jumlah permukaan kaca
- `contrast.json` — pengukuran kontras per halaman
- `targets.json` — distribusi ukuran kontrol & teks dengan ambang desktop/mobile
- `support.json` — dukungan media query preferensi
- `shots/*.png` — 20 screenshot