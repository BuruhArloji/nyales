# WEB-071 — kernel dan adapter jadwal harian

26 Oktober 2026. **In progress: OR-Tools nyata terpasang dan daily kernel/adapter CLI teruji pada matriks sintetis. OSRM nyata, antrean job solver, builder sumber bisnis dan review/publish belum tersedia.** Tidak menambah endpoint atau tabel. Runtime tetap318operasi,114tabel aplikasi/116 dengan metadataD1.

## Yang telah dihitung nyata

Python3.13.15/OR-Tools9.15.6755 di venv lokal `.nyales-agent/solver-python`, tanpa perubahan Python global/WSL/Docker. CP-SAT memilih presence, urutan dan waktu satu sales/satu tanggal. Node start/end terpisah, matriks asymmetric, nulledge terlarang, requiredvisit wajib, waktu service/travel/return dan break tidak overlap, jendela penerimaan serta kapasitas layanan eksplisit. Pilihan yang tidak terjadwal menyebut alasan; hasil feasible/infeasible/timeout dibedakan, optimality tidak diklaim.

Tujuan kernel: maksimalkan `sum(prepared_priority_basis_points * shift_seconds) - travel_weight_basis_points * road_travel_seconds`. Prepared priority berasal dari snapshot yang dibekukan, bukan omzet yang diubah menjadi potensi atau angka prioritas baru otomatis. Formula pembentukan komponen service/overdue/sales dan kelengkapan sumber menjadi tanggung jawab builder bisnis yang masih pending. Bobot perjalanan dari kebijakan yang hash-nya cocok. Tidak ada bonus jumlah kunjungan tersembunyi yang mengalahkan bobot kebijakan.

Adapter memeriksa VisitSnapshot, hash kebijakan, satu sales/hari, minimal-gap/assignment/source, batas node, jendela, identitas graph/profile/cache/nodes serta matrix/snapped coordinates/diagonal/null/fallback. Hasil diperiksa lagi secara independen terhadap matrix dan hard constraints. Hash input/matrix dan exact JSON byte count dicatat. Peak working set berasal dari proses Python/native solver yang diukur OS, bukan RSS Node.

Maksimal98customer/100node; solver maksimal120detik dengan batas proses/abort. Janji terkunci/protected agenda belum diterjemahkan beserta lokasi dan perjalanannya; adapter menolaknya. Repeated customer dalam satu hari ditolak sampai model yang sah tersedia. Required yang tidak terjadwal tidak lolos structural validation. Batas runtime harian kernel ini dapat lebih kecil dari konfigurasi kebijakan dan selalu dilaporkan.

## Alur CLI

`scripts/visit-daily.ts` → baca file operator terbatas4MiB → verifikasi manifest/hash semua file graph → HTTPtable loopback OSRM → revalidasi matrix → OR-Tools di executable operator yang eksplisit → independent validator → tulis artifact lokal nama baru. File parsial sendiri dibersihkan dan destination lama tidak ditimpa. Tidak mengubah D1, upload atau agenda. Paket sumber hanya memuat file yang di-allowlist, lockfile dan runbook; tidak menyertakan data bisnis/credential/graph.

Paket dapat dipasang di komputer lain karena pengguna tidak mempunyai admin pada Windows saat ini. [Petunjuk](../tools/visit-compute-kit/README.md), builder `scripts/package-visit-compute.py`. Windows host yang sudah mempunyai WSL/Docker dapat menjalankan routing dan Windows agent. Linux dapat menjalankan CLI/solver setelah runtime siap, tetapi belum diuji Linux dan vault/polling agent Linux belum diimplementasikan. Alamat/OS/area/operator tujuan belum diberikan.

`nyales-visit-readiness-1` UI bukan snapshot solver dan belum dapat diekspor langsung ke CLI ini. Endpoint job bisnis/claim/result/review/publish belum diregistrasikan; connection_probe tidak dipakai untuk data pelanggan. Artifact selalu publishablefalse, osrm_process_identity_verifiedfalse, agenda_writtenfalse dan uploadedfalse. Manifest file tidak membuktikan proses yang menjawab HTTP memakai graph yang sama.

## Verifikasi

311tes backend/kernel/integrasi lulus tanpa skip;12di antaranya daily solver/adapter/file pipeline. OR-Tools sebenarnya dijalankan, tetapi matrix berasal dari fixture HTTP/synthetic. Meliputi kapasitas, split windows, break, unreachable required/optional, asymmetric travel, invalid/aborted runtime, stale policy/cache, graph substitution, wrong snap/fallback, protected agenda, missing source, output lama dan full file→HTTP→native computation. Typecheck/build lulus. Dua browser profil operasional teruji pada slice0045; tidak ada browser Generate end-to-end karena rutenya belum dibuat.

Log suite: `test-results/web071-final-full-tests.log`; kandidat hasil tes tidak ditulis ke pilot. Tes ini belum membuktikan one-way/bridge/ferry/roadaccuracy, live-engine identity, kapasitas RAM/preprocess OSRM, sumber pelanggan nyata atau PVG-A01–10 end-to-end.

## Sisa pekerjaan

Komputer routing dan graph pilot nyata serta benchmark; builder lengkap dari profile/assignment/calendar dan histori kontak bermakna yang terbukti lengkap; agenda/lokasi/janji lintas kanal; business queue/signed transport/result validation; UI generate/review/publish atomik; bulanan/multi-sales serta recovery/retention. Web/pilot tetap berjalan pada stack Workers/D1/R2 yang disepakati; tidak memakai PostGIS atau Cloudflare Containers pada tahap ini.


26 Oktober2026: pengguna memastikan komputer lain belum tersedia; paket pemasangan revisi2 disiapkan dahulu. [Panduan ringkas](../tools/visit-compute-kit/START-HERE.md), pemeriksa offline dan4tes batas paket tersedia. Tidak mengubah status OSRM/web integration menjadi siap.
