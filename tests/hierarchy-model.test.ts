import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hierarchySnapshot,reportingOn,type HierarchyPerson,type ReportingEdge} from '../src/client/hierarchy-model';
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
