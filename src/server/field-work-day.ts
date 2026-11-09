import {businessUtcBounds} from './calendar';
import {customerPredicate,type Scope} from './scope';

const metadata=(alias:string)=>`CASE WHEN json_valid(${alias}.metadata_json) THEN ${alias}.metadata_json ELSE '{}' END`;
const planId=(alias:string)=>`json_extract(${metadata(alias)},'$.plan_id')`;
const eventTime=(alias:string,kind:string)=>`(SELECT ${kind==='check-in'?'MIN':'MAX'}(v.occurred_at) FROM visit_event v WHERE v.organization_id=${alias}.organization_id AND v.activity_id=${alias}.id AND v.event_kind='${kind}')`;
const location=(kind:string)=>`(SELECT json_object('lat',v.latitude_e7,'lng',v.longitude_e7,'accuracy_cm',v.accuracy_cm,'source',v.source,'quality',v.quality) FROM visit_event v WHERE v.organization_id=a.organization_id AND v.activity_id=a.id AND v.event_kind='${kind}' ORDER BY v.occurred_at ${kind==='check-in'?'ASC':'DESC'} LIMIT 1)`;
type Query={date:string;limit:number;offset:number;user_id?:string;id?:string};

/** Date-bounded, scoped views over the same plan/activity facts. No visit is
 * inferred from a plan and no fact is changed by opening either view. */
export async function readFieldWorkDay(db:D1Database,s:Scope,kind:'work-plans'|'activities',q:Query){
 const timezone=(await db.prepare('SELECT timezone FROM organization WHERE id=?').bind(s.identity.organization_id).first<{timezone:string}>())?.timezone||'Asia/Jakarta';
 const bounds=businessUtcBounds(q.date,q.date,timezone),f=customerPredicate(s),params:any[]=[...f.params];
 const alias=kind==='work-plans'?'w':'a',customer=kind==='work-plans'?'customer_id':'outlet_id';
 const timeColumn=kind==='work-plans'?'w.scheduled_at':'a.occurred_at',carryRunning=kind==='activities'&&q.date===s.date;
 const where=[f.sql,kind==='work-plans'?"w.kind='visit'":"a.channel='field' AND a.activity_kind='visit'",carryRunning?`((${timeColumn}>=? AND ${timeColumn}<?) OR(a.status='in_progress' AND ${timeColumn}<?))`:`${timeColumn}>=? AND ${timeColumn}<?`];
 params.push(bounds.from,bounds.until,...(carryRunning?[bounds.until]:[]));
 if(s.channel&&s.channel!=='field')where.push('0=1');
 if(!s.orgWide&&!s.allRepsInArea){where.push(`${alias}.user_id IN(SELECT value FROM json_each(?))`);params.push(JSON.stringify(s.repIds))}
 if(q.user_id){where.push(`${alias}.user_id=?`);params.push(q.user_id)}
 const join=`JOIN customer_outlet co ON co.organization_id=${alias}.organization_id AND co.id=${alias}.${customer} LEFT JOIN app_user u ON u.organization_id=${alias}.organization_id AND u.id=${alias}.user_id`;
 let select:string,from:string,order:string;
 if(kind==='work-plans'){
  select=`w.*,co.name customer_name,u.name user_name,a.id activity_id,a.version activity_version,a.status activity_status,a.occurred_at activity_occurred_at,a.notes activity_notes,${metadata('a')} activity_metadata_json,${eventTime('a','check-in')} check_in_at,${eventTime('a','check-out')} check_out_at`;
  from=`work_plan w ${join} LEFT JOIN activity a ON a.organization_id=w.organization_id AND a.id=(SELECT linked.id FROM activity linked WHERE linked.organization_id=w.organization_id AND ${planId('linked')}=w.id AND linked.user_id=w.user_id AND linked.outlet_id=w.customer_id AND linked.channel='field' AND linked.activity_kind='visit' ORDER BY CASE linked.status WHEN 'in_progress' THEN 0 WHEN 'done' THEN 1 WHEN 'needs_review' THEN 2 ELSE 3 END,linked.occurred_at DESC,linked.id DESC LIMIT 1)`;
  order='w.scheduled_at,w.id';
 }else{
  select=`a.*,co.name customer_name,u.name user_name,p.id linked_plan_id,p.scheduled_at,p.reason plan_reason,p.status plan_status,${eventTime('a','check-in')} check_in_at,${eventTime('a','check-out')} check_out_at,${location('check-in')} check_in_location_json,${location('check-out')} check_out_location_json,(SELECT json_group_array(json_object('id',id,'mime',mime,'size',size,'created_at',created_at)) FROM(SELECT e.id,e.mime,e.size,e.created_at FROM evidence_attachment e WHERE e.organization_id=a.organization_id AND e.activity_id=a.id AND e.status='ready' ORDER BY e.created_at DESC,e.id LIMIT 20)) evidence_json`;
  from=`activity a ${join} LEFT JOIN work_plan p ON p.organization_id=a.organization_id AND p.id=${planId('a')} AND p.customer_id=a.outlet_id AND p.user_id=a.user_id AND p.kind='visit'`;
  order="CASE a.status WHEN 'in_progress' THEN 0 ELSE 1 END,a.occurred_at DESC,a.id DESC";
 }
 const base=`FROM ${from} WHERE ${where.join(' AND ')}`;
 const summarySql=kind==='work-plans'?`SELECT COUNT(*) total,
 SUM(CASE WHEN status='proposed' THEN 1 ELSE 0 END) proposed,
 SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) cancelled,
 SUM(CASE WHEN status='done' AND activity_id IS NULL THEN 1 ELSE 0 END) unlinked_results,
 SUM(CASE WHEN status!='cancelled' AND activity_status='done' THEN 1 ELSE 0 END) completed,
 SUM(CASE WHEN status!='cancelled' AND activity_status='in_progress' THEN 1 ELSE 0 END) running,
 SUM(CASE WHEN status!='cancelled' AND activity_status IN('pending_checkin','needs_review') THEN 1 ELSE 0 END) needs_review,
 SUM(CASE WHEN status='planned' AND (activity_id IS NULL OR activity_status='draft') THEN 1 ELSE 0 END) remaining,
 SUM(CASE WHEN status='planned' AND (activity_id IS NULL OR activity_status='draft') AND julianday(scheduled_at)+30.0/1440<julianday(?) THEN 1 ELSE 0 END) overdue FROM facts`:
 `SELECT COUNT(*) total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) completed,
 SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) running,
 SUM(CASE WHEN status IN('needs_review','pending_checkin') THEN 1 ELSE 0 END) needs_review,
 SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) drafts,
 SUM(CASE WHEN status='done' AND json_extract(${metadata('facts')},'$.outcome')='productive' THEN 1 ELSE 0 END) productive,
 SUM(CASE WHEN status='done' AND json_type(${metadata('facts')},'$.location_validated')='true' THEN 1 ELSE 0 END) location_validated_count,
 SUM(CASE WHEN status='done' AND json_type(${metadata('facts')},'$.location_verification_pending')='true' THEN 1 ELSE 0 END) location_pending_count,
 SUM(CASE WHEN status='done' AND json_type(${metadata('facts')},'$.location_validation') IS NULL THEN 1 ELSE 0 END) location_unassessed_count,
 AVG(CASE WHEN status='done' AND check_in_at IS NOT NULL AND check_out_at>=check_in_at THEN (unixepoch(check_out_at)-unixepoch(check_in_at))/60.0 END) average_minutes FROM facts`;
 const summary=await db.prepare(`WITH facts AS (SELECT ${select} ${base}) ${summarySql}`).bind(...params,...(kind==='work-plans'?[new Date().toISOString()]:[])).first<any>();
 const rows=(await db.prepare(`SELECT ${select} ${base}${q.id?` AND ${alias}.id=?`:''} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...params,...(q.id?[q.id]:[]),q.limit+1,q.offset).all<any>()).results;
 return {data:rows.slice(0,q.limit),meta:{date:q.date,timezone,summary,overdue_tolerance_minutes:30,pagination:{limit:q.limit,offset:q.offset,has_more:rows.length>q.limit,consistency:'live_offset'}}};
}
