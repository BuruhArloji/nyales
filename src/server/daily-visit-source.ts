import {businessClock,businessUtcBounds,isWorkingInstant,type WorkCalendar} from './calendar';
import {planningInstant} from './planning-time';
import {planningRevision} from './visit-planning-source';
import {customerPredicate,type Scope} from './scope';
import {fail} from './operations';
import {rankDailyCustomers,type DailyPolicy} from '../shared/daily-visit';

export async function dailyRep(db:D1Database,scope:Scope,id:string){
 if(!scope.orgWide&&!scope.repIds.includes(id)&&!scope.allRepsInArea)fail(403,'DAILY_OR_FIELD_SCOPE');
 const row=await db.prepare("SELECT u.id,u.name FROM app_user u WHERE u.organization_id=? AND u.id=? AND u.status='active' AND EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=u.organization_id AND r.user_id=u.id AND r.role_code='SALES_REP' AND r.channel='field' AND r.effective_from_date<=? AND(r.effective_to_date IS NULL OR r.effective_to_date>?))"+(scope.orgWide||!scope.allRepsInArea?'':" AND EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=u.organization_id AND a.user_id=u.id AND a.area_id IN(SELECT value FROM json_each(?)) AND a.effective_from_date<=? AND(a.effective_to_date IS NULL OR a.effective_to_date>?))")).bind(scope.identity.organization_id,id,scope.date,scope.date,...(!scope.orgWide&&scope.allRepsInArea?[JSON.stringify(scope.areaIds),scope.date,scope.date]:[])).first<any>();
 if(!row)fail(403,'DAILY_OR_FIELD_SCOPE');return row;
}
export async function dailySnapshot(db:D1Database,scope:Scope,input:any,policy:DailyPolicy,allowCustomHours=false){
 if(input.custom_work_hours&&!allowCustomHours)fail(403,'DAILY_CUSTOM_HOURS_OWNER_ONLY');
 const org=scope.identity.organization_id,initialRevision=await planningRevision(db,org),rep=await dailyRep(db,scope,input.rep_id);
 const geoEpoch=await db.prepare('SELECT epoch FROM geo_distribution_epoch WHERE organization_id=?').bind(org).first<any>();
 const cal=await db.prepare("SELECT w.id,w.name,w.branch_id,b.timezone,w.weekdays_json,w.holidays_json,w.start_time,w.end_time FROM work_calendar w JOIN branch b ON b.organization_id=w.organization_id AND b.id=w.branch_id WHERE w.organization_id=? AND w.id=? AND w.status='active' AND b.status='active'").bind(org,policy.calendar_id).first<any>();if(!cal)fail(422,'DAILY_CALENDAR_REQUIRED');
 const calendar:WorkCalendar={weekdays:JSON.parse(cal.weekdays_json),holidays:JSON.parse(cal.holidays_json),start_time:cal.start_time,end_time:cal.end_time},timezone=cal.timezone;
 const date=businessClock(new Date(input.start_at),timezone).date,today=businessClock(new Date(),timezone).date;
 if(date!==today||businessClock(new Date(Date.parse(input.end_at)-1000),timezone).date!==date)fail(422,'DAILY_TODAY_ONLY');
 if(Date.parse(input.start_at)<Date.now()+15000)fail(422,'DAILY_START_PAST');
 if(!input.custom_work_hours&&(!isWorkingInstant(new Date(input.start_at),timezone,calendar)||!isWorkingInstant(new Date(Date.parse(input.end_at)-1000),timezone,calendar)))fail(422,'DAILY_OUTSIDE_WORKING_HOURS');
 const profile=await db.prepare("SELECT config_json FROM visit_rep_planning_profile WHERE organization_id=? AND rep_id=? AND status='current' AND valid_from<=? AND valid_until>=?").bind(org,rep.id,date,date).first<any>();
 const repConfig=profile?JSON.parse(profile.config_json):null;if(repConfig&&repConfig.branch_id!==cal.branch_id)fail(422,'DAILY_PROFILE_CALENDAR_MISMATCH');if(repConfig?.absent_dates?.includes(date))fail(422,'DAILY_REP_ABSENT');
 const bounds=businessUtcBounds(date,date,timezone),from=bounds.from,until=bounds.until;
 const observedUntil=new Date().toISOString();
 const allActivities=(await db.prepare("SELECT id,outlet_id,status,occurred_at FROM activity WHERE organization_id=? AND user_id=? AND channel='field' AND activity_kind='visit' AND occurred_at>=? AND occurred_at<? ORDER BY occurred_at").bind(org,rep.id,from,observedUntil).all<any>()).results;
 if(allActivities.some(a=>['open','checked_in','in_progress'].includes(a.status)))fail(409,'DAILY_ACTIVE_VISIT');
 const completedToday=new Set(allActivities.filter(a=>a.status==='done').map(a=>a.outlet_id)).size,remainingTarget=Math.max(0,policy.target_visits-completedToday);if(!remainingTarget)fail(422,'DAILY_TARGET_COMPLETE');
 const agenda=(await db.prepare("SELECT id,customer_id,user_id,scheduled_at,status,version,calendar_snapshot_json FROM work_plan WHERE organization_id=? AND user_id=? AND scheduled_at>=? AND scheduled_at<? AND status IN('planned','proposed') ORDER BY scheduled_at,id LIMIT 101").bind(org,rep.id,from,until).all<any>()).results;if(agenda.length>100)fail(422,'DAILY_AGENDA_LIMIT');
 let replacement:any=null,replacePlans:any[]=[];
 if(input.replace_run_id){replacement=await db.prepare("SELECT id,rep_id,service_date,status FROM daily_visit_run WHERE organization_id=? AND id=? AND rep_id=? AND service_date=? AND status='applied'").bind(org,input.replace_run_id,rep.id,date).first<any>();if(!replacement)fail(409,'DAILY_STALE');
  const linked=(await db.prepare('SELECT work_plan_id FROM daily_visit_plan_link WHERE organization_id=? AND run_id=?').bind(org,replacement.id).all<any>()).results;
  replacePlans=agenda.filter(p=>linked.some(l=>l.work_plan_id===p.id)&&Date.parse(p.scheduled_at)>=Date.now()&&!allActivities.some(a=>a.outlet_id===p.customer_id));
 }
 const replaceIds=new Set(replacePlans.map(p=>p.id));
 if(agenda.some(p=>!replaceIds.has(p.id)&&Date.parse(p.scheduled_at)<Date.parse(input.start_at)&&Date.parse(p.scheduled_at)+Math.max(30,JSON.parse(p.calendar_snapshot_json||'{}').slot_minutes||30)*60000>Date.parse(input.start_at)))fail(422,'DAILY_LOCKED_UNASSIGNED');
 const fixed=agenda.filter(p=>!replaceIds.has(p.id)&&Date.parse(p.scheduled_at)>=Date.parse(input.start_at));
 if(fixed.some(p=>Date.parse(p.scheduled_at)>=Date.parse(input.end_at))||fixed.length>remainingTarget)fail(422,'DAILY_LOCKED_UNASSIGNED');
 const predicate=customerPredicate(scope);
 const assigned=(await db.prepare(`SELECT co.id,co.name,co.area_id,co.latitude_e7,co.longitude_e7,co.coordinate_status,co.service_frequency_days,co.visit_window FROM customer_outlet co WHERE ${predicate.sql} AND co.organization_id=? AND co.record_status='active' AND co.merged_into_id IS NULL AND co.id IN(SELECT COALESCE(origin.merged_into_id,origin.id) FROM customer_assignment ca JOIN customer_outlet origin ON origin.organization_id=ca.organization_id AND origin.id=ca.outlet_id WHERE ca.organization_id=? AND ca.rep_id=? AND ca.channel='field' AND ca.effective_from_date<=? AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?)) ORDER BY co.id LIMIT 1001`).bind(...predicate.params,org,org,rep.id,date,date).all<any>()).results;
 if(assigned.length>1000)fail(422,'DAILY_CANDIDATE_LIMIT');const ids=JSON.stringify(assigned.map(c=>c.id));
 const activity=(await db.prepare("SELECT COALESCE(co.merged_into_id,co.id) id,MAX(a.occurred_at) last_visit FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id WHERE a.organization_id=? AND a.channel='field' AND a.activity_kind='visit' AND a.status='done' AND a.occurred_at<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) GROUP BY COALESCE(co.merged_into_id,co.id)").bind(org,observedUntil,ids).all<any>()).results;
 const since=new Date(Date.parse(from)-90*86400000).toISOString().slice(0,10);
 const sales=(await db.prepare("SELECT COALESCE(co.merged_into_id,co.id) id,SUM(i.net_minor) sales_minor FROM invoice i JOIN customer_outlet co ON co.organization_id=i.organization_id AND co.id=i.outlet_id WHERE i.organization_id=? AND i.rep_id=? AND i.channel='field' AND i.status='validated' AND i.validation_state='validated' AND i.is_current=1 AND i.currency='IDR' AND i.invoice_date>=? AND i.invoice_date<=? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) GROUP BY COALESCE(co.merged_into_id,co.id)").bind(org,rep.id,since,date,ids).all<any>()).results;
 const wallets=(await db.prepare('SELECT customer_id id,wallet_size_minor FROM customer_wallet_profile WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?))').bind(org,ids).all<any>()).results;
 const tasks=(await db.prepare("SELECT id,customer_id,due_at FROM sales_task WHERE organization_id=? AND user_id=? AND channel='field' AND status IN('open','in_progress') AND due_at<? ORDER BY due_at LIMIT 1001").bind(org,rep.id,until).all<any>()).results;if(tasks.length>1000)fail(422,'DAILY_TASK_LIMIT');
 const profiles=(await db.prepare("SELECT customer_id,config_json FROM visit_customer_planning_profile WHERE organization_id=? AND status='current' AND valid_from<=? AND valid_until>=? AND customer_id IN(SELECT value FROM json_each(?))").bind(org,date,date,ids).all<any>()).results;
 const lookup=(rows:any[])=>new Map(rows.map(r=>[r.id,r])),lastById=lookup(activity),salesById=lookup(sales),walletById=lookup(wallets),profileById=new Map(profiles.map(p=>[p.customer_id,JSON.parse(p.config_json)]));
 const weekday=businessClock(new Date(input.start_at),timezone).weekday,skipped:any[]=[];
 const candidates=assigned.map(c=>({...c,last_visit:lastById.get(c.id)?.last_visit??null,sales_minor:salesById.get(c.id)?.sales_minor??0,wallet_size_minor:walletById.get(c.id)?.wallet_size_minor??null,due_tasks:tasks.filter(t=>t.customer_id===c.id).length,profile:profileById.get(c.id)}));
 const ranked=rankDailyCustomers(candidates.filter(c=>{let reason='';const isFixed=fixed.some(p=>p.customer_id===c.id),todayDone=allActivities.some(a=>a.outlet_id===c.id);
  if(c.latitude_e7===null||c.longitude_e7===null)reason='missing_coordinates';else if(c.coordinate_status!=='verified'&&!policy.allow_unverified_coordinates)reason='unverified_coordinates';else if(todayDone)reason='visited_today';else if(!isFixed&&agenda.some(p=>p.customer_id===c.id&&!replaceIds.has(p.id)))reason='existing_agenda';
  if(reason){skipped.push({id:c.id,name:c.name,reason});return false}return true;
 }),input.start,date,policy).filter(c=>{if(!fixed.some(p=>p.customer_id===c.id)&&c.days_since_visit!==null&&c.days_since_visit<c.gap_days){skipped.push({id:c.id,name:c.name,reason:'minimum_gap'});return false}return true});
 const seconds=(v:string)=>Math.floor(Date.parse(v)/1000),startSec=seconds(input.start_at),endSec=seconds(input.end_at);
 const withWindows=ranked.flatMap(c=>{const cfg=c.profile,windows=cfg?.reception_reviewed?cfg.reception_windows.filter((w:any)=>w.weekday===weekday).map((w:any)=>[planningInstant(date,w.start,timezone),planningInstant(date,w.end,timezone)]):policy.use_shift_as_opening_window?[[input.start_at,input.end_at]]:[];
  const service=Math.max(1800,cfg?.service_seconds??policy.service_minutes*60),valid=windows.filter((w:any)=>w[0]&&w[1]).map((w:any)=>[Math.max(startSec,seconds(w[0])),Math.min(endSec,seconds(w[1]))-service]).filter((w:number[])=>w[1]>=w[0]);
  if(!valid.length){skipped.push({id:c.id,name:c.name,reason:cfg?'closed_or_short_window':'missing_opening_hours'});return []}return[{...c,service_seconds:service,windows:valid,opening_source:cfg?'reviewed_profile':'explicit_policy_shift_fallback'}];});
 if(fixed.some(p=>!withWindows.some(c=>c.id===p.customer_id)))fail(422,'DAILY_LOCKED_UNASSIGNED');
 const fixedCustomers=fixed.map(p=>({...withWindows.find(c=>c.id===p.customer_id),fixed_plan:p})),newCustomers=withWindows.filter(c=>!fixed.some(p=>p.customer_id===c.id)).slice(0,Math.min(40-fixed.length,Math.max(0,remainingTarget-fixed.length)*2));
 const selected=[...fixedCustomers,...newCustomers];if(!selected.length)fail(422,skipped.some(c=>c.reason==='missing_opening_hours')?'DAILY_MISSING_OPENING_HOURS':skipped.some(c=>['missing_coordinates','unverified_coordinates'].includes(c.reason))?'DAILY_COORDINATES_REQUIRED':'DAILY_NO_CANDIDATES');
 const locations:number[][]=[],location=(longitude:number,latitude:number)=>{let index=locations.findIndex(p=>p[0]===longitude&&p[1]===latitude);if(index<0){index=locations.length;locations.push([longitude,latitude])}return index;};
 const startIndex=location(input.start.longitude,input.start.latitude),endPoint=input.end??input.start,endIndex=location(endPoint.longitude,endPoint.latitude);
 const breaks:any[]=[];const configuredBreaks=repConfig?.breaks_reviewed?repConfig.breaks:policy.break_minutes?[{start:policy.break_start,end:null}]:[];
 for(const [i,b] of configuredBreaks.entries()){const fromBreak=planningInstant(date,b.start,timezone),toBreak=b.end?planningInstant(date,b.end,timezone):fromBreak?new Date(Date.parse(fromBreak)+policy.break_minutes*60000).toISOString():null;if(!fromBreak||!toBreak)fail(422,'DAILY_BREAK_INVALID');const a=Math.max(startSec,seconds(fromBreak)),bEnd=Math.min(endSec,seconds(toBreak));if(bEnd>a)breaks.push({id:i+1,service:bEnd-a,time_windows:[[a,a]]});}
 for(const [index,task] of tasks.entries()){const t=seconds(task.due_at);if(t+1800<=startSec||t>=endSec)continue;const at=Math.max(startSec,t);breaks.push({id:100+index,service:Math.min(endSec,t+1800)-at,time_windows:[[at,at]]});}
 const sorted=breaks.slice().sort((a,b)=>a.time_windows[0][0]-b.time_windows[0][0]),merged:any[]=[];for(const b of sorted){const prev=merged.at(-1);if(prev&&b.time_windows[0][0]<=prev.time_windows[0][0]+prev.service)prev.service=Math.max(prev.service,b.time_windows[0][0]+b.service-prev.time_windows[0][0]);else merged.push(b);}
 const vehicle={id:1,profile:'driving-car',start:locations[startIndex],end:locations[endIndex],start_index:startIndex,end_index:endIndex,skills:[1],capacity:[remainingTarget],time_window:[startSec,endSec],breaks:merged};
 const jobs=selected.map((c,index)=>{const fixedAt=c.fixed_plan?seconds(c.fixed_plan.scheduled_at):null,windows=fixedAt===null?c.windows:c.windows.filter((w:number[])=>fixedAt>=w[0]&&fixedAt<=w[1]).map(()=>[fixedAt,fixedAt]);if(!windows.length)fail(422,'DAILY_LOCKED_UNASSIGNED');const i=location(c.longitude_e7/1e7,c.latitude_e7/1e7);return{id:index+1,location:locations[i],location_index:i,skills:[1],service:c.service_seconds,time_windows:windows,delivery:[1],priority:c.fixed_plan?10:Math.min(9,Math.floor(c.score/100*9))};});
 const revision=await planningRevision(db,org),geoAfter=await db.prepare('SELECT epoch FROM geo_distribution_epoch WHERE organization_id=?').bind(org).first<any>();
 if(revision.source_epoch!==initialRevision.source_epoch||revision.agenda_epoch!==initialRevision.agenda_epoch||geoEpoch?.epoch!==geoAfter?.epoch)fail(409,'DAILY_STALE');
 Object.assign(revision,{geo_epoch:geoAfter?.epoch??0});
 return{rep,date,timezone,calendar:{...cal,calendar},input,policy,revision,customers:selected.map(({profile,...c})=>c),skipped,eligible_count:withWindows.length,assigned_count:assigned.length,completed_today:completedToday,remaining_target:remainingTarget,replacePlans,replacement,vehicles:[vehicle],jobs,locations,preserved_agenda_count:agenda.length-replacePlans.length};
}
