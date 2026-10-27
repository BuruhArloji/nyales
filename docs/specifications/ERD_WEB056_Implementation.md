# ERD implementasi WEB-056 lokal

Migrasi0033 menambah4 tabel, tanpa mengubah struktur customer/invoice/target.

| Tabel | Kunci dan hubungan logis |
|---|---|
| ops_hourly |PK organization_id,bucket,kind,operation,outcome; counter per jam UTC; operasi adalah route template/job/event, tanpa resource ID customer |
| ops_policy |PK organization_id; owner_user_id mengacu user Management/NSM aktif dalam organisasi melalui validasi API; version dan audit |
| ops_usage_snapshot |PK id; organization_id,metric,window_key,sampled_at; manual_provider_dashboard; immutable via API |
| ops_budget_alert |PK organization_id,metric,window_key,threshold; snapshot_id dan owner_user_id; insert-only threshold ledger; notifikasi in_app_notification dalam transaksi yang sama |

Logika API memvalidasi organisasi/owner/scope, karena tabel ops tidak memiliki FK baru ke data bisnis yang akan menghambat telemetri saat tenant/owner berubah. Snapshot dan alert tetap private menurut organisasi. Retensi serta lifecycle tenant menjadi bagian WEB057. Index ops_usage_latest mencakup organisasi/resource/window/waktu; index aktivitas periode ekspresi, aktivitas review, import review, attachment pending mempercepat pengukuran tanpa menghapus histori.
