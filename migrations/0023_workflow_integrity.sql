CREATE UNIQUE INDEX sales_exception_open_unique ON sales_exception(organization_id,resource_id,kind) WHERE status='open';
CREATE TRIGGER visit_event_immutable BEFORE UPDATE ON visit_event BEGIN SELECT RAISE(ABORT,'VISIT_EVENT_IMMUTABLE');END;
CREATE TRIGGER visit_event_retained BEFORE DELETE ON visit_event BEGIN SELECT RAISE(ABORT,'VISIT_EVENT_IMMUTABLE');END;
