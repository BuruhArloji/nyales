-- WEB-069 DESIGN ONLY. Not in migrations/, not applied to any running database.
-- Actual installation must be reviewed under WEB-070/071/073 with recovery first.
CREATE UNIQUE INDEX visit_generator_work_plan_org_id ON work_plan(organization_id,id);
CREATE TABLE visit_generator_policy_version(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),revision_no INTEGER NOT NULL CHECK(revision_no>0),
 name TEXT NOT NULL,config_json TEXT NOT NULL CHECK(json_valid(config_json)),config_sha256 TEXT NOT NULL CHECK(length(config_sha256)=64),
 status TEXT NOT NULL CHECK(status IN('draft','active','retired')),version INTEGER NOT NULL CHECK(version>0),reason TEXT NOT NULL,
 created_by TEXT NOT NULL,created_at TEXT NOT NULL,activated_by TEXT,activated_at TEXT,
 UNIQUE(organization_id,id),UNIQUE(organization_id,revision_no),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,activated_by) REFERENCES app_user(organization_id,id),CHECK((activated_by IS NULL)=(activated_at IS NULL)),CHECK(status<>'active' OR activated_at IS NOT NULL)
);
CREATE UNIQUE INDEX visit_generator_one_active_policy ON visit_generator_policy_version(organization_id) WHERE status='active';
CREATE TABLE visit_generator_graph_release(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)),manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),
 graph_sha256 TEXT NOT NULL CHECK(length(graph_sha256)=64),profile TEXT NOT NULL CHECK(profile IN('car','motorcycle','bicycle','foot')),
 status TEXT NOT NULL CHECK(status IN('draft','active','retired')),version INTEGER NOT NULL CHECK(version>0),reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE visit_generator_agent(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),environment TEXT NOT NULL,name TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('pairing','active','revoked')),granted_rep_ids_json TEXT NOT NULL CHECK(json_valid(granted_rep_ids_json) AND json_type(granted_rep_ids_json)='array'),
 credential_generation INTEGER NOT NULL CHECK(credential_generation>0),version INTEGER NOT NULL CHECK(version>0),public_key_jwk_json TEXT CHECK(public_key_jwk_json IS NULL OR json_valid(public_key_jwk_json)),
 last_seen_at TEXT,capabilities_json TEXT CHECK(capabilities_json IS NULL OR json_valid(capabilities_json)),created_by TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT,
 UNIQUE(organization_id,environment,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),CHECK(status<>'active' OR public_key_jwk_json IS NOT NULL)
);
CREATE TABLE visit_generator_pairing(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,code_sha256 TEXT NOT NULL UNIQUE CHECK(length(code_sha256)=64),
 expires_at TEXT NOT NULL,consumed_at TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE visit_generator_credential(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),
 secret_sha256 TEXT NOT NULL UNIQUE CHECK(length(secret_sha256)=64),key_thumbprint TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,created_at TEXT NOT NULL,
 UNIQUE(organization_id,environment,id),FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id)
);
CREATE TABLE visit_generator_agent_nonce(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,credential_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),
 kind TEXT NOT NULL CHECK(kind IN('challenge','proof_jti')),value_sha256 TEXT NOT NULL CHECK(length(value_sha256)=64),target_sha256 TEXT NOT NULL CHECK(length(target_sha256)=64),
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL,consumed_at TEXT,
 UNIQUE(organization_id,environment,credential_id,kind,value_sha256),FOREIGN KEY(organization_id,environment,credential_id) REFERENCES visit_generator_credential(organization_id,environment,id),
 CHECK(kind<>'proof_jti' OR consumed_at IS NOT NULL)
);
CREATE TABLE visit_generator_job(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),environment TEXT NOT NULL,requested_by TEXT NOT NULL,
 policy_version_id TEXT NOT NULL,graph_id TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),scope_fingerprint TEXT NOT NULL CHECK(length(scope_fingerprint)=64),
 snapshot_storage_key TEXT NOT NULL,snapshot_sha256 TEXT NOT NULL CHECK(length(snapshot_sha256)=64),snapshot_bytes INTEGER NOT NULL CHECK(snapshot_bytes BETWEEN 1 AND 8388608),
 source_epoch INTEGER NOT NULL CHECK(source_epoch>=0),agenda_version INTEGER NOT NULL CHECK(agenda_version>=0),state TEXT NOT NULL CHECK(state IN('queued','running','cancel_requested','completed','failed','cancelled','expired')),
 attempt_no INTEGER NOT NULL CHECK(attempt_no>=0),fence INTEGER NOT NULL CHECK(fence>=0),max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 5),version INTEGER NOT NULL CHECK(version>0),
 leased_agent_id TEXT,leased_generation INTEGER,lease_until TEXT,result_sha256 TEXT CHECK(result_sha256 IS NULL OR length(result_sha256)=64),failure_code TEXT,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,environment,id),
 FOREIGN KEY(organization_id,requested_by) REFERENCES app_user(organization_id,id),FOREIGN KEY(organization_id,policy_version_id) REFERENCES visit_generator_policy_version(organization_id,id),
 FOREIGN KEY(organization_id,graph_id) REFERENCES visit_generator_graph_release(organization_id,id),FOREIGN KEY(organization_id,environment,leased_agent_id) REFERENCES visit_generator_agent(organization_id,environment,id),
 CHECK((leased_agent_id IS NULL)=(leased_generation IS NULL) AND(leased_agent_id IS NULL)=(lease_until IS NULL)),
 CHECK((state IN('running','cancel_requested'))=(leased_agent_id IS NOT NULL)),CHECK(state<>'completed' OR result_sha256 IS NOT NULL),CHECK(attempt_no<=max_attempts)
);
CREATE INDEX visit_generator_queue ON visit_generator_job(organization_id,environment,state,created_at,id);
CREATE UNIQUE INDEX visit_generator_one_agent_running_job ON visit_generator_job(organization_id,environment,leased_agent_id) WHERE state IN('running','cancel_requested');
CREATE TABLE visit_generator_attempt(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,job_id TEXT NOT NULL,attempt_no INTEGER NOT NULL CHECK(attempt_no>0),fence INTEGER NOT NULL CHECK(fence>0),
 agent_id TEXT NOT NULL,credential_generation INTEGER NOT NULL CHECK(credential_generation>0),status TEXT NOT NULL CHECK(status IN('running','completed','failed','fenced','cancelled')),
 claimed_at TEXT NOT NULL,heartbeat_at TEXT NOT NULL,ended_at TEXT,failure_code TEXT,
 UNIQUE(organization_id,id),UNIQUE(organization_id,job_id,id),UNIQUE(organization_id,job_id,attempt_no),UNIQUE(organization_id,job_id,fence),
 FOREIGN KEY(organization_id,environment,job_id) REFERENCES visit_generator_job(organization_id,environment,id),FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id)
);
CREATE TABLE visit_generator_artifact(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,job_id TEXT NOT NULL,attempt_id TEXT,kind TEXT NOT NULL CHECK(kind IN('input','matrix','checkpoint','result')),
 part_no INTEGER NOT NULL CHECK(part_no BETWEEN 0 AND 99),status TEXT NOT NULL CHECK(status IN('uploading','sealed','abandoned')),storage_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),byte_count INTEGER NOT NULL CHECK(byte_count BETWEEN 1 AND 1048576),created_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,job_id,id),UNIQUE(organization_id,job_id,attempt_id,kind,part_no),
 FOREIGN KEY(organization_id,job_id) REFERENCES visit_generator_job(organization_id,id),FOREIGN KEY(organization_id,job_id,attempt_id) REFERENCES visit_generator_attempt(organization_id,job_id,id),
 CHECK(kind='input' OR attempt_id IS NOT NULL)
);
CREATE UNIQUE INDEX visit_generator_input_part ON visit_generator_artifact(organization_id,job_id,part_no) WHERE kind='input';
CREATE TABLE visit_generator_candidate_revision(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,job_id TEXT NOT NULL,attempt_id TEXT NOT NULL,revision_no INTEGER NOT NULL CHECK(revision_no>0),supersedes_id TEXT,
 result_manifest_json TEXT NOT NULL CHECK(json_valid(result_manifest_json)),result_sha256 TEXT NOT NULL CHECK(length(result_sha256)=64),
 validation_json TEXT NOT NULL CHECK(json_valid(validation_json)),solver_outcome TEXT NOT NULL CHECK(solver_outcome IN('feasible','infeasible','timeout_with_candidate','timeout_without_candidate')),
 source_epoch INTEGER NOT NULL CHECK(source_epoch>=0),agenda_version INTEGER NOT NULL CHECK(agenda_version>=0),created_by TEXT,created_at TEXT NOT NULL,
 UNIQUE(organization_id,id),UNIQUE(organization_id,job_id,id),UNIQUE(organization_id,job_id,revision_no),
 FOREIGN KEY(organization_id,job_id,attempt_id) REFERENCES visit_generator_attempt(organization_id,job_id,id),FOREIGN KEY(organization_id,job_id,supersedes_id) REFERENCES visit_generator_candidate_revision(organization_id,job_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE visit_generator_agenda_epoch(organization_id TEXT PRIMARY KEY REFERENCES organization(id),epoch INTEGER NOT NULL DEFAULT 0 CHECK(epoch>=0));
INSERT INTO visit_generator_agenda_epoch SELECT id,0 FROM organization;
CREATE TRIGGER visit_generator_new_org AFTER INSERT ON organization BEGIN INSERT INTO visit_generator_agenda_epoch VALUES(NEW.id,0);END;
CREATE TRIGGER visit_generator_plan_insert AFTER INSERT ON work_plan BEGIN UPDATE visit_generator_agenda_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_generator_plan_update AFTER UPDATE ON work_plan BEGIN UPDATE visit_generator_agenda_epoch SET epoch=epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_generator_plan_delete AFTER DELETE ON work_plan BEGIN UPDATE visit_generator_agenda_epoch SET epoch=epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TABLE visit_generator_publish_batch(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,candidate_revision_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('staging','ready','activated','aborted')),
 expected_source_epoch INTEGER NOT NULL,expected_agenda_version INTEGER NOT NULL,review_sha256 TEXT NOT NULL CHECK(length(review_sha256)=64),expected_items INTEGER NOT NULL CHECK(expected_items BETWEEN 0 AND 6000),
 version INTEGER NOT NULL CHECK(version>0),reason TEXT NOT NULL,reviewed_by TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,activated_at TEXT,
 UNIQUE(organization_id,id),FOREIGN KEY(organization_id,candidate_revision_id) REFERENCES visit_generator_candidate_revision(organization_id,id),FOREIGN KEY(organization_id,reviewed_by) REFERENCES app_user(organization_id,id),CHECK((status='activated')=(activated_at IS NOT NULL))
);
CREATE TABLE visit_generator_publish_item(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,batch_id TEXT NOT NULL,occurrence_id TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN('create','replace','cancel','preserve')),
 existing_work_plan_id TEXT,expected_work_plan_version INTEGER,new_work_plan_id TEXT,rep_id TEXT NOT NULL,customer_id TEXT NOT NULL,scheduled_at TEXT NOT NULL,
 row_json TEXT NOT NULL CHECK(json_valid(row_json)),row_sha256 TEXT NOT NULL CHECK(length(row_sha256)=64),
 UNIQUE(organization_id,id),UNIQUE(organization_id,batch_id,occurrence_id),UNIQUE(organization_id,batch_id,id),
 FOREIGN KEY(organization_id,batch_id) REFERENCES visit_generator_publish_batch(organization_id,id),FOREIGN KEY(organization_id,existing_work_plan_id) REFERENCES work_plan(organization_id,id),
 FOREIGN KEY(organization_id,rep_id) REFERENCES app_user(organization_id,id),FOREIGN KEY(organization_id,customer_id) REFERENCES customer_outlet(organization_id,id),
 CHECK((action='create' AND existing_work_plan_id IS NULL AND expected_work_plan_version IS NULL AND new_work_plan_id IS NOT NULL) OR(action<>'create' AND existing_work_plan_id IS NOT NULL AND expected_work_plan_version IS NOT NULL))
);
CREATE TABLE visit_generator_plan_link(
 organization_id TEXT NOT NULL,batch_id TEXT NOT NULL,publish_item_id TEXT NOT NULL,work_plan_id TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,batch_id,publish_item_id),UNIQUE(organization_id,batch_id,work_plan_id),
 FOREIGN KEY(organization_id,batch_id,publish_item_id) REFERENCES visit_generator_publish_item(organization_id,batch_id,id),FOREIGN KEY(organization_id,work_plan_id) REFERENCES work_plan(organization_id,id)
);
CREATE TRIGGER visit_generator_candidate_no_update BEFORE UPDATE ON visit_generator_candidate_revision BEGIN SELECT RAISE(ABORT,'GENERATOR_EVIDENCE_IMMUTABLE');END;
CREATE TRIGGER visit_generator_candidate_no_delete BEFORE DELETE ON visit_generator_candidate_revision BEGIN SELECT RAISE(ABORT,'GENERATOR_EVIDENCE_IMMUTABLE');END;
CREATE TRIGGER visit_generator_publish_item_insert BEFORE INSERT ON visit_generator_publish_item WHEN NOT EXISTS(SELECT 1 FROM visit_generator_publish_batch WHERE organization_id=NEW.organization_id AND id=NEW.batch_id AND status='staging') BEGIN SELECT RAISE(ABORT,'PUBLISH_NOT_STAGING');END;
CREATE TRIGGER visit_generator_publish_item_no_update BEFORE UPDATE ON visit_generator_publish_item BEGIN SELECT RAISE(ABORT,'PUBLISH_DIFF_IMMUTABLE');END;
CREATE TRIGGER visit_generator_publish_item_no_delete BEFORE DELETE ON visit_generator_publish_item BEGIN SELECT RAISE(ABORT,'PUBLISH_DIFF_IMMUTABLE');END;
CREATE TRIGGER visit_generator_job_guard BEFORE UPDATE ON visit_generator_job BEGIN
 SELECT CASE WHEN NEW.organization_id<>OLD.organization_id OR NEW.environment<>OLD.environment OR NEW.id<>OLD.id OR NEW.snapshot_sha256<>OLD.snapshot_sha256 OR NEW.snapshot_storage_key<>OLD.snapshot_storage_key OR NEW.request_json<>OLD.request_json OR NEW.requested_by<>OLD.requested_by OR NEW.policy_version_id<>OLD.policy_version_id OR NEW.graph_id<>OLD.graph_id OR NEW.scope_fingerprint<>OLD.scope_fingerprint OR NEW.source_epoch<>OLD.source_epoch OR NEW.agenda_version<>OLD.agenda_version OR NEW.snapshot_bytes<>OLD.snapshot_bytes OR NEW.max_attempts<>OLD.max_attempts OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at OR NEW.version<>OLD.version+1 OR OLD.state IN('completed','failed','cancelled','expired') THEN RAISE(ABORT,'GENERATOR_JOB_VERSION_OR_IMMUTABILITY') END;
 SELECT CASE WHEN NOT((OLD.state='queued' AND NEW.state='running' AND NEW.attempt_no=OLD.attempt_no+1 AND NEW.fence>OLD.fence) OR(OLD.state='queued' AND NEW.state IN('cancelled','expired') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence>=OLD.fence) OR(OLD.state='running' AND NEW.state IN('running','cancel_requested') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence=OLD.fence AND NEW.leased_agent_id IS OLD.leased_agent_id AND NEW.leased_generation IS OLD.leased_generation) OR(OLD.state='running' AND NEW.state IN('queued','completed','failed','cancelled','expired') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence>=OLD.fence) OR(OLD.state='cancel_requested' AND NEW.state='cancelled' AND NEW.attempt_no=OLD.attempt_no AND NEW.fence>=OLD.fence)) THEN RAISE(ABORT,'GENERATOR_JOB_STATE_TRANSITION') END;
END;
CREATE TRIGGER visit_generator_publish_guard BEFORE UPDATE ON visit_generator_publish_batch BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.candidate_revision_id<>OLD.candidate_revision_id OR NEW.review_sha256<>OLD.review_sha256 OR NEW.expected_source_epoch<>OLD.expected_source_epoch OR NEW.expected_agenda_version<>OLD.expected_agenda_version OR NEW.expected_items<>OLD.expected_items OR NEW.reviewed_by<>OLD.reviewed_by OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at OR NEW.reason<>OLD.reason OR NEW.version<>OLD.version+1 OR OLD.status IN('activated','aborted') OR(OLD.status='ready' AND NEW.status NOT IN('activated','aborted')) THEN RAISE(ABORT,'GENERATOR_PUBLISH_VERSION_OR_IMMUTABILITY') END;
END;
CREATE TRIGGER visit_generator_policy_guard BEFORE UPDATE ON visit_generator_policy_version BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.revision_no<>OLD.revision_no OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR OLD.status='retired' OR(OLD.status='active' AND(NEW.status<>'retired' OR NEW.config_json<>OLD.config_json OR NEW.config_sha256<>OLD.config_sha256 OR NEW.name<>OLD.name OR NEW.activated_by IS NOT OLD.activated_by OR NEW.activated_at IS NOT OLD.activated_at)) THEN RAISE(ABORT,'GENERATOR_POLICY_VERSION_OR_IMMUTABILITY') END;
END;
-- Remaining runtime guards are mandatory: server role/scope, graph rights, dated ownership,
-- PoP/replay/credential checks, finite leases/fencing, exact source/agenda/hash verification,
-- checksum-sealed uploads, legal holds, staging row reconciliation, and atomic work_plan
-- insertion/update/revision/lineage/audit/idempotency/activation. SQL alone is not acceptance.

CREATE TRIGGER visit_generator_graph_guard BEFORE UPDATE ON visit_generator_graph_release BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR OLD.status='retired' OR(OLD.status='active' AND(NEW.status<>'retired' OR NEW.manifest_json<>OLD.manifest_json OR NEW.manifest_sha256<>OLD.manifest_sha256 OR NEW.graph_sha256<>OLD.graph_sha256 OR NEW.profile<>OLD.profile)) THEN RAISE(ABORT,'GENERATOR_GRAPH_VERSION_OR_IMMUTABILITY') END;
END;
