import {ActionIcon} from './ActionIcon';
import type {SourceSelection} from './SourceDrill';
import React, {useId} from 'react';

type Activity = {id:string; channel:string; meaningful:boolean};
type Customer = {id:string; covered:boolean};
type Props = {
  data:{customer_count:number; covered_customer_count:number; activity_count:number; meaningful_count:number; declared_connected_pic:number;
    activity_channels:{channel:string; activity_count:number; meaningful_count:number; other_count:number}[];
    sources:{customers:Customer[]; activities:Activity[]}};
  onDrill:(title:string, source:SourceSelection)=>void;
};

export function CoverageActivity({data:d,onDrill}:Props){
  const gradient=useId(), total=d.customer_count, covered=d.covered_customer_count;
  const percent=total?covered/total*100:null, remaining=total-covered;
  const max=Math.max(1,...d.activity_channels.map(c=>c.activity_count));
  const customers=(state:boolean)=>onDrill(state?'Pelanggan tercakup':'Pelanggan belum tercakup',{kind:'customers',covered:state});
  return <section className="card coverage-card" aria-labelledby={gradient+'-title'}>
    <header className="coverage-heading"><div><h2 id={gradient+'-title'}>Coverage dan aktivitas</h2></div><button className="text-button" onClick={()=>onDrill('Seluruh aktivitas',{kind:'activities'})}><ActionIcon name="detail"/>Lihat {d.activity_count} aktivitas ↗</button></header>
    <div className="coverage-body">
      <div className="coverage-customers">
        <div className="coverage-donut" role="img" aria-label={total?`${covered} dari ${total} pelanggan unik tercakup, ${percent!.toLocaleString('id-ID',{maximumFractionDigits:2})} persen`:'Belum ada pelanggan dalam scope'}>
          <svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#0d9488"/><stop offset="1" stopColor="#a7e8dc"/></linearGradient></defs><circle cx="100" cy="100" r="83" fill="none" stroke="#eeefed" strokeWidth="12"/>{covered>0&&<circle cx="100" cy="100" r="83" fill="none" stroke={`url(#${gradient})`} strokeWidth="12" strokeLinecap={covered===total?'butt':'round'} pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 100 100)"/>}</svg>
          <div className="coverage-center"><strong>{percent===null?'—':percent.toLocaleString('id-ID',{maximumFractionDigits:2})+'%'}</strong><span>{total?'pelanggan tercakup':'Belum ada pelanggan'}</span><small>{covered} dari {total} pelanggan unik</small></div>
        </div>
        <div className="coverage-keys"><button disabled={!covered} onClick={()=>customers(true)}><i className="coverage-swatch meaningful"/><span>Tercakup</span><strong>{covered}</strong></button><button disabled={!remaining} onClick={()=>customers(false)}><i className="coverage-swatch other"/><span>Belum tercakup</span><strong>{remaining}</strong></button></div>
      </div>
      <div className="coverage-channels"><h3>Aktivitas per kanal</h3>
        {d.activity_channels.map(c=><div className="coverage-channel" key={c.channel}><div className="coverage-channel-label"><span>{c.channel==='field'?'Lapangan':'Telesales'}</span><strong>{c.activity_count} aktivitas</strong></div><div className="coverage-track">
          {[{count:c.meaningful_count,meaningful:true,label:'bermakna'},{count:c.other_count,meaningful:false,label:'lainnya'}].filter(s=>s.count>0).map(s=><button key={s.label} className={'coverage-segment '+(s.meaningful?'meaningful':'other')} style={{width:s.count/max*100+'%'}} aria-label={`${c.channel==='field'?'Lapangan':'Telesales'}: ${s.count} aktivitas ${s.label}`} onClick={()=>onDrill(`${c.channel==='field'?'Lapangan':'Telesales'} · aktivitas ${s.label}`,{kind:'activities',source_channel:c.channel,meaningful:s.meaningful})}><span className="coverage-tip" role="tooltip">{s.count} aktivitas {s.label}</span></button>)}
          {!c.activity_count&&<span className="coverage-no-activity">Belum ada aktivitas</span>}
        </div><small>{c.meaningful_count} bermakna · {c.other_count} lainnya</small></div>)}
        <div className="coverage-bar-legend"><span><i className="coverage-swatch meaningful"/>Bermakna</span><span><i className="coverage-swatch other"/>Lainnya</span></div>
      </div>
    </div>
    <footer className="coverage-footer"><div><strong>{d.meaningful_count}</strong><span>Aktivitas bermakna</span></div><div><strong>{d.declared_connected_pic}</strong><span>Koneksi PIC · manual</span></div></footer>
    <details className="calculation-note"><summary>Cara hitung coverage</summary><p>Pelanggan unik dengan aktivitas bermakna. Kunjungan ke toko tutup atau tanpa PIC tidak menambah coverage.</p></details>
  </section>;
}
