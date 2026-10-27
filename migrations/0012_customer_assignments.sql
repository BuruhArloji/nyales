ALTER TABLE customer_assignment ADD COLUMN area_id TEXT;
ALTER TABLE customer_assignment ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_assignment ADD COLUMN created_by TEXT;
ALTER TABLE customer_assignment ADD COLUMN created_at TEXT;
UPDATE customer_assignment SET area_id=(SELECT area_id FROM customer_outlet WHERE id=outlet_id AND organization_id=customer_assignment.organization_id);
CREATE TABLE customer_territory_transfer (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,outlet_id TEXT NOT NULL,from_area_id TEXT NOT NULL,to_area_id TEXT NOT NULL,
 effective_from_date TEXT NOT NULL,reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,applied_at TEXT,
 CHECK(from_area_id<>to_area_id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES customer_outlet(organization_id,id),
 FOREIGN KEY(organization_id,from_area_id) REFERENCES area(organization_id,id),
 FOREIGN KEY(organization_id,to_area_id) REFERENCES area(organization_id,id)
);
CREATE UNIQUE INDEX territory_one_pending ON customer_territory_transfer(organization_id,outlet_id) WHERE applied_at IS NULL;
CREATE INDEX territory_due ON customer_territory_transfer(organization_id,applied_at,effective_from_date);
CREATE TABLE territory_apply_guard (organization_id TEXT NOT NULL,outlet_id TEXT NOT NULL,event_id TEXT NOT NULL REFERENCES customer_territory_transfer(id),PRIMARY KEY(organization_id,outlet_id));
DROP TRIGGER outlet_area_update;
CREATE TRIGGER outlet_area_update BEFORE UPDATE OF area_id ON customer_outlet BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM area WHERE id=NEW.area_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_AREA') END;
 SELECT CASE WHEN NEW.area_id<>OLD.area_id AND NOT EXISTS(SELECT 1 FROM territory_apply_guard g JOIN customer_territory_transfer t ON t.id=g.event_id WHERE g.organization_id=OLD.organization_id AND g.outlet_id=OLD.id AND t.from_area_id=OLD.area_id AND t.to_area_id=NEW.area_id AND t.applied_at IS NULL) AND (
 EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) OR
 EXISTS(SELECT 1 FROM invoice WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) OR
 EXISTS(SELECT 1 FROM target_item WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) OR
 EXISTS(SELECT 1 FROM customer_territory_transfer WHERE organization_id=OLD.organization_id AND outlet_id=OLD.id)
 ) THEN RAISE(ABORT,'AREA_TRANSFER_REQUIRES_WORKFLOW') END;
END;
CREATE TRIGGER outlet_pending_transfer_guard BEFORE UPDATE OF merged_into_id,record_status ON customer_outlet WHEN NEW.merged_into_id IS NOT NULL OR NEW.record_status='inactive' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_territory_transfer WHERE organization_id=OLD.organization_id AND outlet_id=OLD.id AND applied_at IS NULL) THEN RAISE(ABORT,'PENDING_TERRITORY_TRANSFER') END;
END;
CREATE TRIGGER area_customer_guard BEFORE UPDATE OF status ON area WHEN NEW.status='archived' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND area_id=NEW.id AND record_status='active' AND merged_into_id IS NULL) OR EXISTS(SELECT 1 FROM customer_territory_transfer WHERE organization_id=NEW.organization_id AND to_area_id=NEW.id AND applied_at IS NULL) THEN RAISE(ABORT,'AREA_HAS_CUSTOMERS_OR_PENDING_TRANSFER') END;
END;
CREATE TRIGGER customer_assignment_insert_guard BEFORE INSERT ON customer_assignment BEGIN
 SELECT CASE WHEN NEW.effective_to_date IS NOT NULL AND NEW.effective_to_date<=NEW.effective_from_date THEN RAISE(ABORT,'INVALID_ASSIGNMENT_INTERVAL') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.outlet_id) OR (NEW.rep_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app_user WHERE organization_id=NEW.organization_id AND id=NEW.rep_id)) THEN RAISE(ABORT,'ASSIGNMENT_TENANT_MISMATCH') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_assignment a JOIN customer_outlet f ON f.organization_id=a.organization_id AND f.id=a.outlet_id JOIN customer_outlet n ON n.organization_id=NEW.organization_id AND n.id=NEW.outlet_id WHERE a.organization_id=NEW.organization_id AND a.id<>NEW.id AND COALESCE(f.merged_into_id,f.id)=COALESCE(n.merged_into_id,n.id) AND a.channel=NEW.channel AND a.rep_id IS NOT NULL AND NEW.rep_id IS NOT NULL AND a.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(a.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'CUSTOMER_OWNER_OVERLAP') END;
END;
CREATE TRIGGER customer_assignment_immutable BEFORE UPDATE ON customer_assignment WHEN NEW.outlet_id<>OLD.outlet_id OR NEW.organization_id<>OLD.organization_id OR NEW.rep_id IS NOT OLD.rep_id OR NEW.channel<>OLD.channel OR NEW.area_id IS NOT OLD.area_id OR NEW.effective_from_date<>OLD.effective_from_date OR NEW.reason<>OLD.reason OR (OLD.effective_to_date IS NOT NULL AND (NEW.effective_to_date IS NULL OR NEW.effective_to_date>OLD.effective_to_date)) OR (NEW.effective_to_date IS NOT NULL AND NEW.effective_to_date<=NEW.effective_from_date) BEGIN SELECT RAISE(ABORT,'ASSIGNMENT_HISTORY_IMMUTABLE'); END;

CREATE TRIGGER reporting_customer_area_guard BEFORE INSERT ON reporting_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_assignment ca JOIN customer_outlet co ON co.organization_id=ca.organization_id AND co.id=ca.outlet_id WHERE ca.organization_id=NEW.organization_id AND ca.rep_id=NEW.subordinate_id AND COALESCE(ca.area_id,co.area_id)<>NEW.area_id AND (ca.effective_to_date IS NULL OR ca.effective_to_date>NEW.effective_from_date)) THEN RAISE(ABORT,'TRANSFER_CUSTOMERS_BEFORE_AREA_CHANGE') END;
END;
