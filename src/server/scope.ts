import {applyDueTerritories} from './territories';
import type {Identity} from './auth';
export const roles=['MANAGEMENT','NSM','REGIONAL_MANAGER','AREA_MANAGER','SUPERVISOR','SALES_REP','TELESALES'] as const;
export type Scope={identity:Identity;areaIds:string[];repIds:string[];orgWide:boolean;allRepsInArea:boolean;channel:'field'|'telesales'|null;date:string;capabilities:string[]};
const active=`effective_from_date<=? AND (effective_to_date IS NULL OR effective_to_date>?)`;
export async function resolveScope(db:D1Database,identity:Identity):Promise<Scope>{
 if(!roles.includes(identity.role as typeof roles[number]))throw new Error('Unsupported role');
 const org=await db.prepare('SELECT timezone FROM organization WHERE id=?').bind(identity.organization_id).first<{timezone:string}>();
 if(!org)throw new Error('Missing organization');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:org.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 await applyDueTerritories(db,identity.organization_id,date);
 const orgWide=['MANAGEMENT','NSM'].includes(identity.role);
 const allRepsInArea=['REGIONAL_MANAGER','AREA_MANAGER'].includes(identity.role);
 const areaRows=await db.prepare(`SELECT area_id FROM user_area_scope WHERE organization_id=? AND user_id=? AND ${active}`).bind(identity.organization_id,identity.id,date,date).all<{area_id:string}>();
 const areaIds=[...new Set(areaRows.results.map(r=>r.area_id))];
 let repIds=[identity.id];
 if(['SUPERVISOR','REGIONAL_MANAGER'].includes(identity.role)){
  // UNION deduplicates nodes; area boundaries are enforced on every edge and the final resource.
  const rows=await db.prepare(`WITH RECURSIVE team(id) AS (SELECT ? UNION SELECT r.subordinate_id FROM reporting_assignment r JOIN team t ON r.manager_id=t.id JOIN app_user u ON u.id=r.subordinate_id AND u.organization_id=r.organization_id WHERE r.organization_id=? AND u.status='active' AND r.effective_from_date<=? AND (r.effective_to_date IS NULL OR r.effective_to_date>?) AND r.area_id IN (SELECT area_id FROM user_area_scope WHERE organization_id=? AND user_id=? AND ${active})) SELECT id FROM team`).bind(identity.id,identity.organization_id,date,date,identity.organization_id,identity.id,date,date).all<{id:string}>();
  repIds=rows.results.map(r=>r.id);
 }
 const channel=identity.role==='SALES_REP'?'field':identity.role==='TELESALES'?'telesales':identity.channel??null;
 const capabilities=['customers:read','dashboard:read','map:read'];
 if(orgWide)capabilities.push('settings:manage','telesales:read');
 else if(['TELESALES','SUPERVISOR','AREA_MANAGER','REGIONAL_MANAGER'].includes(identity.role))capabilities.push('telesales:read');
 return {identity,areaIds,repIds,orgWide,allRepsInArea,channel,date,capabilities};
}
export function canReadRep(scope:Scope,userId:string){return scope.orgWide||scope.repIds.includes(userId)}
export function customerPredicate(scope:Scope,alias='co'):{sql:string;params:string[]}{
 const org=scope.identity.organization_id;
 let sql=`${alias}.organization_id=?`;const params=[org];
 if(scope.orgWide)return {sql,params};
 const area=`${alias}.area_id IN (${scope.areaIds.map(()=>'?').join(',')||'NULL'})`;
 if(scope.allRepsInArea)return {sql:sql+' AND '+area,params:[...params,...scope.areaIds]};
 const assigned=`EXISTS (SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=${alias}.organization_id AND ca.outlet_id IN(SELECT ${alias}.id UNION ALL SELECT f.id FROM customer_outlet f WHERE f.organization_id=${alias}.organization_id AND f.merged_into_id=${alias}.id) AND ca.rep_id IN (${scope.repIds.map(()=>'?').join(',')}) AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)${scope.channel?' AND ca.channel=?':''})`;
 const assignedParams=[...scope.repIds,scope.date,scope.date,...(scope.channel?[scope.channel]:[])];
 // SR sees their field area or explicit field assignment; telesales only explicit telesales assignment.
 if(scope.identity.role==='SALES_REP')return {sql:sql+` AND (${area} OR ${assigned})`,params:[...params,...scope.areaIds,...assignedParams]};
 if(scope.identity.role==='SUPERVISOR')return {sql:sql+` AND ${area} AND ${assigned}`,params:[...params,...scope.areaIds,...assignedParams]};
 return {sql:sql+' AND '+assigned,params:[...params,...assignedParams]};
}
export function invoicePredicate(scope:Scope,alias='i'){
 const params=[scope.identity.organization_id];let sql=`${alias}.organization_id=? AND ${alias}.is_current=1`;
 if(scope.orgWide)return {sql,params};
 if(scope.allRepsInArea||scope.identity.role==='SUPERVISOR'){
  sql+=` AND ${alias}.area_id IN (${scope.areaIds.map(()=>'?').join(',')||'NULL'})`;params.push(...scope.areaIds);
 }
 if(!scope.allRepsInArea){sql+=` AND ${alias}.rep_id IN (${scope.repIds.map(()=>'?').join(',')})`;params.push(...scope.repIds)}
 if(scope.channel){sql+=` AND ${alias}.channel=?`;params.push(scope.channel)}
 return {sql,params};
}
