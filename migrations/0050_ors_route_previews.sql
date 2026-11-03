-- Routing previews only: no writes or triggers to work_plan, visits or invoices.
CREATE TABLE visit_ors_preview (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organization(id),
 actor_id TEXT NOT NULL,
 preflight_id TEXT NOT NULL,
 idempotency_key TEXT NOT NULL,
 input_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','complete','failed')),
 storage_key TEXT,
 result_sha256 TEXT,
 error_code TEXT,
 UNIQUE(organization_id,actor_id,idempotency_key)
);
CREATE INDEX visit_ors_daily_budget ON visit_ors_preview(created_at,status);
CREATE INDEX visit_ors_org_history ON visit_ors_preview(organization_id,created_at DESC,id);
