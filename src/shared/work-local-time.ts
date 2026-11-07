/** Convert a datetime-local field in the displayed business timezone to UTC,
 * independent of the browser/device timezone. Reject nonexistent local times. */
export function workLocalInstant(input:string,timezone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error('Periksa tanggal dan jam.');
 const target=Date.parse(input+':00Z');if(!Number.isFinite(target))throw Error('Periksa tanggal dan jam.');
 const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 let instant=target;
 for(let i=0;i<4;i++){
  const local=formatter.format(new Date(instant)).replace(' ','T'),delta=Date.parse(local+'Z')-target;
  if(delta===0&&local.slice(0,16)===input)return new Date(instant).toISOString();
  instant-=delta;
 }
 throw Error('Tanggal atau jam tidak tersedia pada zona waktu ini.');
}
