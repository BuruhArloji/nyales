import {invoicePredicate,type Scope} from './scope';

/** Read each small aggregate once. Joining materialized aggregates back onto the
 * full directory causes SQLite to scan them once for every customer. */
export async function readDirectoryFacts(db:D1Database,s:Scope,customerId?:string){
 const inv=invoicePredicate(s),detail=customerId!==undefined;
 const familySql=detail?' AND child.id IN (SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND f.id=? UNION SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND f.merged_into_id=?)':'';
 const familyParams=detail?[s.identity.organization_id,customerId,s.identity.organization_id,customerId]:[];
 const invoices=(await db.prepare(`SELECT COALESCE(child.merged_into_id,child.id) customer_id,MAX(i.invoice_date) last,
 SUM(CASE WHEN i.invoice_date>=? AND i.invoice_date<=? AND ${inv.sql} THEN i.net_minor ELSE 0 END) actual
 FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id
 WHERE i.organization_id=? AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=? ${familySql}
 GROUP BY COALESCE(child.merged_into_id,child.id)`).bind(s.date.slice(0,7)+'-01',s.date,...inv.params,s.identity.organization_id,s.date,...familyParams).all<{customer_id:string;last:string;actual:number}>()).results;
 const owners=(await db.prepare(`SELECT customer_id,name FROM (
 SELECT COALESCE(child.merged_into_id,child.id) customer_id,u.name,
 ROW_NUMBER() OVER(PARTITION BY COALESCE(child.merged_into_id,child.id) ORDER BY ca.effective_from_date DESC,ca.id) rank
 FROM customer_assignment ca JOIN customer_outlet child ON child.organization_id=ca.organization_id AND child.id=ca.outlet_id
 JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id
 WHERE ca.organization_id=? AND ca.channel='field' AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?) ${familySql}
 ) WHERE rank=1`).bind(s.identity.organization_id,s.date,s.date,...familyParams).all<{customer_id:string;name:string}>()).results;
 return {invoices:new Map(invoices.map(r=>[r.customer_id,r])),owners:new Map(owners.map(r=>[r.customer_id,r.name]))};
}
