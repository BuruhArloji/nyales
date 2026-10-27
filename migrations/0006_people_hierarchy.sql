ALTER TABLE app_user ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE auth_role_assignment ADD COLUMN channel TEXT CHECK(channel IN ('field','telesales'));
UPDATE auth_role_assignment SET channel=CASE WHEN role_code='TELESALES' THEN 'telesales' WHEN role_code IN ('SALES_REP','SUPERVISOR','AREA_MANAGER') THEN 'field' ELSE NULL END;
ALTER TABLE reporting_assignment ADD COLUMN channel TEXT NOT NULL DEFAULT 'field' CHECK(channel IN ('field','telesales'));
ALTER TABLE reporting_assignment ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TRIGGER role_no_overlap_insert BEFORE INSERT ON auth_role_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=NEW.organization_id AND r.user_id=NEW.user_id AND r.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(r.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ROLE_OVERLAP') END;
END;
CREATE TRIGGER role_no_overlap_update BEFORE UPDATE ON auth_role_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.id<>NEW.id AND r.organization_id=NEW.organization_id AND r.user_id=NEW.user_id AND r.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(r.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'ROLE_OVERLAP') END;
END;
CREATE TRIGGER reporting_no_overlap_insert BEFORE INSERT ON reporting_assignment BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM reporting_assignment r WHERE r.organization_id=NEW.organization_id AND r.subordinate_id=NEW.subordinate_id AND r.effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(r.effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'HIERARCHY_OVERLAP') END;
 SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id,from_date,to_date) AS (SELECT NEW.manager_id,NEW.effective_from_date,COALESCE(NEW.effective_to_date,'9999-12-31') UNION SELECT r.manager_id,MAX(t.from_date,r.effective_from_date),MIN(t.to_date,COALESCE(r.effective_to_date,'9999-12-31')) FROM reporting_assignment r JOIN ancestors t ON r.subordinate_id=t.id WHERE r.organization_id=NEW.organization_id AND r.effective_from_date<t.to_date AND t.from_date<COALESCE(r.effective_to_date,'9999-12-31')) SELECT 1 FROM ancestors WHERE id=NEW.subordinate_id) THEN RAISE(ABORT,'HIERARCHY_CYCLE') END;
END;
CREATE TRIGGER reporting_immutable BEFORE UPDATE ON reporting_assignment WHEN NEW.subordinate_id<>OLD.subordinate_id OR NEW.manager_id<>OLD.manager_id OR NEW.area_id<>OLD.area_id OR NEW.channel<>OLD.channel OR NEW.effective_from_date<>OLD.effective_from_date OR NEW.organization_id<>OLD.organization_id BEGIN SELECT RAISE(ABORT,'HIERARCHY_IMMUTABLE'); END;
