# WEB-059 — UAT web, browser, mobile dan aksesibilitas

20 Oktober 2026. **Pengujian lokal dan perbaikan source tersedia; business UAT/sign-off produksi belum diterima.** Run final menggunakan Worker/D1/R2 lokal terisolasi dan akun Management demo. Setiap run membuat folder persist baru, tanpa mereset sesi/demo utama atau melemahkan rate limit. Tidak ada deployment atau perubahan data produksi.

## Hasil otomatis final

- 121/121 regression test PASS; TypeScript dan production build PASS. Bundle utama masih >500 kB; code splitting belum diselesaikan pada slice ini.
- 11/11 browser check PASS tanpa flaky/skipped: delapan Chrome, tiga Edge. Axe tidak menemukan violation pada sampel tujuh halaman dan satu modal, termasuk state aktivitas kosong.
- npm audit: 0 vulnerability pada lockfile saat pemeriksaan.
- Runner menyiapkan database lokal baru, menerapkan seluruh migrasi dan seed, menjalankan server dan suite otomatis. URL remote ditolak sebelum mutation. State demo utama tidak direset.
- Named business acceptance tetap 0 dari 53 skenario web; 29 skenario integrasi/P1/Android deferred tidak dihitung pass.

## Register 82 skenario

[WEB059_UAT_REGISTER.json](WEB059_UAT_REGISTER.json) mempertahankan nomor, skenario, expected result dan requirement dari PRD v1.10. Applicability mengikuti backlog:

| Applicability | Jumlah | Perlakuan |
| --- | ---: | --- |
| Web release gate | 53 | Supporting regression dan evidence browser dipisahkan dari sign-off pengguna |
| Deferred integration/P1 | 8 | Ditunda; tidak dihitung pass |
| Deferred Android | 21 | Menunggu milestone Android; tidak dihitung pass |
| Total | 82 | Tidak ada skenario yang dihapus |

Setiap skenario memiliki langkah eksekusi, supporting test, keterbatasan, defect IDs, reviewer, waktu review dan signoff evidence. Generator mempertahankan review/defect yang sudah dicatat bila skenario/expected/applicability belum berubah. Unit/route pass tidak otomatis menjadi business acceptance. Saat ini belum ada named reviewer sign-off; skenario 26 actual restore/RPO/RTO tetap blocked provider restore.

## Perbaikan hasil pemeriksaan

| Temuan | Perbaikan dan verifikasi |
| --- | --- |
| Skrip browser lama mencari menu sebelum perubahan sidebar dan judul drilldown generik | Suite baru mengikuti grup sidebar dan accessible name aktual. Skrip historis M2/M3 tidak dipakai sebagai evidence run terbaru. |
| Kontras header tabel, metadata posisi sales dan teks aktivitas kosong kurang | Warna teks pendukung diperkuat tanpa mengganti gaya teal/glass. Fixture tanpa aktivitas memastikan state kosong ikut audit axe. |
| Focus modal dapat keluar pada siklus Tab | Modal bersama menangani first/last focus, Shift+Tab, disabled controls, Escape dan focus return. |
| Tab/pill tidak mendukung navigasi tombol panah | LiquidTabs dengan role tablist memakai roving tab index, ArrowLeft/Right, Home/End dan automatic activation; button group biasa tetap mengikuti semantiknya. |
| Belum ada jalan cepat melewati sidebar | Skip link menuju main workspace ditambahkan dan terlihat saat fokus. |
| Error ringkasan Monitoring tidak menawarkan retry langsung | Tombol Coba lagi memuat ulang sumber; source drilldown juga diuji dengan response 503 sementara lalu recovery. |
| Overview mengesankan nol customer aktif ketika klasifikasi Unknown | active_customer_count sekarang null bila masih ada status Unknown pada master aktif; UI menampilkan Belum lengkap. Unknown count dan observed count dipisahkan. Nol tetap tampil bila completeness sudah dikonfirmasi. Route test mencakup Unknown, known positive, confirmed zero, pembatalan melalui revisi dan master inactive. |

## Cakupan browser yang dapat diulang

Suite: `tests/browser/web059.spec.cjs`; konfigurasi: `playwright.config.cjs`. Chrome menjalankan delapan test, Edge tiga smoke test. Keduanya memakai engine Chromium; ini tidak menggantikan Safari/WebKit atau Firefox.

- Navigasi seluruh 19 halaman dengan reflow 320, 390, 768 dan 1440 piksel pada Chrome dan Edge. Scroll horizontal tabel di dalam container diperbolehkan; overflow halaman tidak.
- Chart penjualan tetap tersedia, source drilldown berpaginasi dan filter kanal memuat sumber terotorisasi. CSV diunduh melalui UI/API privat.
- Audit axe dengan tags WCAG 2 A/AA dan WCAG 2.1 AA pada tujuh halaman representatif serta satu modal; bukan sertifikasi atau pengganti screen reader manual.
- Keyboard: focus modal, Escape, kembali ke trigger dan ArrowRight pada tab Statement/Skema.
- Simulasi gangguan source/summary API 503 dengan retry; simulasi jaringan 4G pada Chrome memakai RTT 150 ms, downlink 1,6 Mbps, uplink 750 Kbps. Hasil bukan SLA jaringan/perangkat lapangan.
- IndexedDB: simpan draft order, reload halaman, pulihkan draft, submit offline. Simulasi respons hilang setelah server menyimpan, lalu retry memakai ID event sama: hanya satu order. Order uji dibatalkan dan snapshot invoice tetap sama.
- Logout mencabut sesi aktif. Token lama mendapat 401; browser context kedua dengan binding berbeda tetap aktif. Ini dua sesi Management demo, bukan dua identitas atau role Firebase nyata.

Ringkasan browser tersimpan pada [WEB059_BROWSER_EVIDENCE.json](WEB059_BROWSER_EVIDENCE.json), terpisah dari acceptance register. Artefak lokal: `test-results/web059/results.json`, `web059-browser.txt`, screenshot/trace/axe attachments di `test-results/web059/artifacts`, `web059-test-suite.txt`, `web059-build.txt`. Test failure menyimpan screenshot dan trace. Hanya order simulasi dan export privat yang dibuat oleh suite; tidak ada finalisasi finance, pengiriman order ERP atau perubahan sumber invoice.

## Cara menjalankan

```text
npm run build
npm run test:browser
npm test
npm run uat:register
```

Suite otomatis menyiapkan migrasi/seed sintetis dan server port 5182 melalui scripts/uat-local.cjs; server pengujian dikelola Playwright. Batas startup 10 menit mencakup migrasi dan cold start Windows; timeout tiap test tetap 120 detik. Gunakan NYALES_UAT_URL hanya untuk base URL lokal alternatif yang sudah disiapkan. Konfigurasi menolak URL non-loopback; suite memeriksa health environment=local sebelum login/mutation. Data fixture tetap harus sintetis dengan customer serta produk aktif. Browser channel Chrome/Edge harus sudah tersedia pada mesin. Fixture harus disepakati sebelum memakai data pilot nyata.

## Gate yang belum boleh dianggap pass

1. Named business reviewers menjalankan 53 skenario web pada role Management/NSM, Area Manager, Supervisor, Sales Rep dan Telesales. Scope lintas role saat ini didukung route tests; browser UAT memakai Management demo.
2. Firebase nyata, MFA admin, dua identitas pada perangkat bersama, akses dicabut ketika offline dan pemulihan akun. Draft/outbox memiliki namespace org:user; perangkat fisik/shared browser dan kebijakan retensi lokal perlu review.
3. HP nyata: GPS permission/accuracy, upload bukti gagal, browser restart, kondisi sinyal lapangan dan kebijakan foto wajib. Viewport emulation bukan bukti perangkat Android/native sudah lulus.
4. Screen reader manual (misalnya NVDA/TalkBack), browser zoom, kebutuhan kontras pada seluruh state/loading/error serta browser lain sesuai matriks yang disepakati. Axe hanya sampel otomatis.
5. Basemap OpenFreeMap/provider dan panorama Google membutuhkan jaringan/provider. Pada inspeksi screenshot, pin dan metadata tersedia tetapi basemap masih memuat; tile rendering/3D/panorama bukan acceptance dari smoke ini.
6. Actual full restore, attachment bytes, RPO15m/RTO4h, kapasitas provider dan go-live WEB-056/057/062 tetap gate terpisah. Tidak membuat angka provider sintetis atau mengubah source completeness demi tampilan.

Local test evidence membantu reviewer menilai kesiapan; keputusan rilis tetap menunggu gate yang berlaku dan persetujuan pengguna.

## Status terkini — 28 Oktober 2026

Suite penuh terbaru berjumlah 319 test dan lulus. Bukti browser WEB-057 menambah tiga skenario Recovery dengan Axe0 dan viewport 390/768/1440. Named role/device UAT, Firebase nyata, perangkat fisik, screen reader manual dan production sign-off tetap belum dianggap pass.
