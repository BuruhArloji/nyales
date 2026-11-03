-- Optional dimensions preserve all existing SKU identities and transaction snapshots.
ALTER TABLE product ADD COLUMN brand TEXT;
ALTER TABLE product ADD COLUMN flavour TEXT;
ALTER TABLE product ADD COLUMN size_ml INTEGER CHECK(size_ml IS NULL OR(size_ml>0 AND size_ml<=1000000));
ALTER TABLE product ADD COLUMN packaging TEXT;
CREATE INDEX product_brand_lookup ON product(organization_id,brand,status);
