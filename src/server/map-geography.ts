/** Map reads need a state, not the complete audit evidence for every location.
 * Inputs are the already-authorized customer snapshots used to draw the map. */
export const MAP_GEOGRAPHY_PAGE_SIZE=1000;
type Customer={id:string;latitude_e7:unknown;longitude_e7:unknown;coordinate_status:unknown};
type Projection={outlet_id:string;boundary_id:string|null;dataset_id:string|null;status:string;latitude_json:string|null;longitude_json:string|null;coordinate_status_json:string|null};
export type MapGeographyState={outlet_id:string;geo_status:string;geo_boundary_id:string|null};

export function projectedMappingState(row:Projection,customer:Customer,dataset:{id:string}|null){
 if(row.status!=='confirmed')return row.status;
 // SQL -> keeps raw JSON types: absent, null, boolean and number stay distinct.
 const value=(raw:string|null)=>raw===null?undefined:JSON.parse(raw);
 return !dataset||row.dataset_id!==dataset.id||value(row.latitude_json)!==customer.latitude_e7||value(row.longitude_json)!==customer.longitude_e7||value(row.coordinate_status_json)!==customer.coordinate_status?'stale':'confirmed';
}

export async function readMapGeographyStates(db:D1Database,organization:string,date:string,customers:Customer[],dataset:{id:string}|null):Promise<MapGeographyState[]>{
 const snapshots=new Map(customers.map(c=>[c.id,c])),ids=[...snapshots.keys()],result:MapGeographyState[]=[];
 for(let offset=0;offset<ids.length;offset+=MAP_GEOGRAPHY_PAGE_SIZE){
  const page=ids.slice(offset,offset+MAP_GEOGRAPHY_PAGE_SIZE);
  // SQLite's single MAX aggregate selects bare columns from that same maximum
  // row. (org,outlet,revision) is unique, so latest revision has no tie.
  // This avoids window-result scans while preserving dated review precedence.
  const rows=(await db.prepare(`
   SELECT l.outlet_id,l.boundary_id,b.dataset_id,l.status,
    CASE WHEN l.status='confirmed' THEN l.evidence_json -> '$.latitude_e7' END latitude_json,
    CASE WHEN l.status='confirmed' THEN l.evidence_json -> '$.longitude_e7' END longitude_json,
    CASE WHEN l.status='confirmed' THEN l.evidence_json -> '$.coordinate_status' END coordinate_status_json,
    MAX(l.revision) revision
   FROM customer_admin_location l LEFT JOIN admin_boundary b ON b.organization_id=l.organization_id AND b.id=l.boundary_id
   WHERE l.organization_id=? AND l.outlet_id IN(SELECT value FROM json_each(?))
    AND l.superseded_at IS NULL AND l.effective_from_date<=? AND(l.effective_to_date IS NULL OR l.effective_to_date>?)
   GROUP BY l.outlet_id`).bind(organization,JSON.stringify(page),date,date).all<Projection>()).results;
  for(const row of rows){const customer=snapshots.get(row.outlet_id);if(!customer)continue;const state=projectedMappingState(row,customer,dataset);result.push({outlet_id:row.outlet_id,geo_status:state,geo_boundary_id:state==='confirmed'?row.boundary_id:null})}
 }
 return result;
}
