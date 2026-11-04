import {presentationLabel} from '../shared/business-labels';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {apiFetch,useIdentity} from './auth';
import {CustomerPicker,type CustomerOption} from './CustomerPicker';
import {FilterPanel} from './FilterPanel';
import {LiquidTabs} from './LiquidNav';
import {Loading} from './Loading';
import {Modal} from './Modal';
import {Pagination} from './Pagination';
import {readGeoContext} from './geo-navigation';
import './targets.css';

const rp=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const localMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const monthRange=(month:string)=>({period_start:month+'-01',period_end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10)});
const statusLabel:Record<string,string>={draft:'Draft',submitted:'Menunggu pengesahan',approved:'Aktif',superseded:'Versi terdahulu'};
const PAGE_SIZE=20;
type TargetRow={key:string;basis:'customer'|'rep';customer_id:string;rep_id:string;area_id:string;target_minor:string;product_id:string|null;product_group_id:string|null;reason:string};
type Dialog='plan'|'items'|'allocation'|'action'|null;
const emptyRow=():TargetRow=>({key:crypto.randomUUID(),basis:'customer',customer_id:'',rep_id:'',area_id:'',target_minor:'',product_id:null,product_group_id:null,reason:''});
async function get(path:string,signal?:AbortSignal){return(await(await apiFetch(path,{signal})).json() as any).data}
async function write(path:string,body:any,version?:number){return(await(await apiFetch(path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...(version?{'If-Match':`"${version}"`}:{})},body:JSON.stringify(body)})).json() as any).data}
const errors:Record<string,string>={
 SELF_APPROVAL_DENIED:'Pengesahan harus dilakukan Management atau NSM lain, bukan pembuat atau pengaju versi ini.',
 TARGET_DOES_NOT_RECONCILE:'Total rincian dan cadangan harus sama dengan target keseluruhan. Periksa jumlah sebelum melanjutkan.',
 BASELINE_SOURCE_INCOMPLETE:'Histori invoice tiga bulan sebelumnya belum dikonfirmasi lengkap. Konfirmasi melalui Status & tier → Cakupan sumber, atau isi rincian secara manual.',
 OVERLAPPING_APPROVED_PLAN:'Sudah ada target aktif untuk kanal dan periode yang bertumpang tindih. Revisi target aktif tersebut.',
 REVISION_ALREADY_OPEN:'Revisi untuk target ini sudah tersedia. Lanjutkan draft atau pengajuan yang ada.',
 INVALID_REP:'Sales harus aktif dan memiliki area serta kanal yang sesuai pada awal periode target.',
 INVALID_CUSTOMER:'Pelanggan harus aktif dan berada pada area yang dipilih.',
 VERSION_CONFLICT:'Versi target berubah. Tutup popup dan muat ulang sebelum melanjutkan.',
 ONBOARDING_INPUT_REQUIRED:'Pelanggan tanpa histori memerlukan target awal. Isi nominal tetap pada pelanggan tersebut.',
 CUSTOMER_AGE_BASELINE_REVIEW_REQUIRED:'Pelanggan baru memerlukan nominal tetap atau konfirmasi kelengkapan histori.',
};
function message(error:unknown){const e=error as Error;return errors[e.message]||e.message||'Target belum dapat diproses.'}

export function Targets(){
 const {identity}=useIdentity(),admin=identity.capabilities.includes('settings:manage');
 const [view,setView]=useState<'manage'|'achievement'>(admin?'manage':'achievement');
 const [plans,setPlans]=useState<any[]>([]),[actual,setActual]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]),[areas,setAreas]=useState<any[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const [channel,setChannel]=useState(''),[area,setArea]=useState(''),[rep,setRep]=useState('');
 const [month,setMonth]=useState(()=>readGeoContext().period||localMonth());
 const [planStatus,setPlanStatus]=useState(''),[planPage,setPlanPage]=useState(0),[actualPage,setActualPage]=useState(0);
 const [modal,setModal]=useState<Dialog>(null),[selected,setSelected]=useState<any>(null),[draft,setDraft]=useState<any>({});
 const [rows,setRows]=useState<TargetRow[]>([]),[allocationCustomers,setAllocationCustomers]=useState<CustomerOption[]>([]),[allocationPick,setAllocationPick]=useState('');
 const [coverage,setCoverage]=useState<any>(null),[coverageLoaded,setCoverageLoaded]=useState(false);
 const operation=useRef(0);
 const query=useMemo(()=>new URLSearchParams(Object.entries({channel,area_id:area,rep_id:rep,period_start:month?month+'-01':''}).filter(([,v])=>v)).toString(),[channel,area,rep,month]);
 useEffect(()=>{
  let alive=true;const abort=new AbortController();setLoading(true);setError('');
  Promise.all([get('/api/targets?'+query,abort.signal),admin?get('/api/target-plans',abort.signal):Promise.resolve([])])
   .then(([a,p])=>{if(alive){setActual(a);setPlans(p)}}).catch(e=>{if(alive)setError(message(e))}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false;abort.abort()};
 },[query,refresh,admin]);
 useEffect(()=>{let alive=true;const abort=new AbortController();Promise.all([get('/api/users',abort.signal),get('/api/areas',abort.signal)])
  .then(([u,a])=>{if(alive){setUsers(u);setAreas(a)}}).catch(e=>{if(alive)setError(message(e))});return()=>{alive=false;abort.abort()}},[]);
 useEffect(()=>{setPlanPage(0);setActualPage(0)},[query,planStatus]);
 const visiblePlans=plans.filter(p=>(!channel||p.channel===channel)&&(!month||p.period_start.slice(0,7)===month)&&(!planStatus||p.version_status===planStatus));
 const safePlanPage=Math.min(planPage,Math.max(0,Math.ceil(visiblePlans.length/PAGE_SIZE)-1)),safeActualPage=Math.min(actualPage,Math.max(0,Math.ceil(actual.length/PAGE_SIZE)-1));
 const pagedPlans=visiblePlans.slice(safePlanPage*PAGE_SIZE,(safePlanPage+1)*PAGE_SIZE),pagedActual=actual.slice(safeActualPage*PAGE_SIZE,(safeActualPage+1)*PAGE_SIZE);
 const sales=users.filter(u=>u.role_code===(selected?.channel==='telesales'?'TELESALES':'SALES_REP'));
 const leafTotal=rows.reduce((sum,r)=>sum+(Number(r.target_minor)||0),0),reserve=Number(draft.reserve_minor)||0;
 const editable=modal!=='items'||selected?.version_status==='draft';
 function close(){operation.current++;setModal(null);setError('')}
 function create(){setError('');setDraft({name:'',method:'bottom_up',channel:channel||'field',month:month||localMonth(),custom_period:false,...monthRange(month||localMonth()),parent_minor:'',reason:''});setModal('plan')}
 async function edit(plan:any){
  const token=++operation.current;setSelected(plan);setError('');setBusy(true);
  try{const items=await get('/api/target-versions/'+plan.version_id+'/items');if(token!==operation.current)return;
   setRows(items.map((r:any)=>({key:r.id||crypto.randomUUID(),basis:r.outlet_id?'customer':'rep',customer_id:r.outlet_id||'',rep_id:r.outlet_id?'':r.rep_id_snapshot||'',area_id:r.area_id_snapshot,target_minor:String(r.target_minor),product_id:r.product_id,product_group_id:r.product_group_id,reason:r.input_reason||''})));
   setDraft({reserve_minor:String(plan.reserve_minor)});setModal('items');
  }catch(e){if(token===operation.current)setError(message(e))}finally{if(token===operation.current)setBusy(false)}
 }
 function allocation(plan:any){
  setSelected(plan);setDraft({onboarding:{},reserve_minor:String(plan.reserve_minor),reason:''});setAllocationCustomers([]);setAllocationPick('');setError('');setCoverage(null);setCoverageLoaded(false);setModal('allocation');
  const token=++operation.current;
  get('/api/customer-source-coverage').then(c=>{if(token===operation.current)setCoverage(c)}).catch(e=>{if(token===operation.current)setError(message(e))}).finally(()=>{if(token===operation.current)setCoverageLoaded(true)});
 }
 function act(plan:any,action:string){setSelected(plan);setDraft({action,reason:''});setError('');setModal('action')}
 function patchRow(key:string,patch:Partial<TargetRow>){setRows(previous=>previous.map(r=>r.key===key?{...r,...patch}:r))}
 function addCustomer(option:CustomerOption|null){if(!option)return;setAllocationCustomers(previous=>previous.some(c=>c.id===option.id)?previous:[...previous,option]);setAllocationPick('')}
 const baseline=selected?(()=>{const end=new Date(selected.period_start.slice(0,7)+'-01T00:00:00Z');end.setUTCDate(0);const start=new Date(selected.period_start.slice(0,7)+'-01T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-3);return {from:start.toISOString().slice(0,10),through:end.toISOString().slice(0,10)}})():null;
 const baselineComplete=Boolean(coverage&&baseline&&coverage.complete_from<=baseline.from&&coverage.complete_through>=baseline.through);
 async function submit(){
  setBusy(true);setError('');setNotice('');
  try{
   if(modal==='plan'){
    const period=draft.custom_period?{period_start:draft.period_start,period_end:draft.period_end}:monthRange(draft.month);
    const p=await write('/api/target-plans',{name:draft.name,method:draft.method,channel:draft.channel,...period,parent_minor:draft.method==='top_down'?Number(draft.parent_minor):0,reason:draft.reason});
    const plan={...p,version_status:'draft',revision_no:1,reserve_minor:0};setSelected(plan);setView('manage');setMonth(period.period_start.slice(0,7));setRefresh(v=>v+1);
    if(plan.method==='top_down'){allocation(plan)}else{setRows([emptyRow()]);setDraft({reserve_minor:'0'});setModal('items')}
    setNotice('Draft dibuat. Lengkapi pembagian target, lalu ajukan untuk disahkan.');return;
   }
   if(modal==='items'){
    await write('/api/target-versions/'+selected.version_id+'/items',{items:rows.map(({key,basis,...r})=>({...r,customer_id:basis==='customer'?r.customer_id:null,rep_id:basis==='rep'?r.rep_id:null,target_minor:Number(r.target_minor)})),reserve_minor:reserve},selected.version);
    setNotice('Rincian tersimpan. Pilih Ajukan untuk mengirim target ke pengesahan.');
   }
   if(modal==='allocation'){
    await write('/api/target-versions/'+selected.version_id+'/allocations',{customer_ids:allocationCustomers.map(c=>c.id),onboarding:Object.fromEntries(Object.entries(draft.onboarding).filter(([key,value])=>value!==''&&allocationCustomers.some(c=>c.id===key)).map(([key,value])=>[key,Number(value)])),reserve_minor:reserve,reason:draft.reason},selected.version);
    setNotice('Alokasi historis tersimpan sebagai draft. Tinjau rincian hasil sebelum mengajukan.');
   }
   if(modal==='action'){
    await write('/api/target-versions/'+selected.version_id+'/'+draft.action,{reason:draft.reason},selected.version);
    setNotice(draft.action==='submit'?'Target diajukan. Management atau NSM lain dapat meninjau dan mengesahkan.':draft.action==='approve'?'Target disahkan dan tersedia pada Pencapaian.':'Revisi dibuat. Lanjutkan pengaturan pada versi draft.');
   }
   setModal(null);setRefresh(v=>v+1);
  }catch(e){setError(message(e))}finally{setBusy(false)}
 }
 const actionTitle=draft.action==='submit'?'Ajukan target':draft.action==='approve'?'Sahkan target':'Buat revisi';
 const modalTitle=modal==='plan'?'Buat target':modal==='items'?(editable?'Atur rincian target':'Rincian target'):modal==='allocation'?'Bagi berdasarkan histori':actionTitle;
 return <div className="target-workspace">
  <div className="page-heading target-page-heading"><div><h1>Target & pencapaian</h1></div>{admin&&<button className="button" onClick={create}>Buat target</button>}</div>
  {admin&&<><LiquidTabs role="tablist" className="target-view-tabs" aria-label="Tampilan target">
   <button type="button" role="tab" aria-selected={view==='manage'} className={'button '+(view==='manage'?'':'secondary')} onClick={()=>setView('manage')}>Kelola target</button>
   <button type="button" role="tab" aria-selected={view==='achievement'} className={'button '+(view==='achievement'?'':'secondary')} onClick={()=>setView('achievement')}>Pencapaian</button>
  </LiquidTabs>{view==='manage'&&<ol className="target-lifecycle" aria-label="Alur pengaturan target">
   {[['Buat target','Pilih periode dan kanal'],['Bagi target','Isi manual atau dari histori'],['Ajukan & sahkan','Ditinjau Management / NSM lain'],['Pantau pencapaian','Actual dari invoice net']].map(([title,description],index)=><li key={title}><span>{index+1}</span><div><strong>{title}</strong><small>{description}</small></div></li>)}
  </ol>}</>}
  <FilterPanel count={[channel,area,rep,month].filter(Boolean).length} onReset={()=>{setChannel('');setArea('');setRep('');setMonth('')}} className="target-filter-panel" label="Filter target" summary={[month||'Semua periode',channel==='field'?'Lapangan':channel==='telesales'?'Telesales':'Semua kanal',view==='achievement'&&area?presentationLabel(areas.find(a=>a.id===area)?.name):null,view==='achievement'&&rep?presentationLabel(users.find(u=>u.id===rep)?.name):null].filter(Boolean).join(' · ')}>
   <div className="assignment-filters target-filters"><label>Periode<input type="month" aria-label="Periode target" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>Kanal<select aria-label="Kanal target" value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Semua kanal</option><option value="field">Lapangan</option><option value="telesales">Telesales</option></select></label>{view==='achievement'&&<><label>Area<select aria-label="Area target" value={area} onChange={e=>setArea(e.target.value)}><option value="">Semua area</option>{areas.map(a=><option key={a.id} value={a.id}>{presentationLabel(a.name)}</option>)}</select></label><label>Sales<select aria-label="Sales target" value={rep} onChange={e=>setRep(e.target.value)}><option value="">Semua sales</option>{users.filter(u=>['SALES_REP','TELESALES'].includes(u.role_code)&&(!channel||u.channel===channel)).map(u=><option key={u.id} value={u.id}>{presentationLabel(u.name)}</option>)}</select></label></>}</div>
  </FilterPanel>
  {notice&&<p className="notice target-notice" role="status">{notice}</p>}{error&&!modal&&<p className="notice danger" role="alert">{error}<button className="button secondary" onClick={()=>setRefresh(v=>v+1)}>Coba lagi</button></p>}
  {view==='manage'&&admin?<section className="card target-management">
   <div className="card-header"><div><h2>Rencana target</h2><small>Draft → Menunggu pengesahan → Aktif</small></div><label className="target-status-filter">Status<select aria-label="Status rencana target" value={planStatus} onChange={e=>setPlanStatus(e.target.value)}><option value="">Semua status</option><option value="draft">Draft</option><option value="submitted">Menunggu pengesahan</option><option value="approved">Aktif</option><option value="superseded">Versi terdahulu</option></select></label></div>
   {loading?<Loading>Memuat rencana target…</Loading>:!visiblePlans.length?<div className="target-empty"><h3>{plans.length?'Tidak ada rencana sesuai filter':'Mulai dengan target bulanan'}</h3><p>{plans.length?'Ubah periode, kanal, atau status untuk melihat rencana lain.':'Tentukan target per pelanggan atau sales, atau bagi target keseluruhan berdasarkan histori invoice.'}</p><button className="button" onClick={create}>Buat target</button></div>:<><div className="table-wrap"><table><thead><tr><th>Rencana / periode</th><th>Pembagian</th><th className="number">Total target</th><th>Status</th><th>Langkah berikutnya</th></tr></thead><tbody>{pagedPlans.map(p=><tr key={p.version_id}>
    <td><strong>{presentationLabel(p.name)}</strong><small>{p.period_start} — {p.period_end}</small><small>{p.channel==='field'?'Lapangan':'Telesales'} · revisi {p.revision_no}</small></td>
    <td>{p.method==='bottom_up'?'Manual per pelanggan / sales':'Berdasarkan histori'}<small>{p.method==='bottom_up'?'Bottom-up':'Top-down'}</small></td>
    <td className="number">{rp(p.parent_minor)}{p.reserve_minor>0&&<small>Belum dialokasikan {rp(p.reserve_minor)}</small>}</td>
    <td><span className={'badge '+(p.version_status==='approved'?'positive':'neutral')}>{statusLabel[p.version_status]||p.version_status}</span>{p.version_status==='draft'&&<small>Lengkapi rincian sebelum diajukan</small>}{p.version_status==='submitted'&&<small>Perlu pengesahan akun lain</small>}</td>
    <td><div className="target-row-actions"><button className="button secondary" disabled={busy} onClick={()=>void edit(p)}>{p.version_status==='draft'?'Atur rincian':'Lihat rincian'}</button>
     {p.version_status==='draft'&&p.method==='top_down'&&<button className="button secondary" disabled={busy} onClick={()=>allocation(p)}>Bagi dari histori</button>}
     {p.version_status==='draft'&&<button className="button" disabled={busy} onClick={()=>act(p,'submit')}>Ajukan</button>}
     {p.version_status==='submitted'&&<button className="button" disabled={busy} onClick={()=>act(p,'approve')}>Sahkan</button>}
     {p.version_status==='approved'&&<button className="button secondary" disabled={busy} onClick={()=>act(p,'revise')}>Buat revisi</button>}
    </div></td>
   </tr>)}</tbody></table></div><Pagination label="Halaman rencana target" page={safePlanPage} total={visiblePlans.length} pageSize={PAGE_SIZE} pageCount={Math.ceil(visiblePlans.length/PAGE_SIZE)} itemLabel="versi target" busy={loading} onPrevious={()=>setPlanPage(safePlanPage-1)} onNext={()=>setPlanPage(safePlanPage+1)}/></>}
  </section>:<section className="card target-achievement"><div className="card-header"><div><h2>Pencapaian target</h2><small>Target yang sudah disahkan · actual invoice net</small></div></div>{loading?<Loading>Memuat pencapaian…</Loading>:!actual.length?<div className="target-empty"><h3>Belum ada target aktif pada filter ini</h3><p>{admin?'Buat rencana, isi pembagian, lalu ajukan dan sahkan sebelum memantau pencapaian.':'Target akan tampil setelah Management atau NSM mengesahkannya.'}</p>{admin&&<button className="button secondary" onClick={()=>setView('manage')}>Kelola target</button>}</div>:<>
   <div className="table-wrap target-desktop-table" tabIndex={0} role="region" aria-label="Tabel pencapaian target"><table><thead><tr><th>Target / pelanggan</th><th>Periode / kanal</th><th className="number">Target</th><th className="number">Actual</th><th className="number">Gap</th><th>Pencapaian</th></tr></thead><tbody>{pagedActual.map(r=><tr key={r.id}><td>{presentationLabel(r.name)}<small>{presentationLabel(r.customer_name||r.rep_name||'Target sales')} · revisi {r.revision_no}</small></td><td>{r.period_start} — {r.period_end}<small>{r.channel==='field'?'Lapangan':'Telesales'}</small></td><td className="number">{rp(r.target_minor)}</td><td className="number">{r.actual_minor===null?'Perlu review':rp(r.actual_minor)}</td><td className="number">{r.gap_minor===null?'Belum tersedia':rp(r.gap_minor)}</td><td>{r.needs_review?(r.review_reason==='ZERO_TARGET'?'Target nol perlu review':'Basis actual perlu review'):r.achievement_percent.toLocaleString('id-ID',{maximumFractionDigits:2})+'%'}</td></tr>)}</tbody></table></div>
   <div className="target-mobile-list">{pagedActual.map(r=><article key={r.id} className="target-mobile-row"><header><strong>{presentationLabel(r.customer_name||r.rep_name||r.name)}</strong><span className="badge neutral">{r.channel==='field'?'Lapangan':'Telesales'}</span></header><small>{presentationLabel(r.name)} · revisi {r.revision_no}</small><dl><div><dt>Actual</dt><dd>{r.actual_minor===null?'Perlu review':rp(r.actual_minor)}</dd></div><div><dt>Target</dt><dd>{rp(r.target_minor)}</dd></div><div><dt>Pencapaian</dt><dd>{r.needs_review?'Perlu review':r.achievement_percent.toLocaleString('id-ID',{maximumFractionDigits:2})+'%'}</dd></div><div><dt>Gap</dt><dd>{r.gap_minor===null?'Belum tersedia':rp(r.gap_minor)}</dd></div></dl><small>{r.period_start} — {r.period_end}</small></article>)}</div>
   <Pagination label="Halaman pencapaian target" page={safeActualPage} total={actual.length} pageSize={PAGE_SIZE} pageCount={Math.ceil(actual.length/PAGE_SIZE)} itemLabel="rincian target" busy={loading} onPrevious={()=>setActualPage(safeActualPage-1)} onNext={()=>setActualPage(safeActualPage+1)}/>
  </>}</section>}
  {modal&&<Modal title={modalTitle} busy={busy} onClose={close} className="target-dialog">
   {selected&&modal!=='plan'&&<div className="target-dialog-context"><strong>{presentationLabel(selected.name)}</strong><span>{selected.period_start} — {selected.period_end} · {selected.channel==='field'?'Lapangan':'Telesales'}</span><span className="badge neutral">{statusLabel[selected.version_status]||'Draft'}</span></div>}
   {error&&<p role="alert" className="notice danger">{error}</p>}
   <form onSubmit={e=>{e.preventDefault();void submit()}}><fieldset className="settings-fields" disabled={busy||!editable}>
    {modal==='plan'&&<>
     <label>Nama target<input required maxLength={160} autoFocus placeholder="Contoh: Target lapangan November" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
     <div className="target-methods" role="radiogroup" aria-label="Cara membagi target">{[['bottom_up','Isi nominal per pelanggan / sales','Total dihitung dari rincian yang kamu isi.'],['top_down','Bagi target keseluruhan','Distribusikan menurut histori invoice tiga bulan.']].map(([value,title,note])=><label key={value} className={draft.method===value?'is-selected':''}><input type="radio" name="target-method" value={value} checked={draft.method===value} onChange={()=>setDraft({...draft,method:value})}/><span><strong>{title}</strong><small>{note}</small></span></label>)}</div>
     <div className="target-form-grid"><label>Kanal<select aria-label="Kanal" value={draft.channel} onChange={e=>setDraft({...draft,channel:e.target.value})}><option value="field">Sales lapangan</option><option value="telesales">Telesales</option></select></label>{!draft.custom_period&&<label>Bulan target<input required type="month" value={draft.month} onChange={e=>setDraft({...draft,month:e.target.value,...monthRange(e.target.value||localMonth())})}/></label>}</div>
     <label className="inline-check"><input type="checkbox" checked={draft.custom_period} onChange={e=>setDraft({...draft,custom_period:e.target.checked})}/>Gunakan rentang tanggal khusus</label>
     {draft.custom_period&&<div className="target-form-grid"><label>Tanggal mulai<input required type="date" value={draft.period_start} onChange={e=>setDraft({...draft,period_start:e.target.value})}/></label><label>Tanggal akhir<input required type="date" min={draft.period_start} value={draft.period_end} onChange={e=>setDraft({...draft,period_end:e.target.value})}/></label></div>}
     {draft.method==='top_down'&&<label>Target keseluruhan (Rp)<input required min="1" max="1000000000000000" type="number" step="1" inputMode="numeric" value={draft.parent_minor} onChange={e=>setDraft({...draft,parent_minor:e.target.value})}/></label>}
     <label>Dasar penetapan<textarea required maxLength={500} placeholder="Contoh: Rencana pertumbuhan penjualan bulan ini" value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
    </>}
    {modal==='items'&&<>
     <div className="target-total-strip"><span><small>Total rincian</small><strong>{rp(leafTotal)}</strong></span><span><small>Belum dialokasikan</small><strong>{rp(reserve)}</strong></span><span><small>{selected.method==='top_down'?'Target keseluruhan':'Total target'}</small><strong>{rp(selected.method==='top_down'?selected.parent_minor:leafTotal+reserve)}</strong></span></div>
     {selected.method==='top_down'&&leafTotal+reserve!==selected.parent_minor&&<p className="notice danger">Selisih {rp(selected.parent_minor-leafTotal-reserve)}. Samakan total rincian dan cadangan dengan target keseluruhan.</p>}
     {!rows.length&&<div className="target-empty"><p>Tambahkan pelanggan atau sales yang akan menerima target.</p></div>}
     <div className="target-item-list">{rows.map((r,index)=><section className="target-item" key={r.key}><div className="target-item-heading"><strong>Rincian {index+1}</strong>{editable&&<button className="button secondary" type="button" onClick={()=>setRows(previous=>previous.filter(x=>x.key!==r.key))}>Hapus</button>}</div>
      <div className="target-form-grid"><label>Basis target<select aria-label={'Basis rincian '+(index+1)} value={r.basis} onChange={e=>patchRow(r.key,{basis:e.target.value as TargetRow['basis'],customer_id:'',rep_id:'',area_id:''})}><option value="customer">Pelanggan</option><option value="rep">{selected.channel==='telesales'?'Telesales':'Sales lapangan'}</option></select></label>
       {r.basis==='customer'?<CustomerPicker value={r.customer_id} disabled={!editable||busy} onChange={(value,option)=>patchRow(r.key,{customer_id:value,area_id:option?.area_id||''})}/>:<label>Sales<select required value={r.rep_id} onChange={e=>patchRow(r.key,{rep_id:e.target.value})}><option value="">Pilih sales</option>{sales.map(u=><option key={u.id} value={u.id}>{presentationLabel(u.name)}</option>)}</select></label>}
       <label>Area<select required value={r.area_id} disabled={r.basis==='customer'} onChange={e=>patchRow(r.key,{area_id:e.target.value})}><option value="">{r.basis==='customer'?'Mengikuti pelanggan':'Pilih area'}</option>{areas.map(a=><option key={a.id} value={a.id}>{presentationLabel(a.name)}</option>)}</select></label>
       <label>Target (Rp)<input required min="0" max="1000000000000000" step="1" type="number" inputMode="numeric" value={r.target_minor} onChange={e=>patchRow(r.key,{target_minor:e.target.value})}/></label>
      </div><label>Dasar target<input required maxLength={500} placeholder="Contoh: Potensi pelanggan atau rencana pertumbuhan" value={r.reason} onChange={e=>patchRow(r.key,{reason:e.target.value})}/></label>
     </section>)}</div>
     {editable&&<button className="button secondary" type="button" disabled={rows.length>=200} onClick={()=>setRows(previous=>[...previous,emptyRow()])}>Tambah rincian</button>}
     <small>Gunakan basis pelanggan atau sales tanpa cakupan yang bertumpang tindih. Maksimal 200 rincian per versi.</small>
     <label>Cadangan belum dialokasikan (Rp)<input required type="number" min="0" max="1000000000000000" step="1" value={draft.reserve_minor} onChange={e=>setDraft({...draft,reserve_minor:e.target.value})}/><small>Terpisah dari rincian penerima target.</small></label>
    </>}
    {modal==='allocation'&&<>
     <div className="target-total-strip"><span><small>Target keseluruhan</small><strong>{rp(selected.parent_minor)}</strong></span><span><small>Pelanggan dipilih</small><strong>{allocationCustomers.length} / 200</strong></span></div>
     <p className={'notice '+(coverageLoaded&&!baselineComplete?'danger':'')}>{!coverageLoaded?'Memeriksa histori invoice…':baselineComplete?`Histori tersedia: ${baseline!.from} — ${baseline!.through}`:`Histori ${baseline!.from} — ${baseline!.through} belum dikonfirmasi lengkap.`}</p>
     {coverageLoaded&&!baselineComplete&&<p>Konfirmasi kelengkapan melalui Status & tier → Cakupan sumber, atau gunakan Atur rincian untuk pembagian manual.</p>}
     <CustomerPicker label="Tambahkan pelanggan" value={allocationPick} required={false} disabled={allocationCustomers.length>=200||busy} onChange={(value,option)=>{setAllocationPick(value);addCustomer(option)}}/>
     {!allocationCustomers.length&&<p className="muted">Cari pelanggan dari nama atau kode ERP untuk mulai membagi target.</p>}
     <div className="target-item-list">{allocationCustomers.map(c=><section className="target-item" key={c.id}><div className="target-item-heading"><strong>{presentationLabel(c.name)}</strong><button type="button" className="button secondary" onClick={()=>setAllocationCustomers(previous=>previous.filter(x=>x.id!==c.id))}>Hapus</button></div><label>Nominal tetap / target pelanggan baru (opsional)<input type="number" min="0" max="1000000000000000" step="1" value={draft.onboarding[c.id]??''} onChange={e=>setDraft({...draft,onboarding:{...draft.onboarding,[c.id]:e.target.value}})}/><small>Kosongkan untuk bobot historis. Pelanggan tanpa histori harus diisi.</small></label></section>)}</div>
     <label>Cadangan belum dialokasikan (Rp)<input required type="number" min="0" max={selected.parent_minor} step="1" value={draft.reserve_minor} onChange={e=>setDraft({...draft,reserve_minor:e.target.value})}/></label>
     <label>Dasar alokasi<textarea required maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
    </>}
    {modal==='action'&&<>
     <p>{draft.action==='submit'?'Setelah diajukan, rincian versi ini dikunci untuk ditinjau.':draft.action==='approve'?'Pengesahan mengaktifkan target untuk pencapaian. Akun pengesah harus berbeda dari pembuat dan pengaju versi.':'Versi aktif tetap digunakan sampai revisi baru disahkan.'}</p>
     <div className="target-total-strip"><span><small>Total target</small><strong>{rp(selected.parent_minor)}</strong></span><span><small>Cadangan</small><strong>{rp(selected.reserve_minor)}</strong></span></div>
     <label>Alasan / dasar keputusan<textarea required maxLength={500} autoFocus value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
    </>}
    {editable&&<div className="target-dialog-actions"><button type="button" className="button secondary" onClick={close}>Batal</button><button type="submit" className="button" disabled={busy||modal==='items'&&(!rows.length||selected.method==='top_down'&&leafTotal+reserve!==selected.parent_minor)||modal==='allocation'&&(!allocationCustomers.length||!coverageLoaded||!baselineComplete)}>{busy?'Menyimpan…':modal==='plan'?'Lanjut ke pembagian':modal==='items'?'Simpan rincian':modal==='allocation'?'Hitung & simpan draft alokasi':actionTitle}</button></div>}
   </fieldset></form>
  </Modal>}
 </div>;
}
