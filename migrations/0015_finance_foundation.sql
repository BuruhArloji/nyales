CREATE TABLE product_group(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,code TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','archived')),version INTEGER NOT NULL DEFAULT 1,UNIQUE(organization_id,id),UNIQUE(organization_id,code),FOREIGN KEY(organization_id) REFERENCES organization(id));
ALTER TABLE product ADD COLUMN quantity_scale INTEGER NOT NULL DEFAULT 1 CHECK(quantity_scale BETWEEN 1 AND 1000000);
ALTER TABLE product ADD COLUMN product_group_id TEXT;
CREATE TABLE product_price(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor BETWEEN 0 AND 1000000000000),currency TEXT NOT NULL CHECK(currency='IDR'),unit_code TEXT NOT NULL,effective_from_date TEXT NOT NULL,effective_to_date TEXT,source TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL,CHECK(effective_to_date IS NULL OR effective_to_date>effective_from_date),FOREIGN KEY(organization_id,product_id) REFERENCES product(organization_id,id));
CREATE INDEX product_price_effective ON product_price(organization_id,product_id,effective_from_date,effective_to_date);
CREATE TRIGGER price_insert_guard BEFORE INSERT ON product_price BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM product WHERE organization_id=NEW.organization_id AND id=NEW.product_id AND base_unit=NEW.unit_code AND status='active') THEN RAISE(ABORT,'INVALID_PRODUCT_UNIT') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM product_price WHERE organization_id=NEW.organization_id AND product_id=NEW.product_id AND effective_from_date<COALESCE(NEW.effective_to_date,'9999-12-31') AND NEW.effective_from_date<COALESCE(effective_to_date,'9999-12-31')) THEN RAISE(ABORT,'PRICE_OVERLAP') END;
END;
CREATE TRIGGER price_history_guard BEFORE UPDATE ON product_price WHEN NEW.organization_id<>OLD.organization_id OR NEW.product_id<>OLD.product_id OR NEW.amount_minor<>OLD.amount_minor OR NEW.unit_code<>OLD.unit_code OR NEW.currency<>OLD.currency OR NEW.effective_from_date<>OLD.effective_from_date OR NEW.source<>OLD.source OR NEW.effective_to_date IS NULL OR NEW.effective_to_date<=OLD.effective_from_date OR (OLD.effective_to_date IS NOT NULL AND NEW.effective_to_date>OLD.effective_to_date) BEGIN SELECT RAISE(ABORT,'PRICE_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER product_group_insert_guard BEFORE INSERT ON product WHEN NEW.product_group_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM product_group WHERE organization_id=NEW.organization_id AND id=NEW.product_group_id AND status='active') THEN RAISE(ABORT,'INVALID_PRODUCT_GROUP') END;
END;
CREATE TRIGGER product_group_update_guard BEFORE UPDATE OF product_group_id ON product WHEN NEW.product_group_id IS NOT NULL AND NEW.product_group_id IS NOT OLD.product_group_id BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM product_group WHERE organization_id=NEW.organization_id AND id=NEW.product_group_id AND status='active') THEN RAISE(ABORT,'INVALID_PRODUCT_GROUP') END;
END;
CREATE TRIGGER group_archive_guard BEFORE UPDATE OF status ON product_group WHEN NEW.status='archived' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM product WHERE organization_id=NEW.organization_id AND product_group_id=NEW.id AND status='active') THEN RAISE(ABORT,'GROUP_HAS_ACTIVE_PRODUCTS') END;
END;
ALTER TABLE invoice ADD COLUMN source_system TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE invoice ADD COLUMN external_invoice_id TEXT;
ALTER TABLE invoice ADD COLUMN origin_source_version TEXT;
ALTER TABLE invoice ADD COLUMN source_updated_at TEXT;
ALTER TABLE invoice ADD COLUMN source_net_minor INTEGER;
ALTER TABLE invoice ADD COLUMN net_includes_credit INTEGER NOT NULL DEFAULT 1 CHECK(net_includes_credit IN(0,1));
ALTER TABLE invoice ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1 CHECK(is_current IN(0,1));
ALTER TABLE invoice ADD COLUMN revision_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoice ADD COLUMN previous_revision_id TEXT;
ALTER TABLE invoice ADD COLUMN reason TEXT NOT NULL DEFAULT 'Legacy snapshot';
ALTER TABLE invoice ADD COLUMN created_by TEXT;
ALTER TABLE invoice ADD COLUMN import_job_id TEXT;
ALTER TABLE invoice ADD COLUMN attribution_basis TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE invoice ADD COLUMN assignment_snapshot_json TEXT NOT NULL DEFAULT '[]';
UPDATE invoice SET external_invoice_id=source_invoice_id,origin_source_version=source_version,source_net_minor=net_minor;
UPDATE invoice SET is_current=0 WHERE rowid NOT IN(SELECT MAX(rowid) FROM invoice GROUP BY organization_id,source_system,external_invoice_id);
UPDATE invoice SET validation_state='needs_review' WHERE is_current=1 AND EXISTS(SELECT 1 FROM invoice old WHERE old.organization_id=invoice.organization_id AND old.source_system=invoice.source_system AND old.external_invoice_id=invoice.external_invoice_id AND old.id<>invoice.id);
CREATE UNIQUE INDEX invoice_current_identity ON invoice(organization_id,source_system,external_invoice_id) WHERE is_current=1;
CREATE INDEX invoice_current_date ON invoice(organization_id,is_current,invoice_date,validation_state);
CREATE TABLE invoice_line(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES invoice(id),source_line_id TEXT NOT NULL,product_id TEXT NOT NULL,sku_snapshot TEXT NOT NULL,quantity_scaled INTEGER NOT NULL,quantity_scale INTEGER NOT NULL,unit_code TEXT NOT NULL,net_minor INTEGER NOT NULL,UNIQUE(invoice_id,source_line_id),FOREIGN KEY(organization_id,product_id) REFERENCES product(organization_id,id));
CREATE TABLE invoice_source_event(organization_id TEXT NOT NULL,source_system TEXT NOT NULL,external_invoice_id TEXT NOT NULL,source_version TEXT NOT NULL,payload_hash TEXT NOT NULL,payload_json TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES invoice(id),created_at TEXT NOT NULL,PRIMARY KEY(organization_id,source_system,external_invoice_id,source_version));
CREATE TABLE credit_note(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,source_system TEXT NOT NULL,source_credit_id TEXT NOT NULL,source_invoice_id TEXT NOT NULL,source_version TEXT NOT NULL,credit_date TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor BETWEEN 0 AND 1000000000000),status TEXT NOT NULL CHECK(status IN('validated','cancelled')),payload_hash TEXT NOT NULL,is_current INTEGER NOT NULL DEFAULT 1 CHECK(is_current IN(0,1)),created_by TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(organization_id,source_system,source_credit_id,source_version));
CREATE UNIQUE INDEX credit_current_identity ON credit_note(organization_id,source_system,source_credit_id) WHERE is_current=1;
CREATE TABLE invoice_revision_credit(invoice_id TEXT NOT NULL REFERENCES invoice(id),credit_id TEXT NOT NULL REFERENCES credit_note(id),amount_minor INTEGER NOT NULL,PRIMARY KEY(invoice_id,credit_id));
CREATE TABLE invoice_import_job(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,source_system TEXT NOT NULL,source_cutoff TEXT NOT NULL,attachment_id TEXT,payload_hash TEXT NOT NULL,payload_json TEXT NOT NULL,request_json TEXT NOT NULL,plan_json TEXT NOT NULL,epoch INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN('validated','needs_review','committed')),valid_count INTEGER NOT NULL,invalid_count INTEGER NOT NULL,errors_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL,committed_at TEXT,FOREIGN KEY(attachment_id) REFERENCES import_file(id));
CREATE INDEX invoice_job_org ON invoice_import_job(organization_id,created_at);
CREATE TABLE finance_epoch(organization_id TEXT PRIMARY KEY,epoch INTEGER NOT NULL);
CREATE TABLE finance_period_lock(organization_id TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,statement_reference TEXT NOT NULL,PRIMARY KEY(organization_id,period_start,period_end,statement_reference));
CREATE UNIQUE INDEX finance_lock_reference ON finance_period_lock(organization_id,statement_reference);
CREATE TABLE finance_adjustment(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,invoice_revision_id TEXT NOT NULL REFERENCES invoice(id),previous_revision_id TEXT NOT NULL REFERENCES invoice(id),statement_reference TEXT NOT NULL,delta_minor INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN('pending_review','resolved')),created_at TEXT NOT NULL,UNIQUE(invoice_revision_id,statement_reference));
CREATE TRIGGER invoice_immutable BEFORE UPDATE ON invoice WHEN NEW.organization_id<>OLD.organization_id OR NEW.outlet_id IS NOT OLD.outlet_id OR NEW.rep_id IS NOT OLD.rep_id OR NEW.area_id IS NOT OLD.area_id OR NEW.channel IS NOT OLD.channel OR NEW.invoice_date<>OLD.invoice_date OR NEW.net_minor<>OLD.net_minor OR NEW.status<>OLD.status OR NEW.source_version<>OLD.source_version OR NEW.validation_state<>OLD.validation_state OR NEW.source_net_minor IS NOT OLD.source_net_minor OR NEW.net_includes_credit<>OLD.net_includes_credit OR NEW.is_current>OLD.is_current BEGIN SELECT RAISE(ABORT,'INVOICE_REVISION_REQUIRED'); END;
CREATE TRIGGER product_unit_history_guard BEFORE UPDATE OF base_unit,quantity_scale ON product WHEN (NEW.base_unit<>OLD.base_unit OR NEW.quantity_scale<>OLD.quantity_scale) AND (EXISTS(SELECT 1 FROM invoice_line WHERE organization_id=OLD.organization_id AND product_id=OLD.id) OR EXISTS(SELECT 1 FROM product_price WHERE organization_id=OLD.organization_id AND product_id=OLD.id)) BEGIN SELECT RAISE(ABORT,'PRODUCT_UNIT_HAS_HISTORY'); END;

CREATE TRIGGER finance_epoch_product_insert AFTER INSERT ON product BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_product_update AFTER UPDATE ON product BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_product_delete AFTER DELETE ON product BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_product_group_insert AFTER INSERT ON product_group BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_product_group_update AFTER UPDATE ON product_group BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_product_group_delete AFTER DELETE ON product_group BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_outlet_insert AFTER INSERT ON customer_outlet BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_outlet_update AFTER UPDATE ON customer_outlet BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_outlet_delete AFTER DELETE ON customer_outlet BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_alias_insert AFTER INSERT ON customer_alias BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_alias_update AFTER UPDATE ON customer_alias BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_alias_delete AFTER DELETE ON customer_alias BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_assignment_insert AFTER INSERT ON customer_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_assignment_update AFTER UPDATE ON customer_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_assignment_delete AFTER DELETE ON customer_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_territory_transfer_insert AFTER INSERT ON customer_territory_transfer BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_territory_transfer_update AFTER UPDATE ON customer_territory_transfer BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_customer_territory_transfer_delete AFTER DELETE ON customer_territory_transfer BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_app_user_insert AFTER INSERT ON app_user BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_app_user_update AFTER UPDATE ON app_user BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_app_user_delete AFTER DELETE ON app_user BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_auth_role_assignment_insert AFTER INSERT ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_auth_role_assignment_update AFTER UPDATE ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_auth_role_assignment_delete AFTER DELETE ON auth_role_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_user_area_scope_insert AFTER INSERT ON user_area_scope BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_user_area_scope_update AFTER UPDATE ON user_area_scope BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_user_area_scope_delete AFTER DELETE ON user_area_scope BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_reporting_assignment_insert AFTER INSERT ON reporting_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_reporting_assignment_update AFTER UPDATE ON reporting_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_reporting_assignment_delete AFTER DELETE ON reporting_assignment BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_area_insert AFTER INSERT ON area BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_area_update AFTER UPDATE ON area BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_area_delete AFTER DELETE ON area BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_insert AFTER INSERT ON invoice BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_update AFTER UPDATE ON invoice BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_delete AFTER DELETE ON invoice BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_credit_note_insert AFTER INSERT ON credit_note BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_credit_note_update AFTER UPDATE ON credit_note BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_credit_note_delete AFTER DELETE ON credit_note BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_line_insert AFTER INSERT ON invoice_line BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_line_update AFTER UPDATE ON invoice_line BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_invoice_line_delete AFTER DELETE ON invoice_line BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_finance_period_lock_insert AFTER INSERT ON finance_period_lock BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_finance_period_lock_update AFTER UPDATE ON finance_period_lock BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER finance_epoch_finance_period_lock_delete AFTER DELETE ON finance_period_lock BEGIN INSERT INTO finance_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1; END;

CREATE TRIGGER credit_history_guard BEFORE UPDATE ON credit_note WHEN NEW.source_system<>OLD.source_system OR NEW.organization_id<>OLD.organization_id OR NEW.source_credit_id<>OLD.source_credit_id OR NEW.source_invoice_id<>OLD.source_invoice_id OR NEW.source_version<>OLD.source_version OR NEW.credit_date<>OLD.credit_date OR NEW.amount_minor<>OLD.amount_minor OR NEW.status<>OLD.status OR NEW.payload_hash<>OLD.payload_hash OR NEW.is_current>OLD.is_current BEGIN SELECT RAISE(ABORT,'CREDIT_REVISION_REQUIRED'); END;
CREATE TRIGGER invoice_line_immutable BEFORE UPDATE ON invoice_line BEGIN SELECT RAISE(ABORT,'LINE_REVISION_REQUIRED'); END;
CREATE TRIGGER invoice_event_immutable BEFORE UPDATE ON invoice_source_event BEGIN SELECT RAISE(ABORT,'SOURCE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER revision_credit_immutable BEFORE UPDATE ON invoice_revision_credit BEGIN SELECT RAISE(ABORT,'REVISION_CREDIT_IMMUTABLE'); END;
