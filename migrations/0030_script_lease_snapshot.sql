ALTER TABLE telesales_lease ADD COLUMN script_snapshot_json TEXT;
UPDATE telesales_lease SET script_snapshot_json=(SELECT json_object('id',s.id,'name',s.name,'content',s.content,'qualification_json',s.qualification_json,'version',s.version) FROM sales_script s WHERE s.organization_id=telesales_lease.organization_id AND s.id=telesales_lease.script_id);
