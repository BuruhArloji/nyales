# Verifikasi M3 lokal NYALES

18 Oktober 2026. Story: Management membuat aturan insentif yang mereferensikan target approved; peserta melihat estimasi, sumber invoice dihitung pada cutoff, pihak independen mereview/finalize, kemudian export dan finance confirmation terpisah. Supervisor/AM memantau customer/sales/target/workforce, membuat coaching dan menangani exception dalam scope.

| Boundary | Status dan bukti |
|---|---|
| Browser UI | Monitoring/Insentif render; responsif320/390/768/1440; tidak ada page error; test-results/m3-browser.json dan screenshot |
| Client → API | Browser nyata POST report-export/private download, exception create/resolve, coaching create/review/close, notification policy; Worker menunjukkan 2xx |
| API → database | Hono menggunakan D1 prepared queries dan R2 lokal; migrations0031–0032 sukses; frozen run/statement dan scoped actor diuji pada SQLite route fixture |
| Data → response | Target draft gate mencegah plan dibuat; perhitungan80/81/102, per-role, return delta, source revision dan scope redaction lulus tes |
| Response → UI | Filter kanal/drill-down record/CSV metadata/tab change serta popup berhasil; grafik batang Overview dan invoice lama tetap |
| Environment | Preview127.0.0.1:5181 menggunakan APP_ENV local + LOCAL_AUTH; tidak ada provisioning/credential/provider baru |
| Snapshot data |64tabel asal preserved,59exact/5append-only;12tabel baru; foreign key check bersih dan integrity_check ok |

Masalah yang diperbaiki: pergantian tab tidak lagi memakai object dashboard sebagai array daftar; penerima coaching/exception AM/SPV diperiksa terhadap area efektif; jumlah query enrollment AM tidak bertambah satu per leaf; sumber statement historis diproyeksikan terhadap izin baca saat ini.

Financial flow dengan dua pihak diverifikasi melalui route Hono yang sama memakai identitas fixture dan SQLite/R2 memory. Browser hanya mempunyai Management demo, tidak mengklaim Firebase multi-user/MFA telah diuji. Local target contoh masih draft; wizard memang tidak dapat membuat plan sampai target approved tersedia.

Production build dan TypeScript lulus. Bundle client besar masih menghasilkan warning; load/volume source serta pagination/retention/restore perlu gate produksi. Tidak ada deployment cloud, pembayaran otomatis, layanan berbayar, atau Android.

Hasil final:82tes otomatis lulus,0gagal; TypeScript dan build lulus. Preview terakhir health HTTP200 environment local.
