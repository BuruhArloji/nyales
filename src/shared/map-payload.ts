/** Pin payloads deliberately omit directory forms, visit windows and full
 * segmentation evidence. Those fields are fetched by the detail endpoints. */
export function mapCustomerPin(x:any){
 return {id:x.id,name:x.name,area:x.area,area_id:x.area_id,owner:x.owner,status:x.status,
 lat:x.lat,lng:x.lng,external_code:x.external_code,record_status:x.record_status,
 coordinate_status:x.coordinate_status,directory_dataset_id:x.directory_dataset_id,
 field_rep_id:x.field_rep_id,telesales_rep_id:x.telesales_rep_id,
 geo_status:x.geo_status,geo_boundary_id:x.geo_boundary_id,metrics:x.metrics,
 demo_operation_overlay:x.demo_operation_overlay,demo_point_link:x.demo_point_link};
}
export function mapDisplayPayload(data:any,compact=false){
 return {...data,all_customers:compact?[]:data.all_customers.map(mapCustomerPin),customers:data.customers.map(mapCustomerPin)};
}
