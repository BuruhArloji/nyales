export type WorkCalendar={weekdays:number[];start_time:string;end_time:string;holidays:string[]};
/** First instant belonging to a local date (also handles DST midnight gaps). */
export function businessDayStart(date:string,timezone:string){
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
 const local=(ms:number)=>{const p=format.formatToParts(new Date(ms)),v=(key:string)=>p.find(x=>x.type===key)!.value;return `${v('year')}-${v('month')}-${v('day')}`};
 const center=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(center))throw Error('Invalid business date');
 let low=center-36*3600000,high=center+36*3600000;
 while(high-low>1){const mid=Math.floor((low+high)/2);if(local(mid)<date)low=mid;else high=mid}
 return new Date(high).toISOString();
}
export function businessUtcBounds(start:string,cutoff:string,timezone:string){return {from:businessDayStart(start,timezone),until:businessDayStart(new Date(Date.parse(cutoff+'T00:00:00Z')+86400000).toISOString().slice(0,10),timezone)}}
export function businessClock(instant:Date,timezone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const v=(kind:string)=>parts.find(p=>p.type===kind)!.value;
 const date=`${v('year')}-${v('month')}-${v('day')}`;
 return {date,time:`${v('hour')}:${v('minute')}`,weekday:new Date(date+'T00:00:00Z').getUTCDay()||7};
}
export function isWorkingInstant(instant:Date,timezone:string,calendar:WorkCalendar){
 const local=businessClock(instant,timezone);
 return calendar.weekdays.includes(local.weekday)&&!calendar.holidays.includes(local.date)&&local.time>=calendar.start_time&&local.time<calendar.end_time;
}
// Shared SLA primitive for future jobs. UTC iteration handles timezone offsets and DST.
export function workingMinutesBetween(start:Date,end:Date,timezone:string,calendar:WorkCalendar){
 const elapsed=end.getTime()-start.getTime();
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>31*86400000)throw new Error('Interval must be 0–31 days');
 let minutes=0;for(let time=start.getTime();time<end.getTime();time+=60000){if(isWorkingInstant(new Date(time),timezone,calendar))minutes+=Math.min(60000,end.getTime()-time)/60000}
 return minutes;
}
/** Working minutes by local calendar day; avoids minute-by-minute work for scheduled SLA jobs. */
export function calendarMinutesBetween(start:Date,end:Date,timezone:string,calendar:WorkCalendar){if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)throw new Error('Invalid interval');const a=businessClock(start,timezone),b=businessClock(end,timezone),minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));const opening=minutes(calendar.start_time),closing=minutes(calendar.end_time);let sum=0;const first=Date.parse(a.date),last=Date.parse(b.date);if(last-first>36600*86400000)throw new Error('Interval too large');for(let day=first;day<=last;day+=86400000){const date=new Date(day).toISOString().slice(0,10),weekday=new Date(day).getUTCDay()||7;if(!calendar.weekdays.includes(weekday)||calendar.holidays.includes(date))continue;const begin=day===first?Math.max(opening,minutes(a.time)+start.getUTCSeconds()/60):opening,finish=day===last?Math.min(closing,minutes(b.time)+end.getUTCSeconds()/60):closing;sum+=Math.max(0,finish-begin)}return sum}
