import {customerHierarchyLabels,walletComparison,type CustomerHierarchy1} from '../shared/customer-wallet';
import {compactNumber} from './numbers';

export function renderMapWallet(host:HTMLElement,data:any){
 host.replaceChildren();host.className='map-popup-wallet';
 const icon=document.createElement('span');icon.className='map-wallet-icon';icon.title='Wallet Size';icon.tabIndex=0;icon.setAttribute('aria-label','Wallet Size');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6m17 6h-5v5h5m-3-2.5h.01');svg.appendChild(path);icon.appendChild(svg);host.appendChild(icon);
 const body=document.createElement('div');body.className='map-wallet-content';
 const category=document.createElement('small');category.className='map-wallet-category';category.textContent=customerHierarchyLabels[data.hierarchy1 as CustomerHierarchy1]||'Kategori belum diisi';body.appendChild(category);
 const track=document.createElement('div');track.className='map-wallet-track';track.setAttribute('role','img');
 const values=[data.wallet_size_minor??null,data.highest_month_actual_minor??null,data.current_month_actual_minor??null];
 const labels=['Wallet Size','Pembelian bulanan tertinggi','Actual bulan ini'];
 const formats=values.map(value=>compactNumber(value,true));
 const history=data.highest_month_period?' · '+data.highest_month_period:'';
 track.setAttribute('aria-label',labels.map((label,index)=>label+': '+formats[index].full).join('; '));
 const percentages=walletComparison(values[0],values[1],values[2]??0);
 for(const [index,width] of [percentages.wallet_percent,percentages.highest_percent,values[2]===null?null:percentages.current_percent].entries()){
  if(width===null)continue;
  const fill=document.createElement('span');fill.className='map-wallet-fill map-wallet-fill--'+index;fill.style.width=width+'%';fill.title=labels[index]+': '+formats[index].full+(index===1?history:'');track.appendChild(fill);
 }
 body.appendChild(track);
 const legend=document.createElement('div');legend.className='map-wallet-values';
 ['Wallet','Tertinggi','Actual'].forEach((label,index)=>{const item=document.createElement('div');item.title=labels[index]+': '+formats[index].full+(index===1?history:'');const caption=document.createElement('small');caption.textContent=label;const dot=document.createElement('i');dot.className='map-wallet-key map-wallet-fill--'+index;caption.insertBefore(dot,caption.firstChild);const amount=document.createElement('span');amount.textContent=formats[index].short;item.appendChild(caption);item.appendChild(amount);legend.appendChild(item)});
 body.appendChild(legend);host.appendChild(body);
}
