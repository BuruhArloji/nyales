import {generateCustomerOptionsContract} from '../scripts/generate-customer-options-contract';
import {generateOperationalProfileContract} from '../scripts/generate-visit-operational-contract';
import {generateVisitPlanningContract} from '../scripts/generate-visit-planning-contract';
import {generateAgentQueueContract} from '../scripts/generate-visit-agent-queue-contract';
import {generateVisitAgentContract} from '../scripts/generate-visit-agent-contract';
import {generateWorkloadContract} from '../scripts/generate-workload-contract';
import {generateRiskContract} from '../scripts/generate-risk-contract';
import {generateRegionalContract} from '../scripts/generate-regional-contract';
import {generateDistributionContract} from '../scripts/generate-distribution-contract';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import app from '../src/server/index';
import {generateInventory,generateRecoveryContract,generateCoreContract} from '../scripts/generate-security-contract';
import {generateGeographyContract} from '../scripts/generate-geography-contract';
import {generateBoundaryContract} from '../scripts/generate-boundary-contract';

test('WEB-058 runtime route inventory and recovery request contract stay synchronized',()=>{
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/customer-options.openapi.json','utf8')),generateCustomerOptionsContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/runtime-api.inventory.json','utf8')),generateInventory());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/m4-recovery-api.openapi.json','utf8')),generateRecoveryContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/core-api.openapi.json','utf8')),generateCoreContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/admin-boundaries-api.m4.openapi.json','utf8')),generateBoundaryContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/geography-api.m4.openapi.json','utf8')),generateGeographyContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/distribution-api.m4.openapi.json','utf8')),generateDistributionContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/regional-analytics-api.m4.openapi.json','utf8')),generateRegionalContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/customer-risk-api.m4.openapi.json','utf8')),generateRiskContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/workload-scenarios-api.m4.openapi.json','utf8')),generateWorkloadContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/visit-agent-identity.m4.openapi.json','utf8')),generateVisitAgentContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/visit-agent-queue.m4.openapi.json','utf8')),generateAgentQueueContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/visit-planning-readiness.m4.openapi.json','utf8')),generateVisitPlanningContract());
 assert.deepEqual(JSON.parse(readFileSync('docs/specifications/visit-operational-profiles.m4.openapi.json','utf8')),generateOperationalProfileContract());
 assert.ok(generateInventory().operations.every(r=>r.contracts.length>0),'Every registered API needs an implementation contract link');
});

test('WEB-058 implementation OpenAPI references resolve and operation IDs and path parameters are unique',()=>{
 for(const file of readdirSync('docs/specifications').filter(f=>f.endsWith('.openapi.json')&&!f.startsWith('Sales_'))){
  const doc=JSON.parse(readFileSync('docs/specifications/'+file,'utf8'));const ids=new Set();
  const walk=(node:any)=>{if(!node||typeof node!=='object')return;if(node.$ref?.startsWith('#/')){let target:any=doc;for(const key of node.$ref.slice(2).split('/'))target=target?.[key.replaceAll('~1','/').replaceAll('~0','~')];assert.notEqual(target,undefined,file+' '+node.$ref)}Object.values(node).forEach(walk)};walk(doc);
  for(const [path,item] of Object.entries(doc.paths) as any)for(const [method,op] of Object.entries(item) as any){if(!['get','post','put','patch','delete'].includes(method))continue;if(op.operationId){assert.ok(!ids.has(op.operationId),file+' duplicate '+op.operationId);ids.add(op.operationId)}
   const names=[...path.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);const params=[...(item.parameters||[]),...(op.parameters||[])].filter(p=>p.in==='path');assert.deepEqual(params.map(p=>p.name).sort(),names.sort(),file+' '+method+' '+path);assert.ok(params.every(p=>p.required));
  }
 }
});

test('WEB-058 every registered nonpublic API rejects missing user or machine credentials before a database access',async()=>{
 const inventory=generateInventory();let dbAccess=0;const env={APP_ENV:'local',LOCAL_AUTH:'true',FIREBASE_PROJECT_ID:'',DB:{prepare:()=>{dbAccess++;throw new Error('Must not touch DB')}}};
 for(const r of inventory.operations){if(r.authentication==='public')continue;if(r.path==='/api/auth/first-admin'){
  assert.equal((await app.request('https://nyales.example'+r.path,{method:'POST'},env as any)).status,404);
  const enabled={...env,APP_ENV:'staging',FIRST_ADMIN_EMAIL:'owner@example.test',FIRST_ADMIN_ORGANIZATION_NAME:'Org'};
  const denied=await app.request('https://nyales.example'+r.path,{method:'POST'},enabled as any);assert.equal(denied.status,401);assert.equal((await denied.json()as any).code,'UNAUTHENTICATED');continue;
 }const path=r.path.replace(/:[\w]+/g,'synthetic-id');const response=await app.request('https://nyales.example'+path,{method:r.method,...(r.method==='GET'?{}:{body:'{}',headers:{'Content-Type':'application/json'}})},env as any);assert.equal(response.status,401,r.method+' '+path);assert.equal((await response.json() as any).code,'UNAUTHENTICATED');}
 assert.equal(dbAccess,0);
});
