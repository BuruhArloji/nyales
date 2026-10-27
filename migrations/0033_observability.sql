CREATE TABLE ops_hourly (
 organization_id TEXT NOT NULL, bucket TEXT NOT NULL, kind TEXT NOT NULL,
 operation TEXT NOT NULL, outcome TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0, wall_ms REAL NOT NULL DEFAULT 0, max_wall_ms REAL NOT NULL DEFAULT 0,
 db_statements INTEGER NOT NULL DEFAULT 0, db_meta_samples INTEGER NOT NULL DEFAULT 0,
 rows_read INTEGER NOT NULL DEFAULT 0, rows_written INTEGER NOT NULL DEFAULT 0,
 r2_a INTEGER NOT NULL DEFAULT 0, r2_b INTEGER NOT NULL DEFAULT 0, r2_deletes INTEGER NOT NULL DEFAULT 0,
 sync_accepted INTEGER NOT NULL DEFAULT 0, sync_review INTEGER NOT NULL DEFAULT 0, sync_rejected INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(organization_id,bucket,kind,operation,outcome)
);
CREATE TABLE ops_policy (
 organization_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL,
 pilot_reps INTEGER NOT NULL, pilot_customers INTEGER NOT NULL, pilot_invoices_month INTEGER NOT NULL,
 concurrent_users INTEGER NOT NULL, api_requests_day INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE ops_usage_snapshot (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, metric TEXT NOT NULL,
 window_key TEXT NOT NULL, value REAL NOT NULL CHECK(value>=0), sampled_at TEXT NOT NULL,
 created_at TEXT NOT NULL, created_by TEXT NOT NULL, source TEXT NOT NULL CHECK(source='manual_provider_dashboard'), reason TEXT NOT NULL
);
CREATE INDEX ops_usage_latest ON ops_usage_snapshot(organization_id,metric,window_key,sampled_at DESC,created_at DESC);
CREATE TABLE ops_budget_alert (
 organization_id TEXT NOT NULL, metric TEXT NOT NULL, window_key TEXT NOT NULL,
 threshold INTEGER NOT NULL CHECK(threshold IN(70,85,95)), snapshot_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,metric,window_key,threshold)
);

CREATE INDEX ops_activity_review ON activity(organization_id,status);
CREATE INDEX ops_activity_period ON activity(organization_id,substr(occurred_at,1,10));
CREATE INDEX ops_invoice_import_review ON invoice_import_job(organization_id,status);
CREATE INDEX ops_attachment_pending ON evidence_attachment(organization_id,status);
