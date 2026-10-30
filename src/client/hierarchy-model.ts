export type HierarchyPerson={id:string;name:string;status:string;version:number;role_code?:string|null;channel?:string|null};
export type ReportingEdge={id:string;subordinate_id:string;manager_id:string;area_id:string;channel:string;effective_from_date:string;effective_to_date:string|null;version:number};
export const roleNames:Record<string,string>={MANAGEMENT:'Management',NSM:'National Sales Manager',AREA_MANAGER:'Area Manager',SUPERVISOR:'Supervisor',SALES_REP:'Sales Rep',TELESALES:'Telesales'};
export const roleName=(value?:string|null)=>value?roleNames[value]||value:'Role belum efektif';
export function reportingOn(edge:ReportingEdge,date:string){return edge.effective_from_date<=date&&(!edge.effective_to_date||edge.effective_to_date>date)}

/** Pure view model: no inferred parents, no mutation of source history. */
export function hierarchySnapshot(people:HierarchyPerson[],history:ReportingEdge[],filters:{date:string;channel:string;area:string},collapsed:ReadonlySet<string>=new Set()){
 const users=new Map(people.map(p=>[p.id,p]));
 const filtered=history.filter(e=>reportingOn(e,filters.date)&&(!filters.channel||e.channel===filters.channel)&&(!filters.area||e.area_id===filters.area));
 const relations=filtered.filter(e=>users.has(e.manager_id)&&users.has(e.subordinate_id));
 const connected=new Set(relations.flatMap(e=>[e.manager_id,e.subordinate_id]));
 const members=people.filter(p=>filters.area?connected.has(p.id):connected.has(p.id)||!filters.channel||!p.channel||p.channel===filters.channel);
 const children=new Map<string,Set<string>>(),parents=new Map<string,Set<string>>();
 for(const e of relations){const a=children.get(e.manager_id)||new Set<string>(),b=parents.get(e.subordinate_id)||new Set<string>();a.add(e.subordinate_id);b.add(e.manager_id);children.set(e.manager_id,a);parents.set(e.subordinate_id,b)}
 const descendants=(id:string)=>{const found=new Set<string>(),queue=[...(children.get(id)||[])];while(queue.length){const next=queue.pop()!;if(next===id||found.has(next))continue;found.add(next);queue.push(...(children.get(next)||[]))}return found};
 const roots=members.filter(p=>!parents.has(p.id)).map(p=>p.id),visibleIds=new Set<string>(),queue=[...roots];
 while(queue.length){const id=queue.pop()!;if(visibleIds.has(id))continue;visibleIds.add(id);if(!collapsed.has(id))queue.push(...(children.get(id)||[]))}
 const folded=new Set([...collapsed].flatMap(id=>[...descendants(id)]));
 // Disconnected/cyclic source components remain inspectable rather than disappearing.
 for(const p of members)if(!visibleIds.has(p.id)&&!folded.has(p.id))visibleIds.add(p.id);
 const state=new Map<string,number>();let hasCycle=false;
 const visit=(id:string)=>{if(state.get(id)===1){hasCycle=true;return}if(state.get(id)===2)return;state.set(id,1);for(const child of children.get(id)||[])visit(child);state.set(id,2)};
 members.forEach(p=>visit(p.id));
 return {members,visible:members.filter(p=>visibleIds.has(p.id)),relations,visibleRelations:relations.filter(e=>visibleIds.has(e.manager_id)&&visibleIds.has(e.subordinate_id)),children,parents,descendants,hasCycle,missingPeople:filtered.length-relations.length,unconnected:members.filter(p=>!connected.has(p.id))};
}
