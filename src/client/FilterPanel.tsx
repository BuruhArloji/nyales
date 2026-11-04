import {ActionIcon} from './ActionIcon';
import React,{useEffect,useId,useState} from 'react';
import {ChevronDown,SlidersHorizontal} from 'lucide-react';
import {Modal} from './Modal';
export function FilterPanel({label='Filter',summary='Semua data',className='',children,onReset,count=0,embedded=false}:{label?:string;summary?:string;className?:string;children:React.ReactNode;onReset?:()=>void;count?:number;embedded?:boolean}){
 const id=useId();const [expanded,setExpanded]=useState(true);
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:767px)').matches),[open,setOpen]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)');const update=()=>{setCompact(media.matches);if(!media.matches)setOpen(false)};media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 if(!compact)return <section className={'filter-panel '+(embedded?'filter-panel--embedded ':'card ')+className} aria-label={label}>
  <div className="filter-panel-header"><div className="filter-panel-caption"><strong><SlidersHorizontal size={16} aria-hidden="true"/>{label}{count>0&&<span className="filter-panel-count">{count}</span>}</strong><span>{summary}</span></div><div className="filter-panel-actions">{onReset&&<button type="button" className="button secondary" onClick={onReset}><ActionIcon name="restore"/>Reset</button>}<button type="button" className="button secondary filter-panel-toggle" aria-controls={id} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Sembunyikan':'Tampilkan'}<ChevronDown size={16} aria-hidden="true"/></button></div></div>
  {expanded&&<div id={id} className="filter-controls">{children}</div>}
 </section>;
 return <><div className="compact-filter-bar"><span>{summary}</span><button type="button" className="button secondary" aria-haspopup="dialog" onClick={()=>setOpen(true)}><SlidersHorizontal size={17} aria-hidden="true"/>Filter{count>0?` (${count})`:null}</button></div>{open&&<Modal title={label} busy={false} onClose={()=>setOpen(false)} className="filter-sheet"><div className={'filter-controls '+className}>{children}</div><div className="filter-sheet-actions">{onReset&&<button type="button" className="button secondary" onClick={onReset}><ActionIcon name="restore"/>Reset filter</button>}<button type="button" className="button" onClick={()=>setOpen(false)}><ActionIcon name="detail"/>Lihat hasil</button></div></Modal>}</>;
}
