CREATE UNIQUE INDEX daily_plan_org_id ON work_plan(organization_id,id);
CREATE TABLE daily_visit_policy(
 organization_id TEXT PRIMARY KEY REFERENCES organization(id),version INTEGER NOT NULL DEFAULT 1,
 config_json TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,updated_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE daily_visit_run(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,actor_id TEXT NOT NULL,rep_id TEXT NOT NULL,
 service_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('pending','complete','failed','applied','superseded')),
 idempotency_key TEXT NOT NULL,input_sha256 TEXT NOT NULL,policy_version INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,storage_key TEXT,result_sha256 TEXT,error_code TEXT,
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL,applied_at TEXT,
 UNIQUE(organization_id,id),UNIQUE(organization_id,actor_id,idempotency_key),
 FOREIGN KEY(organization_id,actor_id) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,rep_id) REFERENCES app_user(organization_id,id)
);
CREATE INDEX daily_visit_run_owner ON daily_visit_run(organization_id,rep_id,service_date,created_at DESC);
CREATE INDEX daily_visit_run_budget ON daily_visit_run(organization_id,created_at,status);
CREATE TABLE daily_visit_plan_link(
 organization_id TEXT NOT NULL,run_id TEXT NOT NULL,work_plan_id TEXT NOT NULL,sequence INTEGER NOT NULL,
 service_seconds INTEGER NOT NULL,
 PRIMARY KEY(organization_id,run_id,work_plan_id),
 FOREIGN KEY(organization_id,run_id) REFERENCES daily_visit_run(organization_id,id),
 FOREIGN KEY(organization_id,work_plan_id) REFERENCES work_plan(organization_id,id)
);
