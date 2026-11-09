import {VisitLocationSettings} from './VisitLocation';
import React,{useEffect,useRef,useState} from 'react';
import {useIdentity} from './auth';
import {ActionIcon} from './ActionIcon';
import {Loading} from './Loading';
import {DailyVisitWeights} from './DailyVisitWeights';
import {dailyRead,dailyWrite,dailyError} from './daily-visit-api';
import {defaultDailyPolicy,dailyPolicy,type DailyPolicy} from '../shared/daily-visit';

export function DailyVisitSettings(){
 const {identity}=useIdentity(),[setup,setSetup]=useState<any>(null),[draft,setDraft]=useState<DailyPolicy>(defaultDailyPolicy),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const retry=useRef<{signature:string;key:string}|null>(null);
 async function load(){setLoading(true);setError('');try{const value=await dailyRead('setup');setSetup(value);setDraft(value.policy?.config||{...defaultDailyPolicy,calendar_id:value.calendars[0]?.id||''})}catch(e){setError(dailyError(e))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function save(e:React.FormEvent){e.preventDefault();if(busy)return;const parsed=dailyPolicy.safeParse(draft);if(!parsed.success){setError('Periksa pengaturan dan total bobot 100%.');return}setBusy(true);setError('');setMessage('');try{
  const signature=JSON.stringify([draft,setup.policy?.version??0]);if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
  const value=await dailyWrite('policy',draft,'PUT',setup.policy?.version??0,retry.current.key);retry.current=null;setSetup({...setup,policy:value});setDraft(value.config);setMessage('Pengaturan generator disimpan.');
 }catch(e){setError(dailyError(e))}finally{setBusy(false)}}
 const total=Object.values(draft.weights).reduce((a,b)=>a+b,0);
 return <><section aria-label="Pengaturan generator harian"><div className="card-header"><h3>Generator kunjungan harian</h3><button type="button" className="button secondary" disabled={loading||busy} onClick={()=>void load()}><ActionIcon name="refresh"/>Muat ulang</button></div>
 {error&&<p role="alert" className="notice danger">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
 {loading?<Loading>Memuat pengaturan generator</Loading>:setup&&<form onSubmit={save}><fieldset disabled={busy||identity.read_only||!setup.manage} className="settings-fields"><div className="daily-visit-fields">
 <label>Kalender kerja<select required value={draft.calendar_id} onChange={e=>setDraft({...draft,calendar_id:e.target.value})}><option value="">Pilih kalender</option>{setup.calendars.map((cal:any)=><option key={cal.id} value={cal.id}>{cal.name} · {cal.start_time}–{cal.end_time}</option>)}</select></label>
 {([['target_visits','Target visit / hari',1,20],['service_minutes','Slot kunjungan (menit)',30,120],['minimum_gap_days','Jarak minimum kunjungan (hari)',0,90],['break_minutes','Istirahat (menit)',0,120]]as const).map(([key,label,min,max])=><label key={key}>{label}<input type="number" required min={min} max={max} value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}/></label>)}
 <label>Mulai istirahat<input type="time" required value={draft.break_start} onChange={e=>setDraft({...draft,break_start:e.target.value})}/></label></div>
 <h4>Bobot bawaan organisasi</h4><DailyVisitWeights value={draft.weights} onChange={weights=>setDraft({...draft,weights})}/>
 <div className="settings-fields"><label className="inline-check"><input type="checkbox" checked={draft.allow_unverified_coordinates} onChange={e=>setDraft({...draft,allow_unverified_coordinates:e.target.checked})}/>Izinkan koordinat pelanggan yang belum diverifikasi</label>
 <label className="inline-check"><input type="checkbox" checked={draft.use_shift_as_opening_window} onChange={e=>setDraft({...draft,use_shift_as_opening_window:e.target.checked})}/>Gunakan jam kerja jika jam buka pelanggan belum dicatat</label>
 <label className="inline-check"><input type="checkbox" checked={draft.allow_rep_publish} onChange={e=>setDraft({...draft,allow_rep_publish:e.target.checked})}/>Izinkan sales memasukkan hasil rute ke agenda</label></div>
 <div className="actions"><button className="button" disabled={total!==100}><ActionIcon name="save"/>{busy?'Menyimpan…':'Simpan pengaturan'}</button></div>
 </fieldset></form>}
 </section><VisitLocationSettings/></>;
}
