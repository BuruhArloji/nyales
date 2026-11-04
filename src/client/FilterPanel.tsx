import {ActionIcon} from './ActionIcon';
import React,{useEffect,useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Modal} from './Modal';
export function FilterPanel({label,summary,className,children,onReset,count=0}:{label:string;summary:string;className:string;children:React.ReactNode;onReset?:()=>void;count?:number}){
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:767px)').matches),[open,setOpen]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width:767px)');const update=()=>{setCompact(media.matches);if(!media.matches)setOpen(false)};media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 if(!compact)return <section className={'card '+className} aria-label={label}>{children}</section>;
 return <><div className="compact-filter-bar"><span>{summary}</span><button type="button" className="button secondary" aria-haspopup="dialog" onClick={()=>setOpen(true)}><SlidersHorizontal size={17} aria-hidden="true"/>Filter{count>0?` (${count})`:null}</button></div>{open&&<Modal title={label} busy={false} onClose={()=>setOpen(false)} className="filter-sheet"><div className={className}>{children}</div><div className="filter-sheet-actions">{onReset&&<button type="button" className="button secondary" onClick={onReset}><ActionIcon name="restore"/>Reset filter</button>}<button className="button" onClick={()=>setOpen(false)}><ActionIcon name="detail"/>Lihat hasil</button></div></Modal>}</>;
}
