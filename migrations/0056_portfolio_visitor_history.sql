CREATE TABLE portfolio_visitor_history (
 organization_id TEXT NOT NULL REFERENCES organization(id),
 subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
 email TEXT NOT NULL,
 display_name TEXT NOT NULL,
 account_kind TEXT NOT NULL CHECK(account_kind IN ('owner','visitor')),
 first_seen_at TEXT NOT NULL,
 last_seen_at TEXT NOT NULL,
 last_auth_time INTEGER NOT NULL,
 visit_count INTEGER NOT NULL DEFAULT 1 CHECK(visit_count>0),
 PRIMARY KEY(organization_id,subject_hash)
);
CREATE INDEX portfolio_visitor_history_recent ON portfolio_visitor_history(organization_id,last_seen_at DESC,subject_hash DESC);
