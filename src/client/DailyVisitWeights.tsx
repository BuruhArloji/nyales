import {dailyWeights,type DailyPolicy} from '../shared/daily-visit';
export function DailyVisitWeights({value,onChange,disabled=false}:{value:DailyPolicy['weights'];onChange:(value:DailyPolicy['weights'])=>void;disabled?:boolean}){
 const total=Object.values(value).reduce((a,b)=>a+b,0);
 return <fieldset className="settings-fields daily-visit-weights" disabled={disabled}><legend>Bobot prioritas · {total}%</legend><div className="daily-visit-fields">{Object.entries({wallet:'Wallet Size',last_visit:'Kunjungan terakhir / keterlambatan',sales:'Penjualan 90 hari',follow_up:'Tindak lanjut jatuh tempo',proximity:'Kedekatan lokasi'}).map(([key,label])=><label key={key}>{label}<input type="number" required min="0" max="100" step="1" value={value[key as keyof typeof value]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div>{!dailyWeights.safeParse(value).success&&<p role="status" className="notice danger">Isi bobot 0–100 dengan total 100%.</p>}</fieldset>;
}
