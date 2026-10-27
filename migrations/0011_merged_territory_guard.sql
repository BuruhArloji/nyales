DROP TRIGGER outlet_area_update;
CREATE TRIGGER outlet_area_update BEFORE UPDATE OF area_id ON customer_outlet BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM area WHERE id=NEW.area_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_AREA') END;
 SELECT CASE WHEN NEW.area_id<>OLD.area_id AND (
 EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) OR
 EXISTS(SELECT 1 FROM invoice WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) OR
 EXISTS(SELECT 1 FROM target_item WHERE organization_id=OLD.organization_id AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id)))
 ) THEN RAISE(ABORT,'AREA_TRANSFER_REQUIRES_WORKFLOW') END;
END;
