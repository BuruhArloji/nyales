-- Expand source release capacity; preserve every row, index, trigger and foreign key.
PRAGMA defer_foreign_keys=ON;
DROP TRIGGER admin_boundary_insert_guard;
DROP TRIGGER admin_chunk_insert_guard;
CREATE TABLE admin_boundary_dataset_expanded (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organization(id),
 provider TEXT NOT NULL, code_namespace TEXT NOT NULL, release_version TEXT NOT NULL,
 released_at TEXT, acquired_at TEXT NOT NULL, source_reference TEXT NOT NULL,
 source_checksum TEXT NOT NULL, metadata_json TEXT NOT NULL, coverage_json TEXT NOT NULL,
 manifest_sha256 TEXT NOT NULL, expected_features INTEGER NOT NULL CHECK(expected_features>=1),
 expected_chunks INTEGER NOT NULL CHECK(expected_chunks BETWEEN 1 AND 100),
 license_reference TEXT, license_note TEXT, attribution TEXT, reviewed_by TEXT, reviewed_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(organization_id,id), UNIQUE(organization_id,code_namespace,release_version,manifest_sha256),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,reviewed_by) REFERENCES app_user(organization_id,id)
);
INSERT INTO admin_boundary_dataset_expanded SELECT * FROM admin_boundary_dataset;
DROP TABLE admin_boundary_dataset;
ALTER TABLE admin_boundary_dataset_expanded RENAME TO admin_boundary_dataset;
CREATE INDEX admin_dataset_list ON admin_boundary_dataset(organization_id,created_at,id);
CREATE UNIQUE INDEX admin_dataset_one_active ON admin_boundary_dataset(organization_id) WHERE status='active';
CREATE TRIGGER admin_dataset_insert_guard BEFORE INSERT ON admin_boundary_dataset WHEN NEW.status<>'draft' OR NEW.version<>1 BEGIN SELECT RAISE(ABORT,'ADMIN_RELEASE_MUST_START_DRAFT'); END;
CREATE TRIGGER admin_dataset_no_delete BEFORE DELETE ON admin_boundary_dataset BEGIN SELECT RAISE(ABORT,'ADMIN_RELEASE_IMMUTABLE'); END;
CREATE TRIGGER admin_dataset_update_guard BEFORE UPDATE ON admin_boundary_dataset BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.provider IS NOT OLD.provider OR NEW.code_namespace IS NOT OLD.code_namespace OR NEW.release_version IS NOT OLD.release_version OR NEW.released_at IS NOT OLD.released_at OR NEW.acquired_at IS NOT OLD.acquired_at OR NEW.source_reference IS NOT OLD.source_reference OR NEW.source_checksum IS NOT OLD.source_checksum OR NEW.metadata_json IS NOT OLD.metadata_json OR NEW.coverage_json IS NOT OLD.coverage_json OR NEW.manifest_sha256 IS NOT OLD.manifest_sha256 OR NEW.expected_features IS NOT OLD.expected_features OR NEW.expected_chunks IS NOT OLD.expected_chunks OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR NEW.version<>OLD.version+1 OR NOT((OLD.status='draft' AND NEW.status IN('draft','active')) OR (OLD.status='active' AND NEW.status='retired')) THEN RAISE(ABORT,'ADMIN_RELEASE_IMMUTABLE') END;
 SELECT CASE WHEN OLD.status<>'draft' AND (NEW.license_reference IS NOT OLD.license_reference OR NEW.license_note IS NOT OLD.license_note OR NEW.attribution IS NOT OLD.attribution OR NEW.reviewed_by IS NOT OLD.reviewed_by OR NEW.reviewed_at IS NOT OLD.reviewed_at) THEN RAISE(ABORT,'ADMIN_REVIEW_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status='active' AND (length(trim(COALESCE(NEW.license_reference,'')))=0 OR length(trim(COALESCE(NEW.license_note,'')))=0 OR length(trim(COALESCE(NEW.attribution,'')))=0 OR NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL OR (SELECT COUNT(*) FROM admin_boundary_chunk WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_chunks OR (SELECT COALESCE(SUM(feature_count),0) FROM admin_boundary_chunk WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_features OR (SELECT COUNT(*) FROM admin_boundary WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_features) THEN RAISE(ABORT,'ADMIN_RELEASE_NOT_REVIEWED') END;
END;
CREATE TRIGGER geo_epoch_admin_boundary_dataset_delete AFTER DELETE ON admin_boundary_dataset BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER geo_epoch_admin_boundary_dataset_insert AFTER INSERT ON admin_boundary_dataset BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER geo_epoch_admin_boundary_dataset_update AFTER UPDATE ON admin_boundary_dataset BEGIN INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;
CREATE TRIGGER admin_boundary_insert_guard BEFORE INSERT ON admin_boundary BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_boundary_dataset d JOIN admin_unit u ON u.organization_id=d.organization_id AND u.id=NEW.admin_unit_id WHERE d.organization_id=NEW.organization_id AND d.id=NEW.dataset_id AND d.status='draft' AND u.level='village' AND u.code_namespace=d.code_namespace) THEN RAISE(ABORT,'ADMIN_BOUNDARY_INVALID') END;
END;
CREATE TRIGGER admin_chunk_insert_guard BEFORE INSERT ON admin_boundary_chunk BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_boundary_dataset d WHERE d.organization_id=NEW.organization_id AND d.id=NEW.dataset_id AND d.status='draft' AND NEW.chunk_index<d.expected_chunks) THEN RAISE(ABORT,'ADMIN_CHUNK_INVALID') END;
END;
INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;
DELETE FROM master_mutation_guard;
-- Clear deferred DROP-table counters only after the full foreign-key check passed.
PRAGMA defer_foreign_keys=OFF;
