/** Format a business calendar date without letting the browser timezone shift it. */
export function businessDateLabel(value:unknown):string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Belum tersedia';
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return 'Belum tersedia';
 return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date);
}
