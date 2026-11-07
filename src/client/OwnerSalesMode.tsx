import React,{useState} from 'react';
import {UserRoundCog,Undo2} from 'lucide-react';
import {apiFetch,useIdentity} from './auth';
import {Modal} from './Modal';

export function OwnerSalesMode(){
 const {identity,switchSalesMode}=useIdentity();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sales,setSales]=useState<Array<{id:string;name:string}>>([]),[selected,setSelected]=useState('');
 if(!identity.portfolio_owner)return null;
 async function show(){setOpen(true);setBusy(true);setError('');try{const r=await apiFetch('/api/owner-sales-mode'),body=await r.json() as {data:Array<{id:string;name:string}>};setSales(body.data);setSelected(body.data.find(s=>s.name.trim().toLowerCase()==='didik')?.id||body.data[0]?.id||'')}catch{setError('Daftar sales belum dapat dimuat. Coba kembali.')}finally{setBusy(false)}}
 async function change(id:string|null){setBusy(true);setError('');try{await switchSalesMode(id);setOpen(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="owner-sales-control">{identity.performed_by?<><span className="owner-sales-indicator" role="status">Mode Sales · {identity.name}</span><button type="button" className="button secondary" disabled={busy} onClick={()=>void change(null)}><Undo2 size={16} aria-hidden="true"/>{busy?'Mengganti…':'Kembali ke Management'}</button>{error&&<span role="alert">{error}</span>}</>:<button type="button" className="button secondary" onClick={()=>void show()}><UserRoundCog size={16} aria-hidden="true"/>Coba sebagai Sales</button>}
 {open&&<Modal title="Coba sebagai Sales" busy={busy} onClose={()=>setOpen(false)}>{error&&<p role="alert" className="notice danger">{error}</p>}<form onSubmit={e=>{e.preventDefault();void change(selected)}}><fieldset disabled={busy} className="settings-fields"><label>Sales<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Pilih sales</option>{sales.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="muted">Gunakan penugasan dan agenda sales ini. Kunjungan yang kamu simpan akan masuk ke data bersama, dengan owner tercatat di audit.</p>{!busy&&!sales.length&&!error&&<p>Belum ada akun sales lapangan aktif.</p>}<button type="submit" className="button" disabled={!selected||busy}><UserRoundCog size={16} aria-hidden="true"/>{busy?'Menyiapkan…':'Masuk mode Sales'}</button></fieldset></form></Modal>}</div>;
}
