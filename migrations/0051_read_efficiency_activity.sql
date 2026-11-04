-- Narrow map/visit period scans without indexing large JSON metadata or names.
CREATE INDEX IF NOT EXISTS activity_channel_period ON activity(organization_id,channel,occurred_at,outlet_id);
CREATE INDEX IF NOT EXISTS activity_customer_period ON activity(organization_id,outlet_id,occurred_at);
