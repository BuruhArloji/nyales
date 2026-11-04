import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertReproducibleCandidateScope,candidateForCustomer,classifyExternalOutletLabel,OUTLET_ROLE_EXPECTED,type CandidateRow} from '../scripts/save-outlet-role-candidates';
import type {CustomerCandidateRow} from '../scripts/outlet-role-candidate-data';

function row(id:number,outlet_type:string,directory_dataset_id:string|null,extra:Record<string,unknown>={}):CandidateRow{
 const customer:CustomerCandidateRow={id:`customer-${String(id).padStart(5,'0')}`,organization_id:'org-1',version:1,outlet_type,directory_dataset_id,...extra};
 return{customer,input:candidateForCustomer(customer)};
}

test('the versioned rule is source-label-only and exposes uncertain/allowlisted edge cases',()=>{
 assert.deepEqual(classifyExternalOutletLabel('Grosir Barang Kelontong'),{role:'wholesale',confidence:'low',reason:'outlet_type_matched_grosir_or_wholesale'});
 assert.deepEqual(classifyExternalOutletLabel('Toko Kelontong Asia'),{role:'retail',confidence:'low',reason:'outlet_type_matched_retail_marker'});
 assert.equal(classifyExternalOutletLabel('Agen Gas Elpiji').role,'agent_distributor');
 assert.equal(classifyExternalOutletLabel('Toko Roti Grosir').role,'wholesale');
 assert.equal(classifyExternalOutletLabel('Agen komersial').role,'mixed_unknown');
 assert.equal(classifyExternalOutletLabel('Agen komersial').confidence,'very_low');
 assert.equal(classifyExternalOutletLabel('Restoran').role,'mixed_unknown');
 const withPurchaseClass=row(1,'Restoran','directory-a',{purchase_class:'wholesale'});
 assert.equal(withPurchaseClass.input.candidate_role,'mixed_unknown');
 assert.equal(withPurchaseClass.input.status,'pending_sales_confirmation');
 assert.equal(withPurchaseClass.input.confidence_basis,'qualitative_low_confidence_source_label_heuristic_unverified');
});

test('the revised full-population candidate totals reconcile exactly, with DEMO and training kept separate',()=>{
 const rows:CandidateRow[]=[];let id=0;
 const append=(count:number,label:string,dataset:string|null)=>{for(let i=0;i<count;i++)rows.push(row(++id,label,dataset))};
 append(40541,'Toko','directory-a');
 append(1543,'Grosir','directory-a');
 append(32,'Agen Gas Elpiji','directory-a');
 append(3834,'Restoran','directory-b');
 append(1000,'retail_demo',null);
 append(20,'',null);
 const result=assertReproducibleCandidateScope(rows,'org-1');
 assert.equal(rows.length,OUTLET_ROLE_EXPECTED.total);
 assert.deepEqual(result.cohorts,{external_directory:45950,synthetic_demo:1000,training:20});
 assert.deepEqual(result.roles,{retail:40541,wholesale:1543,agent_distributor:32,mixed_unknown:3834});
 assert.equal(rows.filter(r=>r.input.cohort==='external_directory'&&r.input.status==='pending_sales_confirmation').length,45950);
 assert.equal(rows.filter(r=>r.input.cohort==='synthetic_demo'&&r.input.candidate_role===null&&r.input.status==='excluded_synthetic').length,1000);
 assert.equal(rows.filter(r=>r.input.cohort==='training'&&r.input.candidate_role===null&&r.input.status==='training_unclassified').length,20);
 const bad=[...rows];bad[0]={...bad[0],input:{...bad[0].input,candidate_role:'mixed_unknown'}};
 assert.throws(()=>assertReproducibleCandidateScope(bad,'org-1'),/REPRODUCIBLE_ROLE_COUNT_MISMATCH/);
 assert.throws(()=>assertReproducibleCandidateScope(rows.slice(1),'org-1'),/APPROVED_46970_POINT_SCOPE_MISMATCH/);
});
