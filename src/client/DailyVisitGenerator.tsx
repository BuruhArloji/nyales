import React,{useEffect,useState} from 'react';
import {apiFetch} from './auth';
import {ActionIcon} from './ActionIcon';
import {Modal} from './Modal';
import {MapLibreCanvas} from './MapView';
import {customDailyWindow,suggestedDailyEnd} from './daily-visit-time';
import {StreetView} from './StreetView';
import {defaultDailyPolicy,dailyWeights} from '../shared/daily-visit';

import {dailyRead as request,dailyWrite as write,dailyError as formatError} from './daily-visit-api';
import {DailyVisitWeights} from './DailyVisitWeights';
import {geoNavigate} from './geo-navigation';
const clock=(seconds:number,timezone:string)=>new Intl.DateTimeFormat('id-ID',{timeZone:timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(seconds*1000));
export function DailyVisitGenerator({users,identity,sessions,onApplied}:{users:any[];identity:any;sessions:any[];onApplied:()=>void}){
 const [startMode,setStartMode]=useState<'now'|'manual'>('now');
 const [customHours,setCustomHours]=useState(false),[customStart,setCustomStart]=useState(''),[customEnd,setCustomEnd]=useState('');
 const [setup,setSetup]=useState<any>(null),[modal,setModal]=useState<'route'|null>(null),[draft,setDraft]=useState<any>(defaultDailyPolicy),[rep,setRep]=useState(identity.role==='SALES_REP'?identity.id:''),[lat,setLat]=useState(''),[lng,setLng]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<any>(null),[history,setHistory]=useState<any[]>([]),[street,setStreet]=useState<any>(null),[message,setMessage]=useState('');
 const reps=users.filter(u=>u.role_code==='SALES_REP'&&u.channel==='field');
 async function loadSetup(){try{const value=await request('setup');setSetup(value);setDraft(value.policy?.config||{...defaultDailyPolicy,calendar_id:value.calendars[0]?.id||''})}catch(e){setError(formatError(e))}}
 useEffect(()=>{void loadSetup()},[]);
 useEffect(()=>{if(!rep&&reps.length)setRep(reps[0].id)},[users]);
 async function loadHistory(){if(!rep)return;try{setHistory((await request('runs?rep_id='+encodeURIComponent(rep))).runs)}catch(e){setError(formatError(e))}}
 useEffect(()=>{setResult(null);if(modal==='route')void loadHistory()},[rep,modal]);
 async function locate(){setError('');setBusy(true);try{const point=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000}));setLat(String(point.coords.latitude));setLng(String(point.coords.longitude))}catch{setError('Lokasi belum tersedia. Izinkan akses lokasi atau isi titik awal secara manual.')}finally{setBusy(false)}}
 async function generate(){setBusy(true);setError('');setMessage('');try{
  const customWindow=customHours?customDailyWindow(setup.today,setup.calendar.timezone,startMode,customStart,customEnd):null;
  if(!customHours&&Date.parse(setup.work_window.end_at)<=Date.now()+120000)throw Error('Jam kerja hari ini sudah berakhir.');
  const startAt=customWindow?.start_at??new Date(Math.max(Date.now()+120000,Date.parse(setup.work_window.start_at))).toISOString(),previous=history.find(h=>h.status==='applied');
  if(rep===identity.id&&!sessions.some(s=>s.user_id===identity.id&&!s.ended_at&&s.kind==='work')){
   await apiFetch('/api/work-sessions',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({kind:'work',reason:'Mulai hari melalui generator kunjungan'})});onApplied();
  }
  const value=await write('runs',{rep_id:rep,start:{latitude:Number(lat),longitude:Number(lng)},start_at:startAt,end_at:customWindow?.end_at??setup.work_window.end_at,...(customHours?{custom_work_hours:true}:{}),confirmed_external_processing:true,weights:draft.weights,...(previous?{replace_run_id:previous.id}:{})});setResult(value);await loadHistory();
 }catch(e){setError(formatError(e))}finally{setBusy(false)}}
 async function apply(){setBusy(true);setError('');try{const value=await write('runs/'+result.id+'/apply',{confirmed:true});setResult({...result,status:'applied',current:false});setMessage(`${value.created??0} kunjungan masuk agenda hari ini.`);await loadHistory();onApplied()}catch(e){setError(formatError(e))}finally{setBusy(false)}}
 async function openRun(id:string){setBusy(true);setError('');try{setResult(await request('runs/'+id))}catch(e){setError(formatError(e))}finally{setBusy(false)}}
 if(identity.channel==='telesales'||identity.role==='TELESALES')return null;
 const hasApplied=history.some(h=>h.status==='applied'),weightsValid=dailyWeights.safeParse(draft.weights).success;
 const map=result?.route?{customers:result.route.steps.filter((s:any)=>s.type==='job').map((s:any)=>({id:s.customer_id,name:s.customer_name,lng:s.location[0],lat:s.location[1],owner:result.rep.name,status:'Unknown'})),sales:[],reference_points:[],basemap:{style_url:'https://tiles.openfreemap.org/styles/positron'},analysis_period:result.date.slice(0,7),analysis_channel:'field'}:null;
 return <>
  <div className="daily-visit-launch"><div className="daily-visit-launch-heading"><img src="/images/daily-visit-plan.png" alt="" aria-hidden="true" width="56" height="56"/><div><strong>Rencana kunjungan hari ini</strong>{setup?.policy&&<small>Target {setup.policy.config.target_visits} kunjungan · {setup.calendar?.name}</small>}</div></div><div className="data-actions"><button type="button" className="button" onClick={()=>{setModal('route');setError('');setMessage('')}}><ActionIcon name="calendar"/>{identity.role==='SALES_REP'?'Mulai hari':'Susun rute harian'}</button></div></div>
  {message&&!modal&&<p role="status" className="notice">{message}</p>}
  {error&&!modal&&<p role="alert" className="notice danger">{error}</p>}
  {modal&&<Modal title="Rencana kunjungan hari ini" busy={busy} onClose={()=>!busy&&setModal(null)} className="daily-visit-dialog">
   {error&&<p role="alert" className="notice danger">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
   <>
    {!setup?.policy?<p>Management perlu menyimpan pengaturan generator terlebih dahulu. {setup?.manage&&<button className="button secondary" onClick={()=>geoNavigate('settings',{settings_section:'planning'})}><ActionIcon name="settings"/>Buka pengaturan</button>}</p>:!setup.configured?<p role="alert">Koneksi ORS belum tersedia di server.</p>:<>
     <div className="daily-visit-fields"><label>Sales<select value={rep} disabled={busy||identity.role==='SALES_REP'} onChange={e=>setRep(e.target.value)}><option value="">Pilih sales</option>{reps.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Latitude awal<input type="number" step="any" min="-90" max="90" value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Longitude awal<input type="number" step="any" min="-180" max="180" value={lng} onChange={e=>setLng(e.target.value)}/></label></div>
     <div className="daily-visit-options"><button className="button secondary" disabled={busy} onClick={()=>void locate()}><ActionIcon name="location"/>Gunakan lokasi saya</button><span>{setup.calendar?.start_time}–{setup.calendar?.end_time} · {setup.calendar?.timezone} · kembali ke titik awal</span></div>
     {setup.custom_work_hours_allowed&&<><label className="inline-check"><input type="checkbox" checked={customHours} disabled={busy} onChange={e=>{setCustomHours(e.target.checked);setError('');if(e.target.checked&&!customEnd)setCustomEnd(suggestedDailyEnd(setup.calendar.timezone))}}/>Jam kerja khusus hari ini</label>{customHours&&<div className="daily-visit-fields daily-visit-time-fields"><div><span className="daily-visit-time-label">Mulai / {setup.calendar?.timezone}</span><div className="daily-visit-start-choice" role="group" aria-label="Waktu mulai"><button type="button" className={'button '+(startMode==='now'?'':'secondary')} aria-pressed={startMode==='now'} disabled={busy} onClick={()=>{setStartMode('now');setError('')}}>Mulai sekarang</button><button type="button" className={'button '+(startMode==='manual'?'':'secondary')} aria-pressed={startMode==='manual'} disabled={busy} onClick={()=>{setStartMode('manual');setError('')}}>Atur jam</button></div>{startMode==='manual'&&<label>Jam mulai<input type="time" lang="id-ID" required value={customStart} disabled={busy} onChange={e=>setCustomStart(e.target.value)}/></label>}</div><label>Selesai hari ini / {setup.calendar?.timezone}<input type="time" lang="id-ID" required value={customEnd} disabled={busy} onChange={e=>setCustomEnd(e.target.value)}/></label></div>}</>}
     <details className="daily-visit-priorities"><summary>Bobot prioritas rute</summary><DailyVisitWeights value={draft.weights} disabled={busy} onChange={weights=>setDraft({...draft,weights})}/><div className="data-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setDraft({...draft,weights:{...setup.policy.config.weights}})}><ActionIcon name="refresh"/>Gunakan bobot bawaan</button><small>Berlaku untuk usulan rute ini.</small></div></details>
     <label className="inline-check"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Izinkan titik dan jadwal dikirim ke ORS. Nama pelanggan tidak dikirim.</label>
     <button className="button" disabled={busy||!weightsValid||!rep||!consent||lat===''||lng===''||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))} onClick={()=>void generate()}><ActionIcon name="start"/>{busy?'Menghitung…':hasApplied?'Atur ulang sisa rute':'Buat usulan rute'}</button>
    </>}
    {result&&<section className="daily-visit-result"><div className="card-header"><h3>{result.rep.name}</h3><span className="badge neutral">{result.status==='applied'?'Masuk agenda':'Pratinjau'}</span></div><div className="daily-visit-summary"><span>Rencana <strong>{result.planned}/{result.target}</strong></span><span>Selesai hari ini <strong>{result.completed_today}</strong></span><span>Belum terisi <strong>{result.shortfall}</strong></span>{result.route&&<span>{(result.route.distance/1000).toLocaleString('id-ID',{maximumFractionDigits:1})} km · {Math.round(result.route.duration/60)} menit perjalanan</span>}</div>
     {map&&<MapLibreCanvas key={result.id} mapData={map} focus={null} onStreetView={setStreet} routeGeometry={result.geometry}/>}
     {result.route&&<div className="table-wrap"><table><thead><tr><th>Pelanggan</th><th>Layanan</th><th>Prioritas</th></tr></thead><tbody>{result.route.steps.filter((s:any)=>s.type==='job').map((step:any,index:number)=><tr key={step.customer_id}><td>{index+1}. {step.customer_name}{step.fixed_plan_id&&<small>Janji tetap</small>}</td><td>{clock(step.arrival+step.waiting_time,result.timezone)}</td><td>{step.score}<small>{step.reasons.join(' · ')}</small></td></tr>)}</tbody></table></div>}
     {!result.current&&result.status==='complete'&&<p className="notice">Data berubah atau rute kedaluwarsa. Buat usulan baru.</p>}
     {result.status==='complete'&&<button className="button" disabled={busy||identity.read_only||!result.current||!result.planned} onClick={()=>void apply()}><ActionIcon name="approve"/>Gunakan rencana</button>}
     <details className="daily-visit-exclusions"><summary>Belum dijadwalkan / dikecualikan · {result.unassigned.length+result.skipped.length}</summary>{result.not_shortlisted_count>0&&<p>{result.not_shortlisted_count} pelanggan layak lainnya berada di luar shortlist hari ini.</p>}{result.unassigned.map((c:any)=><p key={c.customer_id}>{c.customer_name}<small>{c.reason}</small></p>)}{result.skipped.slice(0,50).map((c:any)=><p key={c.id}>{c.name}<small>{({missing_coordinates:'Koordinat belum ada',unverified_coordinates:'Koordinat belum diverifikasi',visited_today:'Sudah dikunjungi hari ini',existing_agenda:'Sudah memiliki agenda',minimum_gap:'Belum waktunya dikunjungi kembali',missing_opening_hours:'Jam buka belum tersedia',closed_or_short_window:'Jam layanan tidak mencukupi'}as any)[c.reason]||c.reason}</small></p>)}{result.skipped.length>50&&<small>50 dari {result.skipped.length} pengecualian ditampilkan.</small>}</details>
     <small>{result.notice}</small>
    </section>}
    {history.length>0&&<details className="daily-visit-history"><summary>Riwayat hari ini</summary>{history.map(h=><div className="card-header" key={h.id}><span>{new Date(h.created_at).toLocaleTimeString('id-ID')} · {h.status}</span>{['complete','applied','superseded'].includes(h.status)&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void openRun(h.id)}><ActionIcon name="detail"/>Lihat</button>}</div>)}</details>}
   </>
  </Modal>}{street&&<StreetView customer={street} onClose={()=>setStreet(null)}/>}
 </>;
}
