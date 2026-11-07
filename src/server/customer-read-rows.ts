import {customerPredicate,type Scope} from './scope';

/** Keep D1 result serialization bounded. Indexed keyset pages never use OFFSET
 * and preserve the complete authorized canonical cohort, including no-GPS rows. */
export async function readCustomerRows(db:D1Database,scope:Scope,customerId?:string){
 const f=customerPredicate(scope),rows:any[]=[];let after:string|undefined;
 const columns='co.id,co.name,a.name area,co.latitude_e7,co.longitude_e7,co.area_id,co.address,co.external_code,co.external_code_review,co.version,co.record_status,co.coordinate_status,co.location_note,co.outlet_type,co.service_frequency_days,co.visit_window,co.directory_dataset_id,co.transaction_history_unverified';
 do{
  const page=(await db.prepare(`SELECT ${columns} FROM customer_outlet co JOIN area a ON a.organization_id=co.organization_id AND a.id=co.area_id WHERE ${f.sql} AND co.merged_into_id IS NULL ${customerId!==undefined?'AND co.id=?':after!==undefined?'AND co.id>?':''} ORDER BY co.id LIMIT 1000`).bind(...f.params,...(customerId!==undefined?[customerId]:after!==undefined?[after]:[])).all<any>()).results;
  rows.push(...page);if(customerId!==undefined||page.length<1000)break;
  const next=page.at(-1)!.id;if(after!==undefined&&next<=after)throw Error('CUSTOMER_CURSOR_INVALID');after=next;
 }while(true);
 // Match SQLite BINARY name ordering; compare Unicode code points for astral names.
 rows.sort((a,b)=>{if(a.name===b.name)return 0;let i=0,j=0;while(i<a.name.length&&j<b.name.length){const x=a.name.codePointAt(i)!,y=b.name.codePointAt(j)!;if(x!==y)return x-y;i+=x>0xffff?2:1;j+=y>0xffff?2:1}return a.name.length-b.name.length});
 return rows;
}
