import {invoicePredicate,type Scope} from './scope';

export function mapPeriod(period:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('INVALID_PERIOD');
 const start=period+'-01',next=new Date(start+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 return {start,end:next.toISOString().slice(0,10)};
}

/** Only enrich already-authorized canonical customers; invoice ownership remains historical. */
export async function readMapMetrics(db:D1Database,scope:Scope,ids:string[],period:string,channel:string,repId?:string,areaId?:string){
 const {start,end}=mapPeriod(period),result=new Map<string,any>();if(!ids.length)return result;
 const inv=invoicePredicate(scope),org=scope.identity.organization_id,json=JSON.stringify(ids);
 const filter=`${inv.sql} AND i.channel=?`+(repId?' AND i.rep_id=?':'')+(areaId?' AND i.area_id=?':'');
 const invoices=(await db.prepare(`SELECT COALESCE(co.merged_into_id,co.id) id,COUNT(*) invoice_count,SUM(i.net_minor) actual_minor FROM invoice i JOIN customer_outlet co ON co.organization_id=i.organization_id AND co.id=i.outlet_id WHERE ${filter} AND i.currency='IDR' AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) GROUP BY COALESCE(co.merged_into_id,co.id)`).bind(...inv.params,channel,...(repId?[repId]:[]),...(areaId?[areaId]:[]),start,end,json).all<any>()).results;
 const userScope=scope.orgWide?'':scope.allRepsInArea?` AND co.area_id IN(SELECT value FROM json_each(?))`:` AND a.user_id IN(SELECT value FROM json_each(?))`;
 const metadata="CASE WHEN json_valid(a.metadata_json) THEN a.metadata_json ELSE '{}' END";
 const acts=(await db.prepare(`SELECT COALESCE(co.merged_into_id,co.id) id,COUNT(*) activity_count,SUM(CASE WHEN a.status='done' AND (json_type(${metadata},'$.meaningful')='true' OR json_extract(${metadata},'$.disposition')='connected_pic') THEN 1 ELSE 0 END) meaningful_count,MAX(a.occurred_at) last_activity FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id WHERE a.organization_id=? AND a.channel=? AND a.occurred_at>=? AND a.occurred_at<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?))${userScope}${repId?' AND a.user_id=?':''} GROUP BY COALESCE(co.merged_into_id,co.id)`).bind(org,channel,new Date(start+'T00:00:00+07:00').toISOString(),new Date(end+'T00:00:00+07:00').toISOString(),json,...(userScope?[JSON.stringify(scope.allRepsInArea?scope.areaIds:scope.repIds)]:[]),...(repId?[repId]:[])).all<any>()).results;
 for(const id of ids)result.set(id,{period,actual_minor:0,invoice_count:0,activity_count:0,meaningful_count:0,last_activity:null});
 for(const row of invoices)Object.assign(result.get(row.id),row);
 for(const row of acts)Object.assign(result.get(row.id),row);
 return result;
}
