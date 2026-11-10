import {CustomerProposals,CustomerProposalForm} from './CustomerProposals';
import {CustomerWallet} from './CustomerWallet';
import {FilterPanel} from './FilterPanel';
import {ActionIcon} from './ActionIcon';
import {presentationLabel,customerRelationshipLabel} from '../shared/business-labels';
import {Pagination,PageSizeSelect} from './Pagination';
import {readGeoContext,geoNavigate} from './geo-navigation';

import {LiquidTabs} from './LiquidNav';

import{Loading}from'./Loading';

import React,{useEffect,useRef,useState} from 'react';

import {apiFetch,useIdentity} from './auth';

import {Modal} from './Modal';

type Kind='customers'|'contacts';

type Row={id:string;name:string;version:number;[key:string]:any};

const labels:Record<Kind,string>={customers:'Pelanggan',contacts:'Kontak'};

const empty={name:'',external_code:'',address:'',area_id:'',latitude:'',longitude:'',coordinate_status:'missing',location_note:'',record_status:'active',outlet_type:'',service_frequency_days:'',visit_window:'',customer_id:'',phone:'',contact_role:'',preferred_channel:'telesales',permission_status:'unknown',permission_note:''};

const permissionLabels:Record<string,string>={unknown:'Belum diketahui',allowed:'Diizinkan (manual)',denied:'Tidak diizinkan',dnc:'Jangan dihubungi'};

export function Customers(){

 const context=useRef(readGeoContext()).current;const geoQuery=new URLSearchParams();if(context.boundary_id)geoQuery.set('geo_boundary_id',context.boundary_id);if(context.mapping_bucket)geoQuery.set('geo_bucket',context.mapping_bucket);if(context.dataset_id)geoQuery.set('geo_dataset_id',context.dataset_id);for(const k of ['area_id','rep_id','channel'] as const)if(context[k])geoQuery.set(k,context[k]!);const fromMap=Boolean(context.boundary_id||context.mapping_bucket||context.risk_run_id);

 const {identity}=useIdentity(),canManage=identity.capabilities.includes('settings:manage');
 const [showProposals,setShowProposals]=useState(false),[proposalCustomer,setProposalCustomer]=useState<any>(undefined),[proposalOpen,setProposalOpen]=useState(false);
 const canPropose=identity.role==='SALES_REP'&&!identity.read_only,canSeeProposals=(identity as any).channel!=='telesales'&&identity.role!=='TELESALES';

 const [kind,setKind]=useState<Kind>('customers'),[records,setRecords]=useState<Record<Kind,Row[]>>({customers:[],contacts:[]}),[areas,setAreas]=useState<Row[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');

 const [page,setPage]=useState(0),[pageSize,setPageSize]=useState(50);
 const [total,setTotal]=useState(0),firstLoad=useRef(true);
 const serverPaged=!fromMap;
 const [q,setQ]=useState(''),[area,setArea]=useState(context.area_id||''),[status,setStatus]=useState(context.customer_status||''),[location,setLocation]=useState(''),[recordStatus,setRecordStatus]=useState(fromMap?'':'active');

 const [modal,setModal]=useState<'form'|'archive'|'detail'|null>(null),[edit,setEdit]=useState<Row|null>(null),[draft,setDraft]=useState<Record<string,string>>({...empty});

 const [events,setEvents]=useState<any[]>([]),[timelineError,setTimelineError]=useState(''),[timelineLoading,setTimelineLoading]=useState(false),[more,setMore]=useState(false);

 const retry=useRef<{signature:string;key:string}|null>(null);
 const referencesReady=useRef(false),loadSequence=useRef(0),mounted=useRef(true);
 const referenceRequest=useRef<Promise<{contacts:Row[];areas:Row[]}>|null>(null);

 function loadReferences(refresh=false):Promise<{contacts:Row[];areas:Row[]}|null>{
  if(refresh)referencesReady.current=false;
  if(referencesReady.current)return Promise.resolve(null);
  if(referenceRequest.current)return referenceRequest.current;
  const request:Promise<{contacts:Row[];areas:Row[]}>=Promise.all(['contacts','areas'].map(async name=>{
   const response=await apiFetch('/api/'+name);
   return(await response.json() as {data:Row[]}).data;
  })).then(([contacts,areas])=>({contacts,areas})).finally(()=>{
   if(referenceRequest.current===request)referenceRequest.current=null;
  });
  referenceRequest.current=request;
  return request;
 }

 async function loadCustomers(pageIndex:number){
  const p=new URLSearchParams(geoQuery);
  if(serverPaged){
   p.set('limit',String(pageSize));p.set('offset',String(pageIndex*pageSize));
   if(q.trim())p.set('q',q.trim());
   if(area)p.set('area_id',area);
   if(status)p.set('status',status);
   if(location)p.set('location',location);
   if(recordStatus)p.set('record_status',recordStatus);
  }
  const r=await apiFetch('/api/customers?'+p.toString());
  const body=await r.json() as {data:Row[];meta?:{total?:number}};
  return{rows:body.data,total:body.meta?.total??body.data.length};
 }
 async function load(pageIndex=page,refreshReferences=false){
  const sequence=++loadSequence.current;setLoading(true);
  try{
   const [customers,references]=await Promise.all([loadCustomers(pageIndex),loadReferences(refreshReferences)]);
   if(!mounted.current||sequence!==loadSequence.current)return;
   setRecords(previous=>({customers:customers.rows,contacts:references?.contacts??previous.contacts}));
   setTotal(customers.total);
   if(references){setAreas(references.areas);referencesReady.current=true}
   setError('');
  }catch(e){if(mounted.current&&sequence===loadSequence.current)setError((e as Error).message)}
  finally{if(mounted.current&&sequence===loadSequence.current)setLoading(false)}
 }

 useEffect(()=>{mounted.current=true;void load(0);return()=>{mounted.current=false;loadSequence.current++}},[]);
 // Filters and paging are resolved by the API; debounce keeps typing from spamming D1.
 useEffect(()=>{if(!serverPaged||kind!=='customers'){firstLoad.current=false;return}if(firstLoad.current){firstLoad.current=false;return}const timer=setTimeout(()=>{void load(page)},250);return()=>clearTimeout(timer)},[q,area,status,location,recordStatus,page,pageSize,kind]);
 // Risk evidence opens the canonical customer through the existing scoped detail endpoint.
 useEffect(()=>{if(!context.customer_id)return;let active=true;apiFetch('/api/customers/'+encodeURIComponent(context.customer_id)).then(r=>r.json() as Promise<{data:Row}>).then(({data})=>{if(active){setEdit(data);setModal('detail')}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[]);

 useEffect(()=>{if(modal!=='detail'||!edit)return;let active=true;setEvents([]);setTimelineError('');setTimelineLoading(true);apiFetch('/api/customers/'+edit.id+'/timeline').then(r=>r.json() as Promise<{data:any[];meta:{has_more:boolean}}>).then(result=>{if(active){setEvents(result.data);setMore(result.meta.has_more)}}).catch(e=>{if(active)setTimelineError(e.message)}).finally(()=>{if(active)setTimelineLoading(false)});return()=>{active=false}},[modal,edit?.id]);

 function close(){if(!busy){setModal(null);setEdit(null);setDraft({...empty});setError('')}}

 function open(row:Row|null){setEdit(row);setError('');setMessage('');setDraft({...empty,...Object.fromEntries(Object.keys(empty).map(key=>[key,row?.[key]===null||row?.[key]===undefined?empty[key as keyof typeof empty]:String(row[key])])),latitude:row?.latitude_e7===null||row?.latitude_e7===undefined?'':String(row.latitude_e7/1e7),longitude:row?.longitude_e7===null||row?.longitude_e7===undefined?'':String(row.longitude_e7/1e7)});setModal('form')}

 function change(key:string,value:string){setDraft(d=>{const next={...d,[key]:value};if(key==='latitude'||key==='longitude')next.coordinate_status=next.latitude===''&&next.longitude===''?'missing':'unverified';return next})}

 async function send(path:string,method:string,body:object,version?:number){const signature=JSON.stringify([path,method,body,version]);if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};const r=await apiFetch(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':retry.current.key,...(version?{'If-Match':`"${version}"`}:{})},body:JSON.stringify(body)});retry.current=null;return r}

 async function run(work:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setError('');setMessage('');try{await work();setModal(null);setEdit(null);setDraft({...empty});await load(page,true);setMessage(success)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}

 function save(e:React.FormEvent){e.preventDefault();void run(async()=>{

  const coordinate=(value:string)=>{if(value==='')return null;const number=Number(value);if(!Number.isFinite(number))throw new Error('Koordinat harus berupa angka.');return Math.round(number*1e7)};

  const body=kind==='contacts'?{name:draft.name,customer_id:draft.customer_id,phone:draft.phone,contact_role:draft.contact_role,preferred_channel:draft.preferred_channel,permission_status:draft.permission_status,permission_note:draft.permission_note}:{name:draft.name,external_code:draft.external_code.trim()||null,address:draft.address,area_id:draft.area_id,latitude_e7:coordinate(draft.latitude),longitude_e7:coordinate(draft.longitude),coordinate_status:draft.coordinate_status,location_note:draft.location_note,record_status:draft.record_status,outlet_type:draft.outlet_type,service_frequency_days:draft.service_frequency_days===''?null:Number(draft.service_frequency_days),visit_window:draft.visit_window};

  await send('/api/'+kind+(edit?'/'+edit.id:''),edit?'PUT':'POST',body,edit?.version)

 },labels[kind]+' tersimpan. Perubahan tercatat dalam histori.')}

 const list=records[kind].filter(r=>[r.name,r.id,r.external_code,r.customer_name,r.phone_display,r.owner,r.address].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase())&&(kind!=='customers'||((!recordStatus||r.record_status===recordStatus)&&(!area||r.area_id===area)&&(!status||(status==='Leads'||status==='Pernah bertransaksi'?customerRelationshipLabel(r)===status:r.status===status))&&(!location||(location==='missing'?r.latitude_e7===null||r.longitude_e7===null:r.coordinate_status===location)))));
 useEffect(()=>setPage(0),[kind,q,area,status,location,recordStatus,pageSize]);
 const serverList=serverPaged&&kind==='customers';
 const pageCount=Math.max(1,Math.ceil((serverList?total:list.length)/pageSize)),safePage=Math.min(page,pageCount-1),pageRows=serverList?list:list.slice(safePage*pageSize,(safePage+1)*pageSize);


 const field=(key:string,label:string,options:{type?:string;required?:boolean;maxLength?:number}={})=><label>{label}<input type={options.type||'text'} required={options.required} maxLength={options.maxLength||160} step={options.type==='number'?'any':undefined} value={draft[key]} onChange={e=>change(key,e.target.value)}/></label>;

 return <>{fromMap&&<div className="callout geo-drill-banner"><span>Daftar dari Peta & Wilayah · pemetaan saat ini</span><button className="button secondary" onClick={()=>geoNavigate('map',context)}><ActionIcon name="back"/>Kembali ke peta</button></div>}<div className="page-heading"><div><h1>Pelanggan, lebih terarah.</h1></div></div><div className="page-toolbar"><LiquidTabs className="settings-tabs" role="tablist" aria-label="Master customer">{(Object.keys(labels) as Kind[]).map(k=><button role="tab" aria-selected={!showProposals&&kind===k} key={k} className={'button '+(!showProposals&&kind===k?'':'secondary')} onClick={()=>{setShowProposals(false);setKind(k);setQ('');setError('');setMessage('')}}>{labels[k]}</button>)}{canSeeProposals&&<button role="tab" aria-selected={showProposals} className={'button '+(showProposals?'':'secondary')} onClick={()=>setShowProposals(true)}>Pengajuan</button>}</LiquidTabs>{canPropose&&<button className="button page-add" onClick={()=>{setProposalCustomer(undefined);setProposalOpen(true)}}><ActionIcon name="add"/>Ajukan pelanggan</button>}{canManage&&!showProposals&&<button className="button page-add" disabled={loading||busy} onClick={()=>open(null)}><span aria-hidden="true">＋</span>Tambah {labels[kind].toLowerCase()}</button>}</div>

 {showProposals?<CustomerProposals/>:<>
 {error&&!modal&&<p role="alert" className="notice danger">{error}<button className="button secondary" onClick={()=>void load()}><ActionIcon name="refresh"/>Coba lagi</button></p>}{message&&<p role="status" className="callout success">{message}</p>}

 <section className="card"><h2>{labels[kind]}</h2>{loading?<Loading>Memuat master customer…</Loading>:<><FilterPanel embedded label={'Filter '+labels[kind].toLowerCase()} count={[q,area,status,location,recordStatus!=='active'?recordStatus||'all':''].filter(Boolean).length} onReset={()=>{setQ('');setArea('');setStatus('');setLocation('');setRecordStatus('active')}}><label>Cari {labels[kind].toLowerCase()}<input type="search" aria-label="Cari customer" placeholder={'Cari '+labels[kind].toLowerCase()+'…'} value={q} onChange={e=>setQ(e.target.value)}/></label>{kind==='customers'&&<><label>Area<select aria-label="Filter area" value={area} onChange={e=>setArea(e.target.value)}><option value="">Semua area</option>{areas.map(a=><option value={a.id} key={a.id}>{presentationLabel(a.name)}</option>)}</select></label><label>Status pelanggan<select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option>{status&&!['Leads','Pernah bertransaksi'].includes(status)&&<option value={status}>{status}</option>}{['Leads','Pernah bertransaksi'].map(x=><option key={x}>{x}</option>)}</select></label><label>Status data<select aria-label="Filter status outlet" value={recordStatus} onChange={e=>setRecordStatus(e.target.value)}><option value="">Semua outlet</option><option value="active">Outlet aktif</option><option value="inactive">Outlet nonaktif</option></select></label><label>Koordinat<select aria-label="Filter koordinat" value={location} onChange={e=>setLocation(e.target.value)}><option value="">Semua lokasi</option><option value="missing">Belum ada koordinat</option><option value="unverified">Belum diverifikasi</option><option value="verified">Diverifikasi manual</option></select></label></>}</FilterPanel>

 <Pagination label="Halaman daftar" page={safePage} pageCount={pageCount} total={serverList?total:list.length} pageSize={pageSize} busy={loading} onPrevious={()=>setPage(safePage-1)} onNext={()=>setPage(safePage+1)}><PageSizeSelect value={pageSize} onChange={value=>{setPageSize(value);setPage(0)}}/></Pagination>
 <div className="table-wrap"><table><thead><tr><th>{labels[kind]}</th>{kind==='customers'?<><th>Area / owner</th><th>Status / lokasi</th><th>Tier penjualan</th><th className="number">Actual bulan ini</th></>:<><th>Outlet / peran</th><th>Nomor / kanal</th><th>Izin / status</th></>}<th>Aksi</th></tr></thead><tbody>{pageRows.map(row=><tr key={row.id}><td><strong className="customer-record-name">{presentationLabel(row.name)}</strong>{row.external_code&&<small>{row.external_code}</small>}</td>{kind==='customers'?<><td>{presentationLabel(row.area)}<small>{presentationLabel(row.owner)}</small></td><td><span className="badge neutral" title="Status pelanggan; verifikasi koordinat dicatat terpisah.">{customerRelationshipLabel(row)}</span><small>{row.record_status==='inactive'?'Outlet nonaktif · ':''}{row.latitude_e7===null||row.longitude_e7===null?'Belum ada koordinat':row.coordinate_status==='verified'?'Diverifikasi manual':'Lokasi belum diverifikasi'}</small>{Boolean(row.external_code_review)&&<small>Kode ERP perlu review</small>}</td><td>{row.tier}</td><td className="number">{new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(row.actual_minor)}</td></>:<><td>{presentationLabel(row.customer_name)}<small>{row.contact_role||'Peran belum diisi'}</small></td><td>{row.phone_display}<small>{row.preferred_channel==='field'?'Lapangan':'Telesales'}</small></td><td>{permissionLabels[row.permission_status]}<small>{row.status==='archived'?'Diarsipkan':'Aktif'}</small></td></>}<td className="row-actions">{kind==='customers'&&<button className="text-button" aria-label={'Lihat '+presentationLabel(row.name)} onClick={()=>{setEdit(row);setError('');setModal('detail')}}><ActionIcon name="detail"/>Lihat</button>}{kind==='customers'&&canPropose&&<button className="button secondary" onClick={()=>{setProposalCustomer(row);setProposalOpen(true)}}><ActionIcon name="location"/>Ajukan lokasi</button>}{canManage&&row.status!=='archived'&&<><button className="text-button" aria-label={'Edit '+presentationLabel(row.name)} onClick={()=>open(row)}><ActionIcon name="edit"/>Edit</button>{kind!=='customers'&&<button className="text-button" aria-label={'Arsipkan '+presentationLabel(row.name)} onClick={()=>{setEdit(row);setError('');setMessage('');setModal('archive')}}><ActionIcon name="archive"/>Arsipkan</button>}</>}</td></tr>)}{!list.length&&<tr><td colSpan={kind==='customers'?6:5}>Tidak ada {labels[kind].toLowerCase()} dalam scope/filter ini.</td></tr>}</tbody></table></div><small className="muted">{list.length} {labels[kind].toLowerCase()} dalam scope/filter ini.{kind==='customers'?' Outlet tanpa koordinat tetap masuk daftar dan total.':''}</small></>}</section>

 {modal==='form'&&<Modal title={(edit?'Edit ':'Tambah ')+labels[kind].toLowerCase()} busy={busy} onClose={close}>{error&&<p className="notice danger" role="alert">{error}</p>}<form onSubmit={save}><fieldset className="settings-fields" disabled={busy}>{field('name','Nama '+labels[kind].toLowerCase(),{required:true})}

 {kind==='customers'&&<>{field('external_code','Kode ERP outlet (opsional)',{maxLength:128})}<label>Alamat<textarea required maxLength={500} value={draft.address} onChange={e=>change('address',e.target.value)}/></label><label>Area<select aria-label="Area" required value={draft.area_id} onChange={e=>change('area_id',e.target.value)}><option value="">Pilih area</option>{areas.filter(a=>a.status==='active'||a.id===draft.area_id).map(a=><option key={a.id} value={a.id}>{presentationLabel(a.name)}</option>)}</select></label>{edit&&<small>Outlet yang sudah ditugaskan atau memiliki transaksi memerlukan alur transfer untuk pindah area.</small>}{field('outlet_type','Tipe outlet')}

 <div className="customer-coordinate-fields">{field('latitude','Latitude (opsional)',{type:'number'})}{field('longitude','Longitude (opsional)',{type:'number'})}</div><label>Status lokasi<select aria-label="Status lokasi" value={draft.coordinate_status} onChange={e=>change('coordinate_status',e.target.value)}><option value="missing">Belum ada koordinat</option><option value="unverified">Belum diverifikasi</option><option value="verified">Diverifikasi manual</option></select></label><label>Catatan lokasi / verifikasi<textarea required={draft.coordinate_status==='verified'} maxLength={500} value={draft.location_note} onChange={e=>change('location_note',e.target.value)}/></label>{field('service_frequency_days','Frekuensi layanan (jumlah hari, opsional)',{type:'number'})}{field('visit_window','Jam menerima kunjungan (opsional)')}<label>Status outlet<select aria-label="Status outlet" value={draft.record_status} onChange={e=>change('record_status',e.target.value)}><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label></>}

 {kind==='contacts'&&<><label>Outlet kontak<select aria-label="Outlet kontak" required disabled={Boolean(edit)} value={draft.customer_id} onChange={e=>change('customer_id',e.target.value)}><option value="">Pilih outlet</option>{edit&&draft.customer_id&&!records.customers.some(c=>c.id===draft.customer_id)&&<option value={draft.customer_id}>{presentationLabel(edit.customer_name)} (ID asal yang digabung)</option>}{records.customers.filter(c=>c.record_status==='active'||c.id===draft.customer_id).map(c=><option key={c.id} value={c.id}>{presentationLabel(c.name)}</option>)}</select></label>{field('phone','Nomor telepon',{type:'tel',required:true,maxLength:80})}<small>Format 08… dinormalisasi ke +62. Nomor yang sama tidak otomatis menggabungkan outlet.</small>{field('contact_role','Peran kontak')}<label>Kanal pilihan<select aria-label="Kanal pilihan" value={draft.preferred_channel} onChange={e=>change('preferred_channel',e.target.value)}><option value="field">Lapangan</option><option value="telesales">Telesales</option></select></label><label>Izin kontak (dicatat manual)<select aria-label="Izin kontak (dicatat manual)" value={draft.permission_status} onChange={e=>change('permission_status',e.target.value)}>{Object.entries(permissionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Catatan / sumber izin<textarea required={draft.permission_status!=='unknown'} maxLength={500} value={draft.permission_note} onChange={e=>change('permission_note',e.target.value)}/></label><small>Mengganti nomor mengembalikan izin ke belum diketahui. Simpan nomor dahulu, lalu catat izin untuk nomor baru. Status ini tidak mengaktifkan panggilan otomatis.</small></>}

 <div className="actions"><button type="submit" className="button">{busy?'Menyimpan…':'Simpan '+labels[kind].toLowerCase()}</button><button className="button secondary" type="button" onClick={close}><ActionIcon name="close"/>Batal</button></div></fieldset></form></Modal>}

 {modal==='archive'&&edit&&<Modal title={'Arsipkan '+edit.name+'?'} busy={busy} onClose={close}>{error&&<p role="alert" className="notice danger">{error}</p>}<p>Record dinonaktifkan, histori tetap tersimpan.</p><div className="actions"><button className="button" disabled={busy} onClick={()=>void run(()=>send('/api/'+kind+'/'+edit.id+'/archive','POST',{},edit.version),'Record diarsipkan. Histori tetap tersimpan.')}>{busy?'Mengarsipkan…':'Konfirmasi arsip'}</button><button className="button secondary" disabled={busy} onClick={close}><ActionIcon name="close"/>Batal</button></div></Modal>}

 {modal==='detail'&&edit&&<Modal title={presentationLabel(edit.name)} busy={false} onClose={close}><CustomerWallet customerId={edit.demo_operation_overlay?.demo_customer_id||edit.id}/><dl className="record-summary"><div><dt>Area / owner</dt><dd>{presentationLabel(edit.area)} · {presentationLabel(edit.owner)}</dd></div><div><dt>Alamat</dt><dd>{edit.address||'Belum diisi'}</dd></div><div><dt>Invoice terakhir</dt><dd>{edit.last}</dd></div><div><dt>Lokasi</dt><dd>{edit.lat===null||edit.lng===null?'Belum ada koordinat':edit.lat+', '+edit.lng}</dd></div></dl><h3>Kontak</h3>{records.contacts.filter(c=>(c.customer_id===edit.id||c.canonical_customer_id===edit.id)&&c.status==='active').map(c=><p key={c.id}>{presentationLabel(c.name)} · {c.phone_display}<small className="customer-note">{permissionLabels[c.permission_status]}</small></p>)}{!records.contacts.some(c=>(c.customer_id===edit.id||c.canonical_customer_id===edit.id)&&c.status==='active')&&<p>Belum ada kontak aktif.</p>}<h3>Customer 360 · timeline dan next action</h3><p className="muted">Invoice, aktivitas, order, task dan forecast sesuai scope. Waktu pada task menunjukkan tenggat; catatan kanal lain hanya muncul bila diizinkan.</p>{timelineLoading?<Loading>Memuat timeline…</Loading>:timelineError?<p role="alert" className="notice danger">{timelineError}</p>:<>{events.map(event=><div className="settings-row" key={event.kind+event.id}><div><strong>{event.kind==='invoice'?'Invoice '+event.label:event.kind==='master'?'Perubahan outlet: '+event.label:event.kind}</strong><small>{event.invoice_date||event.occurred_at}</small>{event.kind!=='invoice'&&event.kind!=='master'&&<small>{event.label}</small>}</div></div>)}{!events.length&&<p>Belum ada aktivitas atau invoice dalam scope akun ini.</p>}{more&&<small>Menampilkan 100 peristiwa terbaru.</small>}</>}<div className="actions"><button className="button secondary" onClick={close}><ActionIcon name="close"/>Tutup detail</button></div></Modal>}</>}{proposalOpen&&<CustomerProposalForm customer={proposalCustomer} onClose={()=>setProposalOpen(false)} onSaved={()=>{setShowProposals(true);void load()}}/>}</>;
}

