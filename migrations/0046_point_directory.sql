-- External point directories are source data, not sales history or verified admin geography.
CREATE TABLE point_directory_dataset(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),name TEXT NOT NULL,
 source_reference TEXT NOT NULL,source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
 storage_key TEXT NOT NULL,storage_sha256 TEXT NOT NULL CHECK(length(storage_sha256)=64),byte_count INTEGER NOT NULL CHECK(byte_count BETWEEN 1 AND 16777216),
 reference_count INTEGER NOT NULL CHECK(reference_count>=0),customer_expected_count INTEGER NOT NULL CHECK(customer_expected_count>=0),
 held_count INTEGER NOT NULL CHECK(held_count>=0),created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ready' CHECK(status IN('ready','retired')),UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
ALTER TABLE customer_outlet ADD COLUMN directory_dataset_id TEXT;
ALTER TABLE customer_outlet ADD COLUMN transaction_history_unverified INTEGER NOT NULL DEFAULT 0 CHECK(transaction_history_unverified IN(0,1));
CREATE TRIGGER customer_directory_insert BEFORE INSERT ON customer_outlet WHEN NEW.directory_dataset_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM point_directory_dataset WHERE id=NEW.directory_dataset_id AND organization_id=NEW.organization_id AND status='ready') THEN RAISE(ABORT,'INVALID_POINT_DIRECTORY') END;
END;
CREATE TRIGGER customer_directory_update BEFORE UPDATE OF directory_dataset_id,organization_id ON customer_outlet WHEN NEW.directory_dataset_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM point_directory_dataset WHERE id=NEW.directory_dataset_id AND organization_id=NEW.organization_id) THEN RAISE(ABORT,'INVALID_POINT_DIRECTORY') END;
END;
