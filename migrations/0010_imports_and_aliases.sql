CREATE TABLE product (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),sku TEXT NOT NULL,name TEXT NOT NULL,base_unit TEXT NOT NULL,group_code TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(organization_id,id),UNIQUE(organization_id,sku)
);
CREATE TABLE import_file (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),original_name TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,checksum TEXT NOT NULL,etag TEXT NOT NULL,size_bytes INTEGER NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 retention_hold INTEGER NOT NULL DEFAULT 1 CHECK(retention_hold=1),retain_until TEXT,
 UNIQUE(organization_id,id),UNIQUE(organization_id,checksum)
);
CREATE TABLE master_import_batch (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,attachment_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('customer','product')),mapping_json TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('validated','committed','partial')),valid_count INTEGER NOT NULL,invalid_count INTEGER NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,committed_at TEXT,version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,attachment_id) REFERENCES import_file(organization_id,id)
);
CREATE TABLE master_import_row (
 batch_id TEXT NOT NULL,row_no INTEGER NOT NULL,organization_id TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('create','update','noop','invalid')),resource_id TEXT,expected_version INTEGER,payload_json TEXT NOT NULL,before_json TEXT,reference_json TEXT NOT NULL DEFAULT '{}',errors_json TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('valid','invalid','applied')),
 PRIMARY KEY(batch_id,row_no),FOREIGN KEY(organization_id,batch_id) REFERENCES master_import_batch(organization_id,id)
);
CREATE INDEX master_import_org ON master_import_batch(organization_id,created_at);
ALTER TABLE customer_outlet ADD COLUMN merged_into_id TEXT;
CREATE UNIQUE INDEX customer_org_identity ON customer_outlet(organization_id,id);
CREATE INDEX customer_code_review ON customer_outlet(organization_id,UPPER(TRIM(external_code)));
CREATE INDEX customer_name_address ON customer_outlet(organization_id,LOWER(TRIM(name)),LOWER(TRIM(address)));
CREATE TABLE customer_alias (
 organization_id TEXT NOT NULL,source_id TEXT NOT NULL,canonical_id TEXT NOT NULL,external_code TEXT,merged_at TEXT NOT NULL,merged_by TEXT NOT NULL,reason TEXT NOT NULL,
 PRIMARY KEY(organization_id,source_id),CHECK(source_id<>canonical_id),
 FOREIGN KEY(organization_id,source_id) REFERENCES customer_outlet(organization_id,id),FOREIGN KEY(organization_id,canonical_id) REFERENCES customer_outlet(organization_id,id)
);
CREATE INDEX alias_canonical ON customer_alias(organization_id,canonical_id);
CREATE TRIGGER alias_target_insert BEFORE INSERT ON customer_alias BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.canonical_id AND merged_into_id IS NULL) THEN RAISE(ABORT,'ALIAS_TARGET_INVALID') END;
END;
CREATE TRIGGER alias_target_update BEFORE UPDATE OF canonical_id ON customer_alias BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.canonical_id AND merged_into_id IS NULL) THEN RAISE(ABORT,'ALIAS_TARGET_INVALID') END;
END;
CREATE TRIGGER merged_outlet_no_insert_assignment BEFORE INSERT ON customer_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.outlet_id AND merged_into_id IS NOT NULL) THEN RAISE(ABORT,'CUSTOMER_MERGED') END;
END;
CREATE TRIGGER merged_outlet_no_move_assignment BEFORE UPDATE OF outlet_id ON customer_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND id=NEW.outlet_id AND merged_into_id IS NOT NULL) THEN RAISE(ABORT,'CUSTOMER_MERGED') END;
END;
CREATE INDEX customer_family ON customer_outlet(organization_id,merged_into_id);
DROP TRIGGER contact_customer_update;
CREATE TRIGGER contact_customer_update BEFORE UPDATE OF customer_id ON contact WHEN NEW.customer_id<>OLD.customer_id BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE id=NEW.customer_id AND organization_id=NEW.organization_id AND record_status='active' AND merged_into_id IS NULL) THEN RAISE(ABORT,'INVALID_CUSTOMER') END;
END;
