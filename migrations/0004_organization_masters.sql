ALTER TABLE organization ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE area ADD COLUMN branch_id TEXT;
ALTER TABLE area ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE area ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived'));
CREATE TABLE branch (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),name TEXT NOT NULL,
 timezone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(organization_id,id),UNIQUE(organization_id,name)
);
CREATE TABLE work_calendar (
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,branch_id TEXT NOT NULL,name TEXT NOT NULL,
 weekdays_json TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,holidays_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),version INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(organization_id,branch_id) REFERENCES branch(organization_id,id)
);
CREATE UNIQUE INDEX calendar_one_active_per_branch ON work_calendar(organization_id,branch_id) WHERE status='active';
CREATE TRIGGER area_branch_insert BEFORE INSERT ON area WHEN NEW.branch_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM branch WHERE id=NEW.branch_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_BRANCH') END;
END;
CREATE TRIGGER area_branch_update BEFORE UPDATE OF branch_id ON area WHEN NEW.branch_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM branch WHERE id=NEW.branch_id AND organization_id=NEW.organization_id AND status='active') THEN RAISE(ABORT,'INVALID_BRANCH') END;
END;
CREATE TABLE master_audit(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,actor_id TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,action TEXT NOT NULL,occurred_at TEXT NOT NULL,before_json TEXT,after_json TEXT NOT NULL);
CREATE TABLE master_idempotency(organization_id TEXT NOT NULL,actor_id TEXT NOT NULL,path TEXT NOT NULL,key TEXT NOT NULL,payload_hash TEXT NOT NULL,response_json TEXT NOT NULL,PRIMARY KEY(organization_id,actor_id,path,key));
CREATE TABLE master_mutation_guard(ok INTEGER NOT NULL CHECK(ok=1));
