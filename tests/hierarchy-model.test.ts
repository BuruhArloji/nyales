import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hierarchyGroups,hierarchySnapshot,reportingOn,type HierarchyPerson,type ReportingEdge} from '../src/client/hierarchy-model';
const people:HierarchyPerson[]=[{id:'head',name:'Management',role_code:'MANAGEMENT',channel:null,status:'active',version:1},{id:'spv',name:'Supervisor',channel:'field',status:'active',version:1},{id:'rep',name:'Sales',channel:'field',status:'active',version:1},{id:'tele',name:'Telesales',channel:'telesales',status:'active',version:1}];
const edge=(id:string,manager_id:string,subordinate_id:string,extras:Partial<ReportingEdge>={}):ReportingEdge=>({id,manager_id,subordinate_id,area_id:'west',channel:'field',effective_from_date:'2026-10-01',effective_to_date:null,version:1,...extras});
const filters={date:'2026-10-29',channel:'',area:''};
test('effective date is inclusive at start and exclusive at end; transfers never show two parents',()=>{
 const old=edge('old','spv','rep',{effective_to_date:'2026-10-29'}),next=edge('next','head','rep',{effective_from_date:'2026-10-29'});
 assert.equal(reportingOn(old,'2026-10-28'),true);assert.equal(reportingOn(old,filters.date),false);
 const snapshot=hierarchySnapshot(people,[old,next],filters);
 assert.deepEqual(snapshot.relations.map(e=>e.id),['next']);assert.deepEqual([...snapshot.parents.get('rep')!],['head']);
});
test('does not infer parents from role and does not mutate original data',()=>{
 const history=[edge('one','spv','rep')],before=JSON.stringify({people,history});
 const snapshot=hierarchySnapshot(people,history,filters);
 assert.equal(snapshot.visible.length,4);assert.equal(snapshot.relations.length,1);assert.ok(snapshot.unconnected.some(p=>p.id==='head'));
 assert.equal(JSON.stringify({people,history}),before);
});
test('area uses real reporting endpoints and channel excludes unrelated reps',()=>{
 const history=[edge('one','spv','rep')];
 assert.deepEqual(hierarchySnapshot(people,history,{...filters,area:'west'}).members.map(p=>p.id),['spv','rep']);
 assert.equal(hierarchySnapshot(people,history,{...filters,area:'east'}).members.length,0);
 assert.equal(hierarchySnapshot(people,history,{...filters,channel:'field'}).members.some(p=>p.id==='tele'),false);
});
test('collapse hides descendants, preserves source relations and expands deterministically',()=>{
 const history=[edge('one','head','spv'),edge('two','spv','rep')];
 const snapshot=hierarchySnapshot(people,history,filters,new Set(['head']));
 assert.deepEqual(snapshot.visible.map(p=>p.id),['head','tele']);assert.equal(snapshot.visibleRelations.length,0);assert.equal(snapshot.relations.length,2);
 assert.equal(hierarchySnapshot(people,history,filters).visible.length,4);
});
test('duplicate area reporting counts unique team members; another open branch remains visible',()=>{
 const history=[edge('one','head','rep'),edge('two','head','rep',{area_id:'east'}),edge('three','spv','rep')];
 const snapshot=hierarchySnapshot(people,history,filters,new Set(['head']));
 assert.equal(snapshot.children.get('head')?.size,1);assert.ok(snapshot.visible.some(p=>p.id==='rep'));
});
test('missing profiles are counted; cyclic components remain inspectable and flagged',()=>{
 const snapshot=hierarchySnapshot(people,[edge('one','spv','rep'),edge('two','rep','spv'),edge('missing','unknown','rep')],filters);
 assert.equal(snapshot.hasCycle,true);assert.equal(snapshot.missingPeople,1);assert.equal(snapshot.visible.length,4);assert.equal(snapshot.visibleRelations.length,2);
});

test('current chart excludes inactive identities by default and never merges matching names',()=>{
 const data:HierarchyPerson[]=[...people,{id:'old',name:'Sales',role_code:null,status:'inactive',version:2}];
 const before=JSON.stringify(data),current=hierarchySnapshot(data,[],filters);
 assert.equal(current.members.length,4);assert.equal(current.members.some(p=>p.id==='old'),false);
 const withInactive=hierarchySnapshot(data,[],{...filters,includeInactive:true});
 assert.equal(withInactive.members.length,5);assert.equal(withInactive.members.filter(p=>p.name==='Sales').length,2);
 assert.equal(JSON.stringify(data),before);
});

test('inactive parent is not a valid current parent and its active child remains visible for repair',()=>{
 const data:HierarchyPerson[]=[{...people[0],id:'head',status:'inactive'},{...people[2],role_code:'SALES_REP'}];
 const history=[edge('old-parent','head','rep')],snapshot=hierarchySnapshot(data,history,filters);
 assert.deepEqual(snapshot.visible.map(p=>p.id),['rep']);assert.equal(snapshot.relations.length,0);
 assert.equal(snapshot.missingPeople,0);assert.equal(snapshot.inactiveRelations,1);
 assert.deepEqual(snapshot.withoutManager.map(p=>p.id),['rep']);
 const inspection=hierarchySnapshot(data,history,{...filters,includeInactive:true});
 assert.equal(inspection.relations.length,1);assert.equal(inspection.inactiveRelations,1);
});

test('historical dates restore evidenced inactive endpoints without inventing past employment or role status',()=>{
 const data:HierarchyPerson[]=[people[0],{...people[2],role_code:null,status:'inactive'},{id:'unrelated-inactive',name:'Other',status:'inactive',version:1}];
 const history=[edge('former','head','rep',{effective_to_date:'2026-11-01'})];
 const snapshot=hierarchySnapshot(data,history,{...filters,currentDate:'2026-11-05'});
 assert.equal(snapshot.historical,true);assert.deepEqual(snapshot.members.map(p=>p.id),['head','rep']);
 assert.equal(snapshot.members[1].status,'inactive');assert.equal(snapshot.members[1].role_code,null);
 assert.equal(snapshot.inactiveRelations,0);assert.equal(snapshot.relations.length,1);
 const current=hierarchySnapshot(data,history,{...filters,date:'2026-11-05',currentDate:'2026-11-05'});
 assert.deepEqual(current.members.map(p=>p.id),['head']);assert.equal(current.historical,false);
});

test('orphan diagnostics ignore legitimate Management roots and do not infer a gap from channel or area filtering',()=>{
 const data=people.map(p=>p.id==='spv'?{...p,role_code:'SUPERVISOR'}:p.id==='rep'?{...p,role_code:'SALES_REP'}:p);
 const history=[edge('top','head','spv',{area_id:'east'}),edge('child','spv','rep')];
 const snapshot=hierarchySnapshot(data,history,{...filters,area:'west'});
 assert.deepEqual(snapshot.members.map(p=>p.id),['spv','rep']);assert.equal(snapshot.withoutManager.length,0);
 const broken=hierarchySnapshot(data,[history[1]],filters);
 assert.deepEqual(broken.withoutManager.map(p=>p.id),['spv']);
});

test('detached operational teams remain inspectable separately without inventing reporting edges',()=>{
 const data:HierarchyPerson[]=[{id:'m',name:'Owner',role_code:'MANAGEMENT',status:'active',version:1},{id:'n',name:'Leader',role_code:'NSM',status:'active',version:1},{id:'s',name:'Sales',role_code:'SALES_REP',status:'active',version:1}];const snapshot=hierarchySnapshot(data,[edge('child','n','s')],filters),groups=hierarchyGroups(snapshot);assert.deepEqual(groups.main.map(p=>p.id),['m']);assert.deepEqual(groups.detached.map(p=>p.id),['n']);assert.equal(groups.detachedIds.size,2);assert.equal(snapshot.relations.length,1);
});
