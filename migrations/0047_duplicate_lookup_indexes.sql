-- Duplicate review compares normalized source values. Index those same expressions
-- so each customer probes matching candidates rather than scanning the tenant again.
CREATE INDEX customer_duplicate_code ON customer_outlet(
 organization_id,UPPER(TRIM(external_code)),id
) WHERE merged_into_id IS NULL AND record_status='active';
CREATE INDEX customer_duplicate_address ON customer_outlet(
 organization_id,LOWER(TRIM(name)),LOWER(TRIM(address)),id
) WHERE merged_into_id IS NULL AND record_status='active';
CREATE INDEX customer_duplicate_location ON customer_outlet(
 organization_id,LOWER(TRIM(name)),latitude_e7,longitude_e7,id
) WHERE merged_into_id IS NULL AND record_status='active';
CREATE INDEX contact_duplicate_phone ON contact(organization_id,phone,customer_id)
 WHERE status='active';
