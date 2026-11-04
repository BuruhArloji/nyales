-- Independent customer potential estimates; imported masters and invoices remain unchanged.
CREATE TABLE customer_wallet_profile(
 organization_id TEXT NOT NULL,
 customer_id TEXT NOT NULL,
 hierarchy1 TEXT NOT NULL CHECK(hierarchy1 IN('retail','wholesale','agen_grosir')),
 wallet_size_minor INTEGER NOT NULL CHECK(wallet_size_minor BETWEEN 0 AND 1000000000000),
 currency TEXT NOT NULL DEFAULT 'IDR' CHECK(currency='IDR'),
 source TEXT NOT NULL CHECK(source IN('synthetic_category_preset','manual_estimate','imported_estimate')),
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(organization_id,customer_id),
 FOREIGN KEY(organization_id,customer_id) REFERENCES customer_outlet(organization_id,id),
 FOREIGN KEY(organization_id,updated_by) REFERENCES app_user(organization_id,id)
);
CREATE TRIGGER wallet_profile_geo_insert AFTER INSERT ON customer_wallet_profile BEGIN
 INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1;
END;
CREATE TRIGGER wallet_profile_geo_update AFTER UPDATE ON customer_wallet_profile BEGIN
 INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(NEW.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1;
END;
CREATE TRIGGER wallet_profile_geo_delete AFTER DELETE ON customer_wallet_profile BEGIN
 INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(OLD.organization_id,1) ON CONFLICT(organization_id) DO UPDATE SET epoch=epoch+1;
END;
