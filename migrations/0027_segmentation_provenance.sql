ALTER TABLE customer_source_coverage ADD COLUMN history_complete INTEGER NOT NULL DEFAULT 0 CHECK(history_complete IN(0,1));
ALTER TABLE customer_segmentation_run ADD COLUMN input_snapshot_json TEXT NOT NULL DEFAULT '{}';
