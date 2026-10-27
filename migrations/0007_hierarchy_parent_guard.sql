CREATE TRIGGER hierarchy_parent_guard BEFORE INSERT ON reporting_assignment BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM app_user WHERE organization_id=NEW.organization_id AND id=NEW.manager_id AND status='active') THEN RAISE(ABORT,'MANAGER_INACTIVE') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM auth_role_assignment sr JOIN auth_role_assignment mr ON sr.organization_id=mr.organization_id
  WHERE sr.organization_id=NEW.organization_id AND sr.user_id=NEW.subordinate_id AND mr.user_id=NEW.manager_id
  AND sr.effective_from_date<=NEW.effective_from_date AND mr.effective_from_date<=NEW.effective_from_date
  AND (sr.effective_to_date IS NULL OR (NEW.effective_to_date IS NOT NULL AND sr.effective_to_date>=NEW.effective_to_date))
  AND (mr.effective_to_date IS NULL OR (NEW.effective_to_date IS NOT NULL AND mr.effective_to_date>=NEW.effective_to_date))
  AND (sr.channel IS NULL OR sr.channel=NEW.channel) AND (mr.channel IS NULL OR mr.channel=NEW.channel)
  AND ((sr.role_code IN ('SALES_REP','TELESALES') AND mr.role_code='SUPERVISOR') OR (sr.role_code='SUPERVISOR' AND mr.role_code='AREA_MANAGER') OR (sr.role_code='AREA_MANAGER' AND mr.role_code IN ('NSM','MANAGEMENT')) OR (sr.role_code='NSM' AND mr.role_code='MANAGEMENT'))
 ) THEN RAISE(ABORT,'INVALID_REPORTING_ROLES') END;
END;
