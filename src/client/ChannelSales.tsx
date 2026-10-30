import type {SourceSelection} from './SourceDrill';
import React,{useId,useState}from'react';
import{compactNumber}from'./numbers';

type Channel={channel:string;target_minor:number|null;actual_minor:number|null;achievement_percent:number|null;status:string};
const name=(channel:string)=>channel==='field'?'Lapangan':'Telesales';
const percent=(value:number)=>value.toLocaleString('id-ID',{maximumFractionDigits:2})+'%';
const stateLabel=(c:Channel)=>c.status==='no_target'?'Target belum tersedia':c.status==='zero_target'?'Target nol · belum berlaku':c.status==='source_incomplete'?'Sumber belum lengkap':c.status==='needs_review'?'Basis perlu ditinjau':percent(c.achievement_percent!);
export function ChannelSales({channels,cutoff,complete,onDrill}:{channels:Channel[];cutoff:string;complete:boolean;onDrill:(title:string,source:SourceSelection)=>void}){
 const id=useId(),[active,setActive]=useState<string|null>(null);
 const drill=(c:Channel)=>onDrill('Rincian target '+name(c.channel),{kind:'targets',source_channel:c.channel});
 const tip=channels.find(c=>c.channel===active);
 return <section className="card channel-sales achievement-card" aria-labelledby={id}>
  <header><h2 id={id}>Pencapaian per kanal</h2></header>
  <div className="channel-achievement-body">
   <div className="channel-achievement-values">{channels.map(c=><button key={c.channel} className={'channel-achievement-value '+c.channel} onClick={()=>drill(c)} onMouseEnter={()=>setActive(c.channel)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(c.channel)} onBlur={()=>setActive(null)} aria-label={`${name(c.channel)}, ${stateLabel(c)}, lihat rincian target`}>
    <span className="channel-achievement-name"><i/>{name(c.channel)}</span>
    <strong>{compactNumber(c.actual_minor,true).short}</strong>
    <span className="channel-achievement-target">Target {compactNumber(c.target_minor,true).short}</span>
    <span className="channel-achievement-percent">{stateLabel(c)}</span>
   </button>)}</div>
   <div className="channel-achievement-chart">
    <svg viewBox="0 0 260 260" aria-label="Pencapaian target Lapangan dan Telesales">
     <defs>
      <linearGradient id={id+'-field'} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#0d9488"/><stop offset="1" stopColor="#a7e8dc"/></linearGradient>
      <linearGradient id={id+'-telesales'} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#344f4a"/><stop offset="1" stopColor="#8da9a2"/></linearGradient>
     </defs>
     {channels.map(c=>{const radius=c.channel==='field'?106:78,value=c.achievement_percent,progress=value===null?0:Math.max(0,Math.min(100,value));return <g key={c.channel} role="button" tabIndex={0} aria-label={`${name(c.channel)}: ${stateLabel(c)}. Lihat rincian target`} onClick={()=>drill(c)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drill(c)}}} onMouseEnter={()=>setActive(c.channel)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(c.channel)} onBlur={()=>setActive(null)} className={'achievement-ring '+c.channel}>
      <circle cx="130" cy="130" r={radius} fill="none" stroke="#eeefed" strokeWidth="16"/>
      {progress>0&&<circle cx="130" cy="130" r={radius} fill="none" stroke={`url(#${id}-${c.channel})`} strokeWidth="16" strokeLinecap={progress===100?'butt':'round'} pathLength="100" strokeDasharray={`${progress} 100`} transform="rotate(-90 130 130)"/>}
     </g>})}
     <text x="130" y="126" textAnchor="middle" className="achievement-ring-center">Target</text><text x="130" y="144" textAnchor="middle" className="achievement-ring-subtitle">per kanal</text>
    </svg>
    {tip&&<div className="achievement-ring-tooltip" role="tooltip"><strong>{name(tip.channel)} · {stateLabel(tip)}</strong><span>Actual {compactNumber(tip.actual_minor,true).full}</span><span>Target {compactNumber(tip.target_minor,true).full}</span></div>}
   </div>
  </div>
  {!complete&&<footer><p>Data sampai {cutoff} belum lengkap.</p></footer>}
 </section>;
}
