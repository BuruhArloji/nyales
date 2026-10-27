CREATE TABLE device_session (
 id TEXT PRIMARY KEY,
 organization_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 auth_subject TEXT NOT NULL,
 device_id TEXT NOT NULL,
 device_label TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 auth_time INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 revoked_at TEXT,
 revoked_by TEXT,
 revoke_reason TEXT,
 version INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(organization_id,user_id) REFERENCES app_user(organization_id,id)
);
CREATE INDEX device_session_owner ON device_session(organization_id,user_id,created_at);
CREATE INDEX device_session_expiry ON device_session(organization_id,expires_at);
CREATE TRIGGER device_session_identity_immutable BEFORE UPDATE OF organization_id,user_id,auth_subject,device_id,token_hash,auth_time,created_at,expires_at ON device_session BEGIN
 SELECT RAISE(ABORT,'SESSION_IDENTITY_IMMUTABLE');
END;
