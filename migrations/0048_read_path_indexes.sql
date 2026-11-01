-- Indexes for the paged customer directory and dashboard aggregates.
-- Every lookup below was previously satisfied by a scan; the dashboard and the
-- list page are the two most expensive reads in the app.

-- Assignment resolution joins customer_alias on source_id, not canonical_id.
CREATE INDEX IF NOT EXISTS alias_source ON customer_alias(organization_id, source_id);

-- Per-page invoice facts join invoice to customer_outlet on outlet_id.
CREATE INDEX IF NOT EXISTS invoice_outlet_facts ON invoice(organization_id, outlet_id, is_current, invoice_date);

-- The list page filters by record_status and orders by name.
CREATE INDEX IF NOT EXISTS customer_list_order ON customer_outlet(organization_id, record_status, name COLLATE NOCASE);