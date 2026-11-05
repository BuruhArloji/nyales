import {businessClock} from '../server/calendar';
import {planningInstant} from '../server/planning-time';

/** A small lead time lets the request reach ORS before the selected departure. */
export function dailyDepartureNow(now=Date.now()){return new Date(Math.ceil((now+120000)/60000)*60000).toISOString()}
export function suggestedDailyEnd(timezone:string,now=Date.now()){
 const local=businessClock(new Date(now),timezone),later=businessClock(new Date(now+4*3600000),timezone);
 return later.date===local.date?later.time:'23:59';
}
export function customDailyWindow(date:string,timezone:string,startMode:'now'|'manual',start:string,end:string,now=Date.now()){
 const startAt=startMode==='now'?dailyDepartureNow(now):planningInstant(date,start,timezone),endAt=planningInstant(date,end,timezone);
 if(!startAt||!endAt)throw Error('Isi jam mulai dan selesai yang valid.');
 if(businessClock(new Date(now),timezone).date!==date||businessClock(new Date(startAt),timezone).date!==date)throw Error('Tanggal rute sudah berganti. Muat ulang halaman untuk membuat rute hari ini.');
 if(Date.parse(startAt)<now+15000)throw Error('Jam mulai sudah lewat. Pilih Mulai sekarang atau atur jam setelah waktu sekarang.');
 if(Date.parse(endAt)<=Date.parse(startAt))throw Error('Jam selesai harus setelah jam mulai pada hari yang sama. Gunakan format 24 jam, misalnya 21:30 untuk malam.');
 if(Date.parse(endAt)-Date.parse(startAt)>12*3600000)throw Error('Durasi rute maksimal 12 jam.');
 return{start_at:startAt,end_at:endAt};
}
