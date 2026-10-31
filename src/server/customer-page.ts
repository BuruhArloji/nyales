// Server-side paged customer directory.
//
// The full read model (readCustomers) scans every customer plus the whole
// segmentation snapshot. A list page only ever shows one page, so this module
// filters, counts and pages inside SQLite, then loads snapshot/assignment/
// invoice facts for the page's ids only.
import type {Scope} from './scope';
import {customerPredicate, invoicePredicate} from './scope';
import {segmentationSnapshot} from './segmentation';

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
};

export type CustomerPage={rows:any[];total:number;limit:number;offset:number};

const ACTIVE_ASSIGNMENT=`ca.channel=? AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)`;
const assignmentExists=(extra='')=>`EXISTS (SELECT 1 FROM customer_assignment ca WHERE ca.organization_id=co.organization_id AND ca.outlet_id IN (SELECT f.id FROM customer_outlet f WHERE f.organization_id=co.organization_id AND (f.id=co.id OR f.merged_into_id=co.id)) AND ${ACTIVE_ASSIGNMENT}${extra})`;

export async function readCustomerPage(db:D1Database,s:Scope,q:CustomerPageQuery):Promise<CustomerPage>{
  const org=s.identity.organization_id;
  const limit=Math.min(MAX_PAGE,Math.max(1,Math.floor(q.limit??100)));
  const offset=Math.max(0,Math.floor(q.offset??0));
  const run=await segmentationSnapshot(db,org,s.date);

  const filter=customerPredicate(s);
  const where:string[]=[filter.sql,'co.merged_into_id IS NULL'];
  const params:any[]=[...filter.params];

  if(q.q?.trim()){
    const like='%'+q.q.trim().toLowerCase()+'%';
    where.push(`(lower(co.name) LIKE ? OR lower(co.id) LIKE ? OR lower(COALESCE(co.external_code,'')) LIKE ? OR lower(COALESCE(co.address,'')) LIKE ?)`);
    params.push(like,like,like,like);
  }
  if(q.areaId){where.push('co.area_id=?');params.push(q.areaId)}
  if(q.status){where.push('ss.status=?');params.push(q.status)}
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
    LEFT JOIN customer_status_snapshot ss ON ss.run_id=? AND ss.customer_id=co.id
    WHERE ${where.join(' AND ')}`;

  const total=(await db.prepare(`SELECT COUNT(*) n ${from}`).bind(run.id,...params).first<{n:number}>())?.n||0;
  const page=await db.prepare(`SELECT co.id,co.name,a.name area,co.latitude_e7,co.longitude_e7,co.area_id,co.address,co.external_code,co.external_code_review,co.version,co.record_status,co.coordinate_status,co.location_note,co.outlet_type,co.service_frequency_days,co.visit_window,co.directory_dataset_id,co.transaction_history_unverified ${from} ORDER BY co.name COLLATE NOCASE,co.id LIMIT ? OFFSET ?`).bind(run.id,...params,limit,offset).all<any>();

  const ids=page.results.map((row:any)=>row.id);
  if(!ids.length)return{rows:[],total,limit,offset};

  const marks=ids.map(()=>'?').join(',');

  const segmentRows=(await db.prepare(`SELECT customer_id,status,tier,provisional,observed_status,cutoff,rule_id,rule_version FROM customer_status_snapshot WHERE run_id=? AND customer_id IN (${marks})`).bind(run.id,...ids).all<any>()).results;

  const assignmentRows=(await db.prepare(`SELECT COALESCE(al.canonical_id,ca.outlet_id) customer_id,ca.rep_id,ca.channel,u.name
    FROM customer_assignment ca
    LEFT JOIN customer_alias al ON al.organization_id=ca.organization_id AND al.source_id=ca.outlet_id
    JOIN app_user u ON u.organization_id=ca.organization_id AND u.id=ca.rep_id
    WHERE ca.organization_id=? AND ca.outlet_id IN (SELECT f.id FROM customer_outlet f WHERE f.organization_id=? AND (f.id IN (${marks}) OR f.merged_into_id IN (${marks})))
      AND ca.effective_from_date<=? AND (ca.effective_to_date IS NULL OR ca.effective_to_date>?)`).bind(org,org,...ids,...ids,s.date,s.date).all<any>()).results;

  const inv=invoicePredicate(s);
  const factRows=(await db.prepare(`WITH facts AS (
      SELECT COALESCE(child.merged_into_id,child.id) customer_id,MAX(i.invoice_date) last,
             SUM(i.net_minor) actual
      FROM invoice i JOIN customer_outlet child ON child.organization_id=i.organization_id AND child.id=i.outlet_id
      WHERE ${inv.sql} AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date<=?
      GROUP BY COALESCE(child.merged_into_id,child.id)
    ) SELECT customer_id,last,actual FROM facts WHERE customer_id IN (${marks})`).bind(...inv.params,s.date,...ids).all<any>()).results;

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
        status:segment?.status||'Unknown',tier:segment?.tier||'Belum tersedia',segmentation:segment||null,
        actual:(fact?.actual||0)/1000000,actual_minor:fact?.actual||0,last:fact?.last||'Belum pernah invoice',
        lat:r.latitude_e7===null?null:r.latitude_e7/1e7,lng:r.longitude_e7===null?null:r.longitude_e7/1e7,
      };
    }),
  };
}