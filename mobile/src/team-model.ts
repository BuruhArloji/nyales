export type TeamUser={id:string;name:string;status:string;role_code?:string|null;channel?:string|null};
export type TeamEdge={id:string;manager_id:string;subordinate_id:string;effective_from_date:string;effective_to_date:string|null};
export const teamRoles:Record<string,string>={MANAGEMENT:'Management',NSM:'National Sales Manager',REGIONAL_MANAGER:'Regional Manager',AREA_MANAGER:'Area Manager',SUPERVISOR:'Supervisor',SALES_REP:'Sales',TELESALES:'Telesales'};
export const teamRole=(r?:string|null)=>r?(teamRoles[r]||r):'Role belum efektif';
export function teamSnapshot(raw:TeamUser[],edges:TeamEdge[],date:string,collapsed:ReadonlySet<string>=new Set()){
 const users=new Map<string,TeamUser>();for(const u of raw)if(!users.has(u.id))users.set(u.id,u);
 const members=[...users.values()].filter(u=>u.status==='active');const allowed=new Set(members.map(u=>u.id));
 const active=edges.filter(e=>e.effective_from_date<=date&&(!e.effective_to_date||e.effective_to_date>date)&&allowed.has(e.manager_id)&&allowed.has(e.subordinate_id));
 const children=new Map<string,Set<string>>(),parents=new Set<string>();for(const e of active){const c=children.get(e.manager_id)||new Set<string>();c.add(e.subordinate_id);children.set(e.manager_id,c);parents.add(e.subordinate_id)}
 const root=members.filter(u=>!parents.has(u.id));const result:Array<{user:TeamUser;depth:number;count:number}>=[];const visited=new Set<string>();
 function walk(u:TeamUser,depth:number){if(visited.has(u.id))return;visited.add(u.id);const kids=children.get(u.id)||new Set<string>();result.push({user:u,depth,count:kids.size});if(!collapsed.has(u.id))for(const id of kids){const child=users.get(id);if(child)walk(child,depth+1)}}
 for(const u of root)walk(u,0);const hidden=new Set<string>();function mark(id:string){for(const child of children.get(id)||[]){if(hidden.has(child))continue;hidden.add(child);mark(child)}}for(const id of collapsed)mark(id);
 for(const u of members)if(!visited.has(u.id)&&!hidden.has(u.id))walk(u,0);
 return {rows:result,roots:root.length,activeEdges:active.length,unconnected:members.filter(u=>!parents.has(u.id)&&!(children.get(u.id)?.size)).length};
}
