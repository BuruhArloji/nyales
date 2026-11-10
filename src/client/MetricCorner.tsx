import {Activity,Banknote,BriefcaseBusiness,CloudUpload,DatabaseBackup,FileCheck2,History,LockKeyhole,MapPin,Phone,ShieldCheck,Target,Timer,TriangleAlert,UserRoundCheck} from 'lucide-react';

const icons={sales:Banknote,target:Target,customers:UserRoundCheck,workforce:BriefcaseBusiness,api:Activity,error:TriangleAlert,latency:Timer,outbox:CloudUpload,backup:DatabaseBackup,restore:History,hold:LockKeyhole,privacy:ShieldCheck,invoice:FileCheck2,field:MapPin,telesales:Phone};
export type MetricKind=keyof typeof icons;
export function MetricCorner({kind,onClick,label}:{kind:MetricKind;onClick?:()=>void;label?:string}){
 const Icon=icons[kind],symbol=<Icon size={15} strokeWidth={1.7} aria-hidden="true"/>;
 return onClick?<button type="button" className="metric-corner metric-corner-action" aria-label={label} title={label} onClick={onClick}>{symbol}</button>:<span className="metric-corner" aria-hidden="true">{symbol}</span>;
}
