DROP INDEX forecast_exclusive_customer;
CREATE UNIQUE INDEX forecast_exclusive_customer ON forecast_contribution(organization_id,customer_id,channel,view_kind,substr(expected_invoice_date,1,7)) WHERE category<>'omitted';
CREATE TRIGGER segmentation_run_immutable_update BEFORE UPDATE ON customer_segmentation_run BEGIN SELECT RAISE(ABORT,'SEGMENTATION_RUN_IMMUTABLE');END;
CREATE TRIGGER segmentation_run_immutable_delete BEFORE DELETE ON customer_segmentation_run BEGIN SELECT RAISE(ABORT,'SEGMENTATION_RUN_IMMUTABLE');END;
ALTER TABLE sales_order ADD COLUMN approval_review_json TEXT;
