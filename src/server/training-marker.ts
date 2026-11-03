export async function hasTrainingData(db:D1Database,organization:string){
 return Boolean(await db.prepare("SELECT id FROM master_audit WHERE organization_id=? AND resource_type='training_dataset' AND resource_id IN('staging-pilot-10-sales','bekasi-field-sales-2026-08-10') AND json_extract(after_json,'$.synthetic')=1 LIMIT 1").bind(organization).first());
}
export async function hasBekasiDemoData(db:D1Database,organization:string){
 return Boolean(await db.prepare("SELECT id FROM master_audit WHERE organization_id=? AND resource_type='training_dataset' AND resource_id='bekasi-field-sales-2026-08-10' AND action='seed_applied' AND json_extract(after_json,'$.synthetic')=1 LIMIT 1").bind(organization).first());
}
