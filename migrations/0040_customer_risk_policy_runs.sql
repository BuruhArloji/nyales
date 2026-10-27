-- WEB-067: policy versions and private snapshot references only; no business defaults.
CREATE TABLE customer_risk_policy_version(
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organization(id),
 revision_no INTEGER NOT NULL CHECK(revision_no>=1),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 config_json TEXT NOT NULL CHECK(json_valid(config_json) AND json_type(config_json)='object' AND length(config_json)<=20000),
 config_sha256 TEXT NOT NULL CHECK(length(config_sha256)=64),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 500),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 activated_by TEXT,
 activated_at TEXT,
 UNIQUE(organization_id,id),
 UNIQUE(organization_id,revision_no),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,activated_by) REFERENCES app_user(organization_id,id),
 CHECK((activated_by IS NULL)=(activated_at IS NULL)),
 CHECK(status<>'active' OR activated_by IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_customer_risk_policy ON customer_risk_policy_version(organization_id) WHERE status='active';
CREATE INDEX customer_risk_policy_history ON customer_risk_policy_version(organization_id,revision_no DESC);
CREATE TRIGGER customer_risk_policy_no_delete BEFORE DELETE ON customer_risk_policy_version BEGIN SELECT RAISE(ABORT,'RISK_POLICY_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER customer_risk_policy_guard BEFORE UPDATE ON customer_risk_policy_version BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.revision_no<>OLD.revision_no OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'RISK_POLICY_VERSION_REQUIRED') END;
 SELECT CASE WHEN OLD.status='retired' OR (OLD.status='active' AND(NEW.status<>'retired' OR NEW.name<>OLD.name OR NEW.config_json<>OLD.config_json OR NEW.config_sha256<>OLD.config_sha256 OR NEW.activated_by IS NOT OLD.activated_by OR NEW.activated_at IS NOT OLD.activated_at)) THEN RAISE(ABORT,'ACTIVE_RISK_POLICY_IMMUTABLE') END;
 SELECT CASE WHEN OLD.status='draft' AND NEW.status='draft' AND(NEW.activated_by IS NOT NULL OR NEW.activated_at IS NOT NULL) THEN RAISE(ABORT,'RISK_POLICY_ACTIVATION_REQUIRED') END;
END;
CREATE TABLE customer_risk_run(
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organization(id),
 policy_version_id TEXT NOT NULL,
 dataset_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 scope_fingerprint TEXT NOT NULL CHECK(length(scope_fingerprint)=64),
 cache_key TEXT NOT NULL CHECK(length(cache_key)=64),
 filters_json TEXT NOT NULL CHECK(json_valid(filters_json)),
 customer_ids_json TEXT NOT NULL CHECK(json_valid(customer_ids_json) AND json_type(customer_ids_json)='array' AND json_array_length(customer_ids_json)<=200),
 cutoff TEXT NOT NULL,
 input_revision INTEGER NOT NULL CHECK(input_revision>=0),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 storage_key TEXT NOT NULL,
 snapshot_sha256 TEXT NOT NULL CHECK(length(snapshot_sha256)=64),
 byte_count INTEGER NOT NULL CHECK(byte_count BETWEEN 1 AND 4194304),
 customer_count INTEGER NOT NULL CHECK(customer_count BETWEEN 0 AND 200),
 attention_customer_count INTEGER NOT NULL CHECK(attention_customer_count BETWEEN 0 AND customer_count),
 unknown_customer_count INTEGER NOT NULL CHECK(unknown_customer_count BETWEEN 0 AND customer_count),
 created_at TEXT NOT NULL,
 UNIQUE(organization_id,id),
 UNIQUE(organization_id,cache_key),
 FOREIGN KEY(organization_id,policy_version_id) REFERENCES customer_risk_policy_version(organization_id,id),
 FOREIGN KEY(organization_id,dataset_id) REFERENCES admin_boundary_dataset(organization_id,id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES app_user(organization_id,id)
);
CREATE INDEX customer_risk_run_history ON customer_risk_run(organization_id,actor_id,created_at DESC);
CREATE TRIGGER customer_risk_run_no_update BEFORE UPDATE ON customer_risk_run BEGIN SELECT RAISE(ABORT,'RISK_RUN_IMMUTABLE'); END;
CREATE TRIGGER customer_risk_run_no_delete BEFORE DELETE ON customer_risk_run BEGIN SELECT RAISE(ABORT,'RISK_RUN_IMMUTABLE'); END;
CREATE TRIGGER customer_risk_policy_input_insert AFTER INSERT ON customer_risk_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER customer_risk_policy_input_update AFTER UPDATE ON customer_risk_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER customer_risk_policy_input_delete AFTER DELETE ON customer_risk_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
