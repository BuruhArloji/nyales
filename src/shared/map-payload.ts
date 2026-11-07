/** Pin payloads deliberately omit directory forms, visit windows and full
 * segmentation evidence. Those fields are fetched by the detail endpoints. */
export function mapCustomerPin(x:any){
 return {id:x.id,name:x.name,area:x.area,area_id:x.area_id,owner:x.owner,status:x.status,
 lat:x.lat,lng:x.lng,external_code:x.external_code,record_status:x.record_status,
 coordinate_status:x.coordinate_status,directory_dataset_id:x.directory_dataset_id,
 telesales_owner:x.telesales_owner,field_rep_id:x.field_rep_id,telesales_rep_id:x.telesales_rep_id,
 geo_status:x.geo_status,geo_boundary_id:x.geo_boundary_id,metrics:x.metrics,
 demo_operation_overlay:x.demo_operation_overlay,demo_point_link:x.demo_point_link};
}
/** Initial drawing payload: preserve every point and all nonzero operational
 * metrics. Wallet/comparison history and source metadata load on point detail. */
export function mapRenderFacts(m:any){
 const hasFacts=m&&(Number(m.invoice_count||0)!==0||Number(m.activity_count||0)!==0||Number(m.actual_minor||0)!==0||Number(m.meaningful_count||0)!==0||m.last_activity);
 return hasFacts?{period:m.period,actual_minor:m.actual_minor||0,invoice_count:m.invoice_count||0,activity_count:m.activity_count||0,meaningful_count:m.meaningful_count||0,last_activity:m.last_activity||undefined}:undefined;
}
export function mapRenderPin(x:any){
 return {id:x.id,name:x.name,lat:x.lat,lng:x.lng,
  status:x.status,
  owner:x.owner&&x.owner!=='Belum assigned'?x.owner:undefined,
  field_rep_id:x.field_rep_id||undefined,telesales_rep_id:x.telesales_rep_id||undefined,
  telesales_owner:x.telesales_rep_id?x.telesales_owner:undefined,
  directory_dataset_id:x.directory_dataset_id||undefined,external_code:x.directory_dataset_id?x.external_code:undefined,
  geo_status:x.geo_status,geo_boundary_id:x.geo_boundary_id||undefined,
  metrics:mapRenderFacts(x.metrics)||{actual_minor:0,invoice_count:0,activity_count:0,meaningful_count:0},
  demo_operation_overlay:x.demo_operation_overlay,demo_point_link:x.demo_point_link};
}
export function mapDisplayPayload(data:any,compact=false){
 return {...data,all_customers:compact?[]:data.all_customers.map(mapCustomerPin),customers:data.customers.map(mapCustomerPin)};
}

/** Overview reuses the canonical GIS payload, including invoice facts and period. */
export function overviewMapData(payload:any){
 return {...payload.map,analysis_mode:'scatter',analysis_period:payload.period_context};
}
