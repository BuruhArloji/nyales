/** Active dependencies must be resolved before disabling a person or changing scope.
 * Historical invoices, targets, completed work and audit attribution stay untouched. */
export function peopleOpenWorkSql(org:string,user:string,date:string,now:string){
 const checks:Array<{sql:string;params:string[]}>=[];
 const add=(table:string,condition:string,extra:string[]=[])=>checks.push({sql:`EXISTS(SELECT 1 FROM ${table} WHERE organization_id=? AND ${condition})`,params:[org,...extra]});
 add('visit_active','user_id=?',[user]);
 add('work_session','user_id=? AND ended_at IS NULL',[user]);
 add('activity',"user_id=? AND status IN('draft','pending_checkin','in_progress','checked_in','open','needs_review')",[user]);
 add('work_plan',"user_id=? AND status IN('planned','proposed')",[user]);
 add('sales_task',"user_id=? AND status IN('open','in_progress')",[user]);
 add('sales_handoff',"(sender_id=? OR receiver_id=?) AND status IN('pending','accepted')",[user,user]);
 add('sales_lead',"user_id=? AND stage NOT IN('won','lost')",[user]);
 add('sales_order',"user_id=? AND status NOT IN('confirmed','cancelled','rejected')",[user]);
 add('telesales_lease',"user_id=? AND status='active' AND expires_at>?",[user,now]);
 add('coaching_review',"user_id=? AND status IN('open','reviewed')",[user]);
 add('visit_off_day',"user_id=? AND status IN('pending','approved') AND service_date>=?",[user,date]);
 add('reporting_assignment','subordinate_id=? AND effective_from_date>?',[user,date]);
 return{sql:checks.map(c=>c.sql).join(' OR '),params:checks.flatMap(c=>c.params)};
}
export async function requireNoOpenPeopleWork(db:D1Database,org:string,user:string,date:string){
 const p=peopleOpenWorkSql(org,user,date,new Date().toISOString());
 const row=await db.prepare('SELECT CASE WHEN '+p.sql+' THEN 1 ELSE 0 END has_open_work').bind(...p.params).first<{has_open_work:number}>();
 if(row?.has_open_work)throw Error('409:RESOLVE_OPEN_WORK_BEFORE_USER_CHANGE');
}
/** Same predicate inside the mutation transaction closes the preflight/write race. */
export function noOpenPeopleWorkGuard(db:D1Database,org:string,user:string,date:string){
 const p=peopleOpenWorkSql(org,user,date,new Date().toISOString());
 return[db.prepare('INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN '+p.sql+' THEN 0 ELSE 1 END').bind(...p.params),db.prepare('DELETE FROM master_mutation_guard')];
}
export function revokePeopleSessions(db:D1Database,org:string,user:string,actor:string){
 return db.prepare('UPDATE device_session SET revoked_at=?,revoked_by=?,revoke_reason=?,version=version+1 WHERE organization_id=? AND user_id=? AND revoked_at IS NULL').bind(new Date().toISOString(),actor,'User disabled or authentication identity changed',org,user);
}
export function peopleDeactivationCleanup(db:D1Database,org:string,user:string,date:string,actor:string){
 // Day-based reporting intervals cannot be zero length. A relationship created
 // today closes at tomorrow's boundary; inactive people are hidden from active UI.
 const nextDate=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return[
  db.prepare('UPDATE reporting_assignment SET effective_to_date=CASE WHEN effective_from_date<? THEN ? ELSE ? END,version=version+1 WHERE organization_id=? AND subordinate_id=? AND effective_from_date<=? AND(effective_to_date IS NULL OR effective_to_date>?)').bind(date,date,nextDate,org,user,date,date),
  revokePeopleSessions(db,org,user,actor),
 ];
}
