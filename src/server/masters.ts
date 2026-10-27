import {Hono} from 'hono';
import {z} from 'zod';
import type {Scope} from './scope';
import type {Identity} from './auth';
import {businessClock,isWorkingInstant} from './calendar';
type Env={Bindings:{DB:D1Database};Variables:{scope:Scope;identity:Identity}};
export const masters=new Hono<Env>();
const timezone=z.string().max(100).refine(t=>{try{new Intl.DateTimeFormat('en',{timeZone:t});return true}catch{return false}},'Timezone IANA tidak valid');
const name=z.string().trim().min(1).max(120);
const date=z.iso.date();const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const orgSchema=z.object({name,timezone}).strict();
const branchSchema=orgSchema;
const areaSchema=z.object({name,branch_id:z.string().min(1).max(128)}).strict();
const calendarSchema=z.object({name,branch_id:z.string().min(1).max(128),weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(a=>new Set(a).size===a.length),start_time:time,end_time:time,holidays:z.array(date).max(366).refine(a=>new Set(a).size===a.length)}).strict().refine(x=>x.start_time<x.end_time,{message:'Jam selesai harus setelah mulai; shift lintas tengah malam belum didukung'});
const tableFor={branches:'branch',areas:'area',calendars:'work_calendar'} as const;
type Kind=keyof typeof tableFor;
function exposed(row:any,kind:string){if(kind!=='calendars')return row;const {weekdays_json,holidays_json,...rest}=row;return {...rest,weekdays:JSON.parse(weekdays_json),holidays:JSON.parse(holidays_json)}}
async function list(db:D1Database,scope:Scope,kind:Kind){
 const table=tableFor[kind];let filter='organization_id=?';const params=[scope.identity.organization_id];
 if(!scope.orgWide){
  // Areas include explicit customer assignment territory, even when the SR has no area-wide grant.
  const ids=[...scope.areaIds];
  const assigned=await db.prepare(`SELECT DISTINCT co.area_id FROM customer_assignment ca JOIN customer_outlet co ON co.id=ca.outlet_id AND co.organization_id=ca.organization_id WHERE ca.organization_id=? AND ca.rep_id IN (${scope.repIds.map(()=>'?').join(',')}) AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)${scope.channel?' AND ca.channel=?':''}`).bind(scope.identity.organization_id,...scope.repIds,scope.date,scope.date,...(scope.channel?[scope.channel]:[])).all<{area_id:string}>();
  if(!scope.allRepsInArea&&scope.identity.role!=='SUPERVISOR')ids.push(...assigned.results.map(x=>x.area_id));
  const placeholders=ids.map(()=>'?').join(',')||'NULL';
  if(kind==='areas')filter+=` AND id IN (${placeholders})`;
  else if(kind==='branches')filter+=` AND id IN(SELECT branch_id FROM area WHERE organization_id=? AND id IN (${placeholders}))`;
  else filter+=` AND branch_id IN(SELECT branch_id FROM area WHERE organization_id=? AND id IN (${placeholders}))`;
  if(kind!=='areas')params.push(scope.identity.organization_id);params.push(...ids);
 }
 const rows=await db.prepare(`SELECT * FROM ${table} WHERE ${filter} ORDER BY name,id`).bind(...params).all();
 return rows.results.map(row=>exposed(row,kind));
}
masters.get('/api/organization',async c=>{const org=await c.env.DB.prepare('SELECT id,name,timezone,version FROM organization WHERE id=?').bind(c.get('identity').organization_id).first<{id:string;name:string;timezone:string;version:number}>();if(!org)return c.json({code:'NOT_FOUND'},404);c.header('ETag',`"${org.version}"`);return c.json({data:org})});
for(const kind of Object.keys(tableFor) as Kind[]){
 masters.get(`/api/${kind}`,async c=>c.json({data:await list(c.env.DB,c.get('scope'),kind)}));
 masters.get(`/api/${kind}/:id`,async c=>{const row=(await list(c.env.DB,c.get('scope'),kind)).find((x:any)=>x.id===c.req.param('id'));if(!row)return c.json({code:'NOT_FOUND'},404);c.header('ETag',`"${row.version}"`);return c.json({data:row})});
}
masters.get('/api/calendars/:id/clock',async c=>{
 const calendar=(await list(c.env.DB,c.get('scope'),'calendars')).find((x:any)=>x.id===c.req.param('id'));if(!calendar)return c.json({code:'NOT_FOUND'},404);
 const branch=await c.env.DB.prepare('SELECT timezone FROM branch WHERE organization_id=? AND id=?').bind(c.get('identity').organization_id,calendar.branch_id).first<{timezone:string}>();
 if(!branch)return c.json({code:'NOT_FOUND'},404);const now=new Date();return c.json({data:{timezone:branch.timezone,utc:now.toISOString(),...businessClock(now,branch.timezone),is_working:calendar.status==='active'&&isWorkingInstant(now,branch.timezone,calendar)}});
});
async function mutate(c:any,kind:Kind|'organization',archive=false){
 if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);
 const db=c.env.DB as D1Database,who=c.get('identity') as Identity,org=who.organization_id;
 const key=c.req.header('Idempotency-Key');if(!key||key.length<8||key.length>128)return c.json({code:'IDEMPOTENCY_KEY_REQUIRED'},400);
 let input:unknown;try{input=await c.req.json()}catch{return c.json({code:'INVALID_JSON'},400)}
 const schema=archive?z.object({}).strict():kind==='organization'?orgSchema:kind==='branches'?branchSchema:kind==='areas'?areaSchema:calendarSchema;
 const valid=schema.safeParse(input);if(!valid.success)return c.json({code:'VALIDATION_ERROR',detail:valid.error.issues.map(i=>i.message).join('; ')},422);
 const value=valid.data as any;const path=c.req.method+' '+c.req.path;
 const payload=JSON.stringify([value,c.req.header('If-Match')||'']);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const replay=await db.prepare('SELECT payload_hash,response_json FROM master_idempotency WHERE organization_id=? AND actor_id=? AND path=? AND key=?').bind(org,who.id,path,key).first<{payload_hash:string;response_json:string}>();
 if(replay){if(replay.payload_hash!==hash)return c.json({code:'IDEMPOTENCY_CONFLICT'},409);const result=JSON.parse(replay.response_json);c.header('ETag',`"${result.data.version}"`);return c.json(result,c.req.method==='POST'&&!archive?201:200)}
 const table=kind==='organization'?'organization':tableFor[kind];const create=c.req.method==='POST'&&!archive;
 const id=kind==='organization'?org:create?crypto.randomUUID():c.req.param('id');
 const before=create?null:await db.prepare(`SELECT * FROM ${table} WHERE id=?${kind==='organization'?'':' AND organization_id=?'}`).bind(id,...(kind==='organization'?[]:[org])).first<any>();
 if(!create&&!before)return c.json({code:'NOT_FOUND'},404);
 if(!create){if(!c.req.header('If-Match'))return c.json({code:'PRECONDITION_REQUIRED'},428);if(c.req.header('If-Match')!==`"${before.version}"`)return c.json({code:'VERSION_CONFLICT'},412);if(before.status==='archived')return c.json({code:'RESOURCE_ARCHIVED'},409)}
 if(value.branch_id){const parent=await db.prepare("SELECT id FROM branch WHERE id=? AND organization_id=? AND status='active'").bind(value.branch_id,org).first();if(!parent)return c.json({code:'INVALID_BRANCH'},422)}
 if(archive&&kind==='branches'){
  const references=await db.prepare("SELECT id FROM area WHERE organization_id=? AND branch_id=? AND status='active' UNION ALL SELECT id FROM work_calendar WHERE organization_id=? AND branch_id=? AND status='active' LIMIT 1").bind(org,id,org,id).first();if(references)return c.json({code:'BRANCH_IN_USE',detail:'Arsipkan area dan kalender aktif terlebih dahulu.'},409);
 }
 if(archive&&kind==='areas'){
  const refs=await db.prepare("SELECT id FROM customer_outlet WHERE organization_id=? AND area_id=? UNION ALL SELECT user_id FROM user_area_scope WHERE organization_id=? AND area_id=? AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1").bind(org,id,org,id,c.get('scope').date).first();if(refs)return c.json({code:'AREA_IN_USE',detail:'Area masih terkait customer atau scope user.'},409);
 }
 const fields:Record<string,unknown>=archive?{status:'archived'}:kind==='calendars'?{name:value.name,branch_id:value.branch_id,weekdays_json:JSON.stringify(value.weekdays),start_time:value.start_time,end_time:value.end_time,holidays_json:JSON.stringify(value.holidays)}:value;
 const version=create?1:before.version+1;const after={...before,...fields,id,version,...(kind==='organization'?{}:{organization_id:org,status:archive?'archived':'active'})};
 const response={data:exposed(after,kind)};
 const columns=Object.keys(fields);const mutation=create?db.prepare(`INSERT INTO ${table}(id,organization_id,${columns.join(',')},version) VALUES(?,?,${columns.map(()=>'?').join(',')},1)`).bind(id,org,...Object.values(fields)):
 db.prepare(`UPDATE ${table} SET ${columns.map(k=>k+'=?').join(',')},version=version+1 WHERE id=? AND version=?${kind==='organization'?'':' AND organization_id=?'}`).bind(...Object.values(fields),id,before.version,...(kind==='organization'?[]:[org]));
 try{
  await db.batch([
   mutation,
   db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),
   db.prepare('DELETE FROM master_mutation_guard'),
   db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),org,who.id,kind,id,archive?'archive':create?'create':'update',new Date().toISOString(),before?JSON.stringify(before):null,JSON.stringify(after)),
   db.prepare('INSERT INTO master_idempotency VALUES(?,?,?,?,?,?)').bind(org,who.id,path,key,hash,JSON.stringify(response))
  ]);
 }catch{
  const saved=await db.prepare('SELECT payload_hash,response_json FROM master_idempotency WHERE organization_id=? AND actor_id=? AND path=? AND key=?').bind(org,who.id,path,key).first<{payload_hash:string;response_json:string}>();
  if(saved&&saved.payload_hash===hash){const result=JSON.parse(saved.response_json);c.header('ETag',`"${result.data.version}"`);return c.json(result,c.req.method==='POST'&&!archive?201:200)}
  if(saved)return c.json({code:'IDEMPOTENCY_CONFLICT'},409);
  return c.json({code:'MASTER_CONFLICT',detail:'Data berubah atau sudah digunakan. Muat ulang sebelum menyimpan.'},409);
 }
 c.header('ETag',`"${version}"`);return c.json(response,create?201:200);
}
masters.put('/api/organization',c=>mutate(c,'organization'));
for(const kind of Object.keys(tableFor) as Kind[]){masters.post(`/api/${kind}`,c=>mutate(c,kind));masters.put(`/api/${kind}/:id`,c=>mutate(c,kind));masters.post(`/api/${kind}/:id/archive`,c=>mutate(c,kind,true))}

export const masterRequestSchemas={organization:orgSchema,branch:branchSchema,area:areaSchema,calendar:calendarSchema,empty:z.object({}).strict()};
