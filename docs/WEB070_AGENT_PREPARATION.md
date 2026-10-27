> Keputusan26 Oktober2026: pengguna tidak mempunyai admin; routing memakai komputer lain, tidak memasang WSL/Docker pada laptop ini. OR-Tools nyata sudah dipasang pada venv lokal tanpa perubahan Python global. [Paket host](../tools/visit-compute-kit/README.md), [daily kernel](WEB071_DAILY_KERNEL.md), [progres terbaru](WEB070_PROGRESS.json).

> Pembaruan 25 Oktober 2026: identitas runtime, pairing, vault Windows, heartbeat dan revoke sudah tersedia/teruji lokal melalui migrasi 0042 dan sembilan endpoint. [Runbook aktual](WEB070_AGENT_IDENTITY.md), [status terbaru](WEB070_PROGRESS.json). Bagian 24 Oktober berikut adalah histori prototipe; pernyataan belum ada pairing/route/migrasi hanya berlaku pada tanggal tersebut. Queue/graph/OSRM/solver tetap pending.

# WEB-070 — persiapan agent komputer pribadi

24 Oktober 2026. **In progress, prototipe teruji; agent/OSRM runtime belum dipasang.** WEB-069 menyediakan desain, validator dan model in-memory. Belum ada pairing nyata, mesin terdaftar, graph OSM diunduh, daemon polling, solver atau rute pelanggan nyata. Tidak menambah endpoint/migrasi runtime; NYALES tetap 276 operasi dan 100 tabel lokal. [Bukti progres](WEB070_PROGRESS.json).

## Kondisi perangkat yang diperiksa

Windows 11 Pro 64-bit, Intel Core i7-1355U, 10 core/12 thread, RAM total sekitar 15,7 GiB. Sampel awal mencatat RAM available 6,9 GiB dan free drive C 21,3 GiB; angka available berubah selama aplikasi lain berjalan. `wsl.exe` tersedia tetapi WSL belum terpasang; Docker CLI/daemon tidak tersedia; Python 3.13 ditemukan namun OR-Tools belum terpasang. Node 24.18.0 sudah tersedia. Tidak memasang OS feature, container/runtime, Python package atau data jalan pada langkah ini.

Doctor dapat diulang: `node node_modules/tsx/dist/cli.mjs scripts/visit-agent-doctor.ts <file-bukti-baru.json>`. Hanya membaca runtime/hardware/tool status dan kapasitas workspace disk; tidak mengumpulkan hostname/user identity, mengirim data jaringan, menyalakan service atau memasang dependency. Output tidak boleh menimpa bukti lama. Ambang review 30 GiB disk dan 8 GiB RAM available hanyalah pengingat teknis, bukan minimum resmi OSRM atau jaminan feasible. Profil/wilayah extract, kebutuhan ruang preprocess sementara dan waktu proses perlu benchmark nyata.

Sebelum install/preprocess: pilih area pilot yang kecil dan jalan penghubung, operator/penyimpanan graph, profil kendaraan yang tervalidasi, versi/image digest OSRM dan cara menjalankan Linux pada Windows. Instalasi WSL/Docker dapat membutuhkan hak admin, restart, download besar dan pengecekan lisensi penggunaan tool; belum dilakukan. Runtime Docker/Linux dan solver dipasang setelah pilihan konkret tersebut tersedia. Jangan memuat seluruh Indonesia atau menyebut total biaya nol dari hasil doctor.

## Kernel autentikasi dan replay

`src/shared/visit-agent-proof.ts` membuat/memverifikasi compact proof ES256 dengan key P-256. Key private agent harus nonextractable dalam prototype transport. Proof mengikat organisasi, environment, agent, credential generation, method, exact origin/path/query, exact body SHA-256, idempotency key, credential hash, purpose, nonce, jti dan masa berlaku. Server/client clock berbeda lebih dari jendela yang disetujui menghasilkan error; tidak otomatis mengabaikan clock check. Public JWK dibatasi hanya kty/crv/x/y; private d tidak diterima.

Bootstrap nonce ditetapkan eksplisit pada kontrak desain: signed `nonce_request` ke `/api/visit-agent/nonces`, nonce=null, body berisi target method/path/body hash/idempotency. Signature dan credential diverifikasi sebelum D1 mengonsumsi jti bootstrap dan membuat challenge berumur 120 detik dalam satu batch. Challenge menyimpan digest, generation dan target hash; token mentah hanya dikembalikan sekali. Target selain machine prefix, target lintas origin atau nonce endpoint berulang ditolak.

Permintaan normal memakai signed `request` dan nonce tersebut. `src/server/visit-agent-replay.ts` membuktikan transaksi D1 prototype: consume challenge yang belum dipakai/belum kedaluwarsa, insert unique proof-jti, dan credential/agent current-generation/expiry/revocation recheck. Konflik/duplicate jti rollback seluruh batch, sehingga challenge yang sebetulnya sah tidak habis tanpa operasi. Race revoke antara verifikasi signature dan consume ditolak oleh DB guard. Store ini hanya dijalankan dalam test schema draft; belum ada gate mesin pada server aplikasi.

`src/agent/transport.ts` merupakan transport dalam memory: signed nonce bootstrap → signed exact request, HTTPS origin tetap (HTTP hanya explicit loopback local), redirect tidak diikuti, body/response bytes dan timeout terbatas, cancellation diteruskan. Retry memakai idempotency key yang sama dengan nonce/jti/signature baru. Error HTTP tidak menyalin body atau secret ke exception. Secret/private key tidak diserialisasi oleh object. Pengujian loopback HTTP nyata memakai synthetic credential dan SQLite in-memory; membuktikan retry satu operasi serta revoke, bukan pairing/deployment nyata.

Credential provisioning, one-time pairing PoP, secure persistence Windows, credential rotation/revoke route, rate limiting, clock bootstrap dari server, session-independent machine middleware dan queue claim DB runtime masih harus dibangun sebelum agent dapat dipakai dengan data nyata. Jangan menyimpan credential/key plaintext di JSON/repo/log atau memakai bearer Management. Hash/PoP tidak menggantikan TLS, least privilege, runtime guard atau review keamanan.

## Graph dan adaptor OSRM

`src/agent/graph-installation.ts` memverifikasi manifest operator-owned: satu extract, satu Lua profile dan file graph, file path relatif terbatas, tidak menerima traversal/ADS/symlink, streaming hash/ukuran dan perubahan file, extract digest serta canonical content-manifest hash. Tidak mengambil path/URL dari job. Hasil membedakan “file terverifikasi” dari “proses OSRM benar-benar memuat file ini”. Registry/launcher runtime perlu mengikat proses, local port, profile dan versi graph ke manifest terverifikasi. Belum ada binary/graph nyata pada pengujian ini.

`src/agent/osrm-client.ts` hanya menghubungi HTTP loopback IP dengan port eksplisit; public OSRM demo tidak dipakai dan redirect ditolak. Request table meminta duration/distance, radius snap per node, tanpa fallback_speed. Parser menjaga matrix asymmetric dan unreachable null, ukuran/dimensi/finite values/diagonal, waypoint order dan jarak snap. Koordinat di luar bbox source ditolak sebelum request; bbox saja bukan bukti graph connectivity. Snap displacement geodesik hanya dipakai untuk kualitas snap, tidak pernah dijadikan waktu jalan. Durasi/jarak dibulatkan ke atas ke integer detik/meter untuk kontrak solver. Cache key mengikat graph digest, engine/profile version, routing profile, node/order/coordinates dan snap policy.

Perilaku table seconds/metres, null unreachable, profile preprocessing dan fallback mengikuti [dokumentasi resmi OSRM](https://project-osrm.org/docs/v5.24.0/api/). Profil `driving` pada URL tidak membuktikan graph motor; installation manifest/launcher harus membuktikan Lua profile dan versi sebenarnya. Node crypto memakai API yang diuji pada runtime lokal; [referensi Web Crypto Node](https://nodejs.org/api/webcrypto.html) dipakai untuk sign/verify P-256. Tidak memilih versi OSRM/image tag terbaru dari nama dokumentasi ini.

Parser/fetcher diuji dengan fixture sintetis, abort, response besar, server error 400 NoSegment/NoTable, malformed data dan kebutuhan cache. Ini belum menguji one-way/bridge/ferry/snap/geometry pada OSRM engine nyata. Tidak ada klaim benchmark, routing accuracy atau provider capacity dari fixture.

## Tahap berikutnya

1. Runtime mesin: pairing proof/credential storage aman, gate dan registrasi server, revoke/rotation/rate-limit, machine nonce/replay schema migration serta backup/restore yang tidak membocorkan credential.
2. DB queue claim/renew/attempt/fence/reap/cancel/checkpoint, agent polling/backoff/heartbeat, typed implementation response contracts dan role/environment regression.
3. Install Linux/container OSRM versi/digest yang dipilih; extract area pilot dengan hak penggunaan/atribusi, preprocess/launcher terikat manifest, local snap/table/route fixture dan benchmark CPU/RAM/disk.
4. Setelah itu solver harian WEB-071, bulanan WEB-072, UI/review/publish WEB-073 dan failure/capacity/operasi WEB-074.

Seluruh keberhasilan kernel dilaporkan sebagai partial WEB-070. Tidak membuka port publik, mempublish agenda, mengubah assignment, menghubungi pelanggan atau mengklaim Plan Visit Generator sudah beroperasi.
