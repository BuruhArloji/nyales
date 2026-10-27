-- WEB-070 identity slice only. No solver jobs, graph releases or agenda writes.
CREATE TABLE visit_generator_agent(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),environment TEXT NOT NULL,name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 status TEXT NOT NULL CHECK(status IN('pairing','active','revoked')),granted_rep_ids_json TEXT NOT NULL CHECK(json_valid(granted_rep_ids_json) AND json_type(granted_rep_ids_json)='array' AND json_array_length(granted_rep_ids_json) BETWEEN 1 AND 10),
 credential_generation INTEGER NOT NULL CHECK(credential_generation>0),version INTEGER NOT NULL CHECK(version>0),public_key_jwk_json TEXT CHECK(public_key_jwk_json IS NULL OR json_valid(public_key_jwk_json)),
 last_seen_at TEXT,capabilities_json TEXT CHECK(capabilities_json IS NULL OR json_valid(capabilities_json)),created_by TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT,
 UNIQUE(organization_id,environment,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),CHECK(status<>'active' OR public_key_jwk_json IS NOT NULL),CHECK((status='revoked')=(revoked_at IS NOT NULL))
);
CREATE TABLE visit_generator_pairing(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),code_sha256 TEXT NOT NULL UNIQUE CHECK(length(code_sha256)=64),
 expires_at TEXT NOT NULL,consumed_at TEXT,revoked_at TEXT,created_by TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE visit_generator_credential(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),
 secret_sha256 TEXT NOT NULL UNIQUE CHECK(length(secret_sha256)=64),key_thumbprint TEXT NOT NULL CHECK(length(key_thumbprint)=64),expires_at TEXT NOT NULL,revoked_at TEXT,created_at TEXT NOT NULL,
 UNIQUE(organization_id,environment,id),FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id)
);
CREATE UNIQUE INDEX visit_agent_one_live_credential ON visit_generator_credential(organization_id,environment,agent_id) WHERE revoked_at IS NULL;
CREATE TABLE visit_generator_agent_nonce(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,credential_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),
 kind TEXT NOT NULL CHECK(kind IN('challenge','proof_jti')),value_sha256 TEXT NOT NULL CHECK(length(value_sha256)=64),target_sha256 TEXT NOT NULL CHECK(length(target_sha256)=64),
 created_at TEXT NOT NULL,expires_at TEXT NOT NULL,consumed_at TEXT,
 UNIQUE(organization_id,environment,credential_id,kind,value_sha256),FOREIGN KEY(organization_id,environment,credential_id) REFERENCES visit_generator_credential(organization_id,environment,id),CHECK(kind<>'proof_jti' OR consumed_at IS NOT NULL)
);
CREATE INDEX visit_agent_nonce_expiry ON visit_generator_agent_nonce(expires_at);
CREATE TABLE visit_generator_agent_event(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,event_kind TEXT NOT NULL CHECK(event_kind IN('paired','heartbeat')),generation INTEGER NOT NULL,occurred_at TEXT NOT NULL,details_json TEXT NOT NULL CHECK(json_valid(details_json)),
 FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id)
);
CREATE INDEX visit_agent_events ON visit_generator_agent_event(organization_id,environment,agent_id,occurred_at DESC);
CREATE TABLE visit_generator_agent_operation(
 organization_id TEXT NOT NULL,environment TEXT NOT NULL,agent_id TEXT NOT NULL,generation INTEGER NOT NULL,path TEXT NOT NULL,key TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),response_json TEXT NOT NULL CHECK(json_valid(response_json)),created_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,environment,agent_id,generation,path,key),FOREIGN KEY(organization_id,environment,agent_id) REFERENCES visit_generator_agent(organization_id,environment,id)
);
CREATE INDEX visit_agent_operation_expiry ON visit_generator_agent_operation(expires_at);
CREATE TABLE visit_generator_agent_rate(scope_sha256 TEXT NOT NULL CHECK(length(scope_sha256)=64),bucket INTEGER NOT NULL,calls INTEGER NOT NULL CHECK(calls>0),expires_at TEXT NOT NULL,PRIMARY KEY(scope_sha256,bucket));
CREATE INDEX visit_agent_rate_expiry ON visit_generator_agent_rate(expires_at);
CREATE TRIGGER visit_agent_no_delete BEFORE DELETE ON visit_generator_agent BEGIN SELECT RAISE(ABORT,'VISIT_AGENT_HISTORY_RETAINED');END;
CREATE TRIGGER visit_agent_guard BEFORE UPDATE ON visit_generator_agent BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.environment<>OLD.environment OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.credential_generation<OLD.credential_generation THEN RAISE(ABORT,'VISIT_AGENT_IDENTITY_IMMUTABLE') END;
 SELECT CASE WHEN NOT((NEW.version=OLD.version+1) OR(NEW.version=OLD.version AND NEW.name=OLD.name AND NEW.status=OLD.status AND NEW.granted_rep_ids_json=OLD.granted_rep_ids_json AND NEW.credential_generation=OLD.credential_generation AND NEW.public_key_jwk_json IS OLD.public_key_jwk_json AND NEW.revoked_at IS OLD.revoked_at)) THEN RAISE(ABORT,'VISIT_AGENT_VERSION_REQUIRED') END;
 SELECT CASE WHEN NEW.granted_rep_ids_json<>OLD.granted_rep_ids_json AND(NEW.credential_generation<=OLD.credential_generation OR NEW.status<>'pairing' OR NEW.public_key_jwk_json IS NOT NULL) THEN RAISE(ABORT,'VISIT_AGENT_GRANT_REPAIR_REQUIRED') END;
END;
CREATE TRIGGER visit_agent_event_immutable BEFORE UPDATE ON visit_generator_agent_event BEGIN SELECT RAISE(ABORT,'VISIT_AGENT_EVENT_IMMUTABLE');END;
CREATE TRIGGER visit_agent_event_retained BEFORE DELETE ON visit_generator_agent_event BEGIN SELECT RAISE(ABORT,'VISIT_AGENT_EVENT_IMMUTABLE');END;
