import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalAttention,type AttentionRegion} from '../src/shared/regional-attention';
const region=(key:string,values:Partial<AttentionRegion>={}):AttentionRegion=>({key,boundary_id:key,customer_count:20,coverage_percent:100,achievement_percent:null,growth_percent:null,...values});
test('regional attention prioritizes financial warnings even with full visit coverage',()=>{
 const rows=[region('low-coverage',{coverage_percent:0}),region('decline',{growth_percent:-20,growth_status:'available'}),region('both',{achievement_percent:80,target_status:'available',growth_percent:-10,growth_status:'available'}),region('healthy',{achievement_percent:110,target_status:'available',growth_percent:20,growth_status:'available'})];
 assert.deepEqual(regionalAttention(rows).map(x=>x.row.key),['both','decline','low-coverage']);
 assert.equal(rows[0].key,'low-coverage');
});
test('unknown and incomplete financial data never becomes zero achievement or fake decline',()=>{
 const rows=[region('unknown'),region('incomplete',{achievement_percent:0,target_status:'source_incomplete',growth_percent:-90,growth_status:'source_incomplete'}),region('empty',{customer_count:0,coverage_percent:0}),region('unmapped',{boundary_id:null,coverage_percent:0})];
 assert.deepEqual(regionalAttention(rows),[]);
 const result=regionalAttention([region('coverage',{coverage_percent:25})]);assert.equal(result[0].financialSignals,0);assert.equal(result[0].coverage,75);
});
test('regional attention ranks shortfall then coverage with stable tie breaks and a bounded list',()=>{
 const result=regionalAttention([region('b',{coverage_percent:20}),region('a',{coverage_percent:20}),region('c',{coverage_percent:40}),region('target',{achievement_percent:50,target_status:'available'})]);
 assert.deepEqual(result.map(x=>x.row.key),['target','a','b']);
});
