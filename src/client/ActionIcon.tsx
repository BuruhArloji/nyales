import {
 Activity,Archive,ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,CalendarClock,Check,
 CheckCheck,CheckCircle2,ClipboardCheck,Copy,Download,Eye,FileCheck2,FileInput,
 FilePlus2,History,Layers,Link2,ListFilter,LogOut,MapPin,MessageSquare,Network,
 Paperclip,Pencil,Phone,Play,Plus,RefreshCw,RotateCcw,Save,Search,Send,Settings2,
 ShieldCheck,Square,Target,Trash2,Upload,UserPlus,Users,X,
} from 'lucide-react';

const symbols={
 add:Plus,save:Save,edit:Pencil,remove:Trash2,archive:Archive,close:X,back:ArrowLeft,
 next:ArrowRight,download:Download,upload:Upload,refresh:RefreshCw,restore:RotateCcw,
 detail:Eye,history:History,settings:Settings2,filter:ListFilter,search:Search,
 assign:Network,calendar:CalendarDays,reschedule:CalendarClock,approve:ShieldCheck,
 done:Check,review:ClipboardCheck,validate:FileCheck2,read:CheckCheck,send:Send,
 start:Play,stop:Square,location:MapPin,attach:Paperclip,people:Users,user:UserPlus,
 import:FileInput,file:FilePlus2,copy:Copy,link:Link2,external:ArrowUpRight,
 target:Target,layers:Layers,activity:Activity,phone:Phone,message:MessageSquare,
 success:CheckCircle2,logout:LogOut,
};
export type ActionIconName=keyof typeof symbols;

/** Icons support the visible action label; the button remains its accessible name. */
export function ActionIcon({name}:{name:ActionIconName}){
 const Symbol=symbols[name];
 return <Symbol className="action-icon" size={16} strokeWidth={1.8} aria-hidden="true" focusable="false"/>;
}
