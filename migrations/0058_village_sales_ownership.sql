-- Whole-village field ownership is effective dated; legacy history is retained.
CREATE TABLE village_sales_owner(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,admin_unit_id TEXT NOT NULL,
 area_id TEXT NOT NULL,rep_id TEXT NOT NULL,effective_from_date TEXT NOT NULL,effective_to_date TEXT,
 reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,admin_unit_id) REFERENCES admin_unit(organization_id,id),
 FOREIGN KEY(organization_id,area_id) REFERENCES area(organization_id,id),
 FOREIGN KEY(organization_id,rep_id) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
CREATE INDEX village_owner_period ON village_sales_owner(organization_id,admin_unit_id,effective_from_date,effective_to_date);
CREATE INDEX village_owner_rep ON village_sales_owner(organization_id,rep_id,effective_from_date,effective_to_date);
CREATE INDEX customer_admin_boundary_current ON customer_admin_location(organization_id,boundary_id,status,superseded_at,effective_from_date,effective_to_date);
CREATE TRIGGER village_owner_overlap BEFORE INSERT ON village_sales_owner BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_unit WHERE organization_id=NEW.organization_id AND id=NEW.admin_unit_id AND level='village' AND status='active') THEN RAISE(ABORT,'VILLAGE_REQUIRED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM village_sales_owner v WHERE v.organization_id=NEW.organization_id AND v.admin_unit_id=NEW.admin_unit_id AND v.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(v.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'VILLAGE_OWNER_OVERLAP') END;
END;
CREATE TRIGGER village_owner_history BEFORE UPDATE ON village_sales_owner WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.admin_unit_id IS NOT OLD.admin_unit_id OR NEW.area_id IS NOT OLD.area_id OR NEW.rep_id IS NOT OLD.rep_id OR NEW.effective_from_date IS NOT OLD.effective_from_date OR NEW.reason IS NOT OLD.reason OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR OLD.effective_to_date IS NOT NULL BEGIN SELECT RAISE(ABORT,'VILLAGE_OWNER_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER village_owner_no_delete BEFORE DELETE ON village_sales_owner BEGIN SELECT RAISE(ABORT,'VILLAGE_OWNER_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER village_owner_epoch_insert AFTER INSERT ON village_sales_owner BEGIN INSERT INTO geo_distribution_epoch VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER village_owner_epoch_update AFTER UPDATE ON village_sales_owner BEGIN INSERT INTO geo_distribution_epoch VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
-- Existing per-customer workflows cannot split a managed village between reps.
CREATE TRIGGER village_field_assignment_insert BEFORE INSERT ON customer_assignment WHEN NEW.channel='field' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_admin_location l JOIN village_sales_owner v ON v.organization_id=l.organization_id AND v.admin_unit_id=l.admin_unit_id WHERE l.organization_id=NEW.organization_id AND l.outlet_id=NEW.outlet_id AND l.status='confirmed' AND l.superseded_at IS NULL AND l.effective_from_date<=NEW.effective_from_date AND(l.effective_to_date IS NULL OR l.effective_to_date>NEW.effective_from_date) AND v.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(v.effective_to_date,'9999-12-31') AND(v.rep_id IS NOT NEW.rep_id OR v.area_id IS NOT NEW.area_id)) THEN RAISE(ABORT,'VILLAGE_OWNER_REQUIRED') END;
END;
CREATE TRIGGER village_field_assignment_close BEFORE UPDATE OF effective_to_date ON customer_assignment WHEN OLD.channel='field' AND NEW.effective_to_date IS NOT NULL AND NEW.effective_to_date IS NOT OLD.effective_to_date BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_admin_location l JOIN village_sales_owner v ON v.organization_id=l.organization_id AND v.admin_unit_id=l.admin_unit_id WHERE l.organization_id=OLD.organization_id AND l.outlet_id=OLD.outlet_id AND l.status='confirmed' AND l.superseded_at IS NULL AND v.rep_id=OLD.rep_id AND v.area_id=OLD.area_id AND v.effective_from_date<=NEW.effective_to_date AND(v.effective_to_date IS NULL OR v.effective_to_date>NEW.effective_to_date)) THEN RAISE(ABORT,'VILLAGE_OWNER_REQUIRED') END;
END;
CREATE TRIGGER village_membership_owner_guard BEFORE INSERT ON area_admin_membership BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM village_sales_owner v WHERE v.organization_id=NEW.organization_id AND v.admin_unit_id=NEW.admin_unit_id AND v.area_id<>NEW.area_id AND v.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(v.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'VILLAGE_OWNER_REQUIRED') END;
END;

-- Equivalent canonical-family overlap protection using existing outlet/family indexes.
DROP TRIGGER customer_assignment_insert_guard;
CREATE TRIGGER customer_assignment_insert_guard BEFORE INSERT ON customer_assignment BEGIN
 SELECT CASE WHEN NEW.effective_to_date IS NOT NULL AND NEW.effective_to_date<=NEW.effective_from_date THEN RAISE(ABORT,'INVALID_ASSIGNMENT_INTERVAL') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.outlet_id) OR (NEW.rep_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app_user WHERE organization_id=NEW.organization_id AND id=NEW.rep_id)) THEN RAISE(ABORT,'ASSIGNMENT_TENANT_MISMATCH') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_assignment a WHERE a.organization_id=NEW.organization_id AND a.id<>NEW.id AND a.outlet_id IN(SELECT COALESCE(n.merged_into_id,n.id) FROM customer_outlet n WHERE n.organization_id=NEW.organization_id AND n.id=NEW.outlet_id UNION SELECT f.id FROM customer_outlet f WHERE f.organization_id=NEW.organization_id AND f.merged_into_id=(SELECT COALESCE(n.merged_into_id,n.id) FROM customer_outlet n WHERE n.organization_id=NEW.organization_id AND n.id=NEW.outlet_id)) AND a.channel=NEW.channel AND a.rep_id IS NOT NULL AND NEW.rep_id IS NOT NULL AND a.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(a.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'CUSTOMER_OWNER_OVERLAP') END;
END;

-- Mapping review must not silently move a customer under another village owner.
-- Existing matching assignment intervals must cover every intersecting ownership interval.
CREATE TRIGGER village_mapping_assignment_guard BEFORE INSERT ON customer_admin_location
WHEN NEW.status='confirmed' AND NEW.superseded_at IS NULL BEGIN
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM village_sales_owner v
  WHERE v.organization_id=NEW.organization_id AND v.admin_unit_id=NEW.admin_unit_id
   AND v.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31')
   AND NEW.effective_from_date<COALESCE(v.effective_to_date,'9999-12-31')
   AND NOT EXISTS(SELECT 1 FROM customer_assignment a
    WHERE a.organization_id=NEW.organization_id AND a.outlet_id=NEW.outlet_id
     AND a.channel='field' AND a.rep_id=v.rep_id AND a.area_id=v.area_id
     AND a.effective_from_date<=MAX(v.effective_from_date,NEW.effective_from_date)
     AND COALESCE(a.effective_to_date,'9999-12-31')>=MIN(COALESCE(v.effective_to_date,'9999-12-31'),COALESCE(NEW.effective_to_date,'9999-12-31')))
 ) THEN RAISE(ABORT,'VILLAGE_OWNER_REQUIRED') END;
END;
