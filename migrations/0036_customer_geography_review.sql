ALTER TABLE customer_admin_location ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customer_admin_location ADD COLUMN superseded_at TEXT;
ALTER TABLE customer_admin_location ADD COLUMN created_at TEXT;
DROP TRIGGER customer_admin_update_guard;
UPDATE customer_admin_location SET revision=(SELECT COUNT(*) FROM customer_admin_location p WHERE p.organization_id=customer_admin_location.organization_id AND p.outlet_id=customer_admin_location.outlet_id AND (p.effective_from_date<customer_admin_location.effective_from_date OR (p.effective_from_date=customer_admin_location.effective_from_date AND p.id<=customer_admin_location.id)));
CREATE UNIQUE INDEX customer_admin_revision ON customer_admin_location(organization_id,outlet_id,revision);
CREATE INDEX customer_admin_current ON customer_admin_location(organization_id,outlet_id,superseded_at,effective_from_date,effective_to_date);
DROP TRIGGER customer_admin_insert_guard;
CREATE TRIGGER customer_admin_insert_guard BEFORE INSERT ON customer_admin_location BEGIN
 SELECT CASE WHEN NEW.admin_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admin_unit u WHERE u.organization_id=NEW.organization_id AND u.id=NEW.admin_unit_id AND u.level='village') THEN RAISE(ABORT,'CUSTOMER_ADMIN_UNIT_INVALID') END;
 SELECT CASE WHEN (NEW.boundary_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admin_boundary b WHERE b.organization_id=NEW.organization_id AND b.id=NEW.boundary_id AND b.admin_unit_id=NEW.admin_unit_id)) OR (NEW.superseded_at IS NOT NULL) OR (NEW.status='confirmed' AND EXISTS(SELECT 1 FROM customer_admin_location x WHERE x.organization_id=NEW.organization_id AND x.outlet_id=NEW.outlet_id AND x.status='confirmed' AND x.superseded_at IS NULL AND x.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(x.effective_to_date,'9999-12-31'))) THEN RAISE(ABORT,'CUSTOMER_ADMIN_CONFLICT') END;
END;
CREATE TRIGGER customer_admin_update_guard BEFORE UPDATE ON customer_admin_location BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.outlet_id IS NOT OLD.outlet_id OR NEW.admin_unit_id IS NOT OLD.admin_unit_id OR NEW.boundary_id IS NOT OLD.boundary_id OR NEW.method IS NOT OLD.method OR NEW.status IS NOT OLD.status OR NEW.evidence_json IS NOT OLD.evidence_json OR NEW.effective_from_date IS NOT OLD.effective_from_date OR NEW.reviewed_by IS NOT OLD.reviewed_by OR NEW.reviewed_at IS NOT OLD.reviewed_at OR NEW.reason IS NOT OLD.reason OR NEW.revision IS NOT OLD.revision OR NEW.created_at IS NOT OLD.created_at OR OLD.superseded_at IS NOT NULL OR (NEW.superseded_at IS NULL AND (NEW.effective_to_date IS NULL OR (OLD.effective_to_date IS NOT NULL AND NEW.effective_to_date>=OLD.effective_to_date))) OR (NEW.superseded_at IS NOT NULL AND NEW.effective_to_date IS NOT OLD.effective_to_date) THEN RAISE(ABORT,'CUSTOMER_ADMIN_REQUIRES_NEW_REVISION') END;
END;
CREATE TRIGGER customer_admin_no_delete BEFORE DELETE ON customer_admin_location BEGIN SELECT RAISE(ABORT,'CUSTOMER_ADMIN_HISTORY_IMMUTABLE'); END;
