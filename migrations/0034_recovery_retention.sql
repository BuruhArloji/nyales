CREATE TABLE recovery_policy (
 organization_id TEXT PRIMARY KEY,
 backup_interval_minutes INTEGER NOT NULL DEFAULT 15 CHECK(backup_interval_minutes BETWEEN 5 AND 1440),
 rpo_minutes INTEGER NOT NULL DEFAULT 15 CHECK(rpo_minutes BETWEEN 1 AND 1440),
 rto_minutes INTEGER NOT NULL DEFAULT 240 CHECK(rto_minutes BETWEEN 1 AND 1440),
 retention_days INTEGER NOT NULL DEFAULT 90 CHECK(retention_days BETWEEN 1 AND 3650),
 gps_detail_days INTEGER NOT NULL DEFAULT 7 CHECK(gps_detail_days BETWEEN 1 AND 365),
 attachment_days INTEGER NOT NULL DEFAULT 90 CHECK(attachment_days BETWEEN 1 AND 3650),
 backup_days INTEGER NOT NULL DEFAULT 35 CHECK(backup_days BETWEEN 1 AND 3650),
 legal_hold_required INTEGER NOT NULL DEFAULT 1 CHECK(legal_hold_required IN(0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);

CREATE TABLE recovery_manifest (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('logical','attachment_metadata')),
 storage_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 cutoff_at TEXT NOT NULL,
 schema_version TEXT NOT NULL,
 row_count INTEGER NOT NULL CHECK(row_count>=0),
 byte_count INTEGER NOT NULL CHECK(byte_count>=0),
 sha256 TEXT NOT NULL,
 attachment_count INTEGER NOT NULL DEFAULT 0 CHECK(attachment_count>=0),
 attachment_bytes INTEGER NOT NULL DEFAULT 0 CHECK(attachment_bytes>=0),
 status TEXT NOT NULL CHECK(status IN('ready','expired','drill_failed')),
 created_by TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX recovery_manifest_latest ON recovery_manifest(organization_id,created_at DESC,status);

CREATE TABLE recovery_drill (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 manifest_id TEXT NOT NULL,
 started_at TEXT NOT NULL,
 finished_at TEXT,
 status TEXT NOT NULL CHECK(status IN('running','passed','failed')),
 row_count INTEGER NOT NULL DEFAULT 0 CHECK(row_count>=0),
 attachment_count INTEGER NOT NULL DEFAULT 0 CHECK(attachment_count>=0),
 checksum_match INTEGER NOT NULL DEFAULT 0 CHECK(checksum_match IN(0,1)),
 reconciliation_json TEXT NOT NULL DEFAULT '{}',
 initiated_by TEXT NOT NULL,
 notes TEXT
);
CREATE INDEX recovery_drill_latest ON recovery_drill(organization_id,started_at DESC);

CREATE TABLE retention_hold (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 resource_type TEXT NOT NULL CHECK(resource_type IN('customer','invoice','activity','attachment','report_export','backup','privacy_subject')),
 resource_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','released')),
 created_at TEXT NOT NULL,
 released_at TEXT,
 created_by TEXT NOT NULL,
 released_by TEXT,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX retention_hold_active ON retention_hold(organization_id,resource_type,resource_id) WHERE status='active';

CREATE TABLE privacy_request (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 subject_type TEXT NOT NULL CHECK(subject_type IN('customer','user','contact','privacy_subject')),
 subject_id TEXT NOT NULL,
 request_kind TEXT NOT NULL CHECK(request_kind IN('access','correction','erasure')),
 reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN('pending_review','approved','rejected','completed')),
 created_at TEXT NOT NULL,
 requested_by TEXT NOT NULL,
 reviewed_at TEXT,
 reviewed_by TEXT,
 outcome TEXT,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX privacy_request_queue ON privacy_request(organization_id,status,created_at DESC);
