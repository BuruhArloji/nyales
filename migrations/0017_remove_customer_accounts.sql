-- Preserve removed master data and old relations as historical audit snapshots, not live entities.
INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json)
SELECT 'remove-account:'||id,organization_id,'system:migration0017','legacy_customer_account',id,'retire_account_layer',strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('id',id,'name',name,'external_code',external_code,'status',status,'needs_review',needs_review,'version',version),'{}' FROM account;
INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json)
SELECT 'remove-account-link:'||id,organization_id,'system:migration0017','customers',id,'retire_account_relation',strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('account_id',account_id),'{}' FROM customer_outlet WHERE account_id IS NOT NULL;
DROP TRIGGER outlet_account_insert;
DROP TRIGGER outlet_account_update;
DROP TRIGGER account_archive_guard;
DROP TRIGGER outlet_area_insert;
DROP INDEX outlet_account_scope;
ALTER TABLE customer_outlet DROP COLUMN account_id;
DROP TABLE account;
CREATE TRIGGER outlet_area_insert BEFORE INSERT ON customer_outlet BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM area WHERE id=NEW.area_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_AREA') END;
END;
-- Old customer dry-runs still contain removed mapping fields and must never be committed.
ALTER TABLE master_import_batch ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
