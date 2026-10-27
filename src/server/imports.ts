import {Hono} from 'hono';

import {bodyLimit} from 'hono/body-limit';

import {z} from 'zod';

import {parseCsv,csvFile} from './csv';

import {digest,fail,operation,guard,type OperationEnv} from './operations';

import {importFields,requiredImportFields,type ImportKind} from '../shared/import';

export const imports=new Hono<OperationEnv>();

const request=z.object({kind:z.enum(['customer','product']),attachment_id:z.string().min(1).max(128),mapping:z.record(z.string(),z.string().min(1)),mode:z.enum(['dry_run','commit']),validation_batch_id:z.string().min(1).optional(),allow_partial:z.boolean().default(false)}).strict();

imports.use('/api/import-files',bodyLimit({maxSize:600*1024,onError:c=>c.json({code:'FILE_TOO_LARGE',detail:'Maksimum 512 KB per file CSV.'},413)}));

imports.post('/api/import-files',async c=>{

 const bucket=c.env.IMPORT_FILES;if(!bucket)return c.json({code:'SOURCE_STORAGE_NOT_CONFIGURED'},503);

 const form=await c.req.parseBody(),file=form.file;if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size>512*1024||file.size===0)return c.json({code:'CSV_FILE_REQUIRED',detail:'Gunakan CSV UTF-8, maksimum 512 KB dan 200 baris.'},422);

 const data=await file.arrayBuffer();let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);parseCsv(text)}catch(e){return c.json({code:'INVALID_CSV',detail:(e as Error).message},422)}

 const org=c.get('identity').organization_id,checksum=await digest(data),db=c.env.DB;

 const prior=await db.prepare('SELECT id,original_name,checksum,size_bytes,created_at,retention_hold FROM import_file WHERE organization_id=? AND checksum=?').bind(org,checksum).first();if(prior)return c.json({data:prior});

 const id=crypto.randomUUID(),key=encodeURIComponent(org)+'/sources/'+id+'.csv',filename=file.name.replace(/[\x00-\x1f\x7f\\/]/g,'_').slice(0,180),now=new Date().toISOString();

 const object=await bucket.put(key,data,{customMetadata:{sha256:checksum},httpMetadata:{contentType:'application/octet-stream'}});

 try{await db.prepare('INSERT INTO import_file(id,organization_id,original_name,storage_key,checksum,etag,size_bytes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,org,filename,key,checksum,object.etag,file.size,c.get('identity').id,now).run()}catch{

  const saved=await db.prepare('SELECT id,original_name,checksum,size_bytes,created_at,retention_hold FROM import_file WHERE organization_id=? AND checksum=?').bind(org,checksum).first();if(saved){if((saved as any).id!==id)await bucket.delete(key);return c.json({data:saved})}return c.json({code:'SOURCE_MANIFEST_UNAVAILABLE'},503);

 }

 return c.json({data:{id,original_name:filename,checksum,size_bytes:file.size,created_at:now,retention_hold:1}},201);

});

imports.get('/api/import-files/:id',async c=>{const row=await c.env.DB.prepare('SELECT * FROM import_file WHERE organization_id=? AND id=?').bind(c.get('identity').organization_id,c.req.param('id')).first<any>();if(!row)return c.json({code:'NOT_FOUND'},404);const object=await c.env.IMPORT_FILES?.get(row.storage_key);if(!object)return c.json({code:'SOURCE_UNAVAILABLE'},503);const bytes=await object.arrayBuffer();if(await digest(bytes)!==row.checksum)return c.json({code:'SOURCE_CHANGED'},409);c.header('Content-Type','application/octet-stream');c.header('X-Content-Type-Options','nosniff');c.header('Content-Disposition',`attachment; filename="source.csv"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);return c.body(bytes)});

imports.get('/api/master-imports/template/:kind',c=>{const kind=c.req.param('kind') as ImportKind;if(!Object.hasOwn(importFields,kind))return c.json({code:'NOT_FOUND'},404);c.header('Content-Type','text/csv; charset=utf-8');c.header('Content-Disposition',`attachment; filename="nyales-${kind}-template.csv"`);return c.body(csvFile([[...importFields[kind]]]))});

imports.get('/api/master-imports',async c=>{const rows=await c.env.DB.prepare('SELECT b.*,f.original_name,f.checksum,f.retention_hold FROM master_import_batch b JOIN import_file f ON f.id=b.attachment_id AND f.organization_id=b.organization_id WHERE b.organization_id=? ORDER BY b.created_at DESC,b.id LIMIT 100').bind(c.get('identity').organization_id).all();return c.json({data:rows.results})});

imports.get('/api/master-imports/:id',async c=>{const batch=await c.env.DB.prepare('SELECT b.*,f.original_name,f.checksum,f.retention_hold FROM master_import_batch b JOIN import_file f ON f.id=b.attachment_id AND f.organization_id=b.organization_id WHERE b.organization_id=? AND b.id=?').bind(c.get('identity').organization_id,c.req.param('id')).first<any>();if(!batch)return c.json({code:'NOT_FOUND'},404);const rows=await c.env.DB.prepare('SELECT row_no,action,resource_id,payload_json,errors_json,status FROM master_import_row WHERE organization_id=? AND batch_id=? ORDER BY row_no').bind(batch.organization_id,batch.id).all<any>();c.header('ETag',`"${batch.version}"`);return c.json({data:{...batch,rows:rows.results.map(r=>({...r,payload:JSON.parse(r.payload_json),errors:JSON.parse(r.errors_json),payload_json:undefined,errors_json:undefined}))}})});

imports.get('/api/master-imports/:id/errors',async c=>{const org=c.get('identity').organization_id,batch=await c.env.DB.prepare('SELECT id FROM master_import_batch WHERE organization_id=? AND id=?').bind(org,c.req.param('id')).first();if(!batch)return c.json({code:'NOT_FOUND'},404);const rows=await c.env.DB.prepare("SELECT row_no,payload_json,errors_json FROM master_import_row WHERE organization_id=? AND batch_id=? AND status='invalid' ORDER BY row_no").bind(org,c.req.param('id')).all<any>();c.header('Content-Type','text/csv; charset=utf-8');c.header('Content-Disposition','attachment; filename="import-errors.csv"');return c.body(csvFile([['baris','error','data'],...rows.results.map(r=>[r.row_no,JSON.parse(r.errors_json).join('; '),r.payload_json])]))});



async function validate(db:D1Database,org:string,kind:ImportKind,parsed:ReturnType<typeof parseCsv>,mapping:Record<string,string>){

 for(const key of Object.keys(mapping))if(!(importFields[kind] as readonly string[]).includes(key)||!parsed.headers.includes(mapping[key]))fail(422,'MAPPING_INVALID');

 for(const key of requiredImportFields[kind])if(!mapping[key])fail(422,'REQUIRED_MAPPING_'+key);

 const get=(values:string[],key:string)=>mapping[key]?values[parsed.headers.indexOf(mapping[key])]?.trim()||'':'';

 const groups=kind==='product'?(await db.prepare("SELECT * FROM product_group WHERE organization_id=?").bind(org).all<any>()).results:[];

 const codes=parsed.rows.map(r=>get(r.values,kind==='customer'?'external_code':'sku').toUpperCase());


 const areas=kind==='customer'?(await db.prepare('SELECT id,version,status FROM area WHERE organization_id=? AND id IN(SELECT value FROM json_each(?))').bind(org,JSON.stringify(parsed.rows.map(r=>get(r.values,'area_id')))).all<any>()).results:[];

 const existing=(await db.prepare(kind==='customer'?'SELECT * FROM customer_outlet WHERE organization_id=? AND UPPER(TRIM(external_code)) IN(SELECT value FROM json_each(?))':'SELECT * FROM product WHERE organization_id=? AND sku IN(SELECT value FROM json_each(?))').bind(org,JSON.stringify(codes)).all<any>()).results;

 return parsed.rows.map((row,index)=>{const errors:string[]=[],raw=Object.fromEntries(Object.keys(mapping).map(key=>[key,get(row.values,key)])),code=codes[index];

  if(row.values.length!==parsed.headers.length)errors.push('Jumlah kolom tidak sama dengan header.');

  for(const key of requiredImportFields[kind])if(!raw[key])errors.push('Field wajib kosong: '+key);

  if(code.length>128||!code)errors.push('Kode wajib diisi, maksimum 128 karakter.');if(codes.filter(x=>x===code).length>1)errors.push('Kode berulang di dalam file.');

  if(raw.source_date&&!z.iso.date().safeParse(raw.source_date).success)errors.push('source_date harus tanggal valid YYYY-MM-DD.');

  const matches=existing.filter(r=>(kind==='customer'?r.external_code?.trim().toUpperCase():r.sku)===code),live=matches.filter(r=>!r.merged_into_id),canonicalIds=new Set(matches.map(r=>r.merged_into_id||r.id)),before=live.length===1&&canonicalIds.size===1?live[0]:matches.length===1?matches[0]:null;

  if(canonicalIds.size>1||live.length>1)errors.push('Kode sumber ambigu. Selesaikan review duplikat dahulu.');

  let payload:any,reference:any={};

  if(kind==='customer'){

   if(before?.merged_into_id)errors.push('Kode telah digabung; gunakan kode outlet yang dipertahankan.');

   const area=areas.find(a=>a.id===raw.area_id);if(!area||area.status!=='active')errors.push('ID area harus aktif dan berada dalam organisasi.');


   const hasLat=Boolean(raw.latitude),hasLon=Boolean(raw.longitude);if(hasLat!==hasLon)errors.push('Latitude dan longitude harus berpasangan.');

   const lat=hasLat?Number(raw.latitude):null,lon=hasLon?Number(raw.longitude):null;if(hasLat&&(!Number.isFinite(lat)||lat!<-90||lat!>90))errors.push('Latitude di luar -90 sampai 90.');if(hasLon&&(!Number.isFinite(lon)||lon!<-180||lon!>180))errors.push('Longitude di luar -180 sampai 180.');

   if(raw.record_status&&!['active','inactive'].includes(raw.record_status))errors.push('record_status harus active/inactive.');

   const frequency=raw.service_frequency_days?Number(raw.service_frequency_days):before?.service_frequency_days??null;if(frequency!==null&&(!Number.isInteger(frequency)||frequency<1||frequency>365))errors.push('Frekuensi layanan harus bilangan bulat 1–365.');

   payload={external_code:code,external_code_key:code,name:raw.name,address:raw.address,area_id:raw.area_id,latitude_e7:hasLat&&Number.isFinite(lat)?Math.round(lat!*1e7):before?.latitude_e7??null,longitude_e7:hasLon&&Number.isFinite(lon)?Math.round(lon!*1e7):before?.longitude_e7??null,coordinate_status:hasLat&&hasLon?'unverified':before?.coordinate_status||'missing',location_note:hasLat&&hasLon?'Lokasi dari import; belum diverifikasi.':before?.location_note||'',outlet_type:raw.outlet_type||before?.outlet_type||'',service_frequency_days:frequency,record_status:raw.record_status||before?.record_status||'active',external_code_review:0};

   reference={area:area?.version};

  }else{if(raw.status&&!['active','inactive'].includes(raw.status))errors.push('status harus active/inactive.');if(raw.base_unit.length>32||!raw.base_unit)errors.push('base_unit wajib, maksimum 32 karakter.');if(raw.group_code?.length>80)errors.push('group_code maksimum 80 karakter.');if(before&&before.base_unit!==raw.base_unit)errors.push('Perubahan satuan produk memerlukan review terpisah.');const scale=raw.quantity_scale?Number(raw.quantity_scale):before?.quantity_scale||1;if(!Number.isInteger(scale)||scale<1||scale>1000000)errors.push('quantity_scale harus integer1–1000000.');const groupCode=raw.group_code?.toUpperCase()||before?.group_code||'',group=groups.find(g=>g.code===groupCode&&g.status==='active');if(raw.group_code&&!group)errors.push('group_code harus mengacu kelompok aktif yang sudah terdaftar.');payload={sku:code,name:raw.name,base_unit:raw.base_unit,quantity_scale:scale,product_group_id:group?.id||before?.product_group_id||null,group_code:groupCode,status:raw.status||before?.status||'active'}}

  if(!raw.name||raw.name.length>160)errors.push('Nama wajib, maksimum 160 karakter.');if(kind==='customer'&&(!raw.address||raw.address.length>500||payload.outlet_type.length>80))errors.push('Alamat wajib maksimum 500 karakter; tipe outlet maksimum 80.');

  const action=errors.length?'invalid':!before?'create':Object.keys(payload).every(key=>payload[key]===before[key])?'noop':'update';

  return {row_no:row.line,action,resource_id:before?.id||crypto.randomUUID(),expected_version:before?.version??null,payload:errors.length?Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v.slice(0,2000)])):payload,before,reference,errors,status:errors.length?'invalid':'valid'};

 });

}

imports.post('/api/master-imports',async c=>{

 const parsed=request.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({code:'INVALID_IMPORT_REQUEST'},422);const body={...parsed.data,mapping:Object.fromEntries(Object.entries(parsed.data.mapping).sort(([a],[b])=>a.localeCompare(b)))};

 return operation(c,body,async()=>{const db=c.env.DB,org=c.get('identity').organization_id,bucket=c.env.IMPORT_FILES;

  const file=await db.prepare('SELECT * FROM import_file WHERE organization_id=? AND id=?').bind(org,body.attachment_id).first<any>();if(!file)fail(404,'FILE_NOT_FOUND');if(!bucket)fail(503,'SOURCE_STORAGE_NOT_CONFIGURED');

  if(body.mode==='dry_run'){

   const source=await bucket!.get(file.storage_key);if(!source)fail(503,'SOURCE_UNAVAILABLE');const bytes=await source!.arrayBuffer();if(await digest(bytes)!==file.checksum)fail(409,'SOURCE_CHANGED');

   let csv;try{csv=parseCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch(e){fail(422,(e as Error).message)}

   const rows=await validate(db,org,body.kind,csv!,body.mapping),id=crypto.randomUUID(),now=new Date().toISOString(),valid=rows.filter(r=>r.status==='valid').length;

   const serial=rows.map(({payload,before,reference,errors,...r})=>({...r,payload_json:JSON.stringify(payload),before_json:before?JSON.stringify(before):null,reference_json:JSON.stringify(reference),errors_json:JSON.stringify(errors)}));

   return {data:{id,version:1,status:'validated',valid_count:valid,invalid_count:rows.length-valid},status:201,resource:'master_import',statements:[db.prepare("INSERT INTO master_import_batch(schema_version,id,organization_id,attachment_id,kind,mapping_json,status,valid_count,invalid_count,created_by,created_at) VALUES(2,?,?,?,?,?,'validated',?,?,?,?)").bind(id,org,file.id,body.kind,JSON.stringify(body.mapping),valid,rows.length-valid,c.get('identity').id,now),db.prepare(`INSERT INTO master_import_row(batch_id,organization_id,row_no,action,resource_id,expected_version,payload_json,before_json,reference_json,errors_json,status) SELECT ?,?,json_extract(value,'$.row_no'),json_extract(value,'$.action'),json_extract(value,'$.resource_id'),json_extract(value,'$.expected_version'),json_extract(value,'$.payload_json'),json_extract(value,'$.before_json'),json_extract(value,'$.reference_json'),json_extract(value,'$.errors_json'),json_extract(value,'$.status') FROM json_each(?)`).bind(id,org,JSON.stringify(serial))]};

  }

  if(!body.validation_batch_id)fail(422,'VALIDATION_BATCH_REQUIRED');

  const batch=await db.prepare('SELECT * FROM master_import_batch WHERE organization_id=? AND id=?').bind(org,body.validation_batch_id).first<any>();if(!batch)fail(404,'BATCH_NOT_FOUND');if(body.kind==='customer'&&batch.schema_version<2)fail(409,'LEGACY_CUSTOMER_BATCH_VALIDATE_AGAIN');

  if(batch.kind!==body.kind||batch.attachment_id!==file.id||JSON.stringify(JSON.parse(batch.mapping_json))!==JSON.stringify(body.mapping))fail(409,'VALIDATION_MISMATCH');

  if(batch.status!=='validated')return {data:batch,resource:'master_import',statements:[]};

  if(!c.req.header('If-Match'))fail(428,'PRECONDITION_REQUIRED');if(c.req.header('If-Match')!==`"${batch.version}"`)fail(412,'VERSION_CONFLICT');

  if(!batch.valid_count)fail(409,'NO_VALID_ROWS');if(batch.invalid_count&&!body.allow_partial)fail(409,'PARTIAL_IMPORT_REQUIRES_CONFIRMATION');

  const head=await bucket!.head(file.storage_key);if(!head||head.etag!==file.etag)fail(409,'SOURCE_CHANGED');

  const rows=(await db.prepare("SELECT * FROM master_import_row WHERE organization_id=? AND batch_id=? AND status='valid' ORDER BY row_no").bind(org,batch.id).all<any>()).results;

  if(body.kind==='customer'){

   const changes=rows.filter(r=>r.action==='update').map(r=>({id:r.resource_id,area_id:JSON.parse(r.payload_json).area_id}));

   const blocked=await db.prepare(`SELECT co.id FROM customer_outlet co JOIN json_each(?) j ON json_extract(j.value,'$.id')=co.id WHERE co.organization_id=? AND co.area_id<>json_extract(j.value,'$.area_id') AND (EXISTS(SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=co.organization_id AND ca.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id))) OR EXISTS(SELECT 1 FROM invoice i WHERE i.organization_id=co.organization_id AND i.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id))) OR EXISTS(SELECT 1 FROM target_item t WHERE t.organization_id=co.organization_id AND t.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)))) LIMIT 1`).bind(JSON.stringify(changes),org).first();if(blocked)fail(409,'AREA_TRANSFER_REQUIRES_WORKFLOW');

  }

  const table=body.kind==='customer'?'customer_outlet':'product',codeColumn=body.kind==='customer'?'external_code':'sku';

  const columns=body.kind==='customer'?['external_code','external_code_key','name','address','area_id','latitude_e7','longitude_e7','coordinate_status','location_note','outlet_type','service_frequency_days','record_status','external_code_review']:['sku','name','base_unit','quantity_scale','product_group_id','group_code','status'];

  const rowFilter="r.organization_id=? AND r.batch_id=? AND r.status='valid'";

  const snapshotGuard=db.prepare(`INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM master_import_row r LEFT JOIN ${table} m ON m.id=r.resource_id AND m.organization_id=r.organization_id WHERE ${rowFilter} AND r.action IN ('update','noop') AND (m.id IS NULL OR m.version<>r.expected_version${body.kind==='customer'?' OR m.merged_into_id IS NOT NULL':''})) AND NOT EXISTS(SELECT 1 FROM master_import_row r JOIN ${table} m ON m.organization_id=r.organization_id AND ${body.kind==='customer'?'UPPER(TRIM(m.external_code))':'m.sku'}=json_extract(r.payload_json,'$.${codeColumn}') WHERE ${rowFilter} AND r.action='create')${body.kind==='customer'?` AND NOT EXISTS(SELECT 1 FROM master_import_row r LEFT JOIN area ar ON ar.organization_id=r.organization_id AND ar.id=json_extract(r.payload_json,'$.area_id') WHERE ${rowFilter} AND (ar.id IS NULL OR ar.status<>'active' OR ar.version<>json_extract(r.reference_json,'$.area')))` :''} THEN 1 ELSE 0 END`).bind(org,batch.id,org,batch.id,...(body.kind==='customer'?[org,batch.id]:[]));

  const selectRow=(col:string)=>`(SELECT json_extract(r.payload_json,'$.${col}') FROM master_import_row r WHERE r.organization_id=${table}.organization_id AND r.batch_id=? AND r.resource_id=${table}.id AND r.status='valid')`;

  const now=new Date().toISOString(),status=batch.invalid_count?'partial':'committed';

  const statements=[...guard(db,db.prepare("UPDATE master_import_batch SET version=version+1,status=?,committed_at=? WHERE organization_id=? AND id=? AND version=? AND status='validated'").bind(status,now,org,batch.id,batch.version)),snapshotGuard,db.prepare('DELETE FROM master_mutation_guard'),db.prepare(`INSERT INTO ${table}(id,organization_id,${columns.join(',')}) SELECT r.resource_id,r.organization_id,${columns.map(col=>`json_extract(r.payload_json,'$.${col}')`).join(',')} FROM master_import_row r WHERE ${rowFilter} AND r.action='create'`).bind(org,batch.id),db.prepare(`UPDATE ${table} SET ${columns.map(col=>col+'='+selectRow(col)).join(',')},version=version+1 WHERE organization_id=? AND id IN(SELECT resource_id FROM master_import_row WHERE organization_id=? AND batch_id=? AND status='valid' AND action='update')`).bind(...columns.map(()=>batch.id),org,org,batch.id),db.prepare("UPDATE master_import_row SET status='applied' WHERE organization_id=? AND batch_id=? AND status='valid'").bind(org,batch.id)];

  // Each row audit receives a stable unique ID instead of sharing the batch ID.

  statements.splice(statements.length-1,0,db.prepare(`INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,occurred_at,before_json,after_json) SELECT ?||':'||r.row_no,r.organization_id,?,?,r.resource_id,'import_'||r.action,?,r.before_json,r.payload_json FROM master_import_row r WHERE ${rowFilter} AND r.action<>'noop'`).bind(batch.id,c.get('identity').id,body.kind==='customer'?'customers':'products',now,org,batch.id));

  return {data:{...batch,status,committed_at:now,version:batch.version+1},before:batch,resource:'master_import',statements};

 });

});
