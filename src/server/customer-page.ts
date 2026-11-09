// Server-side paged customer directory.
//
// The full read model (readCustomers) scans every customer plus the whole
// segmentation snapshot. A list page only ever shows one page, so this module
// filters, counts and pages inside SQLite, then loads snapshot/assignment/
// invoice facts for the page's ids only.
import type {Scope} from './scope';
import {customerPredicate, invoicePredicate} from './scope';
import {segmentationSnapshot} from './segmentation';
import {cachedJson,scopeCacheKey,readModelRevision} from './cache';

const MAX_PAGE=200;

export type CustomerPageQuery={
  limit?:number;
  offset?:number;
  q?:string;
  areaId?:string;
  repId?:string;
  channel?:'field'|'telesales';
  assignmentStatus?:'assigned'|'unassigned';
  status?:string;
  recordStatus?:string;
  location?:string;
  projection?:'assignment';
};

export type CustomerPage={rows:any[];total:number;limit:number;offset:number};

const ACTIVE_ASSIGNMENT=`ca.channel=? AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)`;
const assignmentExists=(extra='')=>`EXISTS (SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=co.organization_id AND ca.outlet_id IN (SELECT co.id UNION SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND f.merged_into_id=co.id) AND ${ACTIVE_ASSIGNMENT}${extra})`;

export async function readCustomerPage(db:D1Database,s:Scope,q:CustomerPageQuery,context?:any):Promise<CustomerPage>{
  const org=s.identity.organization_id;
  const limit=Math.min(MAX_PAGE,Math.max(1,Math.floor(q.limit??100)));
  const offset=Math.max(0,Math.floor(q.offset??0));
  const assignmentOnly=q.projection==='assignment';
  const run=assignmentOnly?null:await segmentationSnapshot(db,org,s.date);

  const filter=customerPredicate(s);
  const where:string[]=[filter.sql,'co.merged_into_id IS NULL'];
  const params:any[]=[...filter.params];

  if(q.q?.trim()){
    const like='%'+q.q.trim().toLowerCase()+'%';
    where.push(`(lower(co.name) LIKE ? OR lower(co.id) LIKE ? OR lower(COALESCE(co.external_code,'')) LIKE ? OR lower(COALESCE(co.address,'')) LIKE ?)`);
    params.push(like,like,like,like);
  }
  if(q.areaId){where.push('co.area_id=?');params.push(q.areaId)}
  const relationshipFilter=q.status==='Leads'||q.status==='Pernah bertransaksi'||q.status==='Diverifikasi manual',historyScope=invoicePredicate(s);
  if(relationshipFilter)where.push(q.status==='Leads'?'history.customer_id IS NULL':'history.customer_id IS NOT NULL');
  else if(q.status){where.push("CASE WHEN recent.customer_id IS NOT NULL THEN 'Aktif' ELSE COALESCE(ss.status,'Unknown') END=?");params.push(q.status)}
  if(q.recordStatus){where.push('co.record_status=?');params.push(q.recordStatus)}
  if(q.location){
    if(q.location==='missing')where.push('(co.latitude_e7 IS NULL OR co.longitude_e7 IS NULL)');
    else{where.push('co.coordinate_status=?');params.push(q.location)}
  }
  const channel=q.channel==='telesales'?'telesales':'field';
  if(q.repId){where.push(assignmentExists(' AND ca.rep_id=?'));params.push(channel,s.date,s.date,q.repId)}
  if(q.assignmentStatus){
    where.push(q.assignmentStatus==='assigned'?assignmentExists():`NOT ${assignmentExists()}`);
    params.push(channel,s.date,s.date);
  }

  const from=`FROM customer_outlet co
    JOIN area a ON a.organization_id=co.organization_id AND a.id=co.area_id
    ${assignmentOnly?'':`LEFT JOIN customer_status_snapshot ss ON ss.run_id=? AND ss.customer_id=co.id LEFT JOIN (SELECT DISTINCT COALESCE(child.merged_into_id,child.id) customer_id FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id WHERE i.organization_id=? AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<=?) recent ON recent.customer_id=co.id`}
    ${relationshipFilter?`LEFT JOIN (SELECT DISTINCT COALESCE(child.merged_into_id,child.id) customer_id FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id WHERE ${historyScope.sql} AND i.is_current=1 AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=?) history ON history.customer_id=co.id`:''}
    WHERE ${where.join(' AND ')}`;

  const fromParams=[...(run?[run.id,org,new Date(Date.parse(s.date)-90*86400000).toISOString().slice(0,10),s.date]:[]),...(relationshipFilter?[...historyScope.params,s.date]:[]),...params];
  const count=async()=>(await db.prepare(`SELECT COUNT(*) n ${from}`).bind(...fromParams).first<{n:number}>())?.n||0;
  // One exact total per filter/revision, shared across pages; authorization was
  // resolved for this request before looking up the cache. No cached page rows.
  const total=context?(await cachedJson(context,scopeCacheKey(s,'customer-count',JSON.stringify([await readModelRevision(context),from,fromParams])),30,count)).value:await count();
  const columns=assignmentOnly?'co.id,co.name,a.name area,co.area_id,co.external_code,co.version,co.record_status':'co.id,co.name,a.name area,co.latitude_e7,co.longitude_e7,co.area_id,co.address,co.external_code,co.external_code_review,co.version,co.record_status,co.coordinate_status,co.location_note,co.outlet_type,co.service_frequency_days,co.visit_window,co.directory_dataset_id,co.transaction_history_unverified,recent.customer_id recent_invoice_id';
  const page=await db.prepare(`SELECT ${columns} ${from} ORDER BY co.name COLLATE NOCASE,co.id LIMIT ? OFFSET ?`).bind(...fromParams,limit,offset).all<any>();

  const ids=page.results.map((row:any)=>row.id);
  if(!ids.length)return{rows:[],total,limit,offset};

  const segmentRows=run?(await db.prepare(`SELECT customer_id,status,tier,provisional,observed_status,cutoff,rule_id,rule_version FROM customer_status_snapshot WHERE run_id=? AND customer_id IN (SELECT value FROM json_each(?))`).bind(run.id,JSON.stringify(ids)).all<any>()).results:[];

  const assignmentRows=(await db.prepare(`SELECT COALESCE(al.canonical_id,ca.outlet_id) customer_id,ca.rep_id,ca.channel,u.name
    FROM customer_assignment ca
    LEFT JOIN customer_alias al ON al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id
    JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id
    WHERE ca.organization_id=?
      AND ca.outlet_id IN (SELECT value FROM json_each(?)
        UNION SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND f.merged_into_id IN (SELECT value FROM json_each(?)))
      AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)`).bind(org,JSON.stringify(ids),org,JSON.stringify(ids),s.date,s.date).all<any>()).results;

  const inv=invoicePredicate(s);
  const factRows=assignmentOnly?[]:(await db.prepare(`WITH facts AS (
      SELECT COALESCE(child.merged_into_id,child.id) customer_id,MAX(i.invoice_date) last,
             SUM(i.net_minor) actual
      FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id
      WHERE ${inv.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=?
        AND i.outlet_id IN (SELECT value FROM json_each(?) UNION
          SELECT f.id FROM customer_outlet f INDEXED BY customer_family WHERE f.organization_id=? AND f.merged_into_id IN (SELECT value FROM json_each(?)))
      GROUP BY COALESCE(child.merged_into_id,child.id)
    ) SELECT customer_id,last,actual FROM facts WHERE customer_id IN (SELECT value FROM json_each(?))`).bind(...inv.params,s.date,JSON.stringify(ids),org,JSON.stringify(ids),JSON.stringify(ids)).all<any>()).results;

  const segments=new Map(segmentRows.map((row:any)=>[row.customer_id,row]));
  const facts=new Map(factRows.map((row:any)=>[row.customer_id,row]));
  const owners=new Map<string,any[]>();
  for(const row of assignmentRows){
    const list=owners.get(row.customer_id)||[];
    list.push(row);
    owners.set(row.customer_id,list);
  }

  return{
    total,limit,offset,
    rows:page.results.map((r:any)=>{
      const segment=segments.get(r.id);
      const fact=facts.get(r.id) as any;
      const owner=owners.get(r.id)||[];
      if(assignmentOnly)return{
        id:r.id,name:r.name,area_id:r.area_id,area:String(r.area||'').replace(/^Area /,''),
        external_code:r.external_code,version:r.version,record_status:r.record_status,
        field_rep_id:owner.find(x=>x.channel==='field')?.rep_id||null,
        telesales_rep_id:owner.find(x=>x.channel==='telesales')?.rep_id||null,
        owner:owner.find(x=>x.channel==='field')?.name||'Belum assigned',
        telesales_owner:owner.find(x=>x.channel==='telesales')?.name||'Belum assigned',
      };
      return{
        id:r.id,name:r.name,latitude_e7:r.latitude_e7,longitude_e7:r.longitude_e7,area_id:r.area_id,address:r.address,
        external_code:r.external_code,external_code_review:r.external_code_review,version:r.version,record_status:r.record_status,
        coordinate_status:r.coordinate_status,location_note:r.location_note,outlet_type:r.outlet_type,
        service_frequency_days:r.service_frequency_days,visit_window:r.visit_window,directory_dataset_id:r.directory_dataset_id,
        transaction_history_unverified:Boolean(r.transaction_history_unverified),
        area:String(r.area||'').replace(/^Area /,''),
        field_rep_id:owner.find(x=>x.channel==='field')?.rep_id||null,
        telesales_rep_id:owner.find(x=>x.channel==='telesales')?.rep_id||null,
        telesales_owner:owner.find(x=>x.channel==='telesales')?.name||'Belum assigned',
        owner:owner.find(x=>x.channel==='field')?.name||'Belum assigned',
        status:r.recent_invoice_id?'Aktif':segment?.status||'Unknown',tier:segment?.tier||'Belum tersedia',segmentation:segment||null,
        has_invoice_history:Boolean(fact?.last),actual:(fact?.actual||0)/1000000,actual_minor:fact?.actual||0,last:fact?.last||'Belum pernah invoice',
        lat:r.latitude_e7===null?null:r.latitude_e7/1e7,lng:r.longitude_e7===null?null:r.longitude_e7/1e7,
      };
    }),
  };
}
