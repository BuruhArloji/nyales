-- A merged alias's territory history is also protected from undated master/import edits.
CREATE TRIGGER territory_family_area_guard BEFORE UPDATE OF area_id ON customer_outlet WHEN NEW.area_id<>OLD.area_id BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_territory_transfer t WHERE t.organization_id=OLD.organization_id AND t.outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=OLD.organization_id AND (id=OLD.id OR merged_into_id=OLD.id))) AND NOT EXISTS(SELECT 1 FROM territory_apply_guard g JOIN customer_territory_transfer t ON t.id=g.event_id WHERE g.organization_id=OLD.organization_id AND g.outlet_id=OLD.id AND t.from_area_id=OLD.area_id AND t.to_area_id=NEW.area_id AND t.applied_at IS NULL) THEN RAISE(ABORT,'AREA_TRANSFER_REQUIRES_WORKFLOW') END;
END;
