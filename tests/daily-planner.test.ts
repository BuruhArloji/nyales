import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {policy,snapshot} from './visit-generator-fixture';
import {computeDailyCandidate} from '../src/agent/daily-planner';
import {parseOsrmMatrix,matrixCacheKey,osrmMatrixRequest} from '../src/agent/osrm-client';
import {canonicalJson} from '../src/shared/boundaries';
import {agentSha256} from '../src/shared/visit-agent-proof';
import type {z} from 'zod';
const python=resolve(process.platform==='win32'?'.nyales-agent/solver-python/Scripts/python.exe':'.nyales-agent/solver-python/bin/python');
const available={skip:!existsSync(python)};
async function inputs(){const p=policy(),s=snapshot();p.runtime.solver_seconds=1;s.policy_sha256=await agentSha256(canonicalJson(p));return{s,p}}
async function matrix(request:z.infer<typeof osrmMatrixRequest>){const n=request.nodes.length;const waypoints=request.nodes.map(p=>({location:[p.longitude_e7/1e7,p.latitude_e7/1e7],distance:0}));const raw={code:'Ok',durations:Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:60)),distances:Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:100)),sources:waypoints,destinations:waypoints};return{...parseOsrmMatrix(raw,request),cache_key:await matrixCacheKey(request)}}
const ctx={python,matrix,routing_profile:'driving',matrix_provenance:'synthetic_fixture' as const};

test('WEB-071 daily adapter computes a structurally valid draft with exact matrix identity and measured Python memory',available,async()=>{
 const{s,p}=await inputs(),c=await computeDailyCandidate(s,p,ctx);
 assert.equal(c.result.solver_outcome,'feasible');assert.equal(c.validation.structurally_valid,true,JSON.stringify(c.validation));
 assert.equal(c.result.routes[0].visits[0].occurrence_id,'v');assert.equal(c.result.routes[0].return_travel_seconds,60);
 assert.equal(c.result.measured.result_bytes,Buffer.byteLength(canonicalJson(c.result)));assert.ok(c.result.measured.peak_memory_bytes>0);
 assert.equal(c.publishable,false);assert.equal(c.osrm_process_identity_verified,false);assert.equal(c.matrix_provenance,'synthetic_fixture');
 assert.equal(c.matrix_sha256,await agentSha256(canonicalJson(c.matrix)));
});

test('WEB-071 missing coordinates stay explicit and required visits cannot become publishable by omission',available,async()=>{
 const{s,p}=await inputs();s.occurrences[0].point=null;s.occurrences[0].missing_fields=['coordinates'];
 let c=await computeDailyCandidate(s,p,ctx);assert.equal(c.result.unscheduled[0].code,'missing_coordinates');
 assert.equal(c.validation.structurally_valid,false);assert.ok(c.validation.issues.some(i=>i.code==='MINIMUM_FREQUENCY_NOT_MET'));
 s.occurrences[0].obligation='candidate';c=await computeDailyCandidate(s,p,ctx);assert.equal(c.validation.structurally_valid,true);
});

test('WEB-071 matrix substitution, bad snaps, forbidden fallback and stale cache identity are rejected before computation',async()=>{
 for(const change of ['graph','snap','fallback','cache','diagonal']){
  const{s,p}=await inputs();const provider=async(request:z.infer<typeof osrmMatrixRequest>)=>{const m=await matrix(request);
   if(change==='graph')m.graph_sha256='d'.repeat(64);if(change==='snap')m.snapped_sources[0].location=[107.9,-6];
   if(change==='fallback')(m as any).estimated_fallback_used=true;if(change==='cache')m.cache_key='e'.repeat(64);
   if(change==='diagonal')m.durations_seconds[0][0]=1;return m};
  await assert.rejects(computeDailyCandidate(s,p,{...ctx,python:'never-spawn',matrix:provider}),/MISMATCH|INVALID/);
 }
});

test('WEB-071 explicit capacity and minimum gap constrain the complete adapter',available,async()=>{
 const{s,p}=await inputs();s.rep_days[0].capacity_service_seconds=1199;let c=await computeDailyCandidate(s,p,ctx);
 assert.equal(c.result.solver_outcome,'infeasible');assert.equal(c.validation.structurally_valid,false);
 s.rep_days[0].capacity_service_seconds=7200;s.occurrences[0].last_completed_date='2026-10-24';s.source.cutoff='2026-10-24';
 c=await computeDailyCandidate(s,p,ctx);assert.equal(c.result.unscheduled[0].code,'hard_constraints_infeasible');
 assert.equal(c.validation.structurally_valid,false);
});

test('WEB-071 unsupported protected agenda and changed policy fail closed rather than claim a complete business plan',async()=>{
 const{s,p}=await inputs();s.policy_sha256='f'.repeat(64);await assert.rejects(computeDailyCandidate(s,p,ctx),/POLICY_HASH_MISMATCH/);
 s.policy_sha256=await agentSha256(canonicalJson(p));s.protected_agenda=[{work_plan_id:'manual',version:1,rep_id:'sr',customer_id:'other',scheduled_at:'2026-10-26T01:20:00Z',reserved_until:'2026-10-26T01:50:00Z',reservation_basis:'explicit_legacy_slot_policy',protection:'outside_selected_scope'}];
 await assert.rejects(computeDailyCandidate(s,p,ctx),/PROTECTED_AGENDA/);
});
