const units=[{value:1n,label:''},{value:1000n,label:'rb'},{value:1000000n,label:'jt'},{value:1000000000n,label:'M'},{value:1000000000000n,label:'T'}];
/** Display-only formatting. Never feeds a rounded value back into calculations. */
export function compactNumber(value:number|null|undefined,currency=false){
 if(value==null||!Number.isSafeInteger(value))return {short:'Belum tersedia',full:'Belum tersedia'};
 const negative=value<0;const abs=BigInt(Math.abs(value));
 let index=0;while(index<units.length-1&&abs>=units[index+1].value)index++;
 const round=(divisor:bigint)=>(abs*100n+divisor/2n)/divisor;
 let scaled=round(units[index].value);
 if(index<units.length-1&&scaled>=100000n){index++;scaled=round(units[index].value)}
 const integer=(scaled/100n).toString();const fraction=(scaled%100n).toString().padStart(2,'0').replace(/0+$/,'');
 const amount=integer+(fraction?','+fraction:'');
 const short=(negative?'-':'')+(currency?'Rp':'')+amount+(index?' '+units[index].label:'');
 const full=currency?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value):new Intl.NumberFormat('id-ID').format(value);
 return {short,full};
}
