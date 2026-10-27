-- WEB-066: read snapshot revision also covers KPI inputs. No history rewrite.
CREATE TRIGGER geo_analytics_activity_insert AFTER INSERT ON activity BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_activity_update AFTER UPDATE ON activity BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_activity_delete AFTER DELETE ON activity BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER geo_analytics_target_plan_insert AFTER INSERT ON target_plan BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_plan_update AFTER UPDATE ON target_plan BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_plan_delete AFTER DELETE ON target_plan BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER geo_analytics_target_version_insert AFTER INSERT ON target_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_version_update AFTER UPDATE ON target_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_version_delete AFTER DELETE ON target_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER geo_analytics_target_item_insert AFTER INSERT ON target_item BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_item_update AFTER UPDATE ON target_item BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_target_item_delete AFTER DELETE ON target_item BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER geo_analytics_customer_source_coverage_insert AFTER INSERT ON customer_source_coverage BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_customer_source_coverage_update AFTER UPDATE ON customer_source_coverage BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER geo_analytics_customer_source_coverage_delete AFTER DELETE ON customer_source_coverage BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
