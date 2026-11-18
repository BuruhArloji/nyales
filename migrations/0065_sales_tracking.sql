-- Separate from work_session: explicitly opted-in GPS tracking is not attendance.
CREATE TABLE sales_tracking_session (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT NOT NULL REFERENCES app_user(id),
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  expires_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('active', 'stopped')),
  CHECK ((state = 'active' AND stopped_at IS NULL) OR (state = 'stopped' AND stopped_at IS NOT NULL))
);
CREATE UNIQUE INDEX sales_tracking_one_active ON sales_tracking_session(organization_id,user_id) WHERE state='active';
CREATE INDEX sales_tracking_session_scope ON sales_tracking_session(organization_id,user_id,started_at DESC);

-- Metadata is separate from immutable R2 objects. Pending writes are reconciled.
CREATE TABLE sales_tracking_batch (
  organization_id TEXT NOT NULL REFERENCES organization(id),
  session_id TEXT NOT NULL REFERENCES sales_tracking_session(id),
  batch_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'deleting')),
  first_captured_at TEXT NOT NULL,
  last_captured_at TEXT NOT NULL,
  point_count INTEGER NOT NULL CHECK(point_count > 0 AND point_count <= 100),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (organization_id,session_id,batch_id)
);
CREATE INDEX sales_tracking_batch_expiry ON sales_tracking_batch(expires_at,state);
CREATE INDEX sales_tracking_batch_history ON sales_tracking_batch(organization_id,session_id,first_captured_at);

-- One row per sales/day, instead of one D1 row per GPS fix.
CREATE TABLE sales_tracking_daily_summary (
  organization_id TEXT NOT NULL REFERENCES organization(id),
  user_id TEXT NOT NULL REFERENCES app_user(id),
  local_date TEXT NOT NULL,
  last_latitude REAL,
  last_longitude REAL,
  last_accuracy_m REAL,
  last_captured_at TEXT,
  estimated_distance_m REAL NOT NULL DEFAULT 0 CHECK(estimated_distance_m >= 0),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (organization_id,user_id,local_date)
);
CREATE INDEX sales_tracking_summary_expiry ON sales_tracking_daily_summary(expires_at);
