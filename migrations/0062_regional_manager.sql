-- Regional Manager is a dated, area-scoped role; preserve existing role history and guards.
CREATE TABLE regional_role_backup AS SELECT * FROM auth_role_assignment;
DROP TRIGGER role_no_overlap_insert;
DROP TRIGGER role_no_overlap_update;
DROP TRIGGER hierarchy_parent_guard;
DROP TRIGGER finance_epoch_auth_role_assignment_insert;
DROP TRIGGER finance_epoch_auth_role_assignment_update;
DROP TRIGGER finance_epoch_auth_role_assignment_delete;
DROP TRIGGER geo_epoch_auth_role_assignment_insert;
DROP TRIGGER geo_epoch_auth_role_assignment_update;
DROP TRIGGER geo_epoch_auth_role_assignment_delete;
DROP TRIGGER visit_input_auth_role_assignment_insert;
DROP TRIGGER visit_input_auth_role_assignment_update;
DROP TRIGGER visit_input_auth_role_assignment_delete;
DROP TABLE auth_role_assignment;
CREATE TABLE auth_role_assignment (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,user_id TEXT NOT NULL,
 role_code TEXT NOT NULL CHECK(role_code IN ('MANAGEMENT','NSM','REGIONAL_MANAGER','AREA_MANAGER','SUPERVISOR','SALES_REP','TELESALES')),
 effective_from_date TEXT NOT NULL,effective_to_date TEXT, channel TEXT CHECK(channel IN ('field','telesales')),
 FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
INSERT INTO auth_role_assignment SELECT * FROM regional_role_backup;
DROP TABLE regional_role_backup;
CREATE TRIGGER role_no_overlap_insert BEFORE INSERT ON auth_role_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=NEW.organization_id AND r.user_id=NEW.user_id AND r.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(r.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ROLE_OVERLAP') END;
END;
CREATE TRIGGER role_no_overlap_update BEFORE UPDATE ON auth_role_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.id<>NEW.id AND r.organization_id=NEW.organization_id AND r.user_id=NEW.user_id AND r.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(r.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ROLE_OVERLAP') END;
END;
CREATE TRIGGER hierarchy_parent_guard BEFORE INSERT ON reporting_assignment BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM app_user WHERE organization_id=NEW.organization_id AND id=NEW.manager_id AND status='active') THEN RAISE(ABORT,'MANAGER_INACTIVE') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM auth_role_assignment sr JOIN auth_role_assignment mr ON sr.organization_id=mr.organization_id
  WHERE sr.organization_id=NEW.organization_id AND sr.user_id=NEW.subordinate_id AND mr.user_id=NEW.manager_id
  AND sr.effective_from_date<=NEW.effective_from_date AND mr.effective_from_date<=NEW.effective_from_date
  AND (sr.effective_to_date IS NULL OR (NEW.effective_to_date IS NOT NULL AND sr.effective_to_date>=NEW.effective_to_date))
  AND (mr.effective_to_date IS NULL OR (NEW.effective_to_date IS NOT NULL AND mr.effective_to_date>=NEW.effective_to_date))
  AND (sr.channel IS NULL OR sr.channel=NEW.channel) AND (mr.channel IS NULL OR mr.channel=NEW.channel)
  AND ((sr.role_code IN ('SALES_REP','TELESALES') AND mr.role_code='SUPERVISOR') OR (sr.role_code='SUPERVISOR' AND mr.role_code='AREA_MANAGER') OR (sr.role_code='AREA_MANAGER' AND mr.role_code IN ('REGIONAL_MANAGER','NSM','MANAGEMENT')) OR (sr.role_code='REGIONAL_MANAGER' AND mr.role_code='MANAGEMENT') OR (sr.role_code='NSM' AND mr.role_code='MANAGEMENT'))
 ) THEN RAISE(ABORT,'INVALID_REPORTING_ROLES') END;
END;
CREATE TRIGGER finance_epoch_auth_role_assignment_insert AFTER INSERT ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER finance_epoch_auth_role_assignment_update AFTER UPDATE ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER finance_epoch_auth_role_assignment_delete AFTER DELETE ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER geo_epoch_auth_role_assignment_insert AFTER INSERT ON auth_role_assignment BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER geo_epoch_auth_role_assignment_update AFTER UPDATE ON auth_role_assignment BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER geo_epoch_auth_role_assignment_delete AFTER DELETE ON auth_role_assignment BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER visit_input_auth_role_assignment_insert AFTER INSERT ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_auth_role_assignment_update AFTER UPDATE ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_auth_role_assignment_delete AFTER DELETE ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
