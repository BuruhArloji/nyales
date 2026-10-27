# WEB-069 — kontrak dan model Plan Visit Generator

24 Oktober 2026. **Baseline desain dan executable specification tersedia.** Belum ada agent terpasang, OSRM/OR-Tools, kredensial mesin, endpoint generator, migrasi runtime atau UI Generate Plan yang aktif. Runtime tetap 276 operasi dan 100 tabel lokal. WEB-070–074 membangun dan memverifikasi implementasinya. [Kontrak desain](specifications/visit-generator.design.openapi.json), [model/data dictionary](specifications/ERD_WEB069_Design.json), [SQL draft](specifications/sql/WEB069_Visit_Generator_DRAFT.sql).

## Keputusan penggunaan kembali sumber

NYALES tetap React/Workers/D1/R2, dengan komputer pribadi sebagai penghitung jalan dan optimasi. PostGIS/Cloudflare Containers tidak ditambahkan. Graph jalan di disk/RAM komputer; R2 menyimpan snapshot/manifest/bukti privat. Browser tidak mengunduh graph dan komputer tidak memerlukan port masuk publik.

Pemeriksaan sumber menemukan `work_plan` adalah satu occurrence visit/call, dengan status proposed/planned/done/cancelled, version, original_scheduled_at, alasan dan calendar snapshot. `work_plan_revision` menyimpan perubahan. Belum ada `plan_item` fisik atau antrean solver yang sesuai. Import/job existing tidak dipakai sebagai job solver karena semantik lease, snapshot, fence, retry dan publish berbeda. Rancangan memakai tabel generator terpisah dan hanya menulis `work_plan` setelah review/publish yang sah pada WEB-073.

Work plan manual saat ini memakai slot collision 30 menit. Itu bukan sumber durasi layanan semua customer. Field `visit_window` existing juga bukan jendela waktu terstruktur yang otomatis aman dipakai solver. WEB-070/071 harus mengubah sumber yang disetujui menjadi UTC windows bertimestamp dan durasi eksplisit, atau melaporkannya sebagai data kurang. Kalender belum mempunyai feed cuti individu yang lengkap; snapshot memerlukan versi/keterangan ketidaklengkapannya. Tidak mengarang jam toko atau menganggap tidak ada cuti.

## Satuan, kebutuhan layanan dan batas wajib

Protokol `nyales-visit-generator-1`. Koordinat WGS84 integer E7; jarak integer meter; durasi integer detik; uang invoice rupiah penuh; bobot integer basis points berjumlah 10.000. Instants ber-offset ISO8601; business date dan IANA timezone per rep/day dibekukan. Periode satu bulan kalender atau subset masa depannya; model harian awal satu sales/satu tanggal, bulanan maksimal sepuluh sales. Semua tanggal masa lalu, kunjungan selesai dan janji terkunci dipertahankan.

Kebijakan Management/NSM memuat cadence kontak per bulan, minimum gap, durasi/fallback beralasan, pengaturan khusus customer, bobot prioritas/overdue/invoice/travel, batas solver/deadline/lease/heartbeat/attempt/snap dan retensi. Angka bisnis tidak mempunyai default aktif. Sumber koordinat, kalender, assignment atau waktu jalan yang hilang selalu memblokir occurrence terkait. Missing durasi/jam toko hanya boleh diisi fallback eksplisit yang beralasan dalam versi kebijakan. Invoice tidak lengkap tetap null. Jika bobot sales dihilangkan karena data kurang, renormalisasi harus diizinkan eksplisit dan dicatat sebagai asumsi; subtotal observasi tidak disebut total lengkap atau potensi.

`service_requirements` memisahkan kontak wajib satu bulan, completed/retained yang diketahui dan remaining demand. Remaining dihitung `max(0, required − completed − retained)` hanya bila semua count sah dan sumber lengkap. Unknown tidak menjadi nol. Occurrence baru tidak boleh menghitung ulang visit selesai atau agenda masa depan yang dipertahankan. Kontak bermakna dideduplikasi menurut definisi layanan; builder harus menyatakan dasar hitung, bukan memakai banyaknya baris aktivitas mentah.

Untuk rencana bulanan, jumlah occurrence required harus sama persis dengan remaining demand dan tidak dapat dibuat opsional untuk memperbaiki objective. Pada model harian, janji/komitmen hari itu required; kandidat prioritas lain boleh tidak dijadwalkan dengan alasan. Hasil harian tidak mengklaim seluruh kebutuhan bulanan terpenuhi. Kebijakan tidak menghapus minimum layanan toko kecil hanya karena sales historis lebih rendah.

Hard constraints: owner field per tanggal, jam shift/istirahat, jam penerimaan customer, durasi, kapasitas layanan eksplisit, minimum frequency/gap dan locked appointment. Soft preferences: prioritas yang disetujui dan biaya perjalanan, dengan bobot/penalti dapat dijelaskan. Redistribusi owner tetap menggunakan WEB-065/068, bukan solver. Telesales/DNC/callback tidak diubah menjadi rute lapangan.

## Snapshot dan hasil

Snapshot membekukan org/environment/job/scope, request, source/agenda epoch, policy/hash, graph/profil/versi/license/extract/checksum, customer/version/koordinat, assignment reference per rep/day, source invoice/cutoff/kelengkapan, kebutuhan layanan, jam kerja/break/absensi, depot mulai/akhir, locked/protected agenda dan asumsi. Referensi owner diverifikasi pada tanggal layanan, bukan hanya hari ini. Seluruh scope yang membebani sales disusun oleh backend; browser tidak mengirim flag complete atau raw financial inputs.

`visitSnapshot` dan `visitResult` memvalidasi referensi, satuan, batas, perhitungan remaining, duplicate, jam dan data kurang. `inspectVisitCandidate` memeriksa coverage occurrence (terjadwal atau alasan), urutan, assignment/day, timestamp travel/service/return, time windows, breaks (idle menunggu boleh), durasi/kapasitas, minimum gap, locked appointment, asumsi dan hard violations. Tidak pernah mengembalikan publishable=true. Matrix, current scope/source, diff agenda dan otorisasi reviewer tetap wajib diperiksa oleh backend implementasi.

Waktu perjalanan berisi departure/arrival eksplisit. Menunggu sebelum service bukan waktu perjalanan palsu; istirahat boleh berada dalam waktu menunggu, tetapi tidak tumpang tindih travel/service/return. Matrix dapat asymmetric; rute pulang, one-way, titik gagal snap/outside graph/unreachable harus eksplisit. Unknown edge tidak bernilai nol. Profil car tidak diberi label motorcycle tanpa profil dan validasi tersendiri. Tidak ada traffic real-time.

Hasil menyatakan feasible, infeasible, timeout_with_candidate atau timeout_without_candidate. Timeout dengan candidate hanya boleh direview bila constraint validation lulus; optimality selalu `not_claimed` pada kontrak awal ini. Solver selesai bukan agenda terpublish. Infeasible/partial diagnostics boleh disimpan sebagai bukti tetapi tidak lolos publish bila ada required service tidak terpenuhi.

Checksum/signature mengikat versi, bytes dan provenance; bukan bukti matematis bahwa angka OSRM benar. Backend memeriksa konsistensi seluruh edge yang dipakai terhadap manifest matrix berkoordinat/graph/profile sama. Komputer agent tetap komponen compute yang dipercaya operator, dengan output diperiksa. Validasi numerik routing memakai fixture/spot check OSRM lokal pada WEB-070/071 dan benchmark WEB-074; belum ada layanan routing independen untuk membuktikan ulang seluruh graph di Workers.

## Izin pengguna dan identitas mesin

| Aksi | Sales Rep | Supervisor | Area Manager | Management / NSM | Telesales / agent |
| --- | --- | --- | --- | --- | --- |
| Atur policy, graph, pairing/revoke | Tidak | Tidak | Tidak | Organisasi sendiri | Tidak |
| Generate dan baca hasil | Rep sendiri, field assignment sah | Tim field dalam area scope | Field reps pada area sendiri | Field reps dalam organisasi | Tidak untuk user telesales |
| Cancel | Job yang diminta sendiri untuk rep sendiri | Job pada tim/area scope | Job area scope | Organisasi | Agent hanya ack cancel job miliknya |
| Review/publish | Tidak | Tim field/area scope | Area sendiri | Organisasi | Tidak |
| Ambil input/upload compute | Tidak | Tidak | Tidak | Melalui peran mesin terpisah | Agent hanya job yang diklaim, org/environment/grant sah |

Scope builder memeriksa role aktif, hierarchy, area dan penugasan bertanggal pada generate serta publish. Visibility customer berbasis area SR tidak berarti boleh membuat rute untuk customer yang belum ditugaskan kepadanya. Supervisor telesales tidak memperoleh hak generator field. Hasil lama tidak memberikan akses permanen setelah scope berubah. Pure authorization specification diuji, tetapi penerapan DB-backed scope pada endpoint baru tetap pekerjaan runtime berikutnya.

Prefix browser `/api/visit-generator/*` kelak memakai bearer user + device session existing. Prefix mesin `/api/visit-agent/*` membutuhkan gate terpisah **sebelum** gate user session; tidak memperluas bypass ke prefix lain. Agent tidak memperoleh token Management, cookie, auth_subject, kredensial D1/R2 atau akses daftar seluruh customer. Native client tanpa Origin tetap memerlukan identitas dan proof yang sah.

Pairing: Management/NSM membuat agent dengan grant rep IDs dan environment yang eksplisit, menerima code acak minimal 128-bit sekali dengan TTL 15 menit. D1 hanya menyimpan digest code, expiry dan consumed timestamp. Komputer membuat private P-256 key lokal, mengirim public JWK serta bukti kepemilikan. Exchange memverifikasi code/TTL/single-use dan proof lalu mengaktifkan agent serta mengembalikan opaque machine credential sekali. Secret credential hanya dalam penyimpanan lokal aman; server menyimpan hash, key thumbprint, generation dan expiry. Private JWK fields ditolak schema. Credential/PoP implementation dan Windows storage belum dibangun.

Setiap machine request menandatangani method, origin/path, exact body SHA-256, server nonce, jti dan window waktu singkat dengan ES256. Server memverifikasi signature, nonce single-use/replay store, credential expiry/revocation/generation, environment dan grant. Pairing/claim menggunakan rate limit/backoff; clock skew terlihat sebagai error, bukan menonaktifkan verifikasi. Retry idempotency memakai key/body yang sama dengan proof/nonce baru; auth/revocation diperiksa **sebelum** replay response. Revoke mengganti generation dan mem-fence attempt aktif. Tidak menaruh code/token/proof penuh, data finansial atau body dalam telemetry.

## State machine dan fencing

State job: queued → running → completed/failed; queued/running dapat cancelled atau expired melalui alur berikut. `completed` berarti candidate diterima, tidak berarti publish. Attempt, heartbeat, byte upload dan publish mempunyai state terpisah.

1. Create job memvalidasi scope/config/source lalu membekukan R2 input; D1 queue/reference/audit/idempotency hanya commit bila sumber masih sama. Unknown commit mempertahankan objek; orphan dihapus hanya setelah DB membuktikan tidak direferensikan.
2. Claim memilih job compatible secara server-side dan melakukan compare-and-swap state/version. Increment attempt_no dan fence; lease milik agent + credential generation, expiry dibatasi deadline job. Satu agent mengerjakan satu job pada model awal. Mesin kedua tidak dapat mengklaim job running.
3. Renew/download/upload/finalize/complete selalu memeriksa org/environment, agent aktif, grant job, generation, attempt, fence, snapshot hash, state running serta server time **strictly before** lease/deadline. Equality berarti kedaluwarsa. Browser tidak menentukan server clock.
4. Komputer mati/sleep/network putus: heartbeat/status terpisah menunjukkan menunggu/terputus. Server reaper mem-fence lease habis, merequeue hanya bila attempt/deadline masih cukup. Old attempt tidak boleh upload/complete pada attempt baru. Checkpoint hanya reusable bila seluruh snapshot/engine/graph checksums sama dan server memilihnya.
5. Cancel queued langsung cancelled. Cancel running menjadi cancel_requested; completion dan renew normal ditolak, agent menghentikan solver dan mengirim cancel-ack. Reaper menyelesaikan cancelled bila agent hilang. Hasil terlambat sesudah cancel ditolak. Terminal job tidak dibuka ulang; regenerate membuat job/snapshot baru.
6. Failure retryable masuk queued dengan budget attempt yang tersisa. Exhausted attempt menjadi failed. Deadline terminal expired; cancel yang sudah diminta tetap cancelled. Revoke credential mem-fence owner dan requeue/cancel sesuai status serta budget. Internal event hanya dipanggil server setelah otorisasi yang sesuai.

`transitionVisitJob` adalah reducer pure untuk menguji aturan ini. Runtime WEB-070 harus menyusun conditional UPDATE, mutation guard, attempt dan audit/idempotency dalam satu D1 transaction. Reducer sendiri bukan queue/lease service atau bukti pengujian dua mesin sesungguhnya.

## Upload privat dan retensi

Input/result maksimum 8 MiB; satu upload part maksimum 1 MiB, 100 parts teknis maksimum tetapi aggregate result tetap 8 MiB. Job memilih graph/profile terpasang sesuai manifest, bukan mengunduh URL graph arbitrer dari request browser. Matrix shard maksimal 100 node dan tetap dipartisi sesuai policy. Angka ini adalah batas rancangan untuk dibenchmark, bukan jaminan Free Workers, RAM PC atau biaya Rp0.

Upload intent mengikat job/attempt/fence/kind/part/hash/bytes. Endpoint upload menerima exact bytes pada intent milik lease aktif; no arbitrary R2 key. Finalize membandingkan Content-Length aktual, checksum dan object ownership sebelum sealed. Complete hanya menerima manifest seluruh sealed parts yang sah dan total bytes/count/schema bounded, kemudian memeriksa hasil. File parsial/attempt lama tidak otomatis menjadi candidate. Semua penyimpanan staging tidak terlihat sebagai agenda aktif.

Policy menetapkan input/result/local-cache/orphan retention secara eksplisit sebelum ada data nyata. Legal hold dan lineage published result mendahului purge; referensi D1/R2 tidak boleh putus. Nonce/pairing expiry dan revoked credential cleanup punya batch batas teknis terpisah. R2 key tidak dikirim ke browser; download mesin privat melalui API terikat lease. Backup wajib mencakup input, result, candidate, publish diff dan lineage; graph dapat dibangun ulang dari extract/checksum tetapi bukan alasan membuang artefak sumber tanpa runbook. Implementasi serta drill nonempty mengikuti WEB-070/074.

## Publikasi agenda atomik

`visit_generator_agenda_epoch` bertambah saat work_plan berubah, termasuk edit manual. Source geography/calendar/assignment/activity epoch dan hash policy/graph ikut diperiksa; tidak bergantung satu epoch yang belum meliputi seluruh sumber. Candidate immutable boleh dibaca historis, tetapi publish memerlukan source/date/scope/agenda terbaru dan tidak ada hard violations. Manual edit route menghasilkan revisi baru melalui recomputation/validation, bukan membetulkan timestamp hasil agent tanpa perhitungan.

Review preview bersifat read-only dan menampilkan create/replace/cancel/preserve beserta alasan dan before/after. Completed, past, locked, agenda di luar scope dan visit dari modul lain dilindungi. Mengganti rute hanya menyentuh slot masa depan yang secara eksplisit dipilih dan sah; original_scheduled_at dan revisions tetap. Stage menyimpan diff/checksum/count immutable dengan expiry; belum menulis work_plan.

Aktivasi menggunakan **satu D1 batch**: compare-and-swap publish version/status + source/agenda/hash guard; verifikasi seluruh staging row/count dan ownership per tanggal; bulk INSERT…SELECT/UPDATE native work_plan, work_plan_revision, generator lineage, audit/idempotency dan status activated. Tidak mempublish lewat loop HTTP per hari. Staging part yang gagal tetap tidak aktif. Semua constraint/expected versions dicek sebelum aktivasi; transaksi gagal tidak meninggalkan setengah agenda. Agenda reads existing tetap membaca work_plan yang sudah committed, sehingga tidak perlu global pointer yang diam-diam menyembunyikan rencana manual.

Target maksimal 600 SQL statements, 6.000 staged items/310 rep-days. Jumlah rows/CPU/bytes dan transactional validation harus diukur WEB-073/074. Bila bound provider tidak cukup, kurangi ukuran model atau rancang versioned activation/read adapter secara eksplisit; jangan mengubah publish menjadi beberapa transaksi dengan klaim atomik. Tidak menulis visit done, GPS, invoice, target, achievement, forecast atau insentif.

## Model fisik dan gate berikutnya

SQL draft 14 tabel diuji **hanya di SQLite in-memory** di atas schema aktual WEB-068. Bukan file migrasi yang otomatis dijalankan. Ini mencakup policy, graph, machine/pairing/credential/replay nonce, job/attempt/artifact/candidate, agenda epoch, publish batch/item dan lineage. Dictionary mencatat columns/FK/index/trigger. Runtime guards dan data-source completeness tetap wajib; DDL saja bukan keamanan lengkap.

21 contract/model tests lulus: no defaults, unit/unknown/cadence, role/environment/proof shape, claim/version/fence, cancel/deadline/retry/revoke, structural candidate checks, SQL tenant references/staging/immutability serta design operations tidak muncul dalam runtime. Kontrak OpenAPI berlabel `proposed-not-registered`; response resource DTO sengaja provisional dan wajib diketik/diverifikasi bersama endpoint saat implementasi. Tidak mengklaim PVG-A01/A03 end-to-end atau solver/OSRM acceptance.

WEB-070 berikutnya: pemeriksaan perangkat dan operator/area pilot, package versions, native/WSL/Docker feasibility, agent pairing/PoP/lease runtime, graph kecil dengan rights/profile, matrix fixture dan restore. WEB-071 solver harian + server candidate validation; WEB-072 bulanan/multi-sales; WEB-073 UI/review/publish atomik; WEB-074 failure/recovery/capacity/runbook/operator acceptance. Gate cloud/human/source nyata tetap terpisah dari keberhasilan desain lokal ini.

## Penyempurnaan saat persiapan WEB-070

Kontrak desain kini mencakup 37 operasi: bootstrap signed nonce diberi endpoint eksplisit `/api/visit-agent/nonces`. Proof nonce_request tidak memakai server nonce sebelumnya; signature/current credential/jti single-use membatasi bootstrap, lalu challenge berikutnya mengikat target exact method/origin/path/query/body/idempotency/generation. Challenge dan proof-jti disimpan hashed dalam model draft yang sama dan consume/revocation race diuji di SQLite. Tidak ada endpoint ini diregistrasikan.

Protected native agenda kini membekukan `scheduled_at`–`reserved_until` dan reservation_basis eksplisit; travel, layanan dan perjalanan pulang tidak boleh menabraknya. Slot manual 30 menit existing hanya dapat digunakan jika policy legacy-slot secara eksplisit direview, bukan default durasi layanan yang tersembunyi. Kebutuhan interval tidak diketahui harus diperbaiki sebelum publish.
