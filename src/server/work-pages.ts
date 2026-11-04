import {z} from 'zod';
import {customerPredicate,type Scope} from './scope';

export const workPageQuery=z.object({
 limit:z.coerce.number().int().min(1).max(100),
 offset:z.coerce.number().int().min(0).max(1000000).default(0),
 status:z.string().trim().min(1).max(40).optional(),
 channel:z.enum(['field','telesales']).optional(),
 activity_kind:z.enum(['visit','call']).optional(),
}).strict();

export type WorkPageKind='work-plans'|'work-sessions'|'activities'|'tasks'|'handoffs'|'exceptions';
const definitions={
 'work-plans':{table:'work_plan',alias:'w',customer:'customer_id',order:'w.scheduled_at,w.id',statuses:['proposed','planned','done','cancelled']},
 activities:{table:'activity',alias:'a',customer:'outlet_id',order:'a.occurred_at DESC,a.id DESC',statuses:['draft','pending_checkin','in_progress','done','needs_review']},
 tasks:{table:'sales_task',alias:'t',customer:'customer_id',order:'t.due_at,t.id',statuses:['open','in_progress','done','cancelled']},
 handoffs:{table:'sales_handoff',alias:'h',customer:'customer_id',order:'h.due_at,h.id',statuses:['pending','accepted','declined','completed','cancelled']},
 exceptions:{table:'sales_exception',alias:'e',customer:'customer_id',order:'e.created_at DESC,e.id DESC',statuses:['open','reviewed','resolved']},
} as const;

/** Opt-in SQL pagination: bounded rows plus one sentinel, no whole-directory
 * fetch/count. Legacy routes keep their response until callers migrate. */
export async function readWorkPage(db:D1Database,s:Scope,kind:WorkPageKind,input:unknown){
 const parsed=workPageQuery.safeParse(input);
 if(!parsed.success)return {error:'INVALID_WORK_PAGE'} as const;
 const q=parsed.data,where:string[]=[],params:any[]=[];
 let select:string,from:string,order:string;
 if(kind==='work-sessions'){
  if(q.channel||q.activity_kind||q.status&&!['active','ended'].includes(q.status))return {error:'INVALID_WORK_PAGE_FILTER'} as const;
  select='w.*';from='work_session w';order='w.started_at DESC,w.id DESC';
  where.push('w.organization_id=?','w.user_id=?');params.push(s.identity.organization_id,s.identity.id);
  if(q.status)where.push(q.status==='active'?'w.ended_at IS NULL':'w.ended_at IS NOT NULL');
 }else{
  const d=definitions[kind],alias=d.alias,f=customerPredicate(s);
  if(q.status&&!(d.statuses as readonly string[]).includes(q.status)||q.activity_kind&&kind!=='activities'||q.channel&&kind==='exceptions')return {error:'INVALID_WORK_PAGE_FILTER'} as const;
  select=alias+'.*,co.name customer_name';from=`${d.table} ${alias} JOIN customer_outlet co ON co.organization_id=${alias}.organization_id AND co.id=${alias}.${d.customer}`;order=d.order;
  where.push(f.sql);params.push(...f.params);
  if(!s.orgWide&&!s.allRepsInArea){
   const reps=JSON.stringify(s.repIds);
   if(kind==='handoffs'){where.push(`(${alias}.sender_id IN(SELECT value FROM json_each(?)) OR ${alias}.receiver_id IN(SELECT value FROM json_each(?)))`);params.push(reps,reps)}
   else{where.push(`${alias}.user_id IN(SELECT value FROM json_each(?))`);params.push(reps)}
  }
  if(kind==='activities'&&s.channel){where.push(`${alias}.channel=?`);params.push(s.channel)}
  if(q.status){where.push(`${alias}.status=?`);params.push(q.status)}
  if(q.activity_kind){where.push(`${alias}.activity_kind=?`);params.push(q.activity_kind)}
  if(q.channel){where.push(kind==='work-plans'?`${alias}.kind=?`:`${alias}.channel=?`);params.push(kind==='work-plans'?(q.channel==='field'?'visit':'call'):q.channel)}
 }
 const rows=(await db.prepare(`SELECT ${select} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...params,q.limit+1,q.offset).all<any>()).results;
 return {data:rows.slice(0,q.limit),meta:{pagination:{limit:q.limit,offset:q.offset,has_more:rows.length>q.limit,consistency:'live_offset'}}};
}
