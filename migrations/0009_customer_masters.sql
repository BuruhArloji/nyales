CREATE TABLE account (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organization(id), name TEXT NOT NULL,
 external_code TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 needs_review INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(organization_id,id)
);
CREATE UNIQUE INDEX account_external_code_unique ON account(organization_id,external_code COLLATE NOCASE) WHERE external_code IS NOT NULL;
ALTER TABLE customer_outlet ADD COLUMN account_id TEXT;
ALTER TABLE customer_outlet ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customer_outlet ADD COLUMN record_status TEXT NOT NULL DEFAULT 'active' CHECK(record_status IN ('active','inactive'));
ALTER TABLE customer_outlet ADD COLUMN coordinate_status TEXT NOT NULL DEFAULT 'missing' CHECK(coordinate_status IN ('missing','unverified','verified'));
ALTER TABLE customer_outlet ADD COLUMN location_note TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_outlet ADD COLUMN outlet_type TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_outlet ADD COLUMN service_frequency_days INTEGER;
ALTER TABLE customer_outlet ADD COLUMN visit_window TEXT NOT NULL DEFAULT '';
ALTER TABLE customer_outlet ADD COLUMN external_code_key TEXT;
ALTER TABLE customer_outlet ADD COLUMN external_code_review INTEGER NOT NULL DEFAULT 0;
-- A legacy outlet is not silently assumed to share a legal account with another outlet.
INSERT INTO account(id,organization_id,name,needs_review) SELECT 'legacy-account:'||id,organization_id,'Account belum dipetakan · '||name,1 FROM customer_outlet;
UPDATE customer_outlet SET account_id='legacy-account:'||id,coordinate_status=CASE WHEN latitude_e7 IS NOT NULL AND longitude_e7 IS NOT NULL THEN 'unverified' ELSE 'missing' END;
UPDATE customer_outlet SET external_code_key=UPPER(TRIM(external_code)) WHERE NULLIF(TRIM(external_code),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_outlet other WHERE other.organization_id=customer_outlet.organization_id AND other.id<>customer_outlet.id AND UPPER(TRIM(other.external_code))=UPPER(TRIM(customer_outlet.external_code)));
UPDATE customer_outlet SET external_code_review=1 WHERE NULLIF(TRIM(external_code),'') IS NOT NULL AND external_code_key IS NULL;
CREATE UNIQUE INDEX outlet_external_code_unique ON customer_outlet(organization_id,external_code_key) WHERE external_code_key IS NOT NULL;
CREATE INDEX outlet_account_scope ON customer_outlet(organization_id,account_id,area_id);
CREATE TABLE contact (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, customer_id TEXT NOT NULL REFERENCES customer_outlet(id),
 name TEXT NOT NULL, phone TEXT NOT NULL, contact_role TEXT NOT NULL DEFAULT '',
 preferred_channel TEXT NOT NULL CHECK(preferred_channel IN ('field','telesales')),
 permission_status TEXT NOT NULL DEFAULT 'unknown' CHECK(permission_status IN ('unknown','allowed','denied','dnc')),
 permission_note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id,id)
);
CREATE INDEX contact_customer_scope ON contact(organization_id,customer_id,status);
CREATE INDEX contact_phone_lookup ON contact(organization_id,phone);
CREATE TRIGGER outlet_account_insert BEFORE INSERT ON customer_outlet WHEN NEW.account_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM account WHERE id=NEW.account_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_ACCOUNT') END;
END;
CREATE TRIGGER outlet_account_update BEFORE UPDATE OF account_id,record_status ON customer_outlet WHEN NEW.account_id IS NOT NULL AND NEW.record_status='active' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM account WHERE id=NEW.account_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_ACCOUNT') END;
END;
CREATE TRIGGER account_archive_guard BEFORE UPDATE OF status ON account WHEN NEW.status='archived' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM customer_outlet WHERE organization_id=NEW.organization_id AND account_id=NEW.id AND record_status='active') THEN RAISE(ABORT,'ACCOUNT_HAS_ACTIVE_OUTLETS') END;
END;
CREATE TRIGGER contact_customer_insert BEFORE INSERT ON contact BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE id=NEW.customer_id AND organization_id=NEW.organization_id AND record_status='active') THEN RAISE(ABORT,'INVALID_CUSTOMER') END;
END;
CREATE TRIGGER contact_customer_update BEFORE UPDATE OF customer_id ON contact BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customer_outlet WHERE id=NEW.customer_id AND organization_id=NEW.organization_id AND record_status='active') THEN RAISE(ABORT,'INVALID_CUSTOMER') END;
END;
CREATE TRIGGER outlet_location_insert BEFORE INSERT ON customer_outlet BEGIN
 SELECT CASE WHEN (NEW.latitude_e7 IS NULL)<>(NEW.longitude_e7 IS NULL) OR NEW.latitude_e7 NOT BETWEEN -900000000 AND 900000000 OR NEW.longitude_e7 NOT BETWEEN -1800000000 AND 1800000000 THEN RAISE(ABORT,'INVALID_COORDINATES') END;
END;
CREATE TRIGGER outlet_location_update BEFORE UPDATE OF latitude_e7,longitude_e7 ON customer_outlet BEGIN
 SELECT CASE WHEN (NEW.latitude_e7 IS NULL)<>(NEW.longitude_e7 IS NULL) OR NEW.latitude_e7 NOT BETWEEN -900000000 AND 900000000 OR NEW.longitude_e7 NOT BETWEEN -1800000000 AND 1800000000 THEN RAISE(ABORT,'INVALID_COORDINATES') END;
END;
CREATE TRIGGER outlet_area_insert BEFORE INSERT ON customer_outlet WHEN NEW.account_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM area WHERE id=NEW.area_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_AREA') END;
END;
CREATE TRIGGER outlet_area_update BEFORE UPDATE OF area_id ON customer_outlet BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM area WHERE id=NEW.area_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_AREA') END;
 SELECT CASE WHEN NEW.area_id<>OLD.area_id AND (EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=OLD.organization_id AND outlet_id=OLD.id) OR EXISTS(SELECT 1 FROM invoice WHERE organization_id=OLD.organization_id AND outlet_id=OLD.id) OR EXISTS(SELECT 1 FROM target_item WHERE organization_id=OLD.organization_id AND outlet_id=OLD.id)) THEN RAISE(ABORT,'AREA_TRANSFER_REQUIRES_WORKFLOW') END;
END;
