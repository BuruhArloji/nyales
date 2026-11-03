import {directoryDetails,referencePoints} from './point-directory';
import {visitOperationalProfiles} from './visit-operational-profiles';
import {createFirstAdminRoutes} from './first-admin';
import {hasBekasiDemoData,hasBekasiDemoReady,hasTrainingData} from './training-marker';
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
import{cachedJson,cacheStatus,scopeCacheKey,READ_MODEL_TTL_SECONDS,DASHBOARD_TTL_SECONDS}from'./cache';
import{readCustomerPage}from'./customer-page';
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
import {demoTerritoryFiles} from './demo-territory';
import {distribution} from './distribution';
import {createGeographyRoutes,filterGeoCustomers} from './geography';
import {applyBekasiOverlay,loadBekasiPointOverlay} from './bekasi-point-overlay';

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

type Bindings={DB:D1Database;APP_ENV:string;LOCAL_AUTH:string;FIREBASE_PROJECT_ID:string;FIRST_ADMIN_EMAIL?:string;FIRST_ADMIN_ORGANIZATION_NAME?:string;IMPORT_FILES?:R2Bucket;MAP_TILE_URL?:string;MAP_ATTRIBUTION?:string;GOOGLE_MAPS_EMBED_API_KEY?:string;OBS_OWNER_ORGANIZATION_ID?:string};

const app=new Hono<{Bindings:Bindings;Variables:{identity:Identity;scope:Scope;auth:SessionAuth;deviceSession:SessionEnv['Variables']['deviceSession']}}>();

app.onError((_err,c)=>{console.error('NYALES_API_UNHANDLED');return c.json({code:'INTERNAL_ERROR',request_id:c.res.headers.get('X-Request-ID')||null},500)});
app.route('/',demoTerritoryFiles);
app.use('/api/*',telemetry);
app.use('/api/*',httpSecurity);

app.get('/api/health',(c)=>c.json({name:'NYALES',status:'ok',environment:c.env.APP_ENV||'local',version:'0.1.0'}));

app.get('/api/auth/config',c=>c.json({mode:localAuthEnabled(c.env)?'local':'firebase',configured:localAuthEnabled(c.env)||Boolean(c.env.FIREBASE_PROJECT_ID),security:securityPolicy(localAuthEnabled(c.env))}));

// First-admin activation verifies its own Google identity and MFA before mapping exists.
app.route('/',createFirstAdminRoutes());

// Machine endpoints verify their own PoP identity before the user bearer/session gate.
app.route('/',visitAgentGateway);

app.use('/api/*',async(c,next)=>{

 c.header('Cache-Control','no-store');

 const token=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];

 if(!token)return c.json({code:'UNAUTHENTICATED',detail:'Login diperlukan.'},401);

 if(localAuthEnabled(c.env)&&token==='nyales-local-demo'){
  const identity=c.env.APP_ENV==='staging'?await c.env.DB.prepare("SELECT u.id,u.name,u.organization_id,r.role_code AS role,r.channel FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.status='active' AND r.role_code='MANAGEMENT' AND r.effective_from_date<=date('now','+7 hours') AND (r.effective_to_date IS NULL OR r.effective_to_date>date('now','+7 hours')) ORDER BY u.created_at,u.id LIMIT 1").first<Identity>():{id:'demo-management',name:'Dina Pratiwi',organization_id:'demo-org',role:'MANAGEMENT'};
  if(!identity)return c.json({code:'LOCAL_AUTH_OPERATOR_UNAVAILABLE'},503);
  c.set('identity',identity);c.set('auth',{subject:'local:demo-management',authTime:Math.floor(Date.now()/1000),mfa:false});await next();return;

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

 const isCustomerMaster=/^\/api\/(contacts)(\/|$)/.test(c.req.path)||(/^\/api\/customers(\/[^/]+)?$/.test(c.req.path)&&c.req.method!=='GET')||/^\/api\/customers\/[^/]+\/(timeline|street-view|directory-details)$/.test(c.req.path);

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

 if(!paths.includes(c.req.path)&&!/^\/api\/customers\/[^/]+(?:\/directory-details)?$/.test(c.req.path)&&!/^\/api\/point-directory\/[^/]+\/details\/[^/]+$/.test(c.req.path))return c.json({code:'NOT_FOUND'},404);

 if(c.req.path==='/api/telesales/queue'&&!c.get('scope').capabilities.includes('telesales:read'))return c.json({code:'SCOPE_DENIED'},403);

 await next();

});

scopedRoutes.onError((err,c)=>{console.error('NYALES request failed',err.name,String((err as Error).message||''),String((err as Error).stack||'').slice(0,900));return c.json({code:'DATA_UNAVAILABLE',detail:'Data tidak dapat dimuat. Coba lagi.'},503)});

function meta(){return {request_id:crypto.randomUUID(),server_time:new Date().toISOString(),source:'d1',validation_state:'provisional',freshness_state:'manual'}}

scopedRoutes.get('/api/me',async c=>{const s=c.get('scope');const demoData=localAuthEnabled(c.env)&&Boolean(await c.env.DB.prepare("SELECT id FROM master_audit WHERE organization_id=? AND resource_type='demo_fixture' AND resource_id='showcase-v1-' LIMIT 1").bind(s.identity.organization_id).first());const trainingData=c.env.APP_ENV==='staging'&&await hasTrainingData(c.env.DB,s.identity.organization_id);const bekasiDemoData=c.env.APP_ENV==='staging'&&await hasBekasiDemoData(c.env.DB,s.identity.organization_id);const bekasiDemoReady=c.env.APP_ENV==='staging'&&await hasBekasiDemoReady(c.env.DB,s.identity.organization_id);const directoryData=Boolean(await c.env.DB.prepare("SELECT id FROM point_directory_dataset WHERE organization_id=? AND status='ready' LIMIT 1").bind(s.identity.organization_id).first());return c.json({data:{...c.get('identity'),demo_data:demoData,training_data:trainingData,bekasi_demo_data:bekasiDemoData,bekasi_demo_ready:bekasiDemoReady,directory_data:directoryData,capabilities:s.capabilities,area_ids:s.areaIds,scope:s.orgWide?'organization':s.allRepsInArea?'area':'assigned'},meta:meta()})});

async function readCustomers(db:D1Database,s:Scope,customerId?:string){

 const filter=customerPredicate(s);const inv=invoicePredicate(s);
 const detail=customerId!==undefined;
 // Reject absent/out-of-scope details before loading any invoice or snapshot.
 // Keep the same scope and area join as the directory, including merged aliases.
 if(detail&&!await db.prepare(`SELECT co.id FROM customer_outlet co JOIN area a ON a.organization_id=co.organization_id AND a.id=co.area_id WHERE ${filter.sql} AND co.merged_into_id IS NULL AND co.id=?`).bind(...filter.params,customerId).first())return [];
 // UNION lets the identity and merged-family indexes each seek a bounded set.
 const familySql=detail?' AND child.id IN (SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND f.id=? UNION SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND f.merged_into_id=?)':'';
 const familyParams=detail?[s.identity.organization_id,customerId,s.identity.organization_id,customerId]:[];

 // Invoice aggregates use invoice ownership, not present-day customer owner; no duplicate join on assignments.

 const rows=await db.prepare(`WITH invoice_facts AS (
 SELECT COALESCE(child.merged_into_id,child.id) customer_id,MAX(i.invoice_date) last,
 SUM(CASE WHEN i.invoice_date>=? AND i.invoice_date<=? AND ${inv.sql} THEN i.net_minor ELSE 0 END) actual
 FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id
 WHERE i.organization_id=? AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=? ${familySql}
 GROUP BY COALESCE(child.merged_into_id,child.id)
 ), field_owners AS (
 SELECT COALESCE(child.merged_into_id,child.id) customer_id,u.name,
 ROW_NUMBER() OVER(PARTITION BY COALESCE(child.merged_into_id,child.id) ORDER BY ca.effective_from_date DESC,ca.id) rank
 FROM customer_assignment ca JOIN customer_outlet child ON child.organization_id=ca.organization_id AND child.id=ca.outlet_id
 JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id
 WHERE ca.organization_id=? AND ca.channel='field' AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?) ${familySql}
 ) SELECT co.id,co.name,a.name area,co.latitude_e7,co.longitude_e7,co.area_id,co.address,co.external_code,co.external_code_review,co.version,co.record_status,co.coordinate_status,co.location_note,co.outlet_type,co.service_frequency_days,co.visit_window,co.directory_dataset_id,co.transaction_history_unverified,
 owner.name owner,facts.last,COALESCE(facts.actual,0) actual FROM customer_outlet co
 JOIN area a ON a.organization_id=co.organization_id AND a.id=co.area_id
 LEFT JOIN invoice_facts facts ON facts.customer_id=co.id
 LEFT JOIN field_owners owner ON owner.customer_id=co.id AND owner.rank=1
 WHERE ${filter.sql} AND co.merged_into_id IS NULL ${detail?'AND co.id=?':''} ORDER BY co.name`).bind(s.date.slice(0,7)+'-01',s.date,...inv.params,s.identity.organization_id,s.date,...familyParams,s.identity.organization_id,s.date,s.date,...familyParams,...filter.params,...(detail?[customerId]:[])).all<{id:string;name:string;area:string;latitude_e7:number|null;longitude_e7:number|null;owner:string|null;last:string|null;actual:number;area_id:string;address:string|null;external_code:string|null;external_code_review:number;version:number;record_status:string;coordinate_status:string;location_note:string;outlet_type:string;service_frequency_days:number|null;visit_window:string;directory_dataset_id:string|null;transaction_history_unverified:number}>();

 const segmentRun=await segmentationSnapshot(db,s.identity.organization_id,s.date);const segmentRows=(await db.prepare('SELECT customer_id,status,tier,provisional,observed_status,cutoff,rule_id,rule_version FROM customer_status_snapshot WHERE run_id=?'+(detail?' AND customer_id=?':'')).bind(segmentRun.id,...(detail?[customerId]:[])).all<any>()).results;
 const segmentsByCustomer=new Map(segmentRows.map(r=>[r.customer_id,r]));
 const current=(await db.prepare(`SELECT COALESCE(al.canonical_id,ca.outlet_id) customer_id,ca.rep_id,ca.channel,u.name FROM customer_assignment ca LEFT JOIN customer_alias al ON al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id WHERE ca.organization_id=? AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?) ${detail?'AND ca.outlet_id IN (SELECT ? UNION SELECT source_id FROM customer_alias WHERE organization_id=? AND canonical_id=?) AND COALESCE(al.canonical_id,ca.outlet_id)=?':''}`).bind(s.identity.organization_id,s.date,s.date,...(detail?[customerId,s.identity.organization_id,customerId,customerId]:[])).all<any>()).results;

 const ownersByCustomer=new Map<string,any[]>();for(const assignment of current){const list=ownersByCustomer.get(assignment.customer_id)||[];list.push(assignment);ownersByCustomer.set(assignment.customer_id,list)}
 return rows.results.map(r=>({id:r.id,name:r.name,latitude_e7:r.latitude_e7,longitude_e7:r.longitude_e7,area_id:r.area_id,address:r.address,external_code:r.external_code,external_code_review:r.external_code_review,version:r.version,record_status:r.record_status,coordinate_status:r.coordinate_status,location_note:r.location_note,outlet_type:r.outlet_type,service_frequency_days:r.service_frequency_days,visit_window:r.visit_window,directory_dataset_id:r.directory_dataset_id,transaction_history_unverified:Boolean(r.transaction_history_unverified),area:r.area.replace(/^Area /,''),field_rep_id:ownersByCustomer.get(r.id)?.find(a=>a.channel==='field')?.rep_id||null,telesales_rep_id:ownersByCustomer.get(r.id)?.find(a=>a.channel==='telesales')?.rep_id||null,telesales_owner:ownersByCustomer.get(r.id)?.find(a=>a.channel==='telesales')?.name||'Belum assigned',owner:r.owner||'Belum assigned',status:segmentsByCustomer.get(r.id)?.status||'Unknown',tier:segmentsByCustomer.get(r.id)?.tier||'Belum tersedia',segmentation:segmentsByCustomer.get(r.id)||null,actual:r.actual/1000000,actual_minor:r.actual,last:r.last||'Belum pernah invoice',lat:r.latitude_e7===null?null:r.latitude_e7/1e7,lng:r.longitude_e7===null?null:r.longitude_e7/1e7}));

}

/** Cached per authorization scope: dashboard, customer list, map and queue all read the same model. */
async function loadCustomers(c:any){
 const s=c.get('scope') as Scope;
 return cachedJson(c,scopeCacheKey(s,'customers'),READ_MODEL_TTL_SECONDS,()=>readCustomers(c.env.DB,s));
 }

scopedRoutes.get('/api/customers',async c=>{

 // Paged directory: filters, ordering and the count run inside SQLite so a list
 // page reads ~100 customers instead of the whole population.
 const paged=c.req.query('limit');
 const geoDrill=c.req.query('geo_boundary_id')||c.req.query('geo_bucket')||c.req.query('geo_dataset_id');
 if(paged&&!geoDrill){
   const limit=Number(paged),offset=Number(c.req.query('offset')||0);
   const channel=c.req.query('channel')||'field',assignmentStatus=c.req.query('assignment_status');
   if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0)return c.json({code:'VALIDATION_ERROR'},422);
   if(!['field','telesales'].includes(channel)||assignmentStatus&&!['assigned','unassigned'].includes(assignmentStatus))return c.json({code:'VALIDATION_ERROR'},422);
   const page=await readCustomerPage(c.env.DB,c.get('scope'),{
     limit,offset,q:c.req.query('q')||'',areaId:c.req.query('area_id')||'',repId:c.req.query('rep_id')||'',
     channel:channel as 'field'|'telesales',assignmentStatus:assignmentStatus as 'assigned'|'unassigned'|undefined,
     status:c.req.query('status')||'',recordStatus:c.req.query('record_status')||'',location:c.req.query('location')||'',
   });
   return c.json({data:page.rows,meta:{...meta(),total:page.total,limit:page.limit,offset:page.offset}});
 }

 const cached=await loadCustomers(c);c.header('X-NYALES-Cache',cacheStatus(cached));let data=cached.value;
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

scopedRoutes.get('/api/customers/:id',async c=>{const requested=c.req.param('id');const alias=await c.env.DB.prepare('SELECT canonical_id FROM customer_alias WHERE organization_id=? AND source_id=?').bind(c.get('identity').organization_id,requested).first<{canonical_id:string}>();const data=(await readCustomers(c.env.DB,c.get('scope'),alias?.canonical_id||requested))[0];if(data)c.header('ETag',`"${data.version}"`);return data?c.json({data,meta:{...meta(),requested_customer_id:requested,canonical_customer_id:data.id,alias_resolved:Boolean(alias)}}):c.json({code:'NOT_FOUND'},404)});

scopedRoutes.get('/api/dashboard',async c=>{
 const s=c.get('scope') as Scope;
 const cached=await cachedJson(c,scopeCacheKey(s,'dashboard'),DASHBOARD_TTL_SECONDS,()=>buildDashboard(c,s));
 c.header('X-NYALES-Cache',cacheStatus(cached));
 return c.json({data:cached.value,meta:meta()});
});

async function buildDashboard(c:any,s:Scope){
 const db=c.env.DB as D1Database;
 const f=invoicePredicate(s);const customers=(await loadCustomers(c)).value;

 const rows=await db.prepare(`SELECT i.channel,SUM(i.net_minor) amount,COUNT(DISTINCT i.rep_id) reps FROM invoice i WHERE ${f.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=? GROUP BY i.channel`).bind(...f.params,s.date.slice(0,7)+'-01',s.date).all<{channel:string;amount:number;reps:number}>();

 const firstMonth=new Date(s.date.slice(0,7)+'-01T00:00:00Z');firstMonth.setUTCMonth(firstMonth.getUTCMonth()-5);

 const history=await db.prepare(`SELECT substr(i.invoice_date,1,7) month,SUM(i.net_minor) amount FROM invoice i WHERE ${f.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=? GROUP BY substr(i.invoice_date,1,7) ORDER BY month`).bind(...f.params,firstMonth.toISOString().slice(0,10),s.date).all<{month:string;amount:number}>();

 const trend=Array.from({length:6},(_,index)=>{const monthDate=new Date(firstMonth);monthDate.setUTCMonth(firstMonth.getUTCMonth()+index);const month=monthDate.toISOString().slice(0,7);return {month,actual_minor:history.results.find((x:any)=>x.month===month)?.amount??0,target_minor:null}});

 const targetOverview=await targetSummary(c.env.DB,s,s.date.slice(0,7));const targetTotal=targetOverview.target_minor,targetActual=targetOverview.actual_minor;
 const customerCohort=customers.filter((x:any)=>x.record_status==='active'),unknownCustomerCount=customerCohort.filter((x:any)=>x.status==='Unknown').length;
 return {period:s.date.slice(0,7),trend,actual_net_minor:rows.results.reduce((a:number,r:any)=>a+r.amount,0),target_net_minor:targetTotal,target_needs_review:targetOverview.needs_review,achievement:targetTotal&&targetActual!==null&&!targetOverview.needs_review?targetActual/targetTotal*100:null,active_customer_count:unknownCustomerCount?null:customerCohort.filter((x:any)=>x.status==='Aktif').length,customer_status_unknown_count:unknownCustomerCount,observed_active_customer_count:customerCohort.filter((x:any)=>x.segmentation?.observed_status==='Aktif').length,sales_rep_count:rows.results.reduce((a:number,r:any)=>a+r.reps,0),channels:rows.results.map((r:any)=>({channel:r.channel,actual_minor:r.amount,target_minor:null}))};
}

scopedRoutes.get('/api/telesales/queue',async c=>{

 const s=c.get('scope');const cached=await loadCustomers(c);c.header('X-NYALES-Cache',cacheStatus(cached));const data=cached.value;

 const assigned=await c.env.DB.prepare(`SELECT COALESCE((SELECT canonical_id FROM customer_alias al WHERE al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id),outlet_id) outlet_id FROM customer_assignment ca WHERE organization_id=? AND channel='telesales' AND effective_from_date<=? AND (effective_to_date IS NULL OR effective_to_date>?)${s.orgWide||s.allRepsInArea?'':` AND rep_id IN (${s.repIds.map(()=>'?').join(',')})`}`).bind(s.identity.organization_id,s.date,s.date,...(s.orgWide||s.allRepsInArea?[]:s.repIds)).all<{outlet_id:string}>();

 // Contact preference support arrives with TEL work: no fabricated permission to call.

 return c.json({data:data.filter(c=>assigned.results.some(a=>a.outlet_id===c.id)).map(c=>({...c,dnc:null,contact_permission:'unknown'})),meta:meta()});

});

async function mapPayload(c:any){

 const s=c.get('scope') as Scope;const cachedCustomers=await loadCustomers(c);c.header('X-NYALES-Cache',cacheStatus(cachedCustomers));let customers=cachedCustomers.value;

 const areaId=c.req.query('area_id'),repId=c.req.query('rep_id'),channel=c.req.query('channel')||'field',status=c.req.query('customer_status');

 if(!['field','telesales'].includes(channel))throw new Error('Invalid channel');

 const overlayRows=cachedCustomers.value.map(row=>({...row,organization_id:s.identity.organization_id}));
 const overlay=await loadBekasiPointOverlay(c.env.DB,s.identity.organization_id,overlayRows,{areaId,repId,channel,status},c.env.APP_ENV);
 const overlaid=overlay.enabled?applyBekasiOverlay(cachedCustomers.value,overlay.links,overlay.metrics,{areaId,repId,channel,status}):{allCustomers:cachedCustomers.value,linkedDemoCustomerCount:0};
 const rawOverlaid=overlaid.allCustomers;

 if(areaId)customers=customers.filter(x=>x.area_id===areaId);

 if(repId)customers=customers.filter(x=>(channel==='field'?x.field_rep_id:x.telesales_rep_id)===repId);

 if(status)customers=customers.filter(x=>x.status===status);

 const filteredAll=rawOverlaid.filter((x:any)=>(!areaId||x.area_id===areaId)&&(!repId||(channel==='field'?x.field_rep_id:x.telesales_rep_id)===repId)&&(!status||x.status===status));
 const enrichedById=new Map(rawOverlaid.map((x:any)=>[x.id,x]));
 const ordinaryMap=customers.filter((x:any)=>x.record_status!=='inactive'&&x.lat!==null&&x.lng!==null).map((x:any)=>enrichedById.get(x.id)||x);
 const mapIds=new Set(ordinaryMap.map((x:any)=>x.id));
 const mapCustomers=[...ordinaryMap,...rawOverlaid.filter((x:any)=>x.demo_operation_overlay&&!mapIds.has(x.id)&&x.record_status!=='inactive'&&x.lat!==null&&x.lng!==null)];

 let sql='p.organization_id=?';const args=[s.identity.organization_id];

 if(!s.orgWide){

  if(s.allRepsInArea){sql+=` AND EXISTS(SELECT 1 FROM user_area_scope uas WHERE uas.organization_id=p.organization_id AND uas.user_id=p.user_id AND uas.area_id IN (${s.areaIds.map(()=>'?').join(',')||'NULL'}) AND uas.effective_from_date<=? AND (uas.effective_to_date IS NULL OR uas.effective_to_date>?))`;args.push(...s.areaIds,s.date,s.date)}

  else{sql+=` AND p.user_id IN (${s.repIds.map(()=>'?').join(',')})`;args.push(...s.repIds)}

 }

 if(repId){sql+=' AND p.user_id=?';args.push(repId)}

 if(areaId){sql+=' AND EXISTS(SELECT 1 FROM user_area_scope a WHERE a.organization_id=p.organization_id AND a.user_id=p.user_id AND a.area_id=? AND a.effective_from_date<=? AND (a.effective_to_date IS NULL OR a.effective_to_date>?))';args.push(areaId,s.date,s.date)}

 if(c.req.query('channel')){sql+=' AND EXISTS(SELECT 1 FROM auth_role_assignment r WHERE r.organization_id=p.organization_id AND r.user_id=p.user_id AND r.channel=? AND r.effective_from_date<=? AND (r.effective_to_date IS NULL OR r.effective_to_date>?))';args.push(channel,s.date,s.date)}

 const reference=await referencePoints(c);
 const positions=await (c.env.DB as D1Database).prepare(`SELECT p.user_id id,u.name,p.latitude_e7,p.longitude_e7,p.captured_at last_seen,p.source,p.accuracy_m FROM sales_last_position p JOIN app_user u ON u.id=p.user_id AND u.organization_id=p.organization_id WHERE ${sql} AND u.status='active'`).bind(...args).all<{id:string;name:string;latitude_e7:number;longitude_e7:number;last_seen:string;source:string;accuracy_m:number|null}>();

 return {data:{reference_points:reference.points,reference_point_count:reference.total,reference_scope_note:reference.scope_note,total_customer_count:customers.length,missing_coordinates_count:customers.filter(x=>x.record_status!=='inactive'&&(x.lat===null||x.lng===null)).length,inactive_customer_count:customers.filter(x=>x.record_status==='inactive').length,all_customers:filteredAll,customers:mapCustomers,demo_operation_overlay_count:mapCustomers.filter((x:any)=>x.demo_operation_overlay).length,linked_demo_customer_count:filteredAll.filter((x:any)=>x.demo_point_link&&(x.lat===null||x.lng===null)).length,demo_operation_overlay_note:overlay.enabled?'DEMO: operasi sintetis ditempel pada titik customer existing; tidak ada titik peta tambahan.':undefined,sales:positions.results.map((r:any)=>{const seconds=Math.floor((Date.now()-Date.parse(r.last_seen))/1000);return {id:r.id,name:r.name,lat:r.latitude_e7/1e7,lng:r.longitude_e7/1e7,last_seen:r.last_seen,source:r.source,accuracy_m:r.accuracy_m,age_seconds:Number.isFinite(seconds)&&seconds>=0?seconds:null,clock_status:!Number.isFinite(seconds)?'invalid':seconds<0?'future':'valid',position_state:'last_received'}}),basemap:{provider:c.env.MAP_TILE_URL?'custom_raster':'openfreemap',style_url:c.env.MAP_TILE_URL?null:'https://tiles.openfreemap.org/styles/positron',tile_url:c.env.MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:c.env.MAP_ATTRIBUTION||'Â© OpenStreetMap contributors',configured:Boolean(c.env.MAP_TILE_URL)}},meta:{...meta(),routing:false}};

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

scopedRoutes.get('/api/customers/:id/directory-details',async c=>{
 const predicate=customerPredicate(c.get('scope'));
 const customer=await c.env.DB.prepare('SELECT co.id,co.external_code,co.directory_dataset_id FROM customer_outlet co WHERE co.id=? AND co.merged_into_id IS NULL AND '+predicate.sql).bind(c.req.param('id'),...predicate.params).first<any>();
 if(!customer?.directory_dataset_id||!customer.external_code)return c.json({code:'DIRECTORY_DETAILS_UNAVAILABLE'},404);
 const detail=await directoryDetails(c,customer.directory_dataset_id,customer.external_code);
 return detail?c.json({data:{...detail,reference_only:false}}):c.json({code:'DIRECTORY_DETAIL_NOT_FOUND'},404);
});

scopedRoutes.get('/api/point-directory/:dataset/details/:external_code',async c=>{
 if(!c.get('scope').orgWide)return c.json({code:'SCOPE_DENIED'},403);
 const detail=await directoryDetails(c,c.req.param('dataset'),c.req.param('external_code'),true);
 return detail?c.json({data:{...detail,reference_only:true}}):c.json({code:'DIRECTORY_DETAIL_NOT_FOUND'},404);
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
