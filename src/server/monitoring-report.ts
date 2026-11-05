import {businessUtcBounds} from './calendar';
import {z} from 'zod';
import {customerPredicate,invoicePredicate,type Scope} from './scope';
import {fail,digest} from './operations';
import {achievement} from './targets';
const id=z.string().min(1).max(128);
const org=(c:any)=>c.get('identity').organization_id;
export const reportFilters=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),area_id:id.optional(),rep_id:id.optional(),channel:z.enum(['field','telesales']).optional(),branch_id:id.optional(),team_id:id.optional()}).strict();
const filters=reportFilters;
export const sourceKinds=['customers','invoices','activities','targets','workforce'] as const;
export type SourceKind=typeof sourceKinds[number];
export const PREVIEW_LIMIT=50,EXPORT_LIMIT=10000;
export async function reportContext(c:any,query:any=c.req.query()){const f=filters.safeParse(query);if(!f.success)fail(422,'INVALID_REPORT_FILTERS');const s=c.get('scope') as Scope,db=c.env.DB as D1Database,x=f.data,period=x.period||s.date.slice(0,7),start=period+'-01',end=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10),cutoff=end<s.date?end:s.date;if(start>cutoff)fail(422,'FUTURE_PERIOD');let team:string[]|null=null;if(x.team_id){team=(await db.prepare(`WITH RECURSIVE team(id) AS(SELECT id FROM app_user WHERE organization_id=? AND id=? UNION SELECT r.subordinate_id FROM reporting_assignment r JOIN team t ON t.id=r.manager_id WHERE r.organization_id=? AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?)) SELECT id FROM team`).bind(org(c),x.team_id,org(c),cutoff,cutoff).all<{id:string}>()).results.map(r=>r.id)}const branchAreas=x.branch_id?(await db.prepare('SELECT id FROM area WHERE organization_id=? AND branch_id=?').bind(org(c),x.branch_id).all<{id:string}>()).results.map(r=>r.id):null;const cp=customerPredicate(s),ip=invoicePredicate(s);let cs=cp.sql,ps:any[]=[...cp.params],is=ip.sql,ips:any[]=[...ip.params];if(x.area_id){cs+=' AND co.area_id=?';ps.push(x.area_id);is+=' AND i.area_id=?';ips.push(x.area_id)}if(x.branch_id){cs+=' AND co.area_id IN(SELECT id FROM area WHERE organization_id=co.organization_id AND branch_id=?)';ps.push(x.branch_id);is+=' AND i.area_id IN(SELECT id FROM area WHERE organization_id=i.organization_id AND branch_id=?)';ips.push(x.branch_id)}if(x.rep_id){is+=' AND i.rep_id=?';ips.push(x.rep_id)}if(team){is+=' AND i.rep_id IN(SELECT value FROM json_each(?))';ips.push(JSON.stringify(team));cs+=' AND EXISTS(SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=co.organization_id AND ca.outlet_id=co.id AND ca.rep_id IN(SELECT value FROM json_each(?)) AND ca.effective_from_date<=? AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?))';ps.push(JSON.stringify(team),cutoff,cutoff)}const channel=x.channel||s.channel;if(channel){is+=' AND i.channel=?';ips.push(channel)}if(x.rep_id||channel){cs+=" AND EXISTS(SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=co.organization_id AND ca.outlet_id IN(SELECT co.id UNION ALL SELECT a.id FROM customer_outlet a WHERE a.organization_id=co.organization_id AND a.merged_into_id=co.id) AND ca.effective_from_date<=? AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?)"+(x.rep_id?' AND ca.rep_id=?':'')+(channel?' AND ca.channel=?':'')+')';ps.push(cutoff,cutoff,...(x.rep_id?[x.rep_id]:[]),...(channel?[channel]:[]))}
let owned=s.orgWide?'1=1':s.allRepsInArea?'a.outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=a.organization_id AND area_id IN(SELECT value FROM json_each(?)))':'a.user_id IN(SELECT value FROM json_each(?))';const ap:any[]=s.orgWide?[]:[JSON.stringify(s.allRepsInArea?s.areaIds:s.repIds)];if(channel){owned+=' AND a.channel=?';ap.push(channel)}if(x.rep_id){owned+=' AND a.user_id=?';ap.push(x.rep_id)}if(team){owned+=' AND a.user_id IN(SELECT value FROM json_each(?))';ap.push(JSON.stringify(team))}
return {c,db,s,x,period,start,end,cutoff,team,branchAreas,cs,ps,is,ips,channel,owned,ap};
}

export async function preparedReport(c:any,query:any){
 const ctx=await reportContext(c,query);
 const {cs,is,owned}=ctx;
 const timezone=(await ctx.db.prepare('SELECT timezone FROM organization WHERE id=?').bind(org(c)).first<{timezone:string}>())!.timezone,utc=businessUtcBounds(ctx.start,ctx.cutoff,timezone);
 const metadata="CASE WHEN json_valid(a.metadata_json) THEN a.metadata_json ELSE '{}' END";
 const cte=`WITH cohort AS(SELECT co.id,co.name,co.area_id FROM customer_outlet co WHERE ${cs} AND co.merged_into_id IS NULL AND co.record_status='active'),
 invoices AS(SELECT i.id,i.source_invoice_id,i.source_version,i.outlet_id,i.rep_id,i.area_id,i.channel,i.invoice_date,i.net_minor,COALESCE(co.merged_into_id,co.id) customer_id FROM invoice i JOIN customer_outlet co ON co.organization_id=i.organization_id AND co.id=i.outlet_id WHERE ${is} AND i.status='validated' AND i.validation_state='validated' AND i.currency='IDR' AND i.invoice_date BETWEEN ? AND ?),
 events AS(SELECT a.id,a.user_id,a.channel,a.activity_kind,a.status,a.occurred_at,COALESCE(co.merged_into_id,co.id) customer_id,
 CASE WHEN a.status='done' AND(json_type(${metadata},'$.meaningful')='true' OR json_extract(${metadata},'$.disposition')='connected_pic') THEN 1 ELSE 0 END meaningful,
 CASE WHEN json_extract(${metadata},'$.disposition')='connected_pic' THEN 1 ELSE 0 END connected_pic
 FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id WHERE a.organization_id=? AND ${owned} AND julianday(a.occurred_at)>=julianday(?) AND julianday(a.occurred_at)<julianday(?) AND COALESCE(co.merged_into_id,co.id) IN(SELECT id FROM cohort))`;
 return {...ctx,timezone,utc,cte,params:[...ctx.ps,...ctx.ips,ctx.start,ctx.cutoff,org(c),...ctx.ap,utc.from,utc.until]};
}
type Context=Awaited<ReturnType<typeof preparedReport>>;
async function all(ctx:Context,sql:string,params:any[]=[]):Promise<any[]>{
 try{return(await ctx.db.prepare(ctx.cte+' '+sql).bind(...ctx.params,...params).all<any>()).results}
 catch(e){if(/integer overflow/i.test(String(e)))fail(422,'AMOUNT_OVERFLOW');throw e}
}
function safeMoney(value:string|number|bigint):number{const n=BigInt(value);if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))fail(422,'AMOUNT_OVERFLOW');return Number(n)}
function sumMoney(rows:any[],key:string){return safeMoney(rows.reduce((a,r)=>a+BigInt(r[key]??0),0n))}
async function invoiceGroups(ctx:Context){const rows=await all(ctx,'SELECT rep_id,channel,COUNT(*) record_count,CAST(SUM(net_minor) AS TEXT) amount FROM invoices GROUP BY rep_id,channel');if(rows.length>2000)fail(422,'REPORT_WORKFORCE_LIMIT_NARROW_FILTERS');return rows.map(r=>({...r,amount:safeMoney(r.amount)}))}
async function targetRows(ctx:Context){const {db,s,x,start,cutoff,branchAreas,team}=ctx;const rows=(await achievement(db,s,{channel:x.channel,area_id:x.area_id,rep_id:x.rep_id,period_start:start,cutoff})).filter(r=>(!branchAreas||branchAreas.includes(r.area_id_snapshot))&&(!team||team.includes(r.rep_id_snapshot)));if(rows.length>2000)fail(422,'REPORT_TARGET_LIMIT_NARROW_FILTERS');return rows}
async function workforceRows(ctx:Context,groups?:any[]){const {c,db,s,x,cutoff,channel,team}=ctx;
const workforce=(await db.prepare(`${ctx.cte} SELECT DISTINCT u.id,u.name,ar.role_code,ar.channel,(SELECT COUNT(*) FROM sales_task t WHERE t.organization_id=u.organization_id AND t.user_id=u.id AND t.channel=ar.channel AND t.customer_id IN(SELECT co.id FROM customer_outlet co WHERE ${ctx.cs}) AND t.status IN('open','in_progress')) open_task_count FROM app_user u JOIN auth_role_assignment ar ON ar.organization_id=u.organization_id AND ar.user_id=u.id WHERE u.organization_id=? AND u.status='active' AND ar.role_code IN('SALES_REP','TELESALES') AND ar.effective_from_date<=? AND(ar.effective_to_date IS NULL OR ar.effective_to_date>?) AND(?=1 OR u.id IN(SELECT value FROM json_each(?)) OR(?=1 AND EXISTS(SELECT 1 FROM user_area_scope ua WHERE ua.organization_id=u.organization_id AND ua.user_id=u.id AND ua.area_id IN(SELECT value FROM json_each(?)) AND ua.effective_from_date<=? AND(ua.effective_to_date IS NULL OR ua.effective_to_date>?)))) AND(? IS NULL OR u.id=?) AND(? IS NULL OR ar.channel=?) AND(? IS NULL OR EXISTS(SELECT 1 FROM user_area_scope ua WHERE ua.organization_id=u.organization_id AND ua.user_id=u.id AND ua.area_id=? AND ua.effective_from_date<=? AND(ua.effective_to_date IS NULL OR ua.effective_to_date>?))) AND(? IS NULL OR EXISTS(SELECT 1 FROM user_area_scope ua JOIN area ar2 ON ar2.organization_id=ua.organization_id AND ar2.id=ua.area_id WHERE ua.organization_id=u.organization_id AND ua.user_id=u.id AND ar2.branch_id=? AND ua.effective_from_date<=? AND(ua.effective_to_date IS NULL OR ua.effective_to_date>?))) ORDER BY u.name LIMIT 2001`).bind(...ctx.params,...ctx.ps,org(c),cutoff,cutoff,s.orgWide?1:0,JSON.stringify(s.repIds),s.allRepsInArea?1:0,JSON.stringify(s.areaIds),cutoff,cutoff,x.rep_id||null,x.rep_id||null,channel||null,channel||null,x.area_id||null,x.area_id||null,cutoff,cutoff,x.branch_id||null,x.branch_id||null,cutoff,cutoff).all<any>()).results;
 if(workforce.length>2000)fail(422,'REPORT_WORKFORCE_LIMIT_NARROW_FILTERS');
 const amounts=groups??await invoiceGroups(ctx);
 return workforce.filter(u=>!team||team.includes(u.id)).map(u=>({...u,observed_actual_minor:sumMoney(amounts.filter(i=>i.rep_id===u.id&&i.channel===u.channel),'amount')}));
}
export async function reportFreshness(ctx:Context){const coverage=await ctx.db.prepare('SELECT complete_from,complete_through,updated_at,version FROM customer_source_coverage WHERE organization_id=?').bind(org(ctx.c)).first<any>();const known=Boolean(coverage&&coverage.complete_from<=ctx.start&&coverage.complete_through>=ctx.cutoff);return {source:'manual_invoice_import',source_coverage:coverage,source_complete:known,source_cutoff:coverage?.complete_through||null,ui_read_at:new Date().toISOString(),validation_state:known?'validated':'provisional'}}

type SourceOptions={limit:number;after?:string;covered?:boolean;meaningful?:boolean;source_channel?:string};
const rowKey=(kind:SourceKind,row:any)=>kind==='workforce'?row.id+'~'+row.channel:row.id;
export async function readReportSource(ctx:Context,kind:SourceKind,options:SourceOptions,cache?:{targets:any[];workforce:any[]}){
 const {limit,after,covered,meaningful,source_channel}=options;
 if(kind==='targets'||kind==='workforce'){
  let rows=kind==='targets'?(cache?.targets??await targetRows(ctx)):(cache?.workforce??await workforceRows(ctx));
  rows=rows.filter(r=>(!source_channel||r.channel===source_channel)&&(!after||rowKey(kind,r)>after));
  return rows.sort((a,b)=>rowKey(kind,a)<rowKey(kind,b)?-1:rowKey(kind,a)>rowKey(kind,b)?1:0).slice(0,limit);
 }
 const conditions:string[]=[],params:any[]=[];
 if(after){conditions.push('id>?');params.push(after)}
 if(kind==='customers'&&covered!==undefined){conditions.push('covered=?');params.push(covered?1:0)}
 if(kind==='activities'&&meaningful!==undefined){conditions.push('meaningful=?');params.push(meaningful?1:0)}
 if(kind==='activities'&&source_channel){conditions.push('channel=?');params.push(source_channel)}
 const source=kind==='customers'?'(SELECT c.*,EXISTS(SELECT 1 FROM events e WHERE e.customer_id=c.id AND e.meaningful=1) covered FROM cohort c)':kind==='invoices'?'invoices':'events';
 const rows=await all(ctx,`SELECT * FROM ${source} ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY id LIMIT ?`,[...params,limit]);
 return rows.map(r=>kind==='customers'?{...r,covered:Boolean(r.covered)}:kind==='activities'?(({connected_pic,...a})=>({...a,meaningful:Boolean(a.meaningful)}))(r):r);
}

export async function monitoringSummary(c:any,query:any=c.req.query()){
 const ctx=await preparedReport(c,query),{x,period,start,end,cutoff,channel}=ctx;
 const [stats]=await all(ctx,`SELECT (SELECT COUNT(*) FROM cohort) customer_count,COUNT(*) activity_count,COALESCE(SUM(meaningful),0) meaningful_count,COALESCE(SUM(connected_pic),0) declared_connected_pic,COUNT(DISTINCT CASE WHEN meaningful=1 THEN customer_id END) covered_customer_count,
 SUM(CASE WHEN channel='field' THEN 1 ELSE 0 END) field_count,SUM(CASE WHEN channel='field' THEN meaningful ELSE 0 END) field_meaningful,SUM(CASE WHEN channel='telesales' THEN 1 ELSE 0 END) tele_count,SUM(CASE WHEN channel='telesales' THEN meaningful ELSE 0 END) tele_meaningful FROM events`);
 const groups=await invoiceGroups(ctx),total=sumMoney(groups,'amount'),targets=await targetRows(ctx),workforce=await workforceRows(ctx,groups),freshness=await reportFreshness(ctx);
 const target=targets.length?sumMoney(targets,'target_minor'):null,validTarget=targets.length>0&&targets.every(r=>!r.needs_review)&&target!>0;
 const counts={customers:stats.customer_count,invoices:groups.reduce((n,r)=>n+r.record_count,0),activities:stats.activity_count,targets:targets.length,workforce:workforce.length};
 const sources:Record<string,any[]>={},source_pages:Record<string,any>={};
 for(const kind of sourceKinds){sources[kind]=await readReportSource(ctx,kind,{limit:PREVIEW_LIMIT},{targets,workforce});source_pages[kind]={preview_limit:PREVIEW_LIMIT,total:counts[kind],has_more:counts[kind]>sources[kind].length}}
 return {filters:x,period,start,cutoff,kpi_definition_version:'nyales-kpi-1',workforce,cohort:'current_active_customer_scope',customer_count:stats.customer_count,covered_customer_count:stats.covered_customer_count,coverage_percent:stats.customer_count?stats.covered_customer_count/stats.customer_count*100:null,actual_net_minor:total,observed_actual_net_minor:total,target_minor:target,achievement_percent:validTarget?sumMoney(targets,'actual_minor')/target!*100:null,sales_rep_count:new Set(groups.map(i=>i.rep_id)).size,activity_count:stats.activity_count,meaningful_count:stats.meaningful_count,declared_connected_pic:stats.declared_connected_pic,verified_connections:null,
 channel_achievement:['field','telesales'].filter(k=>!channel||k===channel).map(channel=>{const rows=targets.filter(r=>r.channel===channel),target=sumMoney(rows,'target_minor'),known=rows.length>0&&rows.every(r=>!r.needs_review&&r.actual_minor!==null&&r.period_end===end),actual=known?sumMoney(rows,'actual_minor'):null;const status=!rows.length?'no_target':target===0?'zero_target':!known?'needs_review':'available';return{channel,target_minor:rows.length?target:null,actual_minor:actual,achievement_percent:status==='available'?actual!/target*100:null,status}}),
 activity_channels:['field','telesales'].filter(k=>!channel||k===channel).map(channel=>{const count=(channel==='field'?stats.field_count:stats.tele_count)||0,productive=(channel==='field'?stats.field_meaningful:stats.tele_meaningful)||0;return{channel,activity_count:count,meaningful_count:productive,other_count:count-productive}}),channels:['field','telesales'].map(channel=>({channel,actual_net_minor:sumMoney(groups.filter(r=>r.channel===channel),'amount')})),sources,source_pages,freshness,routing:false,live_background_tracking:false};
}
const sourceQuery=reportFilters.extend({kind:z.enum(sourceKinds),limit:z.coerce.number().int().min(1).max(100).default(50),after:z.string().min(1).max(2048).optional(),covered:z.enum(['true','false']).optional(),meaningful:z.enum(['true','false']).optional(),source_channel:z.enum(['field','telesales']).optional()}).strict();
export async function monitoringSources(c:any){
 const parsed=sourceQuery.safeParse(c.req.query());if(!parsed.success)fail(422,'INVALID_REPORT_SOURCE_QUERY');
 const {kind,limit,after,covered,meaningful,source_channel,...filters}=parsed.data;
 if(covered!==undefined&&kind!=='customers'||meaningful!==undefined&&kind!=='activities'||source_channel&&!['activities','targets'].includes(kind))fail(422,'INVALID_REPORT_SOURCE_QUERY');
 const ctx=await preparedReport(c,filters),fingerprint=await digest(JSON.stringify({kind,filters:ctx.x,cutoff:ctx.cutoff,covered,meaningful,source_channel,identity:ctx.s.identity.id,org:org(c),role:ctx.s.identity.role,area:ctx.s.areaIds,rep:ctx.s.repIds,channel:ctx.s.channel}));
 let last:string|undefined;
 if(after){try{const cursor=JSON.parse(decodeURIComponent(atob(after)));if(cursor.v!==1||cursor.fingerprint!==fingerprint||typeof cursor.last!=='string'||cursor.last.length>260)throw Error();last=cursor.last}catch{fail(422,'INVALID_REPORT_CURSOR')}}
 const rows=await readReportSource(ctx,kind,{limit:limit+1,after:last,covered:covered===undefined?undefined:covered==='true',meaningful:meaningful===undefined?undefined:meaningful==='true',source_channel}),has_more=rows.length>limit,data=rows.slice(0,limit);
 const next_cursor=has_more?btoa(encodeURIComponent(JSON.stringify({v:1,fingerprint,last:rowKey(kind,data.at(-1))}))):null;
 return {rows:data,kind,cutoff:ctx.cutoff,pagination:{limit,has_more,next_cursor,consistency:'live_keyset'}};
}
