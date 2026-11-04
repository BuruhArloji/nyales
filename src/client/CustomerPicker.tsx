import React,{useEffect,useId,useRef,useState} from 'react';
import {apiFetch} from './auth';

export type CustomerOption={id:string;name:string;external_code:string|null;area_id:string;record_status:string;visit_window:string};
type Result={data:CustomerOption[];meta:{has_more:boolean;next:string|null}};
async function read(params:URLSearchParams,signal:AbortSignal):Promise<Result>{return await(await apiFetch('/api/customer-options?'+params,{signal})).json() as Result}

/** At most twenty options rendered; completed search results stay component-local. */
export function CustomerPicker({label='Pelanggan',value,onChange,required=true,disabled=false,recordStatus='active',onResolve}:{label?:string;value:string;onChange:(value:string,option:CustomerOption|null)=>void;required?:boolean;disabled?:boolean;recordStatus?:'active'|'all';onResolve?:(option:CustomerOption|null)=>void}){
 const id=useId(),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),typing=useRef(false),selectedRef=useRef<CustomerOption|null>(null);
 const [text,setText]=useState(''),[selected,setSelected]=useState<CustomerOption|null>(null),[open,setOpen]=useState(false),[rows,setRows]=useState<CustomerOption[]>([]),[next,setNext]=useState<string|null>(null),[after,setAfter]=useState(''),[back,setBack]=useState<string[]>([]),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[hydrating,setHydrating]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const resolved=useRef(onResolve);resolved.current=onResolve;
 useEffect(()=>{resolved.current?.(selected?.id===value?selected:null)},[selected,value]);
 const query=selected?.id===value?'':text.trim().slice(0,100);
 useEffect(()=>{
  if(!value){setHydrating(false);selectedRef.current=null;setSelected(null);if(!typing.current)setText('');return}
  if(selectedRef.current?.id===value)return;
  const controller=new AbortController();selectedRef.current=null;setSelected(null);setText('');setHydrating(true);setError('');
  read(new URLSearchParams({id:value,record_status:recordStatus}),controller.signal).then(result=>{if(controller.signal.aborted)return;const row=result.data[0];if(!row){setError('Pelanggan tidak lagi tersedia dalam akses Anda.');return}selectedRef.current=row;setSelected(row);setText(row.name);typing.current=false}).catch(e=>{if(!controller.signal.aborted)setError('Pilihan pelanggan belum dapat dimuat.')}).finally(()=>{if(!controller.signal.aborted)setHydrating(false)});
  return()=>controller.abort();
 },[value,recordStatus,retry]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setLoading(true);setRows([]);setNext(null);setActive(-1);setError('');
  const timer=setTimeout(()=>{const params=new URLSearchParams({q:query,limit:'20',record_status:recordStatus});if(after)params.set('after',after);
   void read(params,controller.signal).then(result=>{if(controller.signal.aborted)return;setRows(result.data);setNext(result.meta.next)}).catch(()=>{if(!controller.signal.aborted)setError('Pencarian belum berhasil. Coba lagi.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  },250);
  return()=>{clearTimeout(timer);controller.abort()};
 },[open,query,after,recordStatus,retry]);
 useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
 useEffect(()=>{input.current?.setCustomValidity(value&&selected?.id===value?'':text||required?'Pilih pelanggan dari hasil pencarian.':'')},[value,selected,text,required]);
 function choose(row:CustomerOption){typing.current=false;selectedRef.current=row;setSelected(row);setText(row.name);onChange(row.id,row);setOpen(false);setError('');setAfter('');setBack([]);input.current?.focus()}
 function key(event:React.KeyboardEvent<HTMLInputElement>){
  if(event.key==='Escape'){setOpen(false);event.preventDefault();return}
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);setActive(i=>rows.length?(event.key==='ArrowDown'?(i+1)%rows.length:(i-1+rows.length)%rows.length):-1)}
  if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&rows[active])choose(rows[active])}
 }
 return <div className="customer-picker" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)}}>
  <label htmlFor={id+'-input'}>{label}</label><div className="customer-picker-control"><input ref={input} id={id+'-input'} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id+'-list'} aria-activedescendant={open&&active>=0?id+'-'+active:undefined} aria-describedby={id+'-status'} autoComplete="off" required={required} disabled={disabled||hydrating} value={text} placeholder={hydrating?'Memuat pelanggan…':'Cari nama atau kode ERP'} maxLength={160} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onKeyDown={key} onChange={event=>{typing.current=true;selectedRef.current=null;setSelected(null);setText(event.target.value);onChange('',null);setAfter('');setBack([]);setOpen(true)}}/>{value&&<button type="button" className="customer-picker-clear" disabled={disabled} aria-label={'Hapus pilihan '+label} onClick={()=>{typing.current=false;selectedRef.current=null;setSelected(null);setText('');onChange('',null);setAfter('');setBack([]);setOpen(false);input.current?.focus()}}>×</button>}</div>
  <span id={id+'-status'} className="customer-picker-status" role="status">{hydrating?'Memuat pilihan tersimpan…':!open&&error?error:''}</span>
  {open&&<div className="customer-picker-popup"><div role="listbox" id={id+'-list'} aria-label={'Hasil pencarian '+label} aria-busy={loading}>{!loading&&rows.map((row,index)=><div role="option" id={id+'-'+index} key={row.id} aria-selected={row.id===value} className={'customer-picker-option '+(active===index?'is-highlighted':'')} onPointerDown={e=>e.preventDefault()} onPointerMove={()=>setActive(index)} onClick={()=>choose(row)}><strong>{row.name}</strong><small>{row.external_code||'Tanpa kode ERP'}{row.record_status!=='active'?' · Nonaktif':''}</small></div>)}</div>{loading&&<p role="status">Mencari pelanggan…</p>}{error&&<div className="customer-picker-error"><p role="alert">{error}</p><button type="button" className="button secondary" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button></div>}{!loading&&!error&&!rows.length&&<p>Tidak ada hasil. Cari dari awal nama atau kode ERP.</p>}{!loading&&(back.length>0||next)&&<div className="customer-picker-pages"><button type="button" className="button secondary" disabled={!back.length} onClick={()=>{setAfter(back.at(-1)||'');setBack(v=>v.slice(0,-1));input.current?.focus()}}>Sebelumnya</button><button type="button" className="button secondary" disabled={!next} onClick={()=>{setBack(v=>[...v,after]);setAfter(next!);input.current?.focus()}}>Berikutnya</button></div>}</div>}
 </div>;
}
