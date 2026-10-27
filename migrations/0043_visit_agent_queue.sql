-- Agent delivery queue currently accepts connection probes only, never planning/customer payloads.
CREATE TABLE visit_agent_queue_job(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,target_agent_id TEXT NOT NULL,target_generation INTEGER NOT NULL CHECK(target_generation>0),kind TEXT NOT NULL CHECK(kind='connection_probe'),requested_by TEXT NOT NULL,
 rep_ids_json TEXT NOT NULL CHECK(json_valid(rep_ids_json)),payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 state TEXT NOT NULL CHECK(state IN('queued','running','cancel_requested','completed','failed','cancelled','expired')),version INTEGER NOT NULL CHECK(version>0),attempt_no INTEGER NOT NULL CHECK(attempt_no BETWEEN 0 AND 3),fence INTEGER NOT NULL CHECK(fence>=0),
 lease_credential_id TEXT,lease_until TEXT,checkpoint_code TEXT NOT NULL CHECK(checkpoint_code IN('waiting','claimed','probe_received','probe_verified')),failure_code TEXT,result_sha256 TEXT CHECK(result_sha256 IS NULL OR length(result_sha256)=64),created_at TEXT NOT NULL,expires_at TEXT NOT NULL,ended_at TEXT,
 UNIQUE(organization_id,environment,id),FOREIGN KEY(organization_id,environment,target_agent_id) REFERENCES visit_generator_agent(organization_id,environment,id),FOREIGN KEY(organization_id,environment,lease_credential_id) REFERENCES visit_generator_credential(organization_id,environment,id),FOREIGN KEY(organization_id,requested_by) REFERENCES app_user(organization_id,id),
 CHECK((state IN('running','cancel_requested'))=(lease_credential_id IS NOT NULL)),CHECK((lease_credential_id IS NULL)=(lease_until IS NULL)),CHECK((state IN('completed','failed','cancelled','expired'))=(ended_at IS NOT NULL)),CHECK((state='completed')=(result_sha256 IS NOT NULL))
);
CREATE INDEX visit_agent_queue_recent ON visit_agent_queue_job(organization_id,environment,created_at DESC,id);
CREATE INDEX visit_agent_queue_expiry ON visit_agent_queue_job(state,expires_at,lease_until);
CREATE UNIQUE INDEX visit_agent_queue_one_pending ON visit_agent_queue_job(organization_id,environment,target_agent_id) WHERE state IN('queued','running','cancel_requested');
CREATE TABLE visit_agent_queue_attempt(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,job_id TEXT NOT NULL,attempt_no INTEGER NOT NULL CHECK(attempt_no>0),fence INTEGER NOT NULL CHECK(fence>0),credential_id TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),
 status TEXT NOT NULL CHECK(status IN('running','completed','failed','fenced','cancelled')),claimed_at TEXT NOT NULL,heartbeat_at TEXT NOT NULL,ended_at TEXT,failure_code TEXT,
 UNIQUE(organization_id,environment,job_id,attempt_no),UNIQUE(organization_id,environment,job_id,fence),FOREIGN KEY(organization_id,environment,job_id) REFERENCES visit_agent_queue_job(organization_id,environment,id),FOREIGN KEY(organization_id,environment,credential_id) REFERENCES visit_generator_credential(organization_id,environment,id),CHECK((status='running')=(ended_at IS NULL))
);
CREATE TABLE visit_agent_queue_event(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,environment TEXT NOT NULL,job_id TEXT NOT NULL,job_version INTEGER NOT NULL,event_code TEXT NOT NULL,actor_kind TEXT NOT NULL CHECK(actor_kind IN('user','machine','scheduler')),actor_id TEXT NOT NULL,details_json TEXT NOT NULL CHECK(json_valid(details_json)),created_at TEXT NOT NULL,
 UNIQUE(organization_id,environment,job_id,job_version),FOREIGN KEY(organization_id,environment,job_id) REFERENCES visit_agent_queue_job(organization_id,environment,id)
);
CREATE TRIGGER visit_agent_queue_job_guard BEFORE UPDATE ON visit_agent_queue_job BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.environment<>OLD.environment OR NEW.target_agent_id<>OLD.target_agent_id OR NEW.target_generation<>OLD.target_generation OR NEW.kind<>OLD.kind OR NEW.requested_by<>OLD.requested_by OR NEW.rep_ids_json<>OLD.rep_ids_json OR NEW.payload_json<>OLD.payload_json OR NEW.payload_sha256<>OLD.payload_sha256 OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at OR NEW.version<>OLD.version+1 OR OLD.state IN('completed','failed','cancelled','expired') THEN RAISE(ABORT,'AGENT_QUEUE_IMMUTABLE_OR_VERSION') END;
 SELECT CASE WHEN NOT(
  (OLD.state='queued' AND NEW.state='running' AND NEW.attempt_no=OLD.attempt_no+1 AND NEW.fence=OLD.fence+1) OR
  (OLD.state='queued' AND NEW.state IN('cancelled','failed','expired') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence=OLD.fence) OR
  (OLD.state IN('running','cancel_requested') AND NEW.state IN('running','cancel_requested') AND (OLD.state='running' OR NEW.state='cancel_requested') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence=OLD.fence AND NEW.lease_credential_id IS OLD.lease_credential_id) OR
  (OLD.state='running' AND NEW.state IN('queued','completed','failed','cancelled','expired') AND NEW.attempt_no=OLD.attempt_no AND NEW.fence>=OLD.fence) OR
  (OLD.state='cancel_requested' AND NEW.state='cancelled' AND NEW.attempt_no=OLD.attempt_no AND NEW.fence>=OLD.fence)
 ) THEN RAISE(ABORT,'AGENT_QUEUE_STATE_TRANSITION') END;
END;
CREATE TRIGGER visit_agent_queue_job_no_delete BEFORE DELETE ON visit_agent_queue_job BEGIN SELECT RAISE(ABORT,'AGENT_QUEUE_HISTORY_IMMUTABLE');END;
CREATE TRIGGER visit_agent_queue_attempt_guard BEFORE UPDATE ON visit_agent_queue_attempt WHEN OLD.status<>'running' OR NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.environment<>OLD.environment OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.fence<>OLD.fence OR NEW.credential_id<>OLD.credential_id OR NEW.generation<>OLD.generation OR NEW.claimed_at<>OLD.claimed_at BEGIN SELECT RAISE(ABORT,'AGENT_ATTEMPT_IMMUTABLE');END;
CREATE TRIGGER visit_agent_queue_attempt_no_delete BEFORE DELETE ON visit_agent_queue_attempt BEGIN SELECT RAISE(ABORT,'AGENT_ATTEMPT_IMMUTABLE');END;
CREATE TRIGGER visit_agent_queue_event_no_update BEFORE UPDATE ON visit_agent_queue_event BEGIN SELECT RAISE(ABORT,'AGENT_QUEUE_EVENT_IMMUTABLE');END;
CREATE TRIGGER visit_agent_queue_event_no_delete BEFORE DELETE ON visit_agent_queue_event BEGIN SELECT RAISE(ABORT,'AGENT_QUEUE_EVENT_IMMUTABLE');END;
