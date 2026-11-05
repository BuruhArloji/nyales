import type {Scope} from './scope';
/** Seed from already authorized map reps. Restrict every hierarchy edge to scope. */
export async function readMapSalesHierarchy(db:D1Database,scope:Scope,repIds:string[],channel:string){
 const ids=[...new Set(repIds)].filter(Boolean);if(!ids.length)return[];
 const area=scope.orgWide?'':' AND r.area_id IN(SELECT value FROM json_each(?))';
 const rows=(await db.prepare(`WITH RECURSIVE ancestors(rep_id,id,depth,path) AS(
 SELECT value,value,0,'|'||value||'|' FROM json_each(?)
 UNION ALL SELECT a.rep_id,r.manager_id,a.depth+1,a.path||r.manager_id||'|' FROM ancestors a
 JOIN reporting_assignment r ON r.organization_id=? AND r.subordinate_id=a.id AND r.channel=? AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?)
 WHERE a.depth<4 AND instr(a.path,'|'||r.manager_id||'|')=0 ${area})
 SELECT DISTINCT a.rep_id,u.id,u.name,role.role_code FROM ancestors a JOIN app_user u ON u.organization_id=? AND u.id=a.id AND u.status='active'
 JOIN auth_role_assignment role ON role.organization_id=u.organization_id AND role.user_id=u.id AND role.role_code IN('SUPERVISOR','AREA_MANAGER') AND(role.channel IS NULL OR role.channel=?) AND role.effective_from_date<=? AND(role.effective_to_date IS NULL OR role.effective_to_date>?) WHERE a.depth>0 ORDER BY a.rep_id,a.depth,u.id LIMIT 4001`).bind(JSON.stringify(ids),scope.identity.organization_id,channel,scope.date,scope.date,...(scope.orgWide?[]:[JSON.stringify(scope.areaIds)]),scope.identity.organization_id,channel,scope.date,scope.date).all<any>()).results;
 if(rows.length>4000)throw Error('MAP_HIERARCHY_LIMIT');return rows;
}
