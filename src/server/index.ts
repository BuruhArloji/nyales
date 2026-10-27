import {visitOperationalProfiles} from './visit-operational-profiles';
import {visitPlanning} from './visit-planning';
import {agentQueueAdmin} from './visit-agent-queue';
import {visitAgentGateway,visitAgentMaintenance} from './visit-agent-gateway';
import {visitAgentRegistry} from './visit-agent-registry';
import {workloadPolicies} from './workload-policies';
import {territoryScenarios} from './territory-scenarios';
import {regionalAnalytics} from './geography-analytics';
import {customerRisk} from './customer-risk';
import {riskEvaluations} from './risk-evaluations';
import{observability}from'./observability';
import{telemetry,measuredJob}from'./telemetry';
import{monitoring,notificationMaintenance,operationalReminders,reportMaintenance}from'./monitoring';
import{incentives}from'./incentives';
import {pipeline} from './pipeline';
import {workflows,salesMaintenance} from './workflows';
import {targets,achievement,targetSummary} from './targets';
import {segmentation,segmentationSnapshot,dailySegmentation} from './segmentation';
import {invoices} from './invoices';
import {recovery} from './recovery';
import {boundaries} from './boundaries';
import {distribution} from './distribution';
import {createGeographyRoutes,filterGeoCustomers} from './geography';

import {products} from './products';

import {assignments} from './assignments';

import {imports} from './imports';

import {duplicates} from './duplicates';

import {sessionGate,sessions,securityPolicy,type SessionAuth,type SessionEnv} from './sessions';

import {customerMasters} from './customers';

import {people} from './people';

import {masters} from './masters';

import { Hono } from 'hono';
import {httpSecurity,apiBodyLimit} from './http-security';

import {resolveScope,customerPredicate,invoicePredicate,type Scope} from './scope';

import {localAuthEnabled,verifyFirebaseClaims,mappedIdentity,type Identity} from './auth';

type Bindings={DB:D1Database;APP_ENV:string;LOCAL_AUTH:string;FIREBASE_PROJECT_ID:string;IMPORT_FILES?:R2Bucket;MAP_TILE_URL?:string;MAP_ATTRIBUTION?:string;GOOGLE_MAPS_EMBED_API_KEY?:string;OBS_OWNER_ORGANIZATION_ID?:string};

const app=new Hono<{Bindings:Bindings;Variables:{identity:Identity;scope:Scope;auth:SessionAuth;deviceSession:SessionEnv['Variables']['deviceSession']}}>();

app.onError((_err,c)=>{console.error('NYALES_API_UNHANDLED');return c.json({code:'INTERNAL_ERROR',request_id:c.res.headers.get('X-Request-ID')||null},500)});
app.use('/api/*',telemetry);
app.use('/api/*',httpSecurity);

app.get('/api/health',(c)=>c.json({name:'NYALES',status:'ok',environment:c.env.APP_ENV||'local',version:'0.1.0'}));

app.get('/api/auth/config',c=>c.json({mode:localAuthEnabled(c.env)?'local':'firebase',configured:localAuthEnabled(c.env)||Boolean(c.env.FIREBASE_PROJECT_ID),security:securityPolicy(localAuthEnabled(c.env))}));

// Machine endpoints verify their own PoP identity before the user bearer/session gate.
app.route('/',visitAgentGateway);

app.use('/api/*',async(c,next)=>{

 c.header('Cache-Control','no-store');

 const token=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];

 if(!token)return c.json({code:'UNAUTHENTICATED',detail:'Login diperlukan.'},401);

 if(localAuthEnabled(c.env)&&token==='nyales-local-demo'){

  c.set('identity',{id:'demo-management',name:'Dina Pratiwi',organization_id:'demo-org',role:'MANAGEMENT'});c.set('auth',{subject:'local:demo-management',authTime:Math.floor(Date.now()/1000),mfa:false});await next();return;

 }

 if(!c.env.FIREBASE_PROJECT_ID)return c.json({code:'AUTH_NOT_CONFIGURED'},503);

 let claims:SessionAuth;

 try{claims=await verifyFirebaseClaims(token,c.env.FIREBASE_PROJECT_ID)}catch{return c.json({code:'INVALID_ID_TOKEN'},401)}

 let identity:Identity|null;

 try{identity=await mappedIdentity(c.env.DB,claims.subject)}catch{return c.json({code:'IDENTITY_STORE_UNAVAILABLE'},503)}

 if(!identity)return c.json({code:'USER_NOT_PROVISIONED_OR_INACTIVE'},403);

 c.set('identity',identity);c.set('auth',claims);

 await next();

});

app.use('/api/*',sessionGate);
app.use('/api/*',apiBodyLimit);

app.route('/',sessions);

export const scopedRoutes=new Hono<{Bindings:Bindings;Variables:{identity:Identity;scope:Scope}}>();

scopedRoutes.use('/api/*',async(c,next)=>{

 try{c.set('scope',await resolveScope(c.env.DB,c.get('identity')))}catch{return c.json({code:'SCOPE_UNAVAILABLE',detail:'Akses belum dapat diperiksa.'},503)}

 if(c.req.path.startsWith('/api/observability/')||c.req.path.startsWith('/api/recovery/')){await next();return}
 if(c.req.path.startsWith('/api/admin-boundaries/')){if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(c.req.path.startsWith('/api/geo/')){if(c.req.method!=='GET'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(/^\/api\/customer-risk-policies(\/|$)/.test(c.req.path)){if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(/^\/api\/(workload-policies|territory-scenarios)(\/|$)/.test(c.req.path)){if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(/^\/api\/visit-generator\/(agents|queue-jobs|policies|graphs|preflights|rep-profiles|customer-profiles)(\/|$)/.test(c.req.path)){if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(c.req.path.startsWith('/api/workload/')){await next();return}
 if(c.req.path.startsWith('/api/risks/')){await next();return}
 if((c.req.path==='/api/dashboard/summary'||c.req.path==='/api/dashboard/sources')||/^\/api\/(coaching|notifications|notification-policy|audit-events|report-exports)(\/|$)/.test(c.req.path)){await next();return}
 if(/^\/api\/(incentive-plans|incentive-plan-versions|incentive-enrollments|incentive-simulations|incentive-calculations|incentive-statements|incentive-exports|disputes)(\/|$)/.test(c.req.path)){await next();return}
 if(/^\/api\/(target-plans|target-versions|targets)(\/|$)/.test(c.req.path)){await next();return}
 if(/^\/api\/(customer-tier-rules|customer-source-coverage|customer-segmentation)(\/|$)/.test(c.req.path)){if(c.req.path!=='/api/customer-segmentation'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(/^\/api\/(work-plans|work-sessions|activities|visits|tasks|handoffs|handoff-recipients|campaigns|scripts|attachment-intents|attachments|sync|exceptions)(\/|$)/.test(c.req.path)){if(c.req.method!=='GET'&&/^\/api\/(campaigns|scripts)(\/|$)/.test(c.req.path)&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(/^\/api\/(leads|opportunities|orders|approval-policies|forecast-contributions|forecast-review)(\/|$)/.test(c.req.path)){if(c.req.path.startsWith('/api/approval-policies')&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}
 const isFinance=/^\/api\/(invoice-imports|jobs|invoices)(\/|$)/.test(c.req.path);

 if(isFinance){if((c.req.method!=='GET'||!/^\/api\/invoices(\/|$)/.test(c.req.path))&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isCatalog=/^\/api\/(products|product-groups)(\/|$)/.test(c.req.path);

 if(isCatalog){if(c.req.method!=='GET'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isOperation=/^\/api\/(master-imports|import-files|products|customer-duplicates|customer-aliases)(\/|$)/.test(c.req.path)||/^\/api\/customers\/[^/]+\/(merge|merge-preview)$/.test(c.req.path);

 if(isOperation){if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isCustomerMaster=/^\/api\/(contacts)(\/|$)/.test(c.req.path)||(/^\/api\/customers(\/[^/]+)?$/.test(c.req.path)&&c.req.method!=='GET')||/^\/api\/customers\/[^/]+\/(timeline|street-view)$/.test(c.req.path);

 if(isCustomerMaster){if(c.req.method!=='GET'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isAssignment=/^\/api\/customers\/[^/]+\/assignments$/.test(c.req.path)||c.req.path==='/api/assignment-options';

 if(isAssignment){if((c.req.method!=='GET'||c.req.path==='/api/assignment-options')&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isPeople=/^\/api\/(users|hierarchy-assignments)(\/|$)/.test(c.req.path);

 if(isPeople){if(c.req.method!=='GET'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const isMaster=/^\/api\/(organization|branches|areas|calendars)(\/|$)/.test(c.req.path);

 if(isMaster){if(c.req.method!=='GET'&&!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);await next();return}

 const paths=['/api/me','/api/customers','/api/dashboard','/api/map','/api/telesales/queue','/api/sales/last-positions'];

 if(/^\/api\/telesales\/queue\/(claim|[^/]+\/(renew|complete))$/.test(c.req.path)){if(!c.get('scope').capabilities.includes('telesales:read'))return c.json({code:'SCOPE_DENIED'},403);await next();return}
 if(c.req.path==='/api/telesales/workbench'&&c.req.method==='GET'){await next();return}
 if(c.req.method!=='GET')return c.json({code:'ACTION_NOT_IMPLEMENTED'},403);

 if(!paths.includes(c.req.path)&&!/^\/api\/customers\/[^/]+$/.test(c.req.path))return c.json({code:'NOT_FOUND'},404);

 if(c.req.path==='/api/telesales/queue'&&!c.get('scope').capabilities.includes('telesales:read'))return c.json({code:'SCOPE_DENIED'},403);

 await next();

});

scopedRoutes.onError((err,c)=>{console.error('NYALES request failed',err.name);return c.json({code:'DATA_UNAVAILABLE',detail:'Data tidak dapat dimuat. Coba lagi.'},503)});

function meta(){return {request_id:crypto.randomUUID(),server_time:new Date().toISOString(),source:'d1',validation_state:'provisional',freshness_state:'manual'}}

scopedRoutes.get('/api/me',async c=>{const s=c.get('scope');const demoData=localAuthEnabled(c.env)&&Boolean(await c.env.DB.prepare("SELECT id FROM master_audit WHERE organization_id=? AND resource_type='demo_fixture' AND resource_id='showcase-v1-' LIMIT 1").bind(s.identity.organization_id).first());return c.json({data:{...c.get('identity'),demo_data:demoData,capabilities:s.capabilities,area_ids:s.areaIds,scope:s.orgWide?'organization':s.allRepsInArea?'area':'assigned'},meta:meta()})});

async function readCustomers(db:D1Database,s:Scope){

 const filter=customerPredicate(s);const inv=invoicePredicate(s);

 // Invoice aggregates use invoice ownership, not present-day customer owner; no duplicate join on assignments.

 const rows=await db.prepare(`SELECT co.id,co.name,a.name area,co.latitude_e7,co.longitude_e7,co.area_id,co.address,co.external_code,co.external_code_review,co.version,co.record_status,co.coordinate_status,co.location_note,co.outlet_type,co.service_frequency_days,co.visit_window,

 (SELECT u.name FROM customer_assignment ca JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id WHERE ca.organization_id=co.organization_id AND ca.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)) AND ca.channel='field' AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?) ORDER BY ca.effective_from_date DESC LIMIT 1) owner,

 (SELECT MAX(i.invoice_date) FROM invoice i WHERE i.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)) AND i.organization_id=co.organization_id AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=?) last,

 (SELECT COALESCE(SUM(i.net_minor),0) FROM invoice i WHERE i.outlet_id IN(SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)) AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=? AND ${inv.sql}) actual

 FROM customer_outlet co JOIN area a ON a.organization_id=co.organization_id AND a.id=co.area_id WHERE ${filter.sql} AND co.merged_into_id IS NULL ORDER BY co.name`).bind(s.date,s.date,s.date,s.date.slice(0,7)+'-01',s.date,...inv.params,...filter.params).all<{id:string;name:string;area:string;latitude_e7:number|null;longitude_e7:number|null;owner:string|null;last:string|null;actual:number;area_id:string;address:string|null;external_code:string|null;external_code_review:number;version:number;record_status:string;coordinate_status:string;location_note:string;outlet_type:string;service_frequency_days:number|null;visit_window:string}>();

 const segmentRun=await segmentationSnapshot(db,s.identity.organization_id,s.date);const segmentRows=(await db.prepare('SELECT customer_id,status,tier,provisional,observed_status,cutoff,rule_id,rule_version FROM customer_status_snapshot WHERE run_id=?').bind(segmentRun.id).all<any>()).results;
 const current=(await db.prepare(`SELECT COALESCE(al.canonical_id,ca.outlet_id) customer_id,ca.rep_id,ca.channel,u.name FROM customer_assignment ca LEFT JOIN customer_alias al ON al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id WHERE ca.organization_id=? AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)`).bind(s.identity.organization_id,s.date,s.date).all<any>()).results;

 return rows.results.map(r=>({id:r.id,name:r.name,latitude_e7:r.latitude_e7,longitude_e7:r.longitude_e7,area_id:r.area_id,address:r.address,external_code:r.external_code,external_code_review:r.external_code_review,version:r.version,record_status:r.record_status,coordinate_status:r.coordinate_status,location_note:r.location_note,outlet_type:r.outlet_type,service_frequency_days:r.service_frequency_days,visit_window:r.visit_window,area:r.area.replace(/^Area /,''),field_rep_id:current.find(a=>a.customer_id===r.id&&a.channel==='field')?.rep_id||null,telesales_rep_id:current.find(a=>a.customer_id===r.id&&a.channel==='telesales')?.rep_id||null,telesales_owner:current.find(a=>a.customer_id===r.id&&a.channel==='telesales')?.name||'Belum assigned',owner:r.owner||'Belum assigned',status:segmentRows.find(x=>x.customer_id===r.id)?.status||'Unknown',tier:segmentRows.find(x=>x.customer_id===r.id)?.tier||'Belum tersedia',segmentation:segmentRows.find(x=>x.customer_id===r.id)||null,actual:r.actual/1000000,actual_minor:r.actual,last:r.last||'Belum pernah invoice',lat:r.latitude_e7===null?null:r.latitude_e7/1e7,lng:r.longitude_e7===null?null:r.longitude_e7/1e7}));

}

scopedRoutes.get('/api/customers',async c=>{

 let data=await readCustomers(c.env.DB,c.get('scope'));
 try{data=await filterGeoCustomers(c,data)}catch(e){const m=/^(403|404|409|412|422|503):(.+)$/.exec((e as Error).message);return c.json({code:m?.[2]||'GEOGRAPHY_UNAVAILABLE'},(m?Number(m[1]):503) as any)}

 const channel=c.req.query('channel')||'field',assignmentStatus=c.req.query('assignment_status');

 if(!['field','telesales'].includes(channel)||assignmentStatus&&!['assigned','unassigned'].includes(assignmentStatus))return c.json({code:'VALIDATION_ERROR'},422);

 if(assignmentStatus)data=data.filter(x=>Boolean(channel==='field'?x.field_rep_id:x.telesales_rep_id)===(assignmentStatus==='assigned'));

 const area=c.req.query('area_id'),owner=c.req.query('rep_id'),q=c.req.query('q');

 if(area){const scoped=await c.env.DB.prepare('SELECT name FROM area WHERE organization_id=? AND id=?').bind(c.get('identity').organization_id,area).first<{name:string}>();data=scoped?data.filter(x=>x.area===scoped.name.replace(/^Area /,'')):[]}

 if(owner){const s=c.get('scope');const ids=await c.env.DB.prepare('SELECT COALESCE((SELECT canonical_id FROM customer_alias al WHERE al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id),outlet_id) outlet_id FROM customer_assignment ca WHERE organization_id=? AND rep_id=? AND channel=? AND effective_from_date<=? AND (effective_to_date IS NULL OR effective_to_date>?)').bind(s.identity.organization_id,owner,channel,s.date,s.date).all<{outlet_id:string}>();data=data.filter(c=>ids.results.some(i=>i.outlet_id===c.id))}

 if(q)data=data.filter(x=>x.name.toLowerCase().includes(q.toLowerCase()));

 return c.json({data,meta:meta()});

});

scopedRoutes.get('/api/customers/:id',async c=>{const requested=c.req.param('id');const alias=await c.env.DB.prepare('SELECT canonical_id FROM customer_alias WHERE organization_id=? AND source_id=?').bind(c.get('identity').organization_id,requested).first<{canonical_id:string}>();const data=(await readCustomers(c.env.DB,c.get('scope'))).find(x=>x.id===(alias?.canonical_id||requested));if(data)c.header('ETag',`"${data.version}"`);return data?c.json({data,meta:{...meta(),requested_customer_id:requested,canonical_customer_id:data.id,alias_resolved:Boolean(alias)}}):c.json({code:'NOT_FOUND'},404)});

scopedRoutes.get('/api/dashboard',async c=>{

 const s=c.get('scope'),f=invoicePredicate(s);const customers=await readCustomers(c.env.DB,s);

 const rows=await c.env.DB.prepare(`SELECT i.channel,SUM(i.net_minor) amount,COUNT(DISTINCT i.rep_id) reps FROM invoice i WHERE ${f.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=? GROUP BY i.channel`).bind(...f.params,s.date.slice(0,7)+'-01',s.date).all<{channel:string;amount:number;reps:number}>();

 const firstMonth=new Date(s.date.slice(0,7)+'-01T00:00:00Z');firstMonth.setUTCMonth(firstMonth.getUTCMonth()-5);

 const history=await c.env.DB.prepare(`SELECT substr(i.invoice_date,1,7) month,SUM(i.net_minor) amount FROM invoice i WHERE ${f.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=? GROUP BY substr(i.invoice_date,1,7) ORDER BY month`).bind(...f.params,firstMonth.toISOString().slice(0,10),s.date).all<{month:string;amount:number}>();

 const trend=Array.from({length:6},(_,index)=>{const monthDate=new Date(firstMonth);monthDate.setUTCMonth(firstMonth.getUTCMonth()+index);const month=monthDate.toISOString().slice(0,7);return {month,actual_minor:history.results.find(x=>x.month===month)?.amount??0,target_minor:null}});

 const targetOverview=await targetSummary(c.env.DB,s,s.date.slice(0,7));const targetTotal=targetOverview.target_minor,targetActual=targetOverview.actual_minor;
 const customerCohort=customers.filter(x=>x.record_status==='active'),unknownCustomerCount=customerCohort.filter(x=>x.status==='Unknown').length;
 return c.json({data:{period:s.date.slice(0,7),trend,actual_net_minor:rows.results.reduce((a,r)=>a+r.amount,0),target_net_minor:targetTotal,target_needs_review:targetOverview.needs_review,achievement:targetTotal&&targetActual!==null&&!targetOverview.needs_review?targetActual/targetTotal*100:null,active_customer_count:unknownCustomerCount?null:customerCohort.filter(x=>x.status==='Aktif').length,customer_status_unknown_count:unknownCustomerCount,observed_active_customer_count:customerCohort.filter(x=>x.segmentation?.observed_status==='Aktif').length,sales_rep_count:rows.results.reduce((a,r)=>a+r.reps,0),channels:rows.results.map(r=>({channel:r.channel,actual_minor:r.amount,target_minor:null}))},meta:meta()});

});

scopedRoutes.get('/api/telesales/queue',async c=>{

 const s=c.get('scope');const data=await readCustomers(c.env.DB,s);

 const assigned=await c.env.DB.prepare(`SELECT COALESCE((SELECT canonical_id FROM customer_alias al WHERE al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id),outlet_id) outlet_id FROM customer_assignment ca WHERE organization_id=? AND channel='telesales' AND effective_from_date<=? AND (effective_to_date IS NULL OR effective_to_date>?)${s.orgWide||s.allRepsInArea?'':` AND rep_id IN (${s.repIds.map(()=>'?').join(',')})`}`).bind(s.identity.organization_id,s.date,s.date,...(s.orgWide||s.allRepsInArea?[]:s.repIds)).all<{outlet_id:string}>();

 // Contact preference support arrives with TEL work: no fabricated permission to call.

 return c.json({data:data.filter(c=>assigned.results.some(a=>a.outlet_id===c.id)).map(c=>({...c,dnc:null,contact_permission:'unknown'})),meta:meta()});

});

async function mapPayload(c:any){

 const s=c.get('scope') as Scope;let customers=await readCustomers(c.env.DB,s);

 const areaId=c.req.query('area_id'),repId=c.req.query('rep_id'),channel=c.req.query('channel')||'field',status=c.req.query('customer_status');

 if(!['field','telesales'].includes(channel))throw new Error('Invalid channel');

 if(areaId)customers=customers.filter(x=>x.area_id===areaId);

 if(repId)customers=customers.filter(x=>(channel==='field'?x.field_rep_id:x.telesales_rep_id)===repId);

 if(status)customers=customers.filter(x=>x.status===status);

 let sql='p.organization_id=?';const args=[s.identity.organization_id];

 if(!s.orgWide){

  if(s.allRepsInArea){sql+=` AND EXISTS(SELECT 1 FROM user_area_scope uas WHERE uas.organization_id=p.organization_id AND uas.user_id=p.user_id AND uas.area_id IN (${s.areaIds.map(()=>'?').join(',')||'NULL'}) AND uas.effective_from_date<=? AND (uas.effective_to_date IS NULL OR uas.effective_to_date>?))`;args.push(...s.areaIds,s.date,s.date)}

  else{sql+=` AND p.user_id IN (${s.repIds.map(()=>'?').join(',')})`;args.push(...s.repIds)}

 }

 if(repId){sql+=' AND p.user_id=?';args.push(repId)}

 if(areaId){sql+=' AND EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=p.organization_id AND a.user_id=p.user_id AND a.area_id=? AND a.effective_from_date<=? AND (a.effective_to_date IS NULL OR a.effective_to_date>?))';args.push(areaId,s.date,s.date)}

 if(c.req.query('channel')){sql+=' AND EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=p.organization_id AND r.user_id=p.user_id AND r.channel=? AND r.effective_from_date<=? AND (r.effective_to_date IS NULL OR r.effective_to_date>?))';args.push(channel,s.date,s.date)}

 const positions=await (c.env.DB as D1Database).prepare(`SELECT p.user_id id,u.name,p.latitude_e7,p.longitude_e7,p.captured_at last_seen,p.source,p.accuracy_m FROM sales_last_position p JOIN app_user u ON u.id=p.user_id AND u.organization_id=p.organization_id WHERE ${sql} AND u.status='active'`).bind(...args).all<{id:string;name:string;latitude_e7:number;longitude_e7:number;last_seen:string;source:string;accuracy_m:number|null}>();

 return {data:{total_customer_count:customers.length,missing_coordinates_count:customers.filter(x=>x.record_status!=='inactive'&&(x.lat===null||x.lng===null)).length,inactive_customer_count:customers.filter(x=>x.record_status==='inactive').length,all_customers:customers,customers:customers.filter(x=>x.record_status!=='inactive'&&x.lat!==null&&x.lng!==null),sales:positions.results.map((r:any)=>{const seconds=Math.floor((Date.now()-Date.parse(r.last_seen))/1000);return {id:r.id,name:r.name,lat:r.latitude_e7/1e7,lng:r.longitude_e7/1e7,last_seen:r.last_seen,source:r.source,accuracy_m:r.accuracy_m,age_seconds:Number.isFinite(seconds)&&seconds>=0?seconds:null,clock_status:!Number.isFinite(seconds)?'invalid':seconds<0?'future':'valid',position_state:'last_received'}}),basemap:{provider:c.env.MAP_TILE_URL?'custom_raster':'openfreemap',style_url:c.env.MAP_TILE_URL?null:'https://tiles.openfreemap.org/styles/positron',tile_url:c.env.MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:c.env.MAP_ATTRIBUTION||'© OpenStreetMap contributors',configured:Boolean(c.env.MAP_TILE_URL)}},meta:{...meta(),routing:false}};

}

scopedRoutes.get('/api/customers/:id/street-view',async c=>{
 c.header('Cache-Control','no-store');
 const predicate=customerPredicate(c.get('scope'));
 const customer=await c.env.DB.prepare('SELECT co.id,co.name,co.latitude_e7,co.longitude_e7 FROM customer_outlet co WHERE co.id=? AND co.merged_into_id IS NULL AND '+predicate.sql).bind(c.req.param('id'),...predicate.params).first<any>();
 if(!customer)return c.json({code:'NOT_FOUND'},404);
 if(customer.latitude_e7===null||customer.longitude_e7===null)return c.json({code:'CUSTOMER_COORDINATES_REQUIRED',detail:'Koordinat customer belum tersedia.'},422);
 const key=c.env.GOOGLE_MAPS_EMBED_API_KEY?.trim();
 if(!key)return c.json({code:'STREET_VIEW_NOT_CONFIGURED',detail:'Street View belum dikonfigurasi.'},503);
 const url=new URL('https://www.google.com/maps/embed/v1/streetview');
 url.search=new URLSearchParams({key,location:customer.latitude_e7/1e7+','+customer.longitude_e7/1e7,language:'id',radius:'50',fov:'90'}).toString();
 return c.json({data:{customer_id:customer.id,customer_name:customer.name,embed_url:url.toString()}});
});

scopedRoutes.get('/api/map',async c=>c.json(await mapPayload(c)));

scopedRoutes.get('/api/sales/last-positions',async c=>{const result=await mapPayload(c);return c.json({data:result.data.sales,meta:result.meta})});

scopedRoutes.route('/',invoices);

scopedRoutes.route('/',products);

scopedRoutes.route('/',assignments);

scopedRoutes.route('/',imports);

scopedRoutes.route('/',duplicates);

scopedRoutes.route('/',customerMasters);

scopedRoutes.route('/',masters);

scopedRoutes.route('/',people);

scopedRoutes.route('/',monitoring);
scopedRoutes.route('/',incentives);
scopedRoutes.route('/',segmentation);
scopedRoutes.route('/',targets);
scopedRoutes.route('/',workflows);
scopedRoutes.route('/',pipeline);
scopedRoutes.route('/',observability);
scopedRoutes.route('/',recovery);
scopedRoutes.route('/',boundaries);
scopedRoutes.route('/',createGeographyRoutes(mapPayload));
scopedRoutes.route('/',distribution);
scopedRoutes.route('/',regionalAnalytics);
scopedRoutes.route('/',customerRisk);
scopedRoutes.route('/',riskEvaluations);
scopedRoutes.route('/',workloadPolicies);
scopedRoutes.route('/',visitAgentRegistry);
scopedRoutes.route('/',agentQueueAdmin);
scopedRoutes.route('/',visitPlanning);
scopedRoutes.route('/',visitOperationalProfiles);
scopedRoutes.route('/',territoryScenarios);
app.route('/',scopedRoutes);

export async function runScheduled(env:Bindings){
 const jobs:[string,(db:D1Database,bucket?:R2Bucket)=>Promise<unknown>][]=[['visit-agent-ephemeral',db=>visitAgentMaintenance(db)],['segmentation',db=>dailySegmentation(db)],['sales-maintenance',(db,bucket)=>salesMaintenance(db,bucket)],['notifications',db=>notificationMaintenance(db)],['operational-reminders',db=>operationalReminders(db)],['report-retention',(db,bucket)=>reportMaintenance(db,bucket)]];
 let failed=false;
 // Isolate each checkpoint: a failed maintenance task must not hide outcomes of later jobs.
 for(const[name,work]of jobs){try{await measuredJob(name,env,work)}catch{failed=true}}
 if(failed)throw new Error('NYALES_SCHEDULED_CHECKPOINT_FAILED');
}
export default Object.assign(app,{scheduled:async(_event:ScheduledController,env:Bindings,ctx:ExecutionContext)=>{ctx.waitUntil(runScheduled(env))}});
