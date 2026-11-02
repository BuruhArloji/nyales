import React,{useId,useState}from'react';
import{compactNumber}from'./numbers';

type Channel={channel:string;actual_minor:number};
const label=(key:string)=>key==='field'?'Lapangan':'Telesales';
const point=(angle:number)=>({x:160+105*Math.cos(angle*Math.PI/180),y:160+105*Math.sin(angle*Math.PI/180)});
export function ChannelContribution({channels,period}:{channels:Channel[];period:string}){
 const id=useId(),[active,setActive]=useState<string|null>(null);
 const total=channels.reduce((sum,c)=>sum+c.actual_minor,0),valid=total>0&&channels.every(c=>c.actual_minor>=0);
 const positive=channels.filter(c=>c.actual_minor>0),gap=positive.length>1?24:0;
 let cursor=-90+gap/2;
 const segments=valid?positive.map(c=>{const span=c.actual_minor/total*(360-gap*positive.length),start=cursor,end=start+Math.min(span,359.999),a=point(start),b=point(end),mid=(start+end)/2,pos=point(mid);cursor+=span+gap;let rotation=(mid+90)%360;if(rotation>90&&rotation<270)rotation-=180;return{...c,span,pos,rotation,path:`M${a.x} ${a.y} A105 105 0 ${span>180?1:0} 1 ${b.x} ${b.y}`}}):[];
 const selected=channels.find(c=>c.channel===active);
 return <section className="card contribution-card" aria-labelledby={id}>
  <header className="contribution-header"><h2 id={id}>Kontribusi kanal</h2><p>Invoice net · {period}</p></header>
  <div className="contribution-visual">
   <svg viewBox="0 0 320 320" aria-label="Kontribusi actual penjualan per kanal">
    <defs><linearGradient id={id+'-field'} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#0d9488"/><stop offset="1" stopColor="#a7e8dc"/></linearGradient><linearGradient id={id+'-telesales'} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#344f4a"/><stop offset="1" stopColor="#8da9a2"/></linearGradient></defs>
    {!segments.length&&<circle cx="160" cy="160" r="105" fill="none" stroke="#eeefed" strokeWidth="32"/>}
    {segments.map(c=><g key={c.channel} className="contribution-segment" role="button" tabIndex={0} aria-label={`${label(c.channel)}, ${compactNumber(c.actual_minor,true).full}, ${(c.actual_minor/total*100).toLocaleString('id-ID',{maximumFractionDigits:1})}% kontribusi`} onMouseEnter={()=>setActive(c.channel)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(c.channel)} onBlur={()=>setActive(null)} onClick={()=>setActive(c.channel)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(c.channel)}if(e.key==='Escape')setActive(null)}}>
     <path d={c.path} fill="none" stroke={`url(#${id}-${c.channel})`} strokeWidth={active===c.channel?36:32} strokeLinecap="round"/>
     {c.span>65&&<text x={c.pos.x} y={c.pos.y} transform={`rotate(${c.rotation} ${c.pos.x} ${c.pos.y})`} textAnchor="middle" dominantBaseline="central" className="contribution-arc-label">{(c.actual_minor/total*100).toLocaleString('id-ID',{maximumFractionDigits:1})+'%'}</text>}
    </g>)}
    <text x="160" y="156" textAnchor="middle" className="contribution-total">{compactNumber(total,true).short}</text><text x="160" y="179" textAnchor="middle" className="contribution-subtitle">Total penjualan</text>
   </svg>
   {selected&&<div className="contribution-tooltip" role="tooltip"><strong>{label(selected.channel)}</strong><span>{compactNumber(selected.actual_minor,true).full}</span>{valid&&<span>{(selected.actual_minor/total*100).toLocaleString('id-ID',{maximumFractionDigits:1})}% kontribusi</span>}</div>}
  </div>
  <div className="contribution-legend">{channels.map(c=><button key={c.channel} className={c.channel} onMouseEnter={()=>setActive(c.channel)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(c.channel)} onBlur={()=>setActive(null)} onClick={()=>setActive(c.channel)}><span><i/>{label(c.channel)}</span><strong>{compactNumber(c.actual_minor,true).short}</strong></button>)}</div>
  {!valid&&<p className="contribution-note">{channels.some(c=>c.actual_minor<0)?'Ada nilai net negatif; proporsi donut belum berlaku.':'Belum ada penjualan positif pada periode ini.'}</p>}
 </section>;
}
