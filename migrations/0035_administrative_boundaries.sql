-- WEB-063: immutable dataset releases; assignment/mapping writes follow WEB-064/065.
CREATE TABLE admin_boundary_dataset (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organization(id),
 provider TEXT NOT NULL, code_namespace TEXT NOT NULL, release_version TEXT NOT NULL,
 released_at TEXT, acquired_at TEXT NOT NULL, source_reference TEXT NOT NULL,
 source_checksum TEXT NOT NULL, metadata_json TEXT NOT NULL, coverage_json TEXT NOT NULL,
 manifest_sha256 TEXT NOT NULL, expected_features INTEGER NOT NULL CHECK(expected_features BETWEEN 1 AND 1000),
 expected_chunks INTEGER NOT NULL CHECK(expected_chunks BETWEEN 1 AND 100),
 license_reference TEXT, license_note TEXT, attribution TEXT, reviewed_by TEXT, reviewed_at TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(organization_id,id), UNIQUE(organization_id,code_namespace,release_version,manifest_sha256),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,reviewed_by) REFERENCES app_user(organization_id,id)
);
CREATE UNIQUE INDEX admin_dataset_one_active ON admin_boundary_dataset(organization_id) WHERE status='active';
CREATE INDEX admin_dataset_list ON admin_boundary_dataset(organization_id,created_at,id);
CREATE TRIGGER admin_dataset_insert_guard BEFORE INSERT ON admin_boundary_dataset WHEN NEW.status<>'draft' OR NEW.version<>1 BEGIN SELECT RAISE(ABORT,'ADMIN_RELEASE_MUST_START_DRAFT'); END;
CREATE TABLE admin_boundary_chunk (
 organization_id TEXT NOT NULL,dataset_id TEXT NOT NULL,chunk_index INTEGER NOT NULL CHECK(chunk_index BETWEEN 0 AND 99),
 checksum TEXT NOT NULL, storage_key TEXT NOT NULL, feature_count INTEGER NOT NULL CHECK(feature_count>0),
 byte_count INTEGER NOT NULL CHECK(byte_count>0), created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,dataset_id,chunk_index),
 FOREIGN KEY(organization_id,dataset_id) REFERENCES admin_boundary_dataset(organization_id,id)
);
CREATE TABLE admin_unit (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL, parent_unit_id TEXT,
 code_namespace TEXT NOT NULL,admin_code TEXT NOT NULL,name TEXT NOT NULL,
 level TEXT NOT NULL CHECK(level IN('province','regency','district','village')),
 village_type TEXT CHECK(village_type IN('desa','kelurahan') OR village_type IS NULL),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','retired')),
 UNIQUE(organization_id,id), UNIQUE(organization_id,code_namespace,admin_code),
 FOREIGN KEY(organization_id) REFERENCES organization(id),
 FOREIGN KEY(organization_id,parent_unit_id) REFERENCES admin_unit(organization_id,id),
 CHECK((level='province' AND parent_unit_id IS NULL) OR (level<>'province' AND parent_unit_id IS NOT NULL)),
 CHECK((level='village' AND village_type IS NOT NULL) OR (level<>'village' AND village_type IS NULL))
);
CREATE INDEX admin_unit_parent ON admin_unit(organization_id,parent_unit_id,level,admin_code);
CREATE TABLE admin_boundary (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,dataset_id TEXT NOT NULL,admin_unit_id TEXT NOT NULL,
 source_id TEXT NOT NULL,name_snapshot TEXT NOT NULL,parent_code_snapshot TEXT NOT NULL,hierarchy_json TEXT NOT NULL,
 geometry_object_key TEXT NOT NULL,geometry_feature_index INTEGER NOT NULL CHECK(geometry_feature_index>=0),
 geometry_type TEXT NOT NULL CHECK(geometry_type IN('Polygon','MultiPolygon')),geometry_checksum TEXT NOT NULL,
 min_longitude_e7 INTEGER NOT NULL,min_latitude_e7 INTEGER NOT NULL,max_longitude_e7 INTEGER NOT NULL,max_latitude_e7 INTEGER NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,dataset_id,admin_unit_id),UNIQUE(organization_id,dataset_id,source_id),
 FOREIGN KEY(organization_id,dataset_id) REFERENCES admin_boundary_dataset(organization_id,id),
 FOREIGN KEY(organization_id,admin_unit_id) REFERENCES admin_unit(organization_id,id),
 CHECK(min_longitude_e7<=max_longitude_e7 AND min_latitude_e7<=max_latitude_e7)
);
CREATE INDEX admin_boundary_bbox ON admin_boundary(organization_id,dataset_id,min_longitude_e7,max_longitude_e7,min_latitude_e7,max_latitude_e7);
CREATE TABLE area_admin_membership (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,area_id TEXT NOT NULL,admin_unit_id TEXT NOT NULL,boundary_id TEXT NOT NULL,
 effective_from_date TEXT NOT NULL,effective_to_date TEXT,reason TEXT NOT NULL,
 UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,area_id) REFERENCES area(organization_id,id),
 FOREIGN KEY(organization_id,admin_unit_id) REFERENCES admin_unit(organization_id,id),
 FOREIGN KEY(organization_id,boundary_id) REFERENCES admin_boundary(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date)
);
CREATE INDEX area_admin_period ON area_admin_membership(organization_id,admin_unit_id,effective_from_date,effective_to_date);
CREATE TABLE customer_admin_location (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,outlet_id TEXT NOT NULL,admin_unit_id TEXT,boundary_id TEXT,
 method TEXT NOT NULL CHECK(method IN('coordinate','admin_code','manual')),
 status TEXT NOT NULL CHECK(status IN('proposed','confirmed','needs_review','outside_coverage')),
 evidence_json TEXT NOT NULL,effective_from_date TEXT NOT NULL,effective_to_date TEXT,reviewed_by TEXT,reviewed_at TEXT,reason TEXT,
 UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES customer_outlet(organization_id,id),
 FOREIGN KEY(organization_id,admin_unit_id) REFERENCES admin_unit(organization_id,id),
 FOREIGN KEY(organization_id,boundary_id) REFERENCES admin_boundary(organization_id,id),
 FOREIGN KEY(organization_id,reviewed_by) REFERENCES app_user(organization_id,id),
 CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date),
 CHECK(status<>'confirmed' OR (admin_unit_id IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(trim(reason))>0))
);
CREATE INDEX customer_admin_period ON customer_admin_location(organization_id,outlet_id,effective_from_date,effective_to_date);
CREATE TRIGGER admin_unit_parent_insert BEFORE INSERT ON admin_unit WHEN NEW.parent_unit_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_unit p WHERE p.organization_id=NEW.organization_id AND p.id=NEW.parent_unit_id AND p.code_namespace=NEW.code_namespace AND p.level=CASE NEW.level WHEN 'regency' THEN 'province' WHEN 'district' THEN 'regency' WHEN 'village' THEN 'district' END) THEN RAISE(ABORT,'ADMIN_PARENT_INVALID') END;
END;
CREATE TRIGGER admin_unit_identity_immutable BEFORE UPDATE ON admin_unit BEGIN SELECT RAISE(ABORT,'ADMIN_UNIT_IMMUTABLE'); END;
CREATE TRIGGER admin_unit_no_delete BEFORE DELETE ON admin_unit BEGIN SELECT RAISE(ABORT,'ADMIN_UNIT_IMMUTABLE'); END;
CREATE TRIGGER admin_boundary_insert_guard BEFORE INSERT ON admin_boundary BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_boundary_dataset d JOIN admin_unit u ON u.organization_id=d.organization_id AND u.id=NEW.admin_unit_id WHERE d.organization_id=NEW.organization_id AND d.id=NEW.dataset_id AND d.status='draft' AND u.level='village' AND u.code_namespace=d.code_namespace) THEN RAISE(ABORT,'ADMIN_BOUNDARY_INVALID') END;
END;
CREATE TRIGGER admin_boundary_immutable BEFORE UPDATE ON admin_boundary BEGIN SELECT RAISE(ABORT,'ADMIN_BOUNDARY_IMMUTABLE'); END;
CREATE TRIGGER admin_boundary_no_delete BEFORE DELETE ON admin_boundary BEGIN SELECT RAISE(ABORT,'ADMIN_BOUNDARY_IMMUTABLE'); END;
CREATE TRIGGER admin_chunk_insert_guard BEFORE INSERT ON admin_boundary_chunk BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_boundary_dataset d WHERE d.organization_id=NEW.organization_id AND d.id=NEW.dataset_id AND d.status='draft' AND NEW.chunk_index<d.expected_chunks) THEN RAISE(ABORT,'ADMIN_CHUNK_INVALID') END;
END;
CREATE TRIGGER admin_chunk_immutable BEFORE UPDATE ON admin_boundary_chunk BEGIN SELECT RAISE(ABORT,'ADMIN_CHUNK_IMMUTABLE'); END;
CREATE TRIGGER admin_chunk_no_delete BEFORE DELETE ON admin_boundary_chunk BEGIN SELECT RAISE(ABORT,'ADMIN_CHUNK_IMMUTABLE'); END;
CREATE TRIGGER admin_dataset_update_guard BEFORE UPDATE ON admin_boundary_dataset BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.provider IS NOT OLD.provider OR NEW.code_namespace IS NOT OLD.code_namespace OR NEW.release_version IS NOT OLD.release_version OR NEW.released_at IS NOT OLD.released_at OR NEW.acquired_at IS NOT OLD.acquired_at OR NEW.source_reference IS NOT OLD.source_reference OR NEW.source_checksum IS NOT OLD.source_checksum OR NEW.metadata_json IS NOT OLD.metadata_json OR NEW.coverage_json IS NOT OLD.coverage_json OR NEW.manifest_sha256 IS NOT OLD.manifest_sha256 OR NEW.expected_features IS NOT OLD.expected_features OR NEW.expected_chunks IS NOT OLD.expected_chunks OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR NEW.version<>OLD.version+1 OR NOT((OLD.status='draft' AND NEW.status IN('draft','active')) OR (OLD.status='active' AND NEW.status='retired')) THEN RAISE(ABORT,'ADMIN_RELEASE_IMMUTABLE') END;
 SELECT CASE WHEN OLD.status<>'draft' AND (NEW.license_reference IS NOT OLD.license_reference OR NEW.license_note IS NOT OLD.license_note OR NEW.attribution IS NOT OLD.attribution OR NEW.reviewed_by IS NOT OLD.reviewed_by OR NEW.reviewed_at IS NOT OLD.reviewed_at) THEN RAISE(ABORT,'ADMIN_REVIEW_IMMUTABLE') END;
 SELECT CASE WHEN NEW.status='active' AND (length(trim(COALESCE(NEW.license_reference,'')))=0 OR length(trim(COALESCE(NEW.license_note,'')))=0 OR length(trim(COALESCE(NEW.attribution,'')))=0 OR NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL OR (SELECT COUNT(*) FROM admin_boundary_chunk WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_chunks OR (SELECT COALESCE(SUM(feature_count),0) FROM admin_boundary_chunk WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_features OR (SELECT COUNT(*) FROM admin_boundary WHERE organization_id=NEW.organization_id AND dataset_id=NEW.id)<>NEW.expected_features) THEN RAISE(ABORT,'ADMIN_RELEASE_NOT_REVIEWED') END;
END;
CREATE TRIGGER admin_dataset_no_delete BEFORE DELETE ON admin_boundary_dataset BEGIN SELECT RAISE(ABORT,'ADMIN_RELEASE_IMMUTABLE'); END;
CREATE TRIGGER area_admin_insert_guard BEFORE INSERT ON area_admin_membership BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM admin_boundary b WHERE b.organization_id=NEW.organization_id AND b.id=NEW.boundary_id AND b.admin_unit_id=NEW.admin_unit_id) OR EXISTS(SELECT 1 FROM area_admin_membership a WHERE a.organization_id=NEW.organization_id AND a.admin_unit_id=NEW.admin_unit_id AND a.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(a.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ADMIN_AREA_OVERLAP_OR_BOUNDARY') END;
END;
CREATE TRIGGER area_admin_update_guard BEFORE UPDATE ON area_admin_membership BEGIN
 SELECT CASE WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.admin_unit_id IS NOT OLD.admin_unit_id OR NEW.area_id IS NOT OLD.area_id OR NEW.boundary_id IS NOT OLD.boundary_id OR NEW.effective_from_date IS NOT OLD.effective_from_date OR (OLD.effective_to_date IS NOT NULL AND (NEW.effective_to_date IS NULL OR NEW.effective_to_date>OLD.effective_to_date)) OR EXISTS(SELECT 1 FROM area_admin_membership a WHERE a.id<>OLD.id AND a.organization_id=NEW.organization_id AND a.admin_unit_id=NEW.admin_unit_id AND a.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(a.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ADMIN_AREA_HISTORY') END;
END;
CREATE TRIGGER customer_admin_insert_guard BEFORE INSERT ON customer_admin_location BEGIN
 SELECT CASE WHEN (NEW.boundary_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM admin_boundary b WHERE b.organization_id=NEW.organization_id AND b.id=NEW.boundary_id AND b.admin_unit_id=NEW.admin_unit_id)) OR (NEW.status='confirmed' AND EXISTS(SELECT 1 FROM customer_admin_location x WHERE x.organization_id=NEW.organization_id AND x.outlet_id=NEW.outlet_id AND x.status='confirmed' AND x.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(x.effective_to_date,'9999-12-31'))) THEN RAISE(ABORT,'CUSTOMER_ADMIN_CONFLICT') END;
END;
-- Mapping/territory update workflows are deliberately not exposed until WEB-064/065.
CREATE TRIGGER customer_admin_update_guard BEFORE UPDATE ON customer_admin_location BEGIN SELECT RAISE(ABORT,'CUSTOMER_ADMIN_REQUIRES_NEW_REVISION'); END;
