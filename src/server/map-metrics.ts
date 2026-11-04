import {invoicePredicate,type Scope} from './scope';

export const MAP_ID_JSON_CHUNK_BYTES=512*1024;

export function mapPeriod(period:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('INVALID_PERIOD');
 const start=period+'-01',next=new Date(start+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 return {start,end:next.toISOString().slice(0,10)};
}

/** Keep JSON1 ID parameters comfortably below D1's per-value size limit. */
export function chunkMapIds(ids:string[],maxBytes=MAP_ID_JSON_CHUNK_BYTES):string[][]{
 const chunks:string[][]=[],encoder=new TextEncoder();let chunk:string[]=[],bytes=2;
 for(const id of new Set(ids)){
  const item=JSON.stringify(id),itemBytes=encoder.encode(item).byteLength,separator=chunk.length?1:0;
  if(chunk.length&&bytes+separator+itemBytes>maxBytes){chunks.push(chunk);chunk=[];bytes=2}
  if(bytes+(chunk.length?1:0)+itemBytes>maxBytes)throw Error('MAP_CUSTOMER_ID_TOO_LARGE');
  chunk.push(id);bytes+=(chunk.length>1?1:0)+itemBytes;
 }
 if(chunk.length)chunks.push(chunk);
 return chunks;
}

/** Only enrich already-authorized canonical customers; invoice ownership remains historical. */
export async function readMapMetrics(db:D1Database,scope:Scope,ids:string[],period:string,channel:string,repId?:string,areaId?:string,includeWallet=false){
 const {start,end}=mapPeriod(period),historyStart=new Date(start+'T00:00:00Z');historyStart.setUTCMonth(historyStart.getUTCMonth()-12);const historyFrom=historyStart.toISOString().slice(0,10),result=new Map<string,any>(),uniqueIds=[...new Set(ids)];if(!uniqueIds.length)return result;
 const inv=invoicePredicate(scope),org=scope.identity.organization_id;
 const allChannels=channel==='all',channelParams=allChannels?[]:[channel];
 const filter=`${inv.sql}`+(allChannels?'':' AND i.channel=?')+(repId?' AND i.rep_id=?':'')+(areaId?' AND i.area_id=?':'');
 const userScope=scope.orgWide?'':scope.allRepsInArea?` AND co.area_id IN(SELECT value FROM json_each(?))`:` AND a.user_id IN(SELECT value FROM json_each(?))`;
 const metadata="CASE WHEN json_valid(a.metadata_json) THEN a.metadata_json ELSE '{}' END";
 for(const id of uniqueIds)result.set(id,{period,comparison_period:period,actual_minor:0,current_month_actual_minor:0,highest_month_actual_minor:null,highest_month_period:null,highest_month_history_start:historyFrom,highest_month_history_end:start,hierarchy1:null,wallet_size_minor:null,wallet_size_source:null,invoice_count:0,activity_count:0,meaningful_count:0,last_activity:null});
 for(const chunk of chunkMapIds(uniqueIds)){
  const json=JSON.stringify(chunk);
  const wallets=includeWallet?(await db.prepare(`SELECT customer_id id,hierarchy1,wallet_size_minor,source wallet_size_source FROM customer_wallet_profile WHERE organization_id=? AND customer_id IN(SELECT value FROM json_each(?))`).bind(org,json).all<any>()).results:[];
  const history=includeWallet?(await db.prepare(`WITH monthly AS(SELECT COALESCE(co.merged_into_id,co.id) id,substr(i.invoice_date,1,7) month,SUM(i.net_minor) amount FROM invoice i JOIN customer_outlet co ON co.organization_id=i.organization_id AND co.id=i.outlet_id WHERE ${filter} AND i.currency='IDR' AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) GROUP BY COALESCE(co.merged_into_id,co.id),substr(i.invoice_date,1,7)),ranked AS(SELECT id,month,amount,ROW_NUMBER() OVER(PARTITION BY id ORDER BY amount DESC,month DESC) ranking FROM monthly) SELECT id,amount highest_month_actual_minor,month highest_month_period FROM ranked WHERE ranking=1`).bind(...inv.params,...channelParams,...(repId?[repId]:[]),...(areaId?[areaId]:[]),historyFrom,start,json).all<any>()).results:[];
  const invoices=(await db.prepare(`SELECT COALESCE(co.merged_into_id,co.id) id,COUNT(*) invoice_count,SUM(i.net_minor) actual_minor FROM invoice i JOIN customer_outlet co ON co.organization_id=i.organization_id AND co.id=i.outlet_id WHERE ${filter} AND i.currency='IDR' AND i.status='validated' AND i.validation_state='validated' AND i.invoice_date>=? AND i.invoice_date<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?)) GROUP BY COALESCE(co.merged_into_id,co.id)`).bind(...inv.params,...channelParams,...(repId?[repId]:[]),...(areaId?[areaId]:[]),start,end,json).all<any>()).results;
  const acts=(await db.prepare(`SELECT COALESCE(co.merged_into_id,co.id) id,COUNT(*) activity_count,SUM(CASE WHEN a.status='done' AND (json_type(${metadata},'$.meaningful')='true' OR json_extract(${metadata},'$.disposition')='connected_pic') THEN 1 ELSE 0 END) meaningful_count,MAX(a.occurred_at) last_activity FROM activity a JOIN customer_outlet co ON co.organization_id=a.organization_id AND co.id=a.outlet_id WHERE a.organization_id=? ${allChannels?'':'AND a.channel=?'} AND a.occurred_at>=? AND a.occurred_at<? AND COALESCE(co.merged_into_id,co.id) IN(SELECT value FROM json_each(?))${userScope}${repId?' AND a.user_id=?':''} GROUP BY COALESCE(co.merged_into_id,co.id)`).bind(org,...channelParams,new Date(start+'T00:00:00+07:00').toISOString(),new Date(end+'T00:00:00+07:00').toISOString(),json,...(userScope?[JSON.stringify(scope.allRepsInArea?scope.areaIds:scope.repIds)]:[]),...(repId?[repId]:[])).all<any>()).results;
  for(const row of wallets){const facts=result.get(row.id);if(facts)Object.assign(facts,{hierarchy1:row.hierarchy1,wallet_size_minor:row.wallet_size_minor,wallet_size_source:row.wallet_size_source})}
  for(const row of history){const facts=result.get(row.id);if(facts)Object.assign(facts,{highest_month_actual_minor:row.highest_month_actual_minor,highest_month_period:row.highest_month_period})}
  for(const row of invoices){const facts=result.get(row.id);if(facts)Object.assign(facts,{invoice_count:row.invoice_count,actual_minor:row.actual_minor,current_month_actual_minor:row.actual_minor})}
  for(const row of acts){const facts=result.get(row.id);if(facts)Object.assign(facts,{activity_count:row.activity_count,meaningful_count:row.meaningful_count,last_activity:row.last_activity})}
 }
 return result;
}
