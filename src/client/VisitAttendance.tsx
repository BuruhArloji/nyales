import React,{useEffect,useState} from 'react';
import {apiFetch,useIdentity} from './auth';
import {ActionIcon} from './ActionIcon';
import {FilterPanel} from './FilterPanel';
import {Modal} from './Modal';
import {Loading} from './Loading';
import {Pagination,PageSizeSelect} from './Pagination';
import {workWrite} from './Work';
import {offVisitReasons,offVisitStatuses} from '../shared/visit-attendance';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const errors:Record<string,string>={REP_OFF_VISIT:'Sales sedang off visit pada tanggal tersebut.',FIELD_REP_NOT_FOUND:'Sales tidak tersedia dalam akses Anda.',OFF_MANAGER_REQUIRED:'Persetujuan atau pencatatan alfa hanya dapat dilakukan atasan.',ALPHA_FUTURE_DENIED:'Alfa tidak dapat dicatat untuk tanggal mendatang.',OFF_CONFLICTS_WITH_VISIT:'Sudah ada kunjungan pada tanggal ini. Tinjau catatannya terlebih dahulu.',OFF_ALREADY_REVIEWED:'Status off sudah berubah. Muat ulang data.',VISIT_DATE_RANGE_MAX_93_DAYS:'Pilih rentang tanggal maksimal 93 hari.',VISIT_FUTURE_RECAP:'Rekap hanya tersedia sampai hari ini.',OPERATION_CONFLICT:'Data berubah atau tanggal off sudah terdaftar. Muat ulang dahulu.'};
const message=(e:unknown)=>errors[(e as Error).message]||(e as Error).message;
async function read(url:string,signal:AbortSignal){const r=await apiFetch(url,{signal}),body=await r.json()as any;if(!r.ok)throw Error(body.code||'Data belum dapat dimuat.');return body;}
function usePagedRead(path:string){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{const abort=new AbortController();setBusy(true);setData(null);setError('');void read(path,abort.signal).then(value=>{if(!abort.signal.aborted)setData(value)}).catch(e=>{if(!abort.signal.aborted)setError(message(e))}).finally(()=>{if(!abort.signal.aborted)setBusy(false)});return()=>abort.abort()},[path,revision]);
 useEffect(()=>{const refresh=()=>setRevision(n=>n+1);window.addEventListener('nyales-visit-off-changed',refresh);return()=>window.removeEventListener('nyales-visit-off-changed',refresh)},[]);
 return{data,error,busy,reload:()=>setRevision(n=>n+1)};
}
function monthRange(period:string){const end=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10);return{start:period+'-01',end:end<today()?end:today()}}
export function VisitRecap({filters}:{filters:Record<string,string>}){
 const period=filters.period||today().slice(0,7),[range,setRange]=useState(()=>monthRange(period)),[page,setPage]=useState(0),[size,setSize]=useState(50);
 useEffect(()=>{setRange(monthRange(period));setPage(0)},[period]);
 useEffect(()=>setPage(0),[JSON.stringify(filters)]);
 const query=new URLSearchParams({...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)),start_date:range.start,end_date:range.end,limit:String(size),offset:String(page*size)});
 const state=usePagedRead('/api/visit-attendance?'+query);
 return <section id="monitoring-workforce" tabIndex={-1} className="card"><div className="card-header"><h2>Rekap kunjungan sales lapangan</h2><button type="button" className="button secondary" disabled={state.busy} onClick={state.reload}><ActionIcon name="refresh"/>Muat ulang</button></div>
  <FilterPanel embedded label="Filter tanggal rekap kunjungan"><label>Dari tanggal<input type="date" max={range.end||today()} value={range.start} onChange={e=>{if(e.target.value){setRange({...range,start:e.target.value});setPage(0)}}}/></label><label>Sampai tanggal<input type="date" min={range.start} max={today()} value={range.end} onChange={e=>{if(e.target.value){setRange({...range,end:e.target.value});setPage(0)}}}/></label></FilterPanel>
  {state.error&&<p role="alert" className="notice danger">{state.error}<button type="button" className="text-button" onClick={state.reload}><ActionIcon name="refresh"/>Coba lagi</button></p>}
  <Pagination label="Halaman rekap visit" page={page} busy={state.busy} hasNext={Boolean(state.data?.meta.has_more)} onPrevious={()=>setPage(page-1)} onNext={()=>setPage(page+1)}><PageSizeSelect value={size} onChange={v=>{setSize(v);setPage(0)}}/></Pagination>
  {state.busy?<Loading>Memuat rekap kunjungan…</Loading>:state.data&&<div className="table-wrap"><table><thead><tr><th>Sales</th><th title="Target harian dari pengaturan generator × hari kerja aktif, dikurangi off berizin yang disetujui. Menggunakan pengaturan saat ini.">Target visit</th><th>Off berizin</th><th>Alfa</th><th title="Pelanggan unik per hari dengan kunjungan selesai; kunjungan berulang pada hari yang sama dihitung sekali.">Visit</th><th title="Visit selesai pada hari kerja dibatasi target harian ÷ target visit efektif × 100%. Kelebihan pada satu hari tidak menutupi kekurangan hari lain.">Visit compliance</th></tr></thead><tbody>{state.data.data.map((r:any)=><tr key={r.id}><td>{r.name}{r.pending_off_days>0&&<small>{r.pending_off_days} off menunggu persetujuan</small>}</td><td>{r.target_visit===null?'Belum diatur':r.target_visit}</td><td>{r.off_permitted_days} hari</td><td>{r.off_alpha_days} hari</td><td>{r.visit_count}</td><td>{r.visit_compliance_percent===null?'—':r.visit_compliance_percent.toLocaleString('id-ID',{maximumFractionDigits:1})+'%'}</td></tr>)}{!state.data.data.length&&<tr><td colSpan={6}>Tidak ada sales lapangan sesuai filter.</td></tr>}</tbody></table></div>}
 </section>;
}
export function OffVisits({users}:{users:any[]}){
 const {identity}=useIdentity(),manager=['MANAGEMENT','NSM','AREA_MANAGER','SUPERVISOR'].includes(identity.role),[page,setPage]=useState(0),[size,setSize]=useState(50),[modal,setModal]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const state=usePagedRead(`/api/visit-off-days?limit=${size}&offset=${page*size}`),[draft,setDraft]=useState({user_id:identity.id,service_date:today(),reason_code:'annual_leave',reason:'',status:'approved'});
 const reps=users.filter(u=>u.role_code==='SALES_REP'&&u.channel==='field');
 async function save(){setBusy(true);setError('');try{if(modal.create)await workWrite('/api/visit-off-days',{user_id:draft.user_id,service_date:draft.service_date,reason_code:draft.reason_code,reason:draft.reason});else await workWrite(`/api/visit-off-days/${modal.row.id}/review`,{status:draft.status,reason:draft.reason},modal.row.version);setModal(null);window.dispatchEvent(new Event('nyales-visit-off-changed'));}catch(e){setError(message(e))}finally{setBusy(false)}}
 return <><section className="card"><div className="card-header"><h2>Off visit</h2><button type="button" className="button" disabled={identity.read_only} onClick={()=>{setDraft({user_id:manager?(reps[0]?.id||''):identity.id,service_date:today(),reason_code:'annual_leave',reason:'',status:'approved'});setError('');setModal({create:true})}}><ActionIcon name="calendar"/>{manager?'Catat off visit':'Ajukan off visit'}</button></div>
  {state.error&&<p role="alert" className="notice danger">{state.error}</p>}
  <Pagination label="Halaman off visit" page={page} busy={state.busy} hasNext={Boolean(state.data?.meta.has_more)} onPrevious={()=>setPage(page-1)} onNext={()=>setPage(page+1)}><PageSizeSelect value={size} onChange={v=>{setSize(v);setPage(0)}}/></Pagination>
  {state.busy?<Loading>Memuat off visit…</Loading>:<div className="table-wrap"><table><thead><tr><th>Sales</th><th>Tanggal</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{state.data?.data.map((r:any)=><tr key={r.id}><td>{r.user_name}</td><td>{r.service_date}</td><td>{offVisitReasons[r.reason_code as keyof typeof offVisitReasons]}<small>{r.reason}</small></td><td>{offVisitStatuses[r.status as keyof typeof offVisitStatuses]}</td><td>{manager&&r.user_id!==identity.id&&['pending','approved'].includes(r.status)&&<button type="button" className="text-button" disabled={identity.read_only} onClick={()=>{setDraft({...draft,status:r.status==='approved'?'cancelled':'approved',reason:''});setError('');setModal({row:r})}}><ActionIcon name="review"/>Tinjau</button>}</td></tr>)}{!state.data?.data.length&&<tr><td colSpan={5}>Belum ada catatan off visit.</td></tr>}</tbody></table></div>}
 </section>{modal&&<Modal title={modal.create?(manager?'Catat off visit':'Ajukan off visit'):'Tinjau off visit'} busy={busy} onClose={()=>!busy&&setModal(null)}>{error&&<p role="alert" className="notice danger">{error}</p>}<form onSubmit={e=>{e.preventDefault();void save()}}><fieldset className="settings-fields" disabled={busy||identity.read_only}>{modal.create?<>
  {manager&&<label>Sales<select required value={draft.user_id} onChange={e=>setDraft({...draft,user_id:e.target.value})}><option value="">Pilih sales lapangan</option>{reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
  <label>Tanggal off<input type="date" required value={draft.service_date} onChange={e=>setDraft({...draft,service_date:e.target.value})}/></label><label>Alasan off<select value={draft.reason_code} onChange={e=>setDraft({...draft,reason_code:e.target.value})}>{Object.entries(offVisitReasons).filter(([k])=>manager||k!=='alpha').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 </>:<label>Keputusan<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{(modal.row.status==='pending'?['approved','rejected','cancelled']:['cancelled']).map(k=><option key={k} value={k}>{offVisitStatuses[k as keyof typeof offVisitStatuses]}</option>)}</select></label>}
 <label>Catatan<textarea required maxLength={1000} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label><button className="button"><ActionIcon name="save"/>Simpan</button></fieldset></form></Modal>}</>;
}
