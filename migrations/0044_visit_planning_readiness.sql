-- WEB-070 planning settings and immutable readiness evidence; no solver/job publication.
CREATE TABLE visit_generator_policy_version(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),revision_no INTEGER NOT NULL CHECK(revision_no>0),name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),config_json TEXT NOT NULL CHECK(json_valid(config_json) AND length(config_json)<=1048576),config_sha256 TEXT NOT NULL CHECK(length(config_sha256)=64),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,activated_by TEXT,activated_at TEXT,
 UNIQUE(organization_id,id),UNIQUE(organization_id,revision_no),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id),FOREIGN KEY(organization_id,activated_by) REFERENCES app_user(organization_id,id),CHECK((activated_by IS NULL)=(activated_at IS NULL)),CHECK(status<>'active' OR activated_by IS NOT NULL)
);
CREATE UNIQUE INDEX visit_policy_one_active ON visit_generator_policy_version(organization_id) WHERE status='active';
CREATE TABLE visit_generator_graph_release(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),name TEXT NOT NULL,manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json) AND length(manifest_json)<=16384),manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','retired')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),reason TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,id),FOREIGN KEY(organization_id,created_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE visit_planning_revision(organization_id TEXT PRIMARY KEY REFERENCES organization(id),source_epoch INTEGER NOT NULL DEFAULT 0 CHECK(source_epoch>=0),agenda_epoch INTEGER NOT NULL DEFAULT 0 CHECK(agenda_epoch>=0));
INSERT INTO visit_planning_revision SELECT id,0,0 FROM organization;
CREATE TRIGGER visit_planning_new_org AFTER INSERT ON organization BEGIN INSERT INTO visit_planning_revision VALUES(NEW.id,0,0);END;
CREATE TABLE visit_planning_preflight(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL REFERENCES organization(id),policy_version_id TEXT NOT NULL,graph_id TEXT,actor_id TEXT NOT NULL,input_json TEXT NOT NULL CHECK(json_valid(input_json)),source_epoch INTEGER NOT NULL,agenda_epoch INTEGER NOT NULL,business_date TEXT NOT NULL,storage_key TEXT NOT NULL UNIQUE,snapshot_sha256 TEXT NOT NULL CHECK(length(snapshot_sha256)=64),byte_count INTEGER NOT NULL CHECK(byte_count BETWEEN 1 AND 4194304),customer_count INTEGER NOT NULL CHECK(customer_count BETWEEN 0 AND 200),blocking_count INTEGER NOT NULL CHECK(blocking_count>=0),created_at TEXT NOT NULL,UNIQUE(organization_id,id),FOREIGN KEY(organization_id,policy_version_id) REFERENCES visit_generator_policy_version(organization_id,id),FOREIGN KEY(organization_id,graph_id) REFERENCES visit_generator_graph_release(organization_id,id),FOREIGN KEY(organization_id,actor_id) REFERENCES app_user(organization_id,id)
);
CREATE INDEX visit_planning_history ON visit_planning_preflight(organization_id,created_at DESC,id);
CREATE TRIGGER visit_policy_guard BEFORE UPDATE ON visit_generator_policy_version BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.revision_no<>OLD.revision_no OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR OLD.status='retired' OR (OLD.status<>'draft' AND (NEW.config_json<>OLD.config_json OR NEW.config_sha256<>OLD.config_sha256 OR NEW.name<>OLD.name)) OR (OLD.status='active' AND NEW.status<>'retired') THEN RAISE(ABORT,'VISIT_POLICY_IMMUTABLE_OR_VERSION') END;
END;
CREATE TRIGGER visit_policy_no_delete BEFORE DELETE ON visit_generator_policy_version BEGIN SELECT RAISE(ABORT,'VISIT_POLICY_HISTORY_IMMUTABLE');END;
CREATE TRIGGER visit_graph_guard BEFORE UPDATE ON visit_generator_graph_release BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.organization_id<>OLD.organization_id OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR OLD.status<>'draft' THEN RAISE(ABORT,'VISIT_GRAPH_IMMUTABLE_OR_VERSION') END;
END;
CREATE TRIGGER visit_graph_no_delete BEFORE DELETE ON visit_generator_graph_release BEGIN SELECT RAISE(ABORT,'VISIT_GRAPH_HISTORY_IMMUTABLE');END;
CREATE TRIGGER visit_preflight_no_update BEFORE UPDATE ON visit_planning_preflight BEGIN SELECT RAISE(ABORT,'VISIT_PREFLIGHT_IMMUTABLE');END;
CREATE TRIGGER visit_preflight_no_delete BEFORE DELETE ON visit_planning_preflight BEGIN SELECT RAISE(ABORT,'VISIT_PREFLIGHT_IMMUTABLE');END;
CREATE TRIGGER visit_input_organization_update AFTER UPDATE ON organization BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.id;END;
CREATE TRIGGER visit_input_branch_insert AFTER INSERT ON branch BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_branch_update AFTER UPDATE ON branch BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_branch_delete AFTER DELETE ON branch BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_area_insert AFTER INSERT ON area BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_area_update AFTER UPDATE ON area BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_area_delete AFTER DELETE ON area BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_app_user_insert AFTER INSERT ON app_user BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_app_user_update AFTER UPDATE ON app_user BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_app_user_delete AFTER DELETE ON app_user BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_auth_role_assignment_insert AFTER INSERT ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_auth_role_assignment_update AFTER UPDATE ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_auth_role_assignment_delete AFTER DELETE ON auth_role_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_user_area_scope_insert AFTER INSERT ON user_area_scope BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_user_area_scope_update AFTER UPDATE ON user_area_scope BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_user_area_scope_delete AFTER DELETE ON user_area_scope BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_reporting_assignment_insert AFTER INSERT ON reporting_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_reporting_assignment_update AFTER UPDATE ON reporting_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_reporting_assignment_delete AFTER DELETE ON reporting_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_work_calendar_insert AFTER INSERT ON work_calendar BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_work_calendar_update AFTER UPDATE ON work_calendar BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_work_calendar_delete AFTER DELETE ON work_calendar BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_customer_outlet_insert AFTER INSERT ON customer_outlet BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_outlet_update AFTER UPDATE ON customer_outlet BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_outlet_delete AFTER DELETE ON customer_outlet BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_customer_assignment_insert AFTER INSERT ON customer_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_assignment_update AFTER UPDATE ON customer_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_assignment_delete AFTER DELETE ON customer_assignment BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_invoice_insert AFTER INSERT ON invoice BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_invoice_update AFTER UPDATE ON invoice BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_invoice_delete AFTER DELETE ON invoice BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_customer_source_coverage_insert AFTER INSERT ON customer_source_coverage BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_source_coverage_update AFTER UPDATE ON customer_source_coverage BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_customer_source_coverage_delete AFTER DELETE ON customer_source_coverage BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_activity_insert AFTER INSERT ON activity BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_activity_update AFTER UPDATE ON activity BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_activity_delete AFTER DELETE ON activity BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_work_plan_insert AFTER INSERT ON work_plan BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1,agenda_epoch=agenda_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_work_plan_update AFTER UPDATE ON work_plan BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1,agenda_epoch=agenda_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_work_plan_delete AFTER DELETE ON work_plan BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1,agenda_epoch=agenda_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_policy_version_insert AFTER INSERT ON visit_generator_policy_version BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_policy_version_update AFTER UPDATE ON visit_generator_policy_version BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_policy_version_delete AFTER DELETE ON visit_generator_policy_version BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_graph_release_insert AFTER INSERT ON visit_generator_graph_release BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_graph_release_update AFTER UPDATE ON visit_generator_graph_release BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=NEW.organization_id;END;
CREATE TRIGGER visit_input_visit_generator_graph_release_delete AFTER DELETE ON visit_generator_graph_release BEGIN UPDATE visit_planning_revision SET source_epoch=source_epoch+1 WHERE organization_id=OLD.organization_id;END;
