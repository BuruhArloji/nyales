export type TerritoryItem={id:string;name:string;version:number;branch_id?:string;weekdays?:number[];start_time?:string;end_time?:string;holidays?:string[]};
export type AreaBody={name:string;branch_id:string};
export type CalendarBody=AreaBody&{weekdays:number[];start_time:string;end_time:string;holidays:string[]};
export function territoryPayload(kind:'areas'|'calendars',item:TerritoryItem,name:string,days:number[],start:string,end:string,holidayText:string):AreaBody|CalendarBody {
 const n=name.trim();if(!n||n.length>120)throw Error('Nama wajib diisi dan maksimal 120 karakter.');
 if(!item.branch_id)throw Error('Cabang belum tersedia. Muat ulang data.');
 const base={name:n,branch_id:item.branch_id};if(kind==='areas')return base;
 if(days.length===0||days.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(days).size!==days.length)throw Error('Pilih setidaknya satu hari kerja.');
 const time=/^([01]\d|2[0-3]):[0-5]\d$/;if(!time.test(start)||!time.test(end)||start>=end)throw Error('Jam harus berformat 24 jam dan selesai setelah mulai.');
 const holidays=holidayText.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
 if(holidays.length>366||new Set(holidays).size!==holidays.length)throw Error('Tanggal libur harus unik dan maksimal 366.');
 if(holidays.some(d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return true;const x=new Date(d+'T00:00:00Z');return !Number.isFinite(x.getTime())||x.toISOString().slice(0,10)!==d}))throw Error('Tanggal libur harus valid dengan format YYYY-MM-DD.');
 return {...base,weekdays:[...days].sort((a,b)=>a-b),start_time:start,end_time:end,holidays};
}
