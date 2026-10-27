ALTER TABLE invoice_line ADD COLUMN product_name_snapshot TEXT;
ALTER TABLE invoice_line ADD COLUMN product_group_id_snapshot TEXT;
ALTER TABLE invoice_line ADD COLUMN group_code_snapshot TEXT;
ALTER TABLE invoice_line ADD COLUMN group_snapshot_known INTEGER NOT NULL DEFAULT 0 CHECK(group_snapshot_known IN(0,1));

CREATE INDEX invoice_outlet_current ON invoice(organization_id,outlet_id,is_current,invoice_date,validation_state);
CREATE INDEX invoice_rep_current ON invoice(organization_id,is_current,rep_id,channel,invoice_date,area_id);
