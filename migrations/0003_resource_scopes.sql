CREATE UNIQUE INDEX IF NOT EXISTS idx_area_org_id ON area(organization_id,id);
CREATE TABLE user_area_scope (
 organization_id TEXT NOT NULL,user_id TEXT NOT NULL,area_id TEXT NOT NULL,
 effective_from_date TEXT NOT NULL,effective_to_date TEXT,
 PRIMARY KEY(organization_id,user_id,area_id,effective_from_date),
 FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,area_id) REFERENCES area(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
CREATE TABLE reporting_assignment (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,subordinate_id TEXT NOT NULL,manager_id TEXT NOT NULL,area_id TEXT NOT NULL,
 effective_from_date TEXT NOT NULL,effective_to_date TEXT,
 FOREIGN KEY(organization_id,subordinate_id) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,manager_id) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,area_id) REFERENCES area(organization_id,id),
 CHECK(subordinate_id<>manager_id),CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
CREATE TABLE sales_last_position (
 organization_id TEXT NOT NULL,user_id TEXT NOT NULL,latitude_e7 INTEGER NOT NULL,longitude_e7 INTEGER NOT NULL,
 captured_at TEXT NOT NULL,source TEXT NOT NULL,accuracy_m INTEGER,
 PRIMARY KEY(organization_id,user_id),FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id),
 CHECK(latitude_e7 BETWEEN -900000000 AND 900000000),CHECK(longitude_e7 BETWEEN -1800000000 AND 1800000000)
);
