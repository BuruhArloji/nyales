import {businessClock} from './calendar';
/** Resolve a local wall-clock minute only when a unique instant exists; DST gaps/folds stay unknown. */
export function planningInstant(date:string,time:string,timezone:string):string|null{
 const wanted=date+'T'+time,base=Date.parse(wanted+':00Z');if(!Number.isFinite(base))return null;let instant=base;
 for(let n=0;n<5;n++){const local=businessClock(new Date(instant),timezone),rendered=Date.parse(local.date+'T'+local.time+':00Z'),delta=base-rendered;if(delta===0)break;instant+=delta}
 const matches=(ms:number)=>{const b=businessClock(new Date(ms),timezone);return b.date+'T'+b.time===wanted};if(!matches(instant)||[-7200000,-3600000,-1800000,1800000,3600000,7200000].some(d=>matches(instant+d)))return null;return new Date(instant).toISOString();
}
