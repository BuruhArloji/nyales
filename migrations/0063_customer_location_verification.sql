-- New field evidence is reviewed independently from commercial/customer status.
CREATE TABLE visit_location_policy(
 organization_id TEXT PRIMARY KEY REFERENCES organization(id),version INTEGER NOT NULL,
 config_json TEXT NOT NULL CHECK(json_valid(config_json)),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,updated_by) REFERENCES app_user(organization_id,id)
);
CREATE TABLE customer_proposal(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('new_customer','location')),
 customer_id TEXT,name TEXT NOT NULL,address TEXT NOT NULL,area_id TEXT NOT NULL,
 proposed_by TEXT NOT NULL,submitted_by TEXT NOT NULL,latitude_e7 INTEGER NOT NULL,longitude_e7 INTEGER NOT NULL,
 accuracy_cm INTEGER NOT NULL CHECK(accuracy_cm BETWEEN 0 AND 10000),captured_at TEXT NOT NULL,notes TEXT NOT NULL,
 evidence_attachment_id TEXT,photo_key TEXT,photo_sha256 TEXT,photo_mime TEXT,photo_size INTEGER,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 version INTEGER NOT NULL DEFAULT 1,customer_version INTEGER,
 reviewed_by TEXT,reviewed_at TEXT,review_reason TEXT,created_at TEXT NOT NULL,
 FOREIGN KEY(organization_id,customer_id) REFERENCES customer_outlet(organization_id,id),
 FOREIGN KEY(organization_id,area_id) REFERENCES area(organization_id,id),
 FOREIGN KEY(organization_id,proposed_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,submitted_by) REFERENCES app_user(organization_id,id),
 FOREIGN KEY(organization_id,reviewed_by) REFERENCES app_user(organization_id,id),
 CHECK(latitude_e7 BETWEEN -900000000 AND 900000000),CHECK(longitude_e7 BETWEEN -1800000000 AND 1800000000),
 CHECK(kind='new_customer' OR customer_id IS NOT NULL),CHECK(reviewed_by IS NULL OR (reviewed_by<>proposed_by AND reviewed_by<>submitted_by)),
 CHECK((status='pending' AND reviewed_by IS NULL) OR (status<>'pending' AND reviewed_by IS NOT NULL)),
 UNIQUE(organization_id,id)
);
CREATE INDEX proposal_review_page ON customer_proposal(organization_id,status,area_id,created_at DESC,id);
CREATE INDEX proposal_author_page ON customer_proposal(organization_id,proposed_by,status,created_at DESC,id);
CREATE TRIGGER proposal_closed_immutable BEFORE UPDATE ON customer_proposal WHEN OLD.status<>'pending' BEGIN SELECT RAISE(ABORT,'PROPOSAL_CLOSED'); END;
CREATE TRIGGER proposal_payload_immutable BEFORE UPDATE ON customer_proposal WHEN
 NEW.organization_id IS NOT OLD.organization_id OR NEW.kind IS NOT OLD.kind OR NEW.name IS NOT OLD.name OR
 NEW.address IS NOT OLD.address OR NEW.area_id IS NOT OLD.area_id OR NEW.proposed_by IS NOT OLD.proposed_by OR NEW.submitted_by IS NOT OLD.submitted_by OR
 NEW.latitude_e7 IS NOT OLD.latitude_e7 OR NEW.longitude_e7 IS NOT OLD.longitude_e7 OR NEW.accuracy_cm IS NOT OLD.accuracy_cm OR
 NEW.evidence_attachment_id IS NOT OLD.evidence_attachment_id OR NEW.customer_version IS NOT OLD.customer_version OR NEW.captured_at IS NOT OLD.captured_at OR NEW.notes IS NOT OLD.notes OR NEW.created_at IS NOT OLD.created_at
 BEGIN SELECT RAISE(ABORT,'PROPOSAL_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER proposal_no_delete BEFORE DELETE ON customer_proposal BEGIN SELECT RAISE(ABORT,'PROPOSAL_HISTORY_IMMUTABLE'); END;
