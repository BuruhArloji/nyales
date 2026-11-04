-- One 20-minute lifetime admission per verified Google subject; no email/token storage.
CREATE TABLE portfolio_access(
 subject_hash TEXT PRIMARY KEY CHECK(length(subject_hash)=64),
 first_admitted_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 CHECK(expires_at>first_admitted_at)
);
CREATE TRIGGER portfolio_access_immutable BEFORE UPDATE ON portfolio_access BEGIN SELECT RAISE(ABORT,'PORTFOLIO_ADMISSION_IMMUTABLE');END;
CREATE TRIGGER portfolio_access_retained BEFORE DELETE ON portfolio_access BEGIN SELECT RAISE(ABORT,'PORTFOLIO_ADMISSION_RETAINED');END;
CREATE TABLE portfolio_preview_budget(
 subject_hash TEXT PRIMARY KEY REFERENCES portfolio_access(subject_hash),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5)
);
