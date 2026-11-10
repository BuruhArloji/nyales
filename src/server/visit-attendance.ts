import {Hono} from 'hono';
import {z} from 'zod';
import {fail,guard,operation,type OperationEnv} from './operations';
import {businessUtcBounds} from './calendar';
import {reportContext,reportFilters} from './monitoring-report';
import {offVisitReasons,summarizeVisitDays} from '../shared/visit-attendance';
import {customerPredicate,type Scope} from './scope';

export const visitAttendance=new Hono<OperationEnv>();
const id=z.string().min(1).max(128),reason=z.string().trim().min(1).max(1000),date=z.iso.date();
const manager=(s:Scope)=>['MANAGEMENT','NSM','REGIONAL_MANAGER','AREA_MANAGER','SUPERVISOR'].includes(s.identity.role);
const organization=(c:any)=>c.get('scope').identity.organization_id;
function repPredicate(s:Scope,channel:'field'|'telesales'='field'){
 let sql=`u.organization_id=? AND u.status='active' AND EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=u.organization_id AND r.user_id=u.id AND r.role_code='${channel==='field'?'SALES_REP':'TELESALES'}' AND r.channel='${channel}' AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?))`;
 const params:any[]=[s.identity.organization_id,s.date,s.date];
 if(!s.orgWide){if(!s.allRepsInArea){sql+=' AND u.id IN(SELECT value FROM json_each(?))';params.push(JSON.stringify(s.repIds))}if(s.allRepsInArea||s.identity.role==='SUPERVISOR'){sql+=' AND EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=u.organization_id AND a.user_id=u.id AND a.area_id IN(SELECT value FROM json_each(?)) AND a.effective_from_date<=? AND(a.effective_to_date IS NULL OR a.effective_to_date>?))';params.push(JSON.stringify(s.areaIds),s.date,s.date)}}
 if(s.channel&&s.channel!==channel)sql+=' AND 0=1';return{sql,params};
}
async function readableRep(c:any,user:string){const p=repPredicate(c.get('scope'));if(!await c.env.DB.prepare('SELECT u.id FROM app_user u WHERE u.id=? AND '+p.sql).bind(user,...p.params).first())fail(404,'FIELD_REP_NOT_FOUND')}
export function repVisitAvailableGuard(db:D1Database,org:string,user:string,date:string){return [db.prepare("INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT id FROM visit_off_day WHERE organization_id=? AND user_id=? AND service_date=? AND status='approved') THEN 1 ELSE 0 END").bind(org,user,date),db.prepare('DELETE FROM master_mutation_guard')]}
export async function assertRepVisitAvailable(db:D1Database,org:string,user:string,date:string){if(await db.prepare("SELECT id FROM visit_off_day WHERE organization_id=? AND user_id=? AND service_date=? AND status='approved'").bind(org,user,date).first())fail(409,'REP_OFF_VISIT')}
const range=z.object({start_date:date,end_date:date,limit:z.coerce.number().int().refine(n=>n===50||n===100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().refine(q=>q.end_date>=q.start_date&&Date.parse(q.end_date)-Date.parse(q.start_date)<=92*86400000);
async function telesalesRecap(c:any,filters:any,range:{start_date:string;end_date:string},reps:any[],hasMore:boolean){
 const db=c.env.DB as D1Database,s=c.get('scope')as Scope,org=organization(c);
 const timezone=(await db.prepare('SELECT timezone FROM organization WHERE id=?').bind(org).first<any>())!.timezone;
 const bounds=businessUtcBounds(range.start_date,range.end_date,timezone),ids=JSON.stringify(reps.map(r=>r.id)),cp=customerPredicate(s);
 if(filters.area_id){cp.sql+=' AND co.area_id=?';cp.params.push(filters.area_id)}
 if(filters.branch_id){cp.sql+=' AND co.area_id IN(SELECT id FROM area WHERE organization_id=co.organization_id AND branch_id=?)';cp.params.push(filters.branch_id)}
 const results=(await db.prepare("SELECT a.user_id,COUNT(*) call_count,SUM(CASE WHEN json_extract(CASE WHEN json_valid(a.metadata_json) THEN a.metadata_json ELSE '{}' END,'$.disposition')='connected_pic' THEN 1 ELSE 0 END) success_count FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id WHERE a.organization_id=? AND a.user_id IN(SELECT value FROM json_each(?)) AND a.channel='telesales' AND a.activity_kind='call' AND a.status='done' AND a.occurred_at>=? AND a.occurred_at<? AND "+cp.sql+' GROUP BY a.user_id').bind(org,ids,bounds.from,bounds.until,...cp.params).all<any>()).results;
 const plans=(await db.prepare("SELECT p.user_id,COUNT(*) call_target FROM work_plan p JOIN customer_outlet co ON co.organization_id=p.organization_id AND co.id=p.customer_id WHERE p.organization_id=? AND p.user_id IN(SELECT value FROM json_each(?)) AND p.kind='call' AND p.status IN('planned','proposed','done') AND p.scheduled_at>=? AND p.scheduled_at<? AND "+cp.sql+' GROUP BY p.user_id').bind(org,ids,bounds.from,bounds.until,...cp.params).all<any>()).results;
 const calls=new Map(results.map(r=>[r.user_id,r])),targets=new Map(plans.map(r=>[r.user_id,r.call_target]));
 return c.json({data:reps.map(r=>{const a=calls.get(r.id),count=a?.call_count||0,success=a?.success_count||0;return{...r,call_target:targets.get(r.id)??null,call_count:count,success_count:success,success_rate_percent:count?success/count*100:null}}),meta:{channel:'telesales',has_more:hasMore,timezone,start_date:range.start_date,end_date:range.end_date,target_basis:'scheduled_calls',success_basis:'manual_connected_pic'}});
}
visitAttendance.get('/api/visit-attendance',async c=>{
 const raw=c.req.query(),extra={start_date:raw.start_date,end_date:raw.end_date,limit:raw.limit,offset:raw.offset},r=range.safeParse(extra);if(!r.success)fail(422,'VISIT_DATE_RANGE_MAX_93_DAYS');
 const q=reportFilters.safeParse(Object.fromEntries(Object.entries(raw).filter(([k])=>!Object.keys(extra).includes(k))));if(!q.success)fail(422,'INVALID_REPORT_FILTERS');
 const ctx=await reportContext(c,q.data),s=c.get('scope'),db=c.env.DB,p=repPredicate(s,q.data.channel==='telesales'?'telesales':'field'),x=q.data;
 if(r.data.end_date>s.date)fail(422,'VISIT_FUTURE_RECAP');

 let sql=p.sql;const params=[...p.params];if(x.rep_id){sql+=' AND u.id=?';params.push(x.rep_id)}if(ctx.team){sql+=' AND u.id IN(SELECT value FROM json_each(?))';params.push(JSON.stringify(ctx.team))}
 if(x.area_id||x.branch_id){sql+=' AND EXISTS(SELECT 1 FROM user_area_scope a JOIN area ar ON ar.organization_id=a.organization_id AND ar.id=a.area_id WHERE a.organization_id=u.organization_id AND a.user_id=u.id AND a.effective_from_date<=? AND(a.effective_to_date IS NULL OR a.effective_to_date>?)'+(x.area_id?' AND a.area_id=?':'')+(x.branch_id?' AND ar.branch_id=?':'')+')';params.push(s.date,s.date,...(x.area_id?[x.area_id]:[]),...(x.branch_id?[x.branch_id]:[]))}
 const reps=(await db.prepare('SELECT u.id,u.name FROM app_user u WHERE '+sql+' ORDER BY u.name,u.id LIMIT ? OFFSET ?').bind(...params,r.data.limit+1,r.data.offset).all<any>()).results,visible=reps.slice(0,r.data.limit),ids=JSON.stringify(visible.map(u=>u.id));
 if(x.channel==='telesales')return telesalesRecap(c,x,r.data,visible,reps.length>r.data.limit);
 const policy=await db.prepare("SELECT p.config_json,w.weekdays_json,w.holidays_json,b.timezone FROM daily_visit_policy p JOIN work_calendar w ON w.organization_id=p.organization_id AND w.id=json_extract(p.config_json,'$.calendar_id') JOIN branch b ON b.organization_id=w.organization_id AND b.id=w.branch_id WHERE p.organization_id=? AND w.status='active' AND b.status='active'").bind(organization(c)).first<any>();
 const timezone=policy?.timezone||(await db.prepare('SELECT timezone FROM organization WHERE id=?').bind(organization(c)).first<any>())!.timezone;
 const dates:string[]=[];for(let d=Date.parse(r.data.start_date);d<=Date.parse(r.data.end_date);d+=86400000)dates.push(new Date(d).toISOString().slice(0,10));
 const days=dates.map(d=>({date:d,...businessUtcBounds(d,d,timezone)})),bounds=businessUtcBounds(r.data.start_date,r.data.end_date,timezone);
 const off=(await db.prepare("SELECT id,user_id,service_date,reason_code,status FROM visit_off_day WHERE organization_id=? AND user_id IN(SELECT value FROM json_each(?)) AND service_date BETWEEN ? AND ? AND status IN('pending','approved')").bind(organization(c),ids,r.data.start_date,r.data.end_date).all<any>()).results;
 const cp=customerPredicate(s);if(x.area_id){cp.sql+=' AND co.area_id=?';cp.params.push(x.area_id)}if(x.branch_id){cp.sql+=' AND co.area_id IN(SELECT id FROM area WHERE organization_id=co.organization_id AND branch_id=?)';cp.params.push(x.branch_id)}
 const visits=(await db.prepare("WITH days AS(SELECT json_extract(value,'$.date') date,json_extract(value,'$.from') start,json_extract(value,'$.until') finish FROM json_each(?)) SELECT a.user_id,d.date,COUNT(DISTINCT COALESCE(co.merged_into_id,co.id)) visits FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id JOIN days d ON a.occurred_at>=d.start AND a.occurred_at<d.finish WHERE a.organization_id=? AND a.user_id IN(SELECT value FROM json_each(?)) AND a.channel='field' AND a.activity_kind='visit' AND a.status='done' AND a.occurred_at>=? AND a.occurred_at<? AND "+cp.sql+" GROUP BY a.user_id,d.date").bind(JSON.stringify(days),organization(c),ids,bounds.from,bounds.until,...cp.params).all<any>()).results;
 const roles=(await db.prepare("SELECT user_id,effective_from_date,effective_to_date FROM auth_role_assignment WHERE organization_id=? AND user_id IN(SELECT value FROM json_each(?)) AND role_code='SALES_REP' AND channel='field' AND effective_from_date<=? AND(effective_to_date IS NULL OR effective_to_date>?)").bind(organization(c),ids,r.data.end_date,r.data.start_date).all<any>()).results;
 const visitByDay=new Map(visits.map(v=>[v.user_id+':'+v.date,v.visits])),offByDay=new Map(off.map(o=>[o.user_id+':'+o.service_date,o]));
 const weekdays:number[]=policy?JSON.parse(policy.weekdays_json):[],holidays:string[]=policy?JSON.parse(policy.holidays_json):[],target=policy?JSON.parse(policy.config_json).target_visits:null;
 return c.json({data:visible.map(u=>({...u,...summarizeVisitDays(dates.map(date=>({date,working:weekdays.includes(new Date(date).getUTCDay()||7)&&!holidays.includes(date)&&roles.some(role=>role.user_id===u.id&&role.effective_from_date<=date&&(!role.effective_to_date||role.effective_to_date>date)),visits:visitByDay.get(u.id+':'+date)??0,off:offByDay.get(u.id+':'+date)})),target)})),meta:{has_more:reps.length>r.data.limit,daily_target:target,timezone,target_basis:'current_generator_policy',start_date:r.data.start_date,end_date:r.data.end_date}});
});
visitAttendance.get('/api/visit-off-days',async c=>{
 const query=z.object({limit:z.coerce.number().int().refine(n=>n===50||n===100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().safeParse(c.req.query());if(!query.success)fail(422,'INVALID_OFF_FILTER');
 const p=repPredicate(c.get('scope'));const rows=(await c.env.DB.prepare('SELECT o.*,u.name user_name FROM visit_off_day o JOIN app_user u ON u.organization_id=o.organization_id AND u.id=o.user_id WHERE '+p.sql+' ORDER BY o.service_date DESC,o.id LIMIT ? OFFSET ?').bind(...p.params,query.data.limit+1,query.data.offset).all<any>()).results;
 return c.json({data:rows.slice(0,query.data.limit),meta:{has_more:rows.length>query.data.limit}});
});
const create=z.object({user_id:id,service_date:date,reason_code:z.enum(Object.keys(offVisitReasons) as [keyof typeof offVisitReasons,...(keyof typeof offVisitReasons)[]]),reason}).strict();
async function noVisitConflict(c:any,user:string,date:string){
 const org=organization(c),timezone=(await (c.env.DB as D1Database).prepare('SELECT timezone FROM organization WHERE id=?').bind(org).first<any>())!.timezone,b=businessUtcBounds(date,date,timezone);
 const conflict=c.env.DB.prepare("SELECT id FROM activity WHERE organization_id=? AND user_id=? AND channel='field' AND activity_kind='visit' AND status IN('in_progress','checked_in','open','done','needs_review') AND occurred_at>=? AND occurred_at<? LIMIT 1").bind(org,user,b.from,b.until);if(await conflict.first())fail(409,'OFF_CONFLICTS_WITH_VISIT');
 return[c.env.DB.prepare("INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN NOT EXISTS(SELECT id FROM activity WHERE organization_id=? AND user_id=? AND channel='field' AND activity_kind='visit' AND status IN('in_progress','checked_in','open','done','needs_review') AND occurred_at>=? AND occurred_at<?) THEN 1 ELSE 0 END").bind(org,user,b.from,b.until),c.env.DB.prepare('DELETE FROM master_mutation_guard')];
}
visitAttendance.post('/api/visit-off-days',async c=>{
 const b=create.safeParse(await c.req.json().catch(()=>null));if(!b.success)fail(422,'INVALID_OFF_VISIT');await readableRep(c,b.data.user_id);const s=c.get('scope'),x=b.data;
 if(Date.parse(x.service_date)-Date.parse(s.date)>366*86400000)fail(422,'OFF_DATE_TOO_FAR');
 if(!await c.env.DB.prepare("SELECT user_id FROM auth_role_assignment WHERE organization_id=? AND user_id=? AND role_code='SALES_REP' AND channel='field' AND effective_from_date<=? AND(effective_to_date IS NULL OR effective_to_date>?)").bind(organization(c),x.user_id,x.service_date,x.service_date).first())fail(422,'OFF_DATE_OUTSIDE_FIELD_ROLE');
 if(!manager(s)&&(x.user_id!==s.identity.id||x.reason_code==='alpha'))fail(403,'OFF_MANAGER_REQUIRED');if(x.reason_code==='alpha'&&x.service_date>s.date)fail(422,'ALPHA_FUTURE_DENIED');
 return operation(c,x,async()=>{const approved=manager(s)&&x.user_id!==s.identity.id,stamp=new Date().toISOString();const conflicts=approved?await noVisitConflict(c,x.user_id,x.service_date):[];
  const data={id:crypto.randomUUID(),...x,status:approved?'approved':'pending',version:1};return{resource:'visit-off-day',status:201,data,statements:[...conflicts,c.env.DB.prepare('INSERT INTO visit_off_day(id,organization_id,user_id,service_date,reason_code,reason,status,created_by,created_at,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(data.id,organization(c),x.user_id,x.service_date,x.reason_code,x.reason,data.status,s.identity.id,stamp,approved?s.identity.id:null,approved?stamp:null)]};
 },false);
});
visitAttendance.post('/api/visit-off-days/:id/review',async c=>{
 const b=z.object({status:z.enum(['approved','rejected','cancelled']),reason}).strict().safeParse(await c.req.json().catch(()=>null));if(!b.success)fail(422,'INVALID_OFF_REVIEW');
 const row=await c.env.DB.prepare('SELECT * FROM visit_off_day WHERE organization_id=? AND id=?').bind(organization(c),c.req.param('id')).first<any>();if(!row)fail(404,'NOT_FOUND');await readableRep(c,row.user_id);
 if(!manager(c.get('scope'))||row.user_id===c.get('scope').identity.id)fail(403,'OFF_MANAGER_REQUIRED');
 return operation(c,b.data,async()=>{if(c.req.header('If-Match')!==`"${row.version}"`)fail(412,'VERSION_CONFLICT');if(b.data.status==='cancelled'?!['pending','approved'].includes(row.status):row.status!=='pending')fail(409,'OFF_ALREADY_REVIEWED');const conflicts=b.data.status==='approved'?await noVisitConflict(c,row.user_id,row.service_date):[];
 const data={id:row.id,status:b.data.status,version:row.version+1};return{resource:'visit-off-review',before:row,data,statements:[...conflicts,...guard(c.env.DB,c.env.DB.prepare('UPDATE visit_off_day SET status=?,reviewed_by=?,reviewed_at=?,review_reason=?,version=version+1 WHERE organization_id=? AND id=? AND version=?').bind(data.status,c.get('scope').identity.id,new Date().toISOString(),b.data.reason,organization(c),row.id,row.version))]};},false);
});
visitAttendance.onError((e,c)=>{const m=/^(403|404|409|412|422):(.+)$/.exec(e.message);return c.json({code:m?.[2]||'VISIT_ATTENDANCE_UNAVAILABLE'},(m?Number(m[1]):503)as any)});
