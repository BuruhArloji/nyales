export async function hasTrainingData(db:D1Database,organization:string){
 return Boolean(await db.prepare("SELECT id FROM master_audit WHERE organization_id=? AND resource_type='training_dataset' AND resource_id='staging-pilot-10-sales' AND json_extract(after_json,'$.synthetic')=1 LIMIT 1").bind(organization).first());
}
