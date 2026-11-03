import {invoiceLabel} from '../shared/business-labels';
import React,{useId,useState}from'react';
import{compactNumber}from'./numbers';

// Keep the engine's decimal string exact; only group digits and trim trailing zeroes.
function decimalRupiah(value:unknown){
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value??''));
 if(!match)return 'Belum tersedia';
 const fraction=(match[3]||'').replace(/0+$/,'');
 return `${match[1]}Rp ${BigInt(match[2]).toLocaleString('id-ID')}${fraction?','+fraction:''}`;
}
const componentNames:Record<string,string>={threshold_bonus:'Bonus ambang pencapaian',progressive_layer:'Insentif berjenjang',flat:'Persentase tetap',whole_basis:'Tarif seluruh basis',milestone:'Bonus milestone'};
const statusNames:Record<string,string>={prepared:'Disiapkan',under_review:'Dalam review',finalized:'Difinalkan',exported:'Diekspor',paid_confirmed:'Pembayaran dikonfirmasi',superseded:'Digantikan revisi'};
const percentage=(bps:number)=> (bps/100).toLocaleString('id-ID',{maximumFractionDigits:2})+'%';
function Amount({label,value,featured=false}:{label:string;value:number|null;featured?:boolean}){
 const[show,setShow]=useState(false),id=useId(),amount=compactNumber(value,true);
 return <article className={'statement-metric'+(featured?' featured':'')}><span>{label}</span><button className="statement-amount" type="button" aria-label={label+': '+amount.full} aria-describedby={id} aria-expanded={show} onClick={()=>setShow(!show)} onKeyDown={e=>{if(e.key==='Escape')setShow(false)}}>{amount.short}</button><span className="statement-amount-full" id={id} role="tooltip" data-open={show}>{amount.full}</span></article>;
}
export function StatementDetail({detail,name}:{detail:any;name:string}){
 return <div className="statement-detail">
  <header className="statement-person"><div><strong>{name}</strong><span>{detail.period_start} — {detail.period_end} · Revisi {detail.revision_no}</span></div><span className="badge neutral">{statusNames[detail.status]||detail.status}</span></header>
  <div className="statement-metrics"><Amount label="Target" value={detail.inputs.target_minor}/><Amount label="Actual eligible" value={detail.inputs.actual_minor}/><Amount label="Hak insentif" value={detail.entitlement_minor} featured/><Amount label="Selisih untuk settlement" value={detail.payable_delta_minor}/></div>
  <div className="statement-context"><span>Cutoff <strong>{detail.inputs.cutoff}</strong></span><span>{detail.inputs.timezone}</span><small>Pembulatan ke rupiah penuh dilakukan pada total.</small></div>
  <section className="statement-calculation"><h3>Rincian perhitungan</h3><div className="table-wrap"><table><thead><tr><th>Komponen</th><th className="number">Tarif</th><th className="number">Sebelum pembulatan</th></tr></thead><tbody>{detail.result.components?.map((x:any,i:number)=><tr key={i}><td>{componentNames[x.kind]||x.kind}<small>{x.kind==='threshold_bonus'?`Ambang ${percentage(x.threshold_bps??0)}`:x.from_bps!==undefined?`${percentage(x.from_bps)}${x.to_bps===null?' ke atas':x.to_bps===undefined?' ke atas':' – '+percentage(x.to_bps)}`:''}</small></td><td className="number">{x.rate_bps===undefined?'Nominal':percentage(x.rate_bps)}</td><td className="number statement-decimal">{decimalRupiah(x.decimal_before_rounding)}</td></tr>)}{!detail.result.components?.length&&<tr><td colSpan={3}>Belum ada komponen perhitungan.</td></tr>}</tbody></table></div><small className="statement-engine">Mesin perhitungan: {detail.result.engine_version}</small></section>
  <details className="statement-sources"><summary>Invoice sumber dan exclusion</summary><div className="statement-source-list">{detail.inputs.sources.map((i:any)=><article key={i.id}><header><strong>{invoiceLabel(i.source_invoice_id)}</strong><span>{i.invoice_date} · Versi {i.source_version}</span></header><dl><div><dt>Net invoice</dt><dd>{compactNumber(i.net_minor,true).full}</dd></div><div><dt>Basis terhitung</dt><dd>{compactNumber(i.credited_minor,true).full}</dd></div></dl><small>{i.exclusion_reason||'Eligible'}</small></article>)}{!detail.inputs.sources.length&&<p>Belum ada invoice sumber.</p>}</div></details>
 </div>;
}
