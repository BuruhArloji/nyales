# ERD implementasi lokal M2

18 Oktober 2026. Delta terhadap ERD produk v1.2. DDL aktual ada pada migrations 0018–0030, bukan klaim semua entitas rancangan telah dibangun. [Inventaris fisik JSON](ERD_M2_Implementation.json) dibuat dengan mengeksekusi seluruh migrasi pada SQLite kosong, lalu membaca kolom, indeks dan foreign key. Tabel yang sudah ada dan diubah M2: target_plan, target_item, activity.

```mermaid
erDiagram
  CUSTOMER_OUTLET ||--o{ CUSTOMER_STATUS_SNAPSHOT : status
  CUSTOMER_SEGMENTATION_RUN ||--o{ CUSTOMER_STATUS_SNAPSHOT : freezes
  CUSTOMER_TIER_RULE ||--o{ CUSTOMER_STATUS_SNAPSHOT : version
  TARGET_PLAN ||--o{ TARGET_VERSION : revisions
  TARGET_VERSION ||--o{ TARGET_ITEM : leaf
  CUSTOMER_OUTLET ||--o{ WORK_PLAN : agenda
  APP_USER ||--o{ WORK_SESSION : attendance
  ACTIVITY ||--o{ VISIT_EVENT : immutable
  ACTIVITY ||--o{ EVIDENCE_ATTACHMENT : private
  CUSTOMER_OUTLET ||--o{ SALES_TASK : next_action
  CUSTOMER_OUTLET ||--o{ SALES_HANDOFF : cross_channel
  SALES_CAMPAIGN ||--o{ SALES_SCRIPT : guidance
  SALES_SCRIPT ||--o{ TELESALES_LEASE : snapshot
  TELESALES_LEASE ||--o| CALL_RESULT : disposition
  CUSTOMER_OUTLET ||--o{ SALES_LEAD : opportunity
  CUSTOMER_OUTLET ||--o{ SALES_ORDER : draft
  SALES_ORDER ||--o{ SALES_ORDER_REVISION : immutable
  CUSTOMER_OUTLET ||--o{ FORECAST_CONTRIBUTION : basket
  FORECAST_CONTRIBUTION ||--o{ FORECAST_REALIZATION : attribution
  INVOICE ||--o{ FORECAST_REALIZATION : logical_identity
```

Graf menunjukkan relasi logis, bukan jaminan seluruh garis mempunyai constraint FK fisik. Setiap query memakai organization_id serta scope. Relasi invoice mengikuti identitas sumber dan revisi current, sehingga revisi/retur tidak menggandakan actual. Tabel snapshot dan event mempunyai trigger immutable.

Target menyimpan leaf pelanggan ATAU sales rep, basis revenue/produk/group, snapshot area/rep/kanal/hirarki. Parent dan reserve bukan tambahan leaf actual. Satu plan approved per kanal pada periode beririsan merupakan batas pilot.

Forecast sales dan alternatif manager adalah dua pandangan terpisah. Satu basket aktif per customer/kanal/view/bulan. Omitted membebaskan basket; merge/revisi invoice yang ambigu menahan angka untuk review. Confirmed order belum menjadi invoice.

Script pada lease dan hasil panggilan dibekukan dengan versinya. Mutasi script berikutnya tidak mengubah qualification pada lease aktif. Evidence hanya metadata di D1; byte disimpan di R2 privat, melalui API autentikasi.

Tidak ada relasi Account bisnis/legal. Alias pelanggan dan seluruh fakta keuangan lama dipertahankan. Android/GPS background dan tabel finalisasi insentif tidak termasuk slice M2 ini.
