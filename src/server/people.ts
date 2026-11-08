import {requireNoOpenPeopleWork,noOpenPeopleWorkGuard,peopleDeactivationCleanup,revokePeopleSessions} from './people-impact';
import {Hono} from 'hono';
import {z} from 'zod';
import type {Identity} from './auth';
import {roles,type Scope} from './scope';
type Env={Bindings:{DB:D1Database};Variables:{identity:Identity;scope:Scope}};
export const people=new Hono<Env>();
const id=z.string().min(1).max(128),name=z.string().trim().min(1).max(120),date=z.iso.date();
const roleInput=z.object({role_code:z.enum(roles),channel:z.enum(['field','telesales']).nullable(),area_ids:z.array(id).max(100).refine(a=>new Set(a).size===a.length),effective_from_date:date}).strict().refine(r=>r.role_code==='SALES_REP'?r.channel==='field':r.role_code==='TELESALES'?r.channel==='telesales':['MANAGEMENT','NSM','REGIONAL_MANAGER'].includes(r.role_code)?r.channel===null:r.channel!==null,{message:'Kanal tidak sesuai role'}).refine(r=>!['REGIONAL_MANAGER','AREA_MANAGER','SUPERVISOR'].includes(r.role_code)||r.area_ids.length>0,{message:'Area wajib untuk Manager/Supervisor'});
const userInput=z.object({name,auth_subject:id.nullable(),role:roleInput}).strict();
const profileInput=z.object({name,auth_subject:id.nullable(),status:z.enum(['active','inactive'])}).strict();
const assignmentInput=z.object({subordinate_id:id,manager_id:id,area_id:id,channel:z.enum(['field','telesales']),effective_from_date:date,effective_to_date:date.nullable()}).strict().refine(r=>r.subordinate_id!==r.manager_id,{message:'User tidak boleh melapor ke dirinya sendiri'}).refine(r=>!r.effective_to_date||r.effective_to_date>r.effective_from_date,{message:'Periode tidak valid'});
async function requireNoCustomers(db:D1Database,org:string,id:string,date:string){if(await db.prepare('SELECT id FROM customer_assignment WHERE organization_id=? AND rep_id=? AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1').bind(org,id,date).first())throw new Error('409:TRANSFER_CUSTOMERS_BEFORE_USER_CHANGE')}
async function row(db:D1Database,org:string,user:string){return db.prepare('SELECT * FROM app_user WHERE organization_id=? AND id=?').bind(org,user).first<any>()}
async function roleAt(db:D1Database,org:string,user:string,from:string,to:string|null=null){return db.prepare("SELECT * FROM auth_role_assignment WHERE organization_id=? AND user_id=? AND effective_from_date<=? AND (effective_to_date IS NULL OR (effective_to_date>? AND ? IS NOT NULL AND effective_to_date>=?))").bind(org,user,from,from,to,to).first<any>()}
async function validAreas(db:D1Database,org:string,ids:string[]){for(const area of ids)if(!await db.prepare("SELECT id FROM area WHERE organization_id=? AND id=? AND status='active'").bind(org,area).first())return false;return true}
function canSee(s:Scope,user:string){return s.orgWide||s.repIds.includes(user)}
async function visibleUsers(db:D1Database,s:Scope,status?:'active'|'inactive'){
 let filter='u.organization_id=?';const params=[s.identity.organization_id];if(status){filter+=' AND u.status=?';params.push(status)}
 if(!s.orgWide){if(s.allRepsInArea){filter+=` AND (u.id=? OR EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=u.organization_id AND a.user_id=u.id AND a.area_id IN (${s.areaIds.map(()=>'?').join(',')||'NULL'}) AND a.effective_from_date<=? AND (a.effective_to_date IS NULL OR a.effective_to_date>?)))`;params.push(s.identity.id,...s.areaIds,s.date,s.date)}else{filter+=` AND u.id IN (${s.repIds.map(()=>'?').join(',')})`;params.push(...s.repIds)}}
 const rows=await db.prepare(`SELECT u.id,u.name,u.status,u.version${s.orgWide?',u.auth_subject':''},r.role_code,r.channel FROM app_user u LEFT JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id AND r.effective_from_date<=? AND (r.effective_to_date IS NULL OR r.effective_to_date>?) WHERE ${filter} ORDER BY u.name`).bind(s.date,s.date,...params).all();return rows.results;
}
// All mutations share an atomic idempotency + audit transaction, with optimistic guards.
async function action(c:any,body:unknown,work:(db:D1Database)=>Promise<{statements:D1PreparedStatement[];data:any;before?:unknown;status?:number}>){
 const s=c.get('scope') as Scope;if(!s.orgWide)return c.json({code:'SCOPE_DENIED'},403);
 const db=c.env.DB as D1Database;const key=c.req.header('Idempotency-Key');if(!key||key.length<8||key.length>128)return c.json({code:'IDEMPOTENCY_KEY_REQUIRED'},400);
 const path=c.req.method+' '+c.req.path;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([body,c.req.header('If-Match')||'']))))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const lookup=()=>db.prepare('SELECT payload_hash,response_json FROM master_idempotency WHERE organization_id=? AND actor_id=? AND path=? AND key=?').bind(s.identity.organization_id,s.identity.id,path,key).first<{payload_hash:string;response_json:string}>();
 const replay=await lookup();if(replay){if(replay.payload_hash!==hash)return c.json({code:'IDEMPOTENCY_CONFLICT'},409);const saved=JSON.parse(replay.response_json);return c.json(saved.body,saved.status)}
 try{const result=await work(db);const response={data:result.data};const status=result.status||200;
  await db.batch([...result.statements,db.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),s.identity.organization_id,s.identity.id,'people',result.data.id,c.req.path,new Date().toISOString(),result.before?JSON.stringify(result.before):null,JSON.stringify(result.data)),db.prepare('INSERT INTO master_idempotency VALUES(?,?,?,?,?,?)').bind(s.identity.organization_id,s.identity.id,path,key,hash,JSON.stringify({body:response,status}))]);
  if(result.data.version)c.header('ETag',`"${result.data.version}"`);return c.json(response,status);
 }catch(e){const saved=await lookup();if(saved){if(saved.payload_hash!==hash)return c.json({code:'IDEMPOTENCY_CONFLICT'},409);const result=JSON.parse(saved.response_json);return c.json(result.body,result.status)}const error=e as Error;const match=/^(404|409|412|422|428):(.+)$/.exec(error.message);return c.json({code:match?match[2]:'PEOPLE_CONFLICT',detail:match?.[2]==='RESOLVE_OPEN_WORK_BEFORE_USER_CHANGE'?'Selesaikan atau alihkan kunjungan, agenda, tugas, handoff, pipeline, order, coaching, dan off visit yang masih terbuka sebelum mengubah user.':match?match[2]:'Data berubah, periode tumpang tindih, atau relasi tidak valid. Muat ulang dan periksa kembali.'},match?Number(match[1]):409)}
}
function guard(db:D1Database,statement:D1PreparedStatement){return [statement,db.prepare('INSERT INTO master_mutation_guard(ok) VALUES(changes())'),db.prepare('DELETE FROM master_mutation_guard')]}
function precondition(c:any,user:any){if(!user)throw new Error('404:NOT_FOUND');if(!c.req.header('If-Match'))throw new Error('428:PRECONDITION_REQUIRED');if(c.req.header('If-Match')!==`"${user.version}"`)throw new Error('412:VERSION_CONFLICT')}
async function parsed(c:any,schema:z.ZodType){let body;try{body=await c.req.json()}catch{throw new Error('422:INVALID_JSON')}const result=schema.safeParse(body);if(!result.success)throw new Error('422:'+result.error.issues.map(x=>x.message).join('; '));return result.data as any}
people.get('/api/users',async c=>{const query=z.object({status:z.enum(['active','inactive']).optional()}).strict().safeParse(c.req.query());if(!query.success)return c.json({code:'INVALID_USER_FILTER'},422);return c.json({data:await visibleUsers(c.env.DB,c.get('scope'),query.data.status)})});
people.get('/api/users/:id',async c=>{const s=c.get('scope');const user=(await visibleUsers(c.env.DB,s)).find((u:any)=>u.id===c.req.param('id')) as any;if(!user)return c.json({code:'NOT_FOUND'},404);let history={};if(s.orgWide){const roles=await c.env.DB.prepare('SELECT * FROM auth_role_assignment WHERE organization_id=? AND user_id=? ORDER BY effective_from_date').bind(s.identity.organization_id,user.id).all();const areas=await c.env.DB.prepare('SELECT * FROM user_area_scope WHERE organization_id=? AND user_id=? ORDER BY effective_from_date').bind(s.identity.organization_id,user.id).all();history={roles:roles.results,areas:areas.results}}c.header('ETag',`"${user.version}"`);return c.json({data:{...user,...history}})});
people.post('/api/users',async c=>{let body;try{body=await parsed(c,userInput)}catch(e){return c.json({detail:(e as Error).message},422)}return action(c,body,async db=>{
 const s=c.get('scope'),org=s.identity.organization_id;if(body.role.effective_from_date<s.date)throw new Error('422:PAST_DATE_NOT_ALLOWED');if(!await validAreas(db,org,body.role.area_ids))throw new Error('422:INVALID_AREA');
 const userId=crypto.randomUUID();const statements=[db.prepare("INSERT INTO app_user(id,organization_id,name,auth_subject,status) VALUES(?,?,?,?,'inactive')").bind(userId,org,body.name,body.auth_subject),db.prepare('INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),org,userId,body.role.role_code,body.role.channel,body.role.effective_from_date),...body.role.area_ids.map((a:string)=>db.prepare('INSERT INTO user_area_scope VALUES(?,?,?,?,NULL)').bind(org,userId,a,body.role.effective_from_date))];
 return {statements,data:{id:userId,name:body.name,status:'inactive',version:1},status:201};
})});
people.put('/api/users/:id',async c=>{let body;try{body=await parsed(c,profileInput)}catch(e){return c.json({detail:(e as Error).message},422)}return action(c,body,async db=>{
 const s=c.get('scope'),org=s.identity.organization_id,id=c.req.param('id'),before=await row(db,org,id);precondition(c,before);
 if(id===s.identity.id&&(body.status!=='active'||body.auth_subject!==before.auth_subject))throw new Error('409:SELF_ACCESS_CHANGE_FORBIDDEN');
 if(body.status==='active'){
  const role=await roleAt(db,org,id,s.date,s.date);if(!role)throw new Error('409:ACTIVE_ROLE_REQUIRED');
  if(['SALES_REP','TELESALES'].includes(role.role_code)){const reporting=await db.prepare("SELECT id FROM reporting_assignment WHERE organization_id=? AND subordinate_id=? AND effective_from_date<=? AND (effective_to_date IS NULL OR effective_to_date>?)").bind(org,id,s.date,s.date).all();if(reporting.results.length!==1)throw new Error('409:SUPERVISOR_REQUIRED')}
 }else{await requireNoCustomers(db,org,id,s.date);await requireNoOpenPeopleWork(db,org,id,s.date);const used=await db.prepare('SELECT id FROM reporting_assignment WHERE organization_id=? AND manager_id=? AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1').bind(org,id,s.date).first();if(used)throw new Error('409:TRANSFER_TEAM_BEFORE_DEACTIVATION')}
 const customerGuard=body.status==='inactive'?' AND NOT EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=? AND rep_id=? AND (effective_to_date IS NULL OR effective_to_date>?))':'';
 const dependencyGuard=body.status==='inactive'?' AND NOT EXISTS(SELECT 1 FROM reporting_assignment WHERE organization_id=? AND manager_id=? AND (effective_to_date IS NULL OR effective_to_date>?))':'';
 const statement=db.prepare(`UPDATE app_user SET name=?,auth_subject=?,status=?,version=version+1 WHERE organization_id=? AND id=? AND version=?${dependencyGuard}${customerGuard}`).bind(body.name,body.auth_subject,body.status,org,id,before.version,...(body.status==='inactive'?[org,id,s.date,org,id,s.date]:[]));
 const cleanup=body.status==='inactive'?peopleDeactivationCleanup(db,org,id,s.date,s.identity.id):body.auth_subject!==before.auth_subject?[revokePeopleSessions(db,org,id,s.identity.id)]:[];
 return {before,statements:[...(body.status==='inactive'?noOpenPeopleWorkGuard(db,org,id,s.date):[]),...guard(db,statement),...cleanup],data:{id,name:body.name,status:body.status,version:before.version+1}};
})});
people.post('/api/users/:id/roles',async c=>{let body;try{body=await parsed(c,roleInput)}catch(e){return c.json({detail:(e as Error).message},422)}return action(c,body,async db=>{
 const s=c.get('scope'),org=s.identity.organization_id,id=c.req.param('id'),before=await row(db,org,id);precondition(c,before);
 await requireNoCustomers(db,org,id,body.effective_from_date);await requireNoOpenPeopleWork(db,org,id,body.effective_from_date);
 if(id===s.identity.id)throw new Error('409:SELF_ROLE_CHANGE_FORBIDDEN');if(body.effective_from_date<s.date)throw new Error('422:PAST_DATE_NOT_ALLOWED');if(!await validAreas(db,org,body.area_ids))throw new Error('422:INVALID_AREA');
 const related=await db.prepare('SELECT id FROM reporting_assignment WHERE organization_id=? AND (subordinate_id=? OR manager_id=?) AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1').bind(org,id,id,body.effective_from_date).first();if(related)throw new Error('409:END_HIERARCHY_BEFORE_ROLE_CHANGE');
 // An active rep cannot lose a required hierarchy by changing role; deactivate first if no manager remains.
 if(before.status==='active'&&['SALES_REP','TELESALES'].includes(body.role_code))throw new Error('409:CONFIGURE_ROLE_WHILE_INACTIVE');
 const later=await db.prepare('SELECT id FROM auth_role_assignment WHERE organization_id=? AND user_id=? AND effective_from_date>=?').bind(org,id,body.effective_from_date).first();if(later)throw new Error('409:ROLE_DATE_CONFLICT');
 const statements=[...noOpenPeopleWorkGuard(db,org,id,body.effective_from_date),...guard(db,db.prepare('UPDATE app_user SET version=version+1 WHERE organization_id=? AND id=? AND version=? AND NOT EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=? AND rep_id=? AND (effective_to_date IS NULL OR effective_to_date>?)) AND NOT EXISTS(SELECT 1 FROM reporting_assignment WHERE organization_id=? AND (subordinate_id=? OR manager_id=?) AND (effective_to_date IS NULL OR effective_to_date>?))').bind(org,id,before.version,org,id,body.effective_from_date,org,id,id,body.effective_from_date)),db.prepare('UPDATE auth_role_assignment SET effective_to_date=? WHERE organization_id=? AND user_id=? AND (effective_to_date IS NULL OR effective_to_date>?)').bind(body.effective_from_date,org,id,body.effective_from_date),db.prepare('UPDATE user_area_scope SET effective_to_date=? WHERE organization_id=? AND user_id=? AND effective_from_date<? AND (effective_to_date IS NULL OR effective_to_date>?)').bind(body.effective_from_date,org,id,body.effective_from_date,body.effective_from_date),db.prepare('INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),org,id,body.role_code,body.channel,body.effective_from_date),...body.area_ids.map((a:string)=>db.prepare('INSERT INTO user_area_scope VALUES(?,?,?,?,NULL)').bind(org,id,a,body.effective_from_date))];
 return {before,statements,data:{id,version:before.version+1,role:body}};
})});
async function checkHierarchy(db:D1Database,s:Scope,input:any){
 if(await db.prepare('SELECT id FROM customer_assignment WHERE organization_id=? AND rep_id=? AND COALESCE(area_id,(SELECT area_id FROM customer_outlet WHERE id=outlet_id))<>? AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1').bind(s.identity.organization_id,input.subordinate_id,input.area_id,input.effective_from_date).first())throw new Error('409:TRANSFER_CUSTOMERS_BEFORE_AREA_CHANGE');
 const org=s.identity.organization_id;const sub=await row(db,org,input.subordinate_id),manager=await row(db,org,input.manager_id);if(!sub||!manager)throw new Error('404:NOT_FOUND');if(manager.status!=='active')throw new Error('409:MANAGER_INACTIVE');
 if(input.effective_from_date<s.date)throw new Error('422:PAST_DATE_NOT_ALLOWED');
 const subordinateRole=await roleAt(db,org,sub.id,input.effective_from_date,input.effective_to_date),managerRole=await roleAt(db,org,manager.id,input.effective_from_date,input.effective_to_date);
 if(!subordinateRole||!managerRole)throw new Error('409:ROLE_MUST_COVER_ASSIGNMENT');
 if(['SALES_REP','TELESALES'].includes(subordinateRole.role_code)&&input.effective_to_date)throw new Error('422:USE_TRANSFER_TO_END_SALES_ASSIGNMENT');
 const parents:Record<string,string[]>={SALES_REP:['SUPERVISOR'],TELESALES:['SUPERVISOR'],SUPERVISOR:['AREA_MANAGER'],AREA_MANAGER:['REGIONAL_MANAGER','NSM','MANAGEMENT'],REGIONAL_MANAGER:['MANAGEMENT'],NSM:['MANAGEMENT']};
 if(!parents[subordinateRole.role_code]?.includes(managerRole.role_code))throw new Error('422:INVALID_REPORTING_LAYER');
 if(subordinateRole.channel&&subordinateRole.channel!==input.channel||managerRole.channel&&managerRole.channel!==input.channel)throw new Error('422:CHANNEL_MISMATCH');
 if(!await validAreas(db,org,[input.area_id]))throw new Error('422:INVALID_AREA');
 for(const user of [sub,manager]){if(user.id===manager.id&&['NSM','MANAGEMENT'].includes(managerRole.role_code))continue;const assigned=await db.prepare('SELECT area_id FROM user_area_scope WHERE organization_id=? AND user_id=? AND area_id=? AND effective_from_date<=? AND (effective_to_date IS NULL OR (? IS NOT NULL AND effective_to_date>=?))').bind(org,user.id,input.area_id,input.effective_from_date,input.effective_to_date,input.effective_to_date).first();if(!assigned)throw new Error('422:AREA_SCOPE_MISMATCH')}
}
function reportingInsert(db:D1Database,org:string,id:string,input:any){return db.prepare('INSERT INTO reporting_assignment(id,organization_id,subordinate_id,manager_id,area_id,channel,effective_from_date,effective_to_date) VALUES(?,?,?,?,?,?,?,?)').bind(id,org,input.subordinate_id,input.manager_id,input.area_id,input.channel,input.effective_from_date,input.effective_to_date)}
people.get('/api/hierarchy-assignments',async c=>{const s=c.get('scope');const users=await visibleUsers(c.env.DB,s);const ids=new Set(users.map((x:any)=>x.id));const rows=await c.env.DB.prepare('SELECT id,subordinate_id,manager_id,area_id,channel,effective_from_date,effective_to_date,version FROM reporting_assignment WHERE organization_id=? ORDER BY effective_from_date DESC').bind(s.identity.organization_id).all<any>();return c.json({data:rows.results.filter(r=>s.orgWide||(ids.has(r.subordinate_id)&&ids.has(r.manager_id)&&s.areaIds.includes(r.area_id)))})});
people.post('/api/hierarchy-assignments',async c=>{let body;try{body=await parsed(c,assignmentInput)}catch(e){return c.json({detail:(e as Error).message},422)}return action(c,body,async db=>{const s=c.get('scope');await checkHierarchy(db,s,body);const id=crypto.randomUUID();return {statements:[reportingInsert(db,s.identity.organization_id,id,body)],data:{...body,id,version:1},status:201}})});
people.post('/api/hierarchy-assignments/:id/end',async c=>{let body;try{body=await parsed(c,endInput)}catch(e){return c.json({detail:(e as Error).message},422)}return action(c,body,async db=>{
 const s=c.get('scope'),org=s.identity.organization_id,before=await db.prepare('SELECT * FROM reporting_assignment WHERE organization_id=? AND id=?').bind(org,c.req.param('id')).first<any>();precondition(c,before);
 if(body.effective_to_date<s.date||body.effective_to_date<=before.effective_from_date||before.effective_to_date&&body.effective_to_date>=before.effective_to_date)throw new Error('422:INVALID_END_DATE');
 const subordinate=await row(db,org,before.subordinate_id);const role=await roleAt(db,org,before.subordinate_id,body.effective_to_date,body.effective_to_date);
 if(!body.replacement_manager_id&&subordinate.status==='active'&&['SALES_REP','TELESALES'].includes(role?.role_code))throw new Error('409:REPLACEMENT_SUPERVISOR_REQUIRED');
 const next={...before,manager_id:body.replacement_manager_id,effective_from_date:body.effective_to_date,effective_to_date:before.effective_to_date};
 if(body.replacement_manager_id)await checkHierarchy(db,s,next);
 const statements=guard(db,db.prepare('UPDATE reporting_assignment SET effective_to_date=?,version=version+1 WHERE organization_id=? AND id=? AND version=?').bind(body.effective_to_date,org,before.id,before.version));
 if(body.replacement_manager_id)statements.push(reportingInsert(db,org,crypto.randomUUID(),next));
 return {before,statements,data:{...before,effective_to_date:body.effective_to_date,version:before.version+1,reason:body.reason}};
})});
people.get('/api/hierarchy-assignments/:id',async c=>{
 const s=c.get('scope');const edge=await c.env.DB.prepare('SELECT * FROM reporting_assignment WHERE organization_id=? AND id=?').bind(s.identity.organization_id,c.req.param('id')).first<any>();
 const visible=new Set((await visibleUsers(c.env.DB,s)).map((u:any)=>u.id));
 if(!edge||!s.orgWide&&!(visible.has(edge.subordinate_id)&&visible.has(edge.manager_id)&&s.areaIds.includes(edge.area_id)))return c.json({code:'NOT_FOUND'},404);
 c.header('ETag',`"${edge.version}"`);return c.json({data:edge});
});
people.post('/api/users/:id/deactivate',async c=>{
 let body;try{body=await parsed(c,deactivateInput)}catch(e){return c.json({detail:(e as Error).message},422)}
 return action(c,body,async db=>{const s=c.get('scope'),org=s.identity.organization_id,id=c.req.param('id'),before=await row(db,org,id);precondition(c,before);
 await requireNoCustomers(db,org,id,s.date);await requireNoOpenPeopleWork(db,org,id,s.date);
 if(id===s.identity.id)throw new Error('409:SELF_ACCESS_CHANGE_FORBIDDEN');
 const dependents=await db.prepare('SELECT id FROM reporting_assignment WHERE organization_id=? AND manager_id=? AND (effective_to_date IS NULL OR effective_to_date>?) LIMIT 1').bind(org,id,s.date).first();if(dependents)throw new Error('409:TRANSFER_TEAM_BEFORE_DEACTIVATION');
 return {before,statements:[...noOpenPeopleWorkGuard(db,org,id,s.date),...guard(db,db.prepare("UPDATE app_user SET status='inactive',version=version+1 WHERE organization_id=? AND id=? AND version=? AND NOT EXISTS(SELECT 1 FROM customer_assignment WHERE organization_id=? AND rep_id=? AND (effective_to_date IS NULL OR effective_to_date>?)) AND NOT EXISTS(SELECT 1 FROM reporting_assignment WHERE organization_id=? AND manager_id=? AND (effective_to_date IS NULL OR effective_to_date>?))").bind(org,id,before.version,org,id,s.date,org,id,s.date)),...peopleDeactivationCleanup(db,org,id,s.date,s.identity.id)],data:{id,status:'inactive',version:before.version+1,reason:body.reason}};
 });
});

const endInput=z.object({effective_to_date:date,replacement_manager_id:id.nullable(),reason:z.string().trim().min(1).max(500)}).strict();
const deactivateInput=z.object({reason:z.string().trim().min(1).max(500)}).strict();
export const peopleRequestSchemas={role:roleInput,user:userInput,profile:profileInput,assignment:assignmentInput,end:endInput,deactivate:deactivateInput};
