export type SalesMapLevel='rep'|'supervisor'|'area_manager';
export type SalesMapGroup={id:string;name:string;color:string;count:number;property:string};
export const salesMapLevels={rep:'Sales Rep',supervisor:'Supervisor',area_manager:'Area Manager'} as const;
export function salesColor(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `hsl(${(hash>>>0)%360}, 48%, 36%)`}
export function salesMapCustomers(customers:any[],hierarchy:any[],level:SalesMapLevel,channel:string){
 const ancestry=new Map<string,any[]>();for(const h of hierarchy){const values=ancestry.get(h.rep_id)||[];values.push(h);ancestry.set(h.rep_id,values)}
 const groups=new Map<string,SalesMapGroup>();
 const decorated=customers.map(c=>{
  const rep=channel==='telesales'?c.telesales_rep_id:c.field_rep_id,role=level==='supervisor'?'SUPERVISOR':'AREA_MANAGER',matches=level==='rep'?[]:(ancestry.get(rep)||[]).filter(h=>h.role_code===role);
  const h=matches.length===1?matches[0]:null,id=level==='rep'?rep:h?.id;
  const name=id?(level==='rep'?(channel==='telesales'?c.telesales_owner:c.owner)||'Sales':h.name):!rep?'Belum ditugaskan':matches.length>1?'Hirarki perlu ditinjau':'Hirarki belum tersedia';
  const groupId=id?level+':'+id:!rep?'unassigned':'unknown',color=id?salesColor(groupId):'#a4aeaa';
  if(!groups.has(groupId))groups.set(groupId,{id:groupId,name,color,count:0,property:''});groups.get(groupId)!.count++;
  return{...c,sales_group_id:groupId,sales_group_name:name,sales_group_color:color};
 });
 const legend=[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id)).map((g,i)=>({...g,property:'sales_group_'+i}));
 return{customers:decorated,groups:legend};
}
/** Bounded category aggregation. A mixed cluster uses its largest assigned group;
 * ties are resolved by stable ID, never by current viewport/order. */
export function salesClusterStyle(groups:SalesMapGroup[]){
 const assigned=groups.filter(g=>!['unassigned','unknown'].includes(g.id));
 const properties=Object.fromEntries(groups.map(g=>[g.property,['+',['case',['==',['get','sales_group_id'],g.id],1,0]]]));
 const get=(g:SalesMapGroup):any=>['coalesce',['get',g.property],0];
 const max:any=assigned.length?['max',0,...assigned.map(get)]:0;
 const color:any=assigned.length?['case',...assigned.flatMap(g=>[['all',['>',get(g),0],['==',get(g),max]],g.color]),'#a4aeaa']:'#a4aeaa';
 return{properties,color};
}
