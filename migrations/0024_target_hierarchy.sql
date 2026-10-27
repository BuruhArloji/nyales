ALTER TABLE target_item ADD COLUMN hierarchy_snapshot_json TEXT NOT NULL DEFAULT '[]';
CREATE INDEX segmentation_input_lookup ON customer_segmentation_run(organization_id,cutoff,source_epoch,coverage_version);
