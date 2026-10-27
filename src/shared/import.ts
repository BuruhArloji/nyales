export const importFields={customer:['external_code','name','area_id','address','latitude','longitude','outlet_type','service_frequency_days','record_status','source_date'],product:['sku','name','base_unit','quantity_scale','group_code','status','source_date']} as const;
export const requiredImportFields={customer:['external_code','name','area_id','address'],product:['sku','name','base_unit']} as const;
export type ImportKind=keyof typeof importFields;
