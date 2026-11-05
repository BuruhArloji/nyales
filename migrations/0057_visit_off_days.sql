CREATE TABLE visit_off_day (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
 service_date TEXT NOT NULL, reason_code TEXT NOT NULL CHECK(reason_code IN('annual_leave','sick','permit','training','other','alpha')),
 reason TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN('pending','approved','rejected','cancelled')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 reviewed_by TEXT, reviewed_at TEXT, review_reason TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id)
);
CREATE UNIQUE INDEX visit_off_one_day ON visit_off_day(organization_id,user_id,service_date) WHERE status IN('pending','approved');
CREATE INDEX visit_off_date ON visit_off_day(organization_id,service_date,user_id,status);
CREATE INDEX visit_off_user ON visit_off_day(organization_id,user_id,service_date,status);
CREATE INDEX activity_visit_recap ON activity(organization_id,user_id,channel,activity_kind,occurred_at,status,outlet_id);

CREATE TRIGGER visit_off_epoch_insert AFTER INSERT ON visit_off_day BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER visit_off_epoch_update AFTER UPDATE ON visit_off_day BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER visit_off_epoch_delete AFTER DELETE ON visit_off_day BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id; END;
