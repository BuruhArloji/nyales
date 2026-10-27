-- WEB-068: explicit workload policy and immutable scenario revisions; no business defaults.
CREATE TABLE workload_policy_version(
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL REFERENCES organization(id),
 revision_no INTEGER NOT NULL CHECK(revision_no>=1),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 config_json TEXT NOT NULL CHECK(json_valid(config_json) AND json_type(config_json)='object' AND length(config_json)<=1048576),
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
CREATE UNIQUE INDEX one_active_workload_policy ON workload_policy_version(organization_id) WHERE status='active';
CREATE INDEX workload_policy_history ON workload_policy_version(organization_id,revision_no DESC);
CREATE TRIGGER workload_policy_no_delete BEFORE DELETE ON workload_policy_version BEGIN SELECT RAISE(ABORT,'WORKLOAD_POLICY_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER workload_policy_guard BEFORE UPDATE ON workload_policy_version BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.revision_no<>OLD.revision_no OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'WORKLOAD_POLICY_VERSION_REQUIRED') END;
 SELECT CASE WHEN OLD.status='retired' OR (OLD.status='active' AND(NEW.status<>'retired' OR NEW.name<>OLD.name OR NEW.config_json<>OLD.config_json OR NEW.config_sha256<>OLD.config_sha256 OR NEW.activated_by IS NOT OLD.activated_by OR NEW.activated_at IS NOT OLD.activated_at)) THEN RAISE(ABORT,'ACTIVE_WORKLOAD_POLICY_IMMUTABLE') END;
 SELECT CASE WHEN OLD.status='draft' AND NEW.status='draft' AND(NEW.activated_by IS NOT NULL OR NEW.activated_at IS NOT NULL) THEN RAISE(ABORT,'WORKLOAD_POLICY_ACTIVATION_REQUIRED') END;
END;

CREATE TABLE territory_scenario(
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organization(id), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','archived')),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE territory_scenario_revision(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,scenario_id TEXT NOT NULL,revision_no INTEGER NOT NULL CHECK(revision_no>=1),
 supersedes_id TEXT,policy_version_id TEXT NOT NULL,dataset_id TEXT NOT NULL,input_revision INTEGER NOT NULL CHECK(input_revision>=0),mapping_cutoff TEXT NOT NULL,
 scope_fingerprint TEXT NOT NULL CHECK(length(scope_fingerprint)=64),preview_hash TEXT NOT NULL CHECK(length(preview_hash)=64),
 input_json TEXT NOT NULL CHECK(json_valid(input_json)),storage_key TEXT NOT NULL,snapshot_sha256 TEXT NOT NULL CHECK(length(snapshot_sha256)=64),byte_count INTEGER NOT NULL CHECK(byte_count BETWEEN 1 AND 4194304),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 500),created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,scenario_id,id),UNIQUE(organization_id,scenario_id,revision_no),
 FOREIGN KEY(organization_id,scenario_id) REFERENCES territory_scenario(organization_id,id),
 FOREIGN KEY(organization_id,policy_version_id) REFERENCES workload_policy_version(organization_id,id),
 FOREIGN KEY(organization_id,dataset_id) REFERENCES admin_boundary_dataset(organization_id,id),
 FOREIGN KEY(organization_id,scenario_id,supersedes_id) REFERENCES territory_scenario_revision(organization_id,scenario_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE territory_scenario_application(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,scenario_id TEXT NOT NULL,revision_id TEXT NOT NULL,batch_key TEXT NOT NULL,
 distribution_run_id TEXT NOT NULL,effective_date TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 500),created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,scenario_id,batch_key),UNIQUE(organization_id,distribution_run_id),
 FOREIGN KEY(organization_id,scenario_id,revision_id) REFERENCES territory_scenario_revision(organization_id,scenario_id,id),
 FOREIGN KEY(organization_id,distribution_run_id) REFERENCES geo_distribution_run(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE INDEX territory_scenario_history ON territory_scenario(organization_id,updated_at DESC);
CREATE TRIGGER territory_scenario_no_delete BEFORE DELETE ON territory_scenario BEGIN SELECT RAISE(ABORT,'SCENARIO_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER territory_scenario_guard BEFORE UPDATE ON territory_scenario BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR OLD.status='archived' THEN RAISE(ABORT,'SCENARIO_VERSION_REQUIRED') END;
END;
CREATE TRIGGER territory_scenario_revision_no_update BEFORE UPDATE ON territory_scenario_revision BEGIN SELECT RAISE(ABORT,'SCENARIO_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER territory_scenario_revision_no_delete BEFORE DELETE ON territory_scenario_revision BEGIN SELECT RAISE(ABORT,'SCENARIO_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER territory_scenario_application_no_update BEFORE UPDATE ON territory_scenario_application BEGIN SELECT RAISE(ABORT,'SCENARIO_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER territory_scenario_application_no_delete BEFORE DELETE ON territory_scenario_application BEGIN SELECT RAISE(ABORT,'SCENARIO_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER workload_input_workload_policy_version_insert AFTER INSERT ON workload_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_workload_policy_version_update AFTER UPDATE ON workload_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_workload_policy_version_delete AFTER DELETE ON workload_policy_version BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER workload_input_work_calendar_insert AFTER INSERT ON work_calendar BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_work_calendar_update AFTER UPDATE ON work_calendar BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_work_calendar_delete AFTER DELETE ON work_calendar BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
CREATE TRIGGER workload_input_branch_insert AFTER INSERT ON branch BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_branch_update AFTER UPDATE ON branch BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id; END;
CREATE TRIGGER workload_input_branch_delete AFTER DELETE ON branch BEGIN UPDATE geo_distribution_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id; END;
