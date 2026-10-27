// The current-area projection is applied atomically before resolving every domain request's scope.
// Effective date uses the organization's business timezone, not the browser clock.
export function territoryStatements(db:D1Database,org:string,date:string){return [
 db.prepare(`INSERT INTO territory_apply_guard(organization_id,outlet_id,event_id) SELECT t.organization_id,t.outlet_id,t.id FROM customer_territory_transfer t JOIN customer_outlet co ON co.organization_id=t.organization_id AND co.id=t.outlet_id WHERE t.organization_id=? AND t.applied_at IS NULL AND t.effective_from_date<=? AND co.area_id=t.from_area_id AND co.merged_into_id IS NULL`).bind(org,date),
 db.prepare(`UPDATE customer_outlet SET area_id=(SELECT t.to_area_id FROM territory_apply_guard g JOIN customer_territory_transfer t ON t.id=g.event_id WHERE g.organization_id=customer_outlet.organization_id AND g.outlet_id=customer_outlet.id),version=version+1 WHERE organization_id=? AND id IN(SELECT outlet_id FROM territory_apply_guard WHERE organization_id=?)`).bind(org,org),
 db.prepare(`INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) SELECT 'territory:'+t.id,t.organization_id,t.created_by,'customers',t.outlet_id,'territory_effective',?,json_object('area_id',t.from_area_id),json_object('area_id',t.to_area_id,'effective_from_date',t.effective_from_date,'reason',t.reason) FROM territory_apply_guard g JOIN customer_territory_transfer t ON t.id=g.event_id WHERE g.organization_id=?`).bind(new Date().toISOString(),org),
 db.prepare(`UPDATE customer_territory_transfer SET applied_at=? WHERE organization_id=? AND id IN(SELECT event_id FROM territory_apply_guard WHERE organization_id=?)`).bind(new Date().toISOString(),org,org),
 db.prepare('DELETE FROM territory_apply_guard WHERE organization_id=?').bind(org)
]}
export async function applyDueTerritories(db:D1Database,org:string,date:string){
 const pending=await db.prepare('SELECT id FROM customer_territory_transfer WHERE organization_id=? AND applied_at IS NULL AND effective_from_date<=? LIMIT 1').bind(org,date).first();
 if(pending)await db.batch(territoryStatements(db,org,date));
}
