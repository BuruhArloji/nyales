# WEB-060 — persiapan migrasi dan rekonsiliasi pilot

20 Oktober 2026. Tooling rekonsiliasi lokal tersedia. **Data nyata belum dimigrasikan atau disahkan.** Pilot berkapasitas hingga 10 sales, dengan PIC **Rizky Aditya** dan peserta awal **Novely, Didik, Mursal**. Tujuh slot berikutnya dapat dilengkapi. Manifest tidak membuat akun login atau menetapkan role/area secara otomatis.

## Keputusan pilot dan kebutuhan data

Konfigurasi: [manifest](../pilot/pilot-01/manifest.json). Role Sales Rep/Telesales, ID user, organisasi/area, periode dan cutoff menunggu penetapan. PIC tetap berbeda dari daftar sales; kapasitas 10 tidak berarti sepuluh peserta telah ditentukan. Tidak ada kanal/area yang ditebak dari nama peserta.

Sumber ERP/file, definisi net (termasuk pajak/diskon/ongkir/retur), mapping ID dan reviewer Finance belum dipilih. Ini diperlukan sebelum menulis adapter file perusahaan. Template JSON merupakan kontrak perbandingan setelah mapping, **bukan importer Excel/CSV generik**. Field `complete` dan `current_only` masih null pada template agar template kosong tidak dianggap bukti.

## Pemeriksaan yang tersedia

`npm run pilot:check` membaca manifest, dua snapshot terpetakan dan ledger ID. Tidak membuka database/koneksi jaringan, melakukan commit import, membuat akun atau mengubah sumber. Output hanya ditulis ke folder run baru; folder evidence lama ditolak jika sudah ada.

- Identitas: cohort maksimal 10, peserta unik, role/kanal, area, kode ERP, pasangan koordinat serta mapping canonical/alias. ID sumber ambigu atau mapping yang hilang menjadi blocker.
- Record: customer, user sales, owner historis, invoice current, retur current, versi target terpilih dan target leaf dibandingkan per identitas dan seluruh field. Jumlah/total yang sama tidak menutupi record hilang, record tambahan atau angka yang saling mengompensasi.
- Histori: `history_start` minimal tiga bulan sebelum bulan target. Invoice historis ikut diperiksa sampai cutoff; ringkasan actual periode dan total seluruh histori dipisahkan. Ini memeriksa rentang yang **dideklarasikan** lengkap, bukan membuktikan completeness ERP atau klasifikasi rolling 90 hari secara mandiri.
- Owner: interval akhir eksklusif, tanpa overlap per customer/kanal. Invoice pilot dicocokkan dengan owner pada tanggal invoice. Snapshot harus membawa histori assignment/territory yang relevan, bukan hanya owner sekarang.
- Invoice: IDR integer, versi current unik per sumber/invoice, tanggal/periode/cutoff, status validasi dan atribusi. Draft/cancelled tidak masuk actual. Retur dihitung pada invoice asal; `net_includes_credit=true` mencegah pengurangan kedua. Credit cancelled tidak mengurangi actual.
- Target: leaf + reserve sama dengan parent. Parent tidak dijumlahkan ulang ke total leaf. Versi terpilih harus satu per plan dan periode harus cocok dengan target pilot.
- Provenance: SHA-256 manifest, snapshot, ledger dan file sumber asli; checksum file yang sudah dipatok harus tetap sama. Nilai agregat uang menggunakan BigInt dan dilaporkan sebagai string integer agar tidak kehilangan digit.

Validator import aplikasi tetap menjadi acuan untuk hierarchy/SPV, eligibility target/product, transfer territory, finance lock, approval dan transaksi atomik. Tool ini membandingkan snapshot setelah validasi tersebut; bukan engine bisnis kedua atau bukti bahwa data sudah masuk database.

## Paket file

| File | Isi |
| --- | --- |
| `pilot/pilot-01/manifest.json` | PIC, peserta, kapasitas, scope dan referensi sumber |
| `pilot/pilot-01/source-snapshot.template.json` | Kerangka snapshot sumber setelah mapping yang disetujui |
| `pilot/pilot-01/nyales-snapshot.template.json` | Kerangka snapshot dari lingkungan pilot NYALES |
| `pilot/pilot-01/id-mapping.template.json` | Ledger source ID → NYALES ID, canonical/alias dan alasan |
| `docs/specifications/pilot-*.schema.json` | Tiga kontrak JSON yang dihasilkan dari validator runtime lokal |

Snapshot memiliki `origin=source` atau `nyales`, klasifikasi `real_pilot` atau `synthetic`, waktu ekspor dan scope yang sama. Waktu ekspor tidak boleh sebelum cutoff. Dataset wajib hadir sebagai array; tidak ada pemotongan atau pemilihan revisi terbaru secara diam-diam. Data sintetis tidak dapat dipakai dengan manifest real pilot.

Snapshot user hanya memuat sales dalam cohort, sedangkan PIC/reviewer administratif dicatat di manifest. Customer merujuk ID NYALES terpetakan dan kode ERP asli. Owner memakai tanggal berlaku. Invoice/credit menggunakan identitas sumber serta versi sumber numerik. Angka teknis `*_minor` di pilot IDR berarti rupiah penuh, bukan sen. Target memakai `plan_key` yang stabil dan versi yang dipilih; leaf customer atau rep harus terisi salah satu. `product_id` dan `product_group_id` tidak boleh sekaligus terisi.

Kedua snapshot harus berasal dari ekstraksi independen yang dapat ditelusuri. Menyalin snapshot sumber menjadi snapshot NYALES tidak membuktikan migrasi. Adapter normalisasi/ekspor sumber nyata akan disambungkan setelah format dan mapping tersedia; template belum mengisi data perusahaan secara otomatis.

## Urutan pelaksanaan

1. PIC memilih area, role/kanal dan ID user peserta. Lengkapi tujuh slot tambahan jika dibutuhkan, maksimal 10 peserta.
2. Finance/Sales Ops menyepakati sistem sumber, definisi net, periode target, cutoff, histori tiga bulan dan ledger ID. Simpan ekspor asli beserta checksum. Retur sesudah akhir periode tetapi sebelum cutoff tetap ditautkan ke invoice asal.
3. Siapkan lingkungan pilot terpisah dan backup/recovery gate. Pastikan organisasi, cabang/area, user/role, hierarchy, produk/unit dan histori assignment benar. Akun demo dan seed sintetis tidak menjadi akun/data pilot nyata.
4. Gunakan alur import master dan invoice yang tersedia untuk mapping/dry-run. Periksa seluruh error dan snapshot referensi. Batas saat ini 512 KiB/200 row per CSV; invoice/credit masing-masing maksimal 100 per batch. File besar harus dipartisi dengan header/line tetap utuh, bukan dipotong diam-diam. API/job ID, ETag dan checksum harus tercatat.
5. Setelah validasi, jalankan commit terotorisasi di lingkungan pilot. Ekstrak snapshot NYALES dari fakta yang tersimpan; versi current, pagination dan `has_more` harus diperiksa sampai lengkap. Jangan memakai preview 50/200 row atau daftar yang terpotong sebagai snapshot lengkap. Ekspor invoice admin saat ini maksimal 5.000 row per filter.
6. Jalankan checker pada snapshot sumber independen dan snapshot NYALES. Selisih sekecil satu rupiah atau satu record menjadi blocker. Tinjau setiap perubahan; koreksi melalui revisi/import yang diaudit, kemudian ulangi run baru.
7. Rizky Aditya/PIC, Finance/Sales Ops dan QA meninjau record/count/net/owner/target, evidence role/device WEB-059 serta restore/capacity gate. Catat nama, waktu, versi sumber/job dan keputusan. CLI tidak mengisi persetujuan mereka.

```text
npm run pilot:schemas
npm run pilot:check -- --manifest pilot/pilot-01/manifest.json --out test-results/pilot-review-001
```

Path input relatif terhadap folder manifest. Folder output baru wajib belum ada. Manifest/folder asli sebaiknya disalin ke ruang kerja data pilot privat, lalu lengkapi referensi file di sana. Output berisi identitas/angka bisnis; tetap dalam penyimpanan lokal privat yang sesuai scope.

Output: `reconciliation.json`, `discrepancies.csv` yang melindungi formula spreadsheet, dan `checksums.json`. Exit code: **0** perbandingan siap ditinjau, **2** blocker/setup belum lengkap, **1** kegagalan command/input manifest. Status terbaik adalah `ready_for_named_review`; `production_accepted` selalu false. Angka agregat JSON berupa string integer.

## Evidence dan batas saat ini

129/129 regression test dan TypeScript/production build PASS. Delapan regression test baru mencakup cohort 10 sales, net/kanal/retur/target, selisih dengan grand total sama, histori owner, net retur ganda, duplicate current version, scope/cutoff/klasifikasi, canonical/alias serta provenance/preservasi sumber dan no-overwrite evidence. Regresi lama yang mencari substring `800` pada seluruh JSON diperbaiki agar memeriksa nilai angka; digit UUID/timestamp tidak lagi menimbulkan false positive pada tes kebocoran forecast.

Run manifest nyata pada `test-results/web060-readiness-01` menghasilkan `blocked`: tiga peserta bernama, tujuh slot terbuka, scope/role/ID/mapping/data masih pending. `totals.source` dan `totals.nyales` null; data yang belum tersedia tidak dilaporkan sebagai nol. Tidak ada migrasi nyata, sign-off atau deployment cloud pada langkah persiapan ini.

## Pembaruan 21 Oktober 2026 — penyelesaian scope dummy

Pengguna memilih data dummy di file terpisah. [Paket dummy 10 sales](../pilot/demo-10-sales/README.md) kini tersedia dengan sumber JSON, CSV customer/invoice, manifest/ledger, snapshot sumber yang dihitung independen dan snapshot fakta hasil database. Rehearsal menerapkan seluruh migrasi pada SQLite in-memory, menginisialisasi fixture master/hirarki, menjalankan route dry-run/commit/retry invoice dan dua alur target create/items/submit/approve oleh aktor berbeda. Bukan bypass validator domain: financial dan target writes memakai route aplikasi; identitas auth diinjeksi harness, sehingga login/Firebase dan impor master UI belum dibuktikan oleh rehearsal ini.

Hasil: 10 sales, 20 customer/owner, 80 invoice, 4 credit dan dua target approved simulasi. Actual September Rp36.520.000, field Rp30.840.000, telesales Rp5.680.000; seluruh histori Rp163.720.000. Target leaf Rp80.000.000 dan reserve Rp200.000. Selisih per record 0. Retry kembali ke job sama tanpa invoice ganda. Seluruh output diberi synthetic dan production_accepted=false. Approval dummy bukan sign-off manusia.

Untuk mengulang: `npm run pilot:demo -- --out test-results/demo-run-baru`. Artefak yang dapat dibuka ada di `pilot/demo-10-sales/rehearsal-20261021`. Scope dummy WEB-060 selesai; manifest nyata `pilot/pilot-01` tetap tidak ditimpa. Tidak mengubah data `.wrangler/state`, preview, provider, atau akun pengguna.

## Pilot lokal Oktober sudah dijalankan

Sesuai instruksi berikutnya, sumber turunan dummy sekarang dimuat pada D1 pilot terpisah, bukan `.wrangler/state`. Login demo, tampilan dan order telah diverifikasi browser. Sumber September, manifest nyata serta output rehearsal awal tetap utuh. Lihat [runbook WEB-062](WEB062_LOCAL_PILOT.md) dan [evidence](WEB062_PILOT_EVIDENCE.json).
