CREATE TRIGGER geo_distribution_org_clock AFTER UPDATE ON organization BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.id; END;
