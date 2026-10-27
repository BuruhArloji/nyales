CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_subject_unique ON app_user(auth_subject) WHERE auth_subject IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_org_identity ON app_user(organization_id,id);
CREATE TABLE IF NOT EXISTS auth_role_assignment (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,user_id TEXT NOT NULL,
 role_code TEXT NOT NULL CHECK(role_code IN ('MANAGEMENT','NSM','AREA_MANAGER','SUPERVISOR','SALES_REP','TELESALES')),
 effective_from_date TEXT NOT NULL,effective_to_date TEXT,
 FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
