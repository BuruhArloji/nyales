CREATE INDEX field_plan_day ON work_plan(organization_id,kind,scheduled_at,user_id);
CREATE INDEX field_activity_plan ON activity(organization_id,json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,'$.plan_id'),user_id,outlet_id,occurred_at)
 WHERE channel='field' AND activity_kind='visit';
CREATE INDEX field_visit_event_time ON visit_event(organization_id,activity_id,event_kind,occurred_at);
CREATE INDEX field_visit_evidence ON evidence_attachment(organization_id,activity_id,status,created_at);
