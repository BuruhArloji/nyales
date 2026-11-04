-- Prefix lookup and keyset ordering: no count or financial projections needed.
CREATE INDEX IF NOT EXISTS customer_options_name ON customer_outlet(organization_id,name COLLATE NOCASE,id) WHERE merged_into_id IS NULL;
CREATE INDEX IF NOT EXISTS customer_options_code ON customer_outlet(organization_id,external_code COLLATE NOCASE,id) WHERE merged_into_id IS NULL;
