import {Hono} from 'hono';
import {villagePlanInput,villagePlanCommit,type VillagePlanInput} from '../shared/village-territory';
import {canonicalJson} from '../shared/boundaries';
import {eligibleSql,eligibleParams} from './assignments';
import {loadGeographyDataset,mappingState} from './geography';
import {businessDayStart} from './calendar';
import {territoryStatements} from './territories';
import {fail,digest,operation,type OperationEnv} from './operations';

const org=(c:any)=>c.get('scope').identity.organization_id;
async function revision(c:any){return await c.env.DB.prepare('SELECT g.epoch,v.source_epoch,v.agenda_epoch FROM geo_distribution_epoch g JOIN visit_planning_revision v ON v.organization_id=g.organization_id WHERE g.organization_id=?').bind(org(c)).first()}
function chunks<T>(rows:T[],size=500){return Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size))}
export async function prepareVillagePlan(c:any,input:VillagePlanInput){
 if(!c.get('scope').orgWide)fail(403,'SCOPE_DENIED');
 const db=c.env.DB as D1Database,organization=org(c),today=c.get('scope').date,date=input.effective_from_date;
 if(date<today)fail(422,'PAST_DATE_NOT_ALLOWED');
 const basis=await revision(c),dataset=await loadGeographyDataset(c,input.dataset_id);
 if(dataset?.status!=='active')fail(409,'ACTIVE_DATASET_REQUIRED');
 const area=await db.prepare("SELECT a.id,a.name,a.branch_id,b.timezone FROM area a JOIN branch b ON b.organization_id=a.organization_id AND b.id=a.branch_id WHERE a.organization_id=? AND a.id=? AND a.status='active' AND b.status='active'").bind(organization,input.area_id).first<any>();if(!area)fail(422,'INVALID_AREA');
 const eligible=Boolean(await db.prepare(`SELECT 1 WHERE ${eligibleSql()}`).bind(...eligibleParams(organization,input.rep_id,'field',input.area_id,date)).first());
 const selected=(await db.prepare("SELECT b.id,b.admin_unit_id,b.name_snapshot,b.dataset_id,b.hierarchy_json FROM admin_boundary b JOIN admin_unit u ON u.organization_id=b.organization_id AND u.id=b.admin_unit_id WHERE b.organization_id=? AND b.dataset_id=? AND b.id IN(SELECT value FROM json_each(?)) AND u.level='village' AND u.status='active' ORDER BY b.id").bind(organization,dataset.id,JSON.stringify(input.boundary_ids)).all<any>()).results;
 if(selected.length!==input.boundary_ids.length||new Set(selected.map(b=>b.admin_unit_id)).size!==selected.length)fail(404,'BOUNDARY_NOT_FOUND');
 const boundaries=JSON.stringify(selected.map(b=>b.id)),units=JSON.stringify(selected.map(b=>b.admin_unit_id));
 // Read only the selected village cohort, never an organization-wide customer list.
 const customers=(await db.prepare("SELECT co.id,co.name,co.area_id,co.version,co.latitude_e7,co.longitude_e7,co.coordinate_status,co.service_frequency_days,l.id mapping_id,l.revision mapping_revision,l.status,l.evidence_json,l.boundary_id,l.admin_unit_id,b.dataset_id FROM customer_admin_location l JOIN customer_outlet co ON co.organization_id=l.organization_id AND co.id=l.outlet_id JOIN admin_boundary b ON b.organization_id=l.organization_id AND b.id=l.boundary_id WHERE l.organization_id=? AND l.boundary_id IN(SELECT value FROM json_each(?)) AND l.superseded_at IS NULL AND l.effective_from_date<=? AND(l.effective_to_date IS NULL OR l.effective_to_date>?) AND l.status='confirmed' AND co.record_status='active' AND co.merged_into_id IS NULL ORDER BY co.id LIMIT 10001").bind(organization,boundaries,date,date).all<any>()).results;
 if(customers.length>10000)fail(422,'VILLAGE_COHORT_TOO_LARGE');
 if(new Set(customers.map(c=>c.id)).size!==customers.length)fail(409,'VILLAGE_MAPPING_AMBIGUOUS');
 const ids=JSON.stringify(customers.map(c=>c.id));
 if(new TextEncoder().encode(ids).byteLength>450000)fail(422,'VILLAGE_COHORT_TOO_LARGE');
 const owners=(await db.prepare(`SELECT v.*,u.name rep_name FROM village_sales_owner v JOIN app_user u ON u.organization_id=v.organization_id AND u.id=v.rep_id WHERE v.organization_id=? AND v.admin_unit_id IN(SELECT value FROM json_each(?)) AND(v.effective_to_date IS NULL OR v.effective_to_date>?) ORDER BY v.id`).bind(organization,units,date).all<any>()).results;
 const memberships=(await db.prepare('SELECT * FROM area_admin_membership WHERE organization_id=? AND admin_unit_id IN(SELECT value FROM json_each(?)) AND(effective_to_date IS NULL OR effective_to_date>?) ORDER BY id').bind(organization,units,date).all<any>()).results;
 const assignments=(await db.prepare("SELECT ca.*,COALESCE(co.merged_into_id,co.id) canonical_id FROM customer_assignment ca JOIN customer_outlet co ON co.id=ca.outlet_id AND co.organization_id=ca.organization_id WHERE ca.organization_id=? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) AND ca.channel='field' AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?) ORDER BY ca.id").bind(organization,ids,date).all<any>()).results;
 const byCustomer=new Map<string,any[]>();for(const a of assignments){const list=byCustomer.get(a.canonical_id)||[];list.push(a);byCustomer.set(a.canonical_id,list)}
 const changed=customers.filter(co=>{const a=(byCustomer.get(co.id)||[]).filter(a=>a.rep_id!==null&&a.effective_from_date<=date);return co.area_id!==area.id||a.length!==1||a[0].rep_id!==input.rep_id||a[0].area_id!==area.id});
 const changedSet=new Set(changed.map(c=>c.id));
 const changedIds=JSON.stringify([...changedSet]),cutoff=businessDayStart(date,area.timezone);
 const agenda=(await db.prepare("SELECT * FROM work_plan WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?)) AND kind='visit' AND status IN('planned','proposed') AND scheduled_at>=? ORDER BY id LIMIT 5001").bind(organization,changedIds,cutoff).all<any>()).results;
 const blockers:{code:string;count:number}[]=[];
 if(!eligible)blockers.push({code:'REP_ROLE_AREA_OR_SUPERVISOR_INVALID',count:1});
 if(customers.some(co=>mappingState(co,co,dataset)!=='confirmed'))blockers.push({code:'STALE_CUSTOMER_MAPPING',count:customers.filter(co=>mappingState(co,co,dataset)!=='confirmed').length});
 const membershipChanges=selected.filter(b=>!memberships.some(m=>m.admin_unit_id===b.admin_unit_id&&m.area_id===area.id&&m.boundary_id===b.id&&m.effective_from_date<=date));
 const ownerChanges=selected.filter(b=>!owners.some(o=>o.admin_unit_id===b.admin_unit_id&&o.area_id===area.id&&o.rep_id===input.rep_id&&o.effective_from_date<=date));
 if(owners.some(o=>o.effective_from_date>date||o.effective_from_date===date&&ownerChanges.some(b=>b.admin_unit_id===o.admin_unit_id))||memberships.some(m=>m.effective_from_date>date||m.effective_from_date===date&&selected.some(b=>b.admin_unit_id===m.admin_unit_id&&(m.area_id!==area.id||m.boundary_id!==b.id)))||assignments.some(a=>a.effective_from_date>=date&&changedSet.has(a.canonical_id)))blockers.push({code:'VILLAGE_DATE_CONFLICT',count:1});
 if(agenda.length>5000)blockers.push({code:'AGENDA_REVIEW_LIMIT',count:agenda.length});
 if(agenda.length&&input.agenda_action==='block')blockers.push({code:'FUTURE_VISITS_REQUIRE_REVIEW',count:agenda.length});
 const pending=(await db.prepare('SELECT COUNT(*) n FROM customer_territory_transfer WHERE organization_id=? AND outlet_id IN(SELECT value FROM json_each(?)) AND applied_at IS NULL').bind(organization,ids).first<any>())?.n||0;if(pending)blockers.push({code:'PENDING_TERRITORY_TRANSFER',count:pending});
 const dependencies=(await db.prepare(`SELECT 'ACTIVE_VISITS' code,COUNT(*) n FROM visit_active v JOIN activity a ON a.organization_id=v.organization_id AND a.id=v.activity_id WHERE v.organization_id=? AND a.outlet_id IN(SELECT value FROM json_each(?)) UNION ALL SELECT 'OPEN_FIELD_TASKS',COUNT(*) FROM sales_task WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?)) AND channel='field' AND user_id<>? AND status IN('open','in_progress') UNION ALL SELECT 'PENDING_FIELD_HANDOFFS',COUNT(*) FROM sales_handoff WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?)) AND channel='field' AND status IN('pending','accepted')`).bind(organization,changedIds,organization,changedIds,input.rep_id,organization,changedIds).all<any>()).results;
 for(const row of dependencies)if(row.n)blockers.push({code:row.code,count:row.n});
 const wallet=(await db.prepare('SELECT COUNT(*) known,COALESCE(SUM(wallet_size_minor),0) amount FROM customer_wallet_profile WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?))').bind(organization,ids).first<any>())!;
 const last90=new Date(Date.parse(today)-90*86400000).toISOString().slice(0,10);
 const invoice=(await db.prepare("SELECT COUNT(*) invoices,COALESCE(SUM(i.net_minor),0) amount FROM invoice i JOIN customer_outlet co ON co.id=i.outlet_id AND co.organization_id=i.organization_id WHERE i.organization_id=? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.currency='IDR' AND i.invoice_date>=? AND i.invoice_date<=?").bind(organization,ids,last90,today).first<any>())!;
 if(!Number.isSafeInteger(wallet.amount)||!Number.isSafeInteger(invoice.amount))fail(422,'AMOUNT_OVERFLOW');
 const calendar=await db.prepare("SELECT * FROM work_calendar WHERE organization_id=? AND branch_id=? AND status='active' ORDER BY id LIMIT 1").bind(organization,area.branch_id).first<any>();
 const policy=await db.prepare('SELECT config_json FROM daily_visit_policy WHERE organization_id=?').bind(organization).first<any>(),target=policy?JSON.parse(policy.config_json).target_visits:15;
 const month=date.slice(0,7),days=new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate();let workingDays:number|null=null;
 if(calendar){workingDays=0;const weekdays=JSON.parse(calendar.weekdays_json),holidays=JSON.parse(calendar.holidays_json);for(let day=1;day<=days;day++){const d=month+'-'+String(day).padStart(2,'0'),weekday=new Date(d+'T00:00:00Z').getUTCDay()||7;if(weekdays.includes(weekday)&&!holidays.includes(d))workingDays++}}
 const otherLoad=(await db.prepare("SELECT co.id,co.service_frequency_days FROM customer_assignment ca JOIN customer_outlet co ON co.organization_id=ca.organization_id AND co.id=ca.outlet_id WHERE ca.organization_id=? AND ca.rep_id=? AND ca.channel='field' AND ca.effective_from_date<=? AND(ca.effective_to_date IS NULL OR ca.effective_to_date>?) AND co.record_status='active' AND co.merged_into_id IS NULL AND co.id NOT IN(SELECT value FROM json_each(?)) ORDER BY co.id LIMIT 10001").bind(organization,input.rep_id,date,date,ids).all<any>()).results;
 if(otherLoad.length>10000)blockers.push({code:'REP_LOAD_REVIEW_LIMIT',count:otherLoad.length});
 const existingVisits=otherLoad.reduce((n,co)=>n+Math.ceil(days/Math.max(1,Number(co.service_frequency_days)||7)),0);
 const visits=customers.reduce((n,co)=>n+Math.ceil(days/Math.max(1,Number(co.service_frequency_days)||7)),0),capacity=workingDays===null?null:workingDays*target;
 const affected=changed.map(co=>({id:co.id,version:co.version,from_area_id:co.area_id,mapping_id:co.mapping_id,mapping_revision:co.mapping_revision}));
 const data={dataset_id:dataset.id,area,rep_id:input.rep_id,effective_from_date:date,summary:{villages:selected.length,customers:customers.length,customer_changes:changed.length,area_moves:changed.filter(c=>c.area_id!==area.id).length,wallet_size_minor:wallet.amount,wallet_known:wallet.known,wallet_unknown:customers.length-wallet.known,invoice_net_90_days:invoice.amount,invoices:invoice.invoices,required_visits_month:visits,nominal_capacity_month:capacity,existing_required_visits_month:existingVisits,total_required_visits_month:visits+existingVisits,over_capacity:capacity!==null&&visits+existingVisits>capacity,future_visits:agenda.length,agenda_action:input.agenda_action,telesales:'unchanged'},villages:selected.map(b=>({id:b.id,name:b.name_snapshot,admin_unit_id:b.admin_unit_id,hierarchy:JSON.parse(b.hierarchy_json),customers:customers.filter(co=>co.admin_unit_id===b.admin_unit_id).length,previous_rep_name:owners.find(o=>o.admin_unit_id===b.admin_unit_id&&o.effective_from_date<=date)?.rep_name||null,previous_rep_id:owners.find(o=>o.admin_unit_id===b.admin_unit_id&&o.effective_from_date<=date)?.rep_id||null})),blockers,can_commit:blockers.length===0&&(changed.length>0||ownerChanges.length>0||membershipChanges.length>0),sample:customers.slice(0,50).map(co=>({id:co.id,name:co.name,area_id:co.area_id})),capacity_basis:'Full-month nominal calendar; frequency fallback 7 days. Includes existing assigned customers; travel and individual leave are not deducted.',historical_attribution_unchanged:true};
 const after=await revision(c);if(canonicalJson(basis)!==canonicalJson(after))fail(412,'VILLAGE_PREVIEW_STALE');
 const hash=await digest(canonicalJson({input:{...input,boundary_ids:[...input.boundary_ids].sort()},basis,data,affected,assignments,owners,memberships,agenda,calendar}));
 return{data:{...data,preview_hash:hash},basis,customers,changed,assignments,owners,memberships,ownerChanges,agenda,selected};
}

export const villageTerritory=new Hono<OperationEnv>();
villageTerritory.use('/api/geo/village-territories*',async(c,next)=>{if(!c.get('scope').orgWide)fail(403,'SCOPE_DENIED');await next()});
villageTerritory.get('/api/geo/village-territories',async c=>{
 const organization=org(c),date=c.get('scope').date,offset=Number(c.req.query('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(422,'INVALID_PAGE');
 const dataset=await c.env.DB.prepare("SELECT id,release_version FROM admin_boundary_dataset WHERE organization_id=? AND status='active'").bind(organization).first();
 const rows=await c.env.DB.prepare("SELECT v.*,u.name rep_name,a.name area_name,n.name village_name FROM village_sales_owner v JOIN app_user u ON u.organization_id=v.organization_id AND u.id=v.rep_id JOIN area a ON a.organization_id=v.organization_id AND a.id=v.area_id JOIN admin_unit n ON n.organization_id=v.organization_id AND n.id=v.admin_unit_id WHERE v.organization_id=? AND(v.effective_to_date IS NULL OR v.effective_to_date>?) ORDER BY n.name,v.id LIMIT 51 OFFSET ?").bind(organization,date,offset).all();
 return c.json({data:{business_date:date,dataset,owners:rows.results.slice(0,50),next_offset:rows.results.length>50?offset+50:null}});
});
villageTerritory.post('/api/geo/village-territories/preview',async c=>{const b=villagePlanInput.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json({code:'INVALID_VILLAGE_PLAN'},422);return c.json({data:(await prepareVillagePlan(c,b.data)).data})});
villageTerritory.post('/api/geo/village-territories/commit',async c=>{
 const parsed=villagePlanCommit.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({code:'INVALID_VILLAGE_PLAN'},422);
 return operation(c,parsed.data,async()=>{
  const {preview_hash,confirmed,...input}=parsed.data,plan=await prepareVillagePlan(c,input);if(plan.data.preview_hash!==preview_hash)fail(412,'VILLAGE_PREVIEW_STALE');if(!plan.data.can_commit)fail(409,'VILLAGE_REVIEW_CONFLICT');
  const db=c.env.DB,organization=org(c),actor=c.get('scope').identity.id,id=crypto.randomUUID(),created=new Date().toISOString(),date=input.effective_from_date,statements:D1PreparedStatement[]=[];
  statements.push(db.prepare('INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN g.epoch=? AND v.source_epoch=? AND v.agenda_epoch=? THEN 1 ELSE 0 END FROM geo_distribution_epoch g JOIN visit_planning_revision v ON v.organization_id=g.organization_id WHERE g.organization_id=?').bind(plan.basis.epoch,plan.basis.source_epoch,plan.basis.agenda_epoch,organization),db.prepare('DELETE FROM master_mutation_guard'),db.prepare(`INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN ${eligibleSql()} THEN 1 ELSE 0 END`).bind(...eligibleParams(organization,input.rep_id,'field',input.area_id,date)),db.prepare('DELETE FROM master_mutation_guard'));
  for(const b of plan.ownerChanges){
   statements.push(db.prepare('UPDATE village_sales_owner SET effective_to_date=? WHERE organization_id=? AND admin_unit_id=? AND effective_from_date<? AND(effective_to_date IS NULL OR effective_to_date>?)').bind(date,organization,b.admin_unit_id,date,date));
   statements.push(db.prepare('INSERT INTO village_sales_owner VALUES(?,?,?,?,?,?,NULL,?,?,?)').bind(crypto.randomUUID(),organization,b.admin_unit_id,input.area_id,input.rep_id,date,input.reason,actor,created));
  }
  for(const b of plan.selected){const current=plan.memberships.find(m=>m.admin_unit_id===b.admin_unit_id&&m.effective_from_date<=date);if(current?.area_id===input.area_id&&current?.boundary_id===b.id)continue;
   statements.push(db.prepare('UPDATE area_admin_membership SET effective_to_date=? WHERE organization_id=? AND admin_unit_id=? AND effective_from_date<? AND(effective_to_date IS NULL OR effective_to_date>?)').bind(date,organization,b.admin_unit_id,date,date),db.prepare('INSERT INTO area_admin_membership(id,organization_id,area_id,admin_unit_id,boundary_id,effective_from_date,reason) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),organization,input.area_id,b.admin_unit_id,b.id,date,input.reason));
  }
  for(const list of chunks(plan.changed)){
   const ids=JSON.stringify(list.map(co=>co.id));
   statements.push(db.prepare("UPDATE customer_assignment SET effective_to_date=?,ended_reason=?,ended_by=?,ended_at=? WHERE organization_id=? AND channel='field' AND outlet_id IN(SELECT id FROM customer_outlet WHERE organization_id=? AND COALESCE(merged_into_id,id) IN(SELECT value FROM json_each(?))) AND effective_from_date<? AND(effective_to_date IS NULL OR effective_to_date>?)").bind(date,input.reason,actor,created,organization,organization,ids,date,date));
   statements.push(db.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date,reason,created_by,created_at) SELECT ?||':'||co.id,co.organization_id,co.id,?,'field',?,?,?,?,? FROM customer_outlet co WHERE co.organization_id=? AND co.id IN(SELECT value FROM json_each(?))").bind(id,input.rep_id,input.area_id,date,input.reason,actor,created,organization,ids));
   statements.push(db.prepare('INSERT INTO customer_territory_transfer(id,organization_id,outlet_id,from_area_id,to_area_id,effective_from_date,reason,created_by,created_at) SELECT ?||\':area:\'||co.id,co.organization_id,co.id,co.area_id,?,?,?,?,? FROM customer_outlet co WHERE co.organization_id=? AND co.id IN(SELECT value FROM json_each(?)) AND co.area_id<>?').bind(id,input.area_id,date,input.reason,actor,created,organization,ids,input.area_id));
   statements.push(db.prepare('UPDATE customer_outlet SET version=version+1 WHERE organization_id=? AND id IN(SELECT value FROM json_each(?))').bind(organization,ids));
  }
  if(input.agenda_action==='cancel')for(const list of chunks(plan.agenda)){
   statements.push(db.prepare("INSERT INTO work_plan_revision SELECT ?||':plan:'||json_extract(value,'$.id'),?,json_extract(value,'$.id'),?,?,value,json_set(value,'$.status','cancelled','$.version',json_extract(value,'$.version')+1),? FROM json_each(?)").bind(id,organization,actor,created,input.reason,JSON.stringify(list)));
   statements.push(db.prepare("UPDATE work_plan SET status='cancelled',version=version+1 WHERE organization_id=? AND id IN(SELECT value FROM json_each(?)) AND status IN('planned','proposed')").bind(organization,JSON.stringify(list.map(p=>p.id))));
  }
  if(statements.length>800)fail(422,'VILLAGE_COMMIT_TOO_LARGE');
  if(date===c.get('scope').date)statements.push(...territoryStatements(db,organization,date));
  const data={id,version:1,status:date>c.get('scope').date?'scheduled':'effective',...plan.data};return{resource:'village_territory',data,status:201,statements};
 });
});
villageTerritory.onError((e,c)=>{const m=/^(403|404|409|412|422|503):(.+)$/.exec(e.message);return c.json({code:m?.[2]||'VILLAGE_TERRITORY_UNAVAILABLE'},(m?Number(m[1]):503)as any)});
