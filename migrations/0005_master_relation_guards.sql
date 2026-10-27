CREATE TRIGGER branch_archive_guard BEFORE UPDATE OF status ON branch WHEN NEW.status='archived' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM area WHERE organization_id=NEW.organization_id AND branch_id=NEW.id AND status='active') OR EXISTS(SELECT 1 FROM work_calendar WHERE organization_id=NEW.organization_id AND branch_id=NEW.id AND status='active') THEN RAISE(ABORT,'BRANCH_IN_USE') END;
END;
CREATE TRIGGER calendar_branch_insert BEFORE INSERT ON work_calendar BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM branch WHERE organization_id=NEW.organization_id AND id=NEW.branch_id AND status='active') THEN RAISE(ABORT,'INVALID_BRANCH') END;
END;
CREATE TRIGGER calendar_branch_update BEFORE UPDATE OF branch_id,status ON work_calendar WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM branch WHERE organization_id=NEW.organization_id AND id=NEW.branch_id AND status='active') THEN RAISE(ABORT,'INVALID_BRANCH') END;
END;
