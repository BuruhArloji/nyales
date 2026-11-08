/** Keyset pagination keeps each D1 result bounded without truncating the scope. */
export const REGIONAL_PAGE_SIZE=1000;
export async function regionalCohort(db:D1Database,predicate:string,params:unknown[]){
 const result:any[]=[];let after='';
 for(;;){
  const page=(await db.prepare(`SELECT co.id,co.name,co.record_status,co.latitude_e7,co.longitude_e7,co.coordinate_status,co.service_frequency_days FROM customer_outlet co WHERE ${predicate} AND co.merged_into_id IS NULL AND co.id>? ORDER BY co.id LIMIT ${REGIONAL_PAGE_SIZE}`).bind(...params,after).all<any>()).results;
  result.push(...page);if(page.length<REGIONAL_PAGE_SIZE)break;
  const next=page.at(-1)!.id;if(next<=after)throw Error('503:REGIONAL_CURSOR_INVALID');after=next;
 }
 return result;
}
