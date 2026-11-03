import {invoiceLabel} from '../shared/business-labels';
import React,{useEffect,useState} from 'react';
import {apiFetch} from './auth';
import {Loading} from './Loading';
import {compactNumber} from './numbers';

export type SourceSelection={kind:'customers'|'invoices'|'activities'|'targets'|'workforce';covered?:boolean;meaningful?:boolean;source_channel?:string};
type Result={rows:any[];cutoff:string;pagination:{has_more:boolean;next_cursor:string|null}};
const money=(value:number|null)=>compactNumber(value,true).full;

export function SourceDrill({filters,source}:{filters:Record<string,string>;source:SourceSelection}){
 const [cursors,setCursors]=useState<(string|null)[]>([null]);
 const [pageSize,setPageSize]=useState(50);
 const [data,setData]=useState<Result|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
 Object.entries(source).forEach(([key,value])=>{if(value!==undefined)query.set(key,String(value))});
 query.set('limit',String(pageSize));if(cursors.at(-1))query.set('after',cursors.at(-1)!);
 const url='/api/dashboard/sources?'+query;
 useEffect(()=>{
  const controller=new AbortController();let active=true;setData(null);setError('');
  apiFetch(url,{signal:controller.signal}).then(r=>r.json() as Promise<{data:Result}>).then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(e.message)});
  return()=>{active=false;controller.abort()};
 },[url,retry]);
 return <div className="source-drill">

  {error?<p role="alert" className="notice danger">{error} <button className="button secondary" onClick={()=>setRetry(x=>x+1)}>Coba lagi</button></p>:!data?<Loading>Memuat rincian…</Loading>:<>
   <p className="muted">{data.cutoff} · Halaman {cursors.length} · {data.rows.length} baris</p>
   <div className="table-wrap"><table><thead><tr><th>Record</th><th>Basis / nilai</th><th>Waktu / status</th></tr></thead><tbody>
    {data.rows.map(r=><tr key={r.id+(r.channel||'')}><td>{r.name||r.customer_name||invoiceLabel(r.source_invoice_id)||r.activity_kind||r.id}</td><td>{r.net_minor!==undefined?money(r.net_minor):r.target_minor!==undefined?'Target '+money(r.target_minor)+(r.actual_minor!==undefined?' · Actual '+money(r.actual_minor):''):r.observed_actual_minor!==undefined?money(r.observed_actual_minor):r.channel||r.area_id||'—'}</td><td>{r.invoice_date||r.occurred_at||r.status||r.period_start||'Master saat ini'}</td></tr>)}
    {!data.rows.length&&<tr><td colSpan={3}>Belum ada record sesuai pilihan.</td></tr>}
   </tbody></table></div>
  </>}
  <div className="source-pagination" aria-label="Navigasi halaman rincian">
   <button className="button secondary" disabled={cursors.length===1||!data} onClick={()=>setCursors(x=>x.slice(0,-1))}>Sebelumnya</button>
   <label>Record per halaman<select aria-label="Record per halaman" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCursors([null])}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <button className="button" disabled={!data?.pagination.has_more} onClick={()=>{if(data?.pagination.next_cursor)setCursors(x=>[...x,data.pagination.next_cursor])}}>Berikutnya</button>
  </div>
 </div>;
}
