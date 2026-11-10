import {useEffect,useState} from 'react';
import {apiFetch,useIdentity} from './auth';
import {Modal} from './Modal';
import {Loading} from './Loading';
import {ActionIcon} from './ActionIcon';
import {Pagination,PageSizeSelect} from './Pagination';

type Visitor={email:string;display_name:string|null;account_kind:'owner'|'visitor';first_seen_at:string;last_seen_at:string;visit_count:number};
type Response={data:Visitor[];meta:{has_more:boolean;next_cursor:string|null;limit:number}};
const time=new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'});
function timestamp(value:string){return Number.isFinite(Date.parse(value))?time.format(new Date(value)):'—'}

export function PortfolioVisitors({onClose}:{onClose:()=>void}){
 const {identity}=useIdentity(),[limit,setLimit]=useState(50),[cursors,setCursors]=useState<Array<string|null>>([null]),[page,setPage]=useState(0),[result,setResult]=useState<Response|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const cursor=cursors[page]??null;
 useEffect(()=>{
  if(!identity.portfolio_owner)return;let active=true;const controller=new AbortController();setLoading(true);setError('');setResult(null);
  const query=new URLSearchParams({limit:String(limit)});if(cursor)query.set('cursor',cursor);
  apiFetch('/api/portfolio-visitors?'+query,{signal:controller.signal}).then(response=>response.json() as Promise<Response>).then(data=>{if(active)setResult(data)}).catch(e=>{if(active&&(e as Error).name!=='AbortError')setError((e as Error).message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;controller.abort()};
 },[identity.portfolio_owner,limit,cursor,retry]);
 if(!identity.portfolio_owner)return null;
 function changeLimit(value:number){setPage(0);setCursors([null]);setLimit(value)}
 function next(){const cursor=result?.meta.next_cursor;if(loading||!result?.meta.has_more||!cursor)return;setCursors(previous=>[...previous.slice(0,page+1),cursor]);setPage(previous=>previous+1)}
 return <Modal title="Pengunjung" busy={false} onClose={onClose} className="portfolio-visitors-dialog">
  <div aria-busy={loading}>
   {loading?<Loading>Memuat pengunjung…</Loading>:error?<div role="alert"><p className="notice danger">{error}</p><button type="button" className="button secondary" onClick={()=>setRetry(value=>value+1)}><ActionIcon name="refresh"/>Coba lagi</button></div>:result?.data.length?<div className="table-wrap" role="region" aria-label="Riwayat pengunjung" tabIndex={0}><table>
    <thead><tr><th>Akun</th><th>Kunjungan</th><th>Pertama</th><th>Terakhir</th></tr></thead>
    <tbody>{result.data.map(visitor=><tr key={visitor.email}><td style={{overflowWrap:'anywhere'}}>{visitor.email}{visitor.display_name&&<small>{visitor.display_name}</small>}{visitor.account_kind==='owner'&&<small>Pemilik</small>}</td><td>{visitor.visit_count.toLocaleString('id-ID')}</td><td><time dateTime={visitor.first_seen_at} title="Waktu Indonesia Barat">{timestamp(visitor.first_seen_at)}</time></td><td><time dateTime={visitor.last_seen_at} title="Waktu Indonesia Barat">{timestamp(visitor.last_seen_at)}</time></td></tr>)}</tbody>
   </table></div>:<p className="muted" role="status">Belum ada pengunjung.</p>}
   <Pagination label="Halaman pengunjung" page={page} busy={loading} hasPrevious={page>0} hasNext={Boolean(result?.meta.has_more&&result.meta.next_cursor)} onPrevious={()=>setPage(value=>Math.max(0,value-1))} onNext={next}><PageSizeSelect value={limit} onChange={changeLimit} label="Baris per halaman"/></Pagination>
  </div>
 </Modal>;
}
