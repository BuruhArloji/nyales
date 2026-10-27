# WEB-062 — gate pemeriksaan rilis pilot

28 Oktober 2026. Script `scripts/pilot-release-gate.ts` membaca evidence lokal dan memberi keputusan **blocked** sampai gate manusia/provider selesai. Script hanya membaca JSON; tidak mengubah D1, R2, agenda, customer, invoice atau status produksi.

## Lulus secara lokal

- Regresi penuh: 319 test, tanpa gagal/skip. Typecheck dan production build lulus; warning bundle besar tetap ada.
- Recovery object drill: 3 browser scenario lulus; satu lampiran pilot 73 byte cocok checksum.
- Row bisnis yang sudah ada tetap sama.

## Blocker yang masih terbuka

- UAT bernama untuk Management/NSM, Area Manager, Supervisor, Sales Rep dan Telesales.
- Migrasi data nyata dan rekonsiliasi sumber.
- Restore cloud/provider, durability, RPO/RTO dan kapasitas provider.
- Training dan handover support yang ditandatangani.
- Approval go-live produksi.

Output mesin: [WEB062_RELEASE_GATE.json](WEB062_RELEASE_GATE.json). Keputusan `blocked` adalah hasil pemeriksaan bukti saat ini, bukan penolakan permanen. Ketika gate manusia/provider sudah dijalankan, script dapat diulang dengan evidence terbaru.
