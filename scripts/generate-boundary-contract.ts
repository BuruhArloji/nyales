import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {boundaryRequestSchemas} from '../src/server/boundaries';
import {boundaryPropertiesSchema,boundaryLimits} from '../src/shared/boundaries';

export function generateBoundaryContract(){
 const schemas:Record<string,any>=Object.fromEntries(Object.entries(boundaryRequestSchemas).map(([name,s])=>[name,z.toJSONSchema(s,{io:'input'})]));
 schemas.properties=z.toJSONSchema(boundaryPropertiesSchema);
 const point={type:'array',minItems:2,maxItems:2,prefixItems:[{type:'number',minimum:-180,maximum:180},{type:'number',minimum:-90,maximum:90}],items:false};
 const ring={type:'array',minItems:4,items:point},polygon={type:'array',minItems:1,items:ring};
 schemas.geometry={oneOf:[{type:'object',required:['type','coordinates'],properties:{type:{const:'Polygon'},coordinates:polygon},additionalProperties:false},{type:'object',required:['type','coordinates'],properties:{type:{const:'MultiPolygon'},coordinates:{type:'array',minItems:1,items:polygon}},additionalProperties:false}]};
 schemas.collection={type:'object',required:['type','features'],properties:{type:{const:'FeatureCollection'},features:{type:'array',minItems:1,maxItems:boundaryLimits.maxFeatures,items:{type:'object',required:['type','properties','geometry'],properties:{type:{const:'Feature'},properties:{$ref:'#/components/schemas/properties'},geometry:{$ref:'#/components/schemas/geometry'}},additionalProperties:false}}},additionalProperties:false};
 schemas.chunk.properties.collection={$ref:'#/components/schemas/collection'};schemas.chunk.required=['index','collection'];
 schemas.error={type:'object',required:['code'],properties:{code:{type:'string'},detail:{type:'string'}},additionalProperties:true};
 schemas.data={type:'object',required:['data'],properties:{data:{},next:{type:['string','null']},dataset_status:{type:'string'}},additionalProperties:false};
 const paths:Record<string,any>={};
 for(const [method,suffix,request,description] of [
  ['get','config',null,'Limits, selected source and unverified usage-terms notice.'],
  ['get','datasets',null,'Organization release list; 50 rows, after cursor and next cursor.'],
  ['post','datasets','dataset','Create immutable draft manifest (201) or resume an exact matching partial draft (200). Different provenance conflicts. No automatic source fetching.'],
  ['get','datasets/{id}',null,'Release metadata/counts/chunk checksums and ETag.'],
  ['post','datasets/{id}/chunks','chunk','Validate full topology, canonicalize, retain private R2 FeatureCollection and transactionally index its village metadata.'],
  ['post','datasets/{id}/activate','review','Verify complete manifest and source checksums; reviewed activation atomically retires previous release, preserving historical references.'],
  ['get','datasets/{id}/boundaries',null,'Paginated full metadata and release hierarchy snapshots, 100 rows. No geometry or customer data.'],
  ['get','datasets/{id}/chunks/{index}',null,'Private full-geometry download after SHA-256 verification; no public R2 URL.']
 ] as const){
  const path='/api/admin-boundaries/'+suffix,parameters:any[]=[];
  for(const name of [...path.matchAll(/\{(\w+)\}/g)].map(m=>m[1]))parameters.push({in:'path',name,required:true,schema:name==='index'?{type:'integer',minimum:0,maximum:99}:{type:'string',maxLength:128}});
  if(method==='post')parameters.push({in:'header',name:'Idempotency-Key',required:true,schema:{type:'string',minLength:8,maxLength:128}});
  if(method==='post'&&suffix.includes('{id}'))parameters.push({in:'header',name:'If-Match',required:true,schema:{type:'string'},example:'"1"'});
  if(method==='get'&&['datasets','datasets/{id}/boundaries'].includes(suffix))parameters.push({in:'query',name:'after',required:false,schema:{type:'string'}});
  const download=suffix.endsWith('{index}'),responses:any={200:{description:download?'Verified GeoJSON chunk':'Resource-specific data envelope; detail includes immutable metadata, reviewer and version',content:{[download?'application/geo+json':'application/json']:{schema:{$ref:'#/components/schemas/'+(download?'collection':'data')}}}}};
  if(method==='post'&&suffix==='datasets')responses[201]={description:'Draft created',content:{'application/json':{schema:{$ref:'#/components/schemas/data'}}}};
  for(const code of [400,401,403,404,409,412,413,422,428,503])responses[code]={description:({400:'Missing or invalid idempotency header',401:'Bearer/device session missing or expired',403:'Management/NSM organization-wide permission required',404:'Missing or foreign organization resource',409:'Immutable/duplicate/conflicting source or checksum; active release unchanged on failure',412:'If-Match or expected_active_id stale',413:'Actual request body too large',422:'Invalid JSON/schema, topology, coordinate, complexity, date or count',428:'If-Match required',503:'Storage/source unavailable'})[code],content:{'application/json':{schema:{$ref:'#/components/schemas/error'}}}};
  paths[path]??={};paths[path][method]={operationId:'boundary_'+method+'_'+suffix.replace(/\W/g,'_'),summary:description,parameters,responses,...(request?{requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+request}}}}}:{}),'x-access-policy':'Management/NSM in current organization for ALL WEB-063 routes, including reads. Scoped operational polygon views are deferred to WEB-064.'};
 }
 return {openapi:'3.1.0',info:{title:'NYALES WEB-063 administrative boundary administration - local implementation',version:'0.1.0',description:'Separate from full-product /api/v1 contract. Private versioned geometry in R2, metadata in D1. No matching, territory assignment or customer/owner changes. Activation requires reviewed usage rights and exact manifest; public source availability is not a license assertion.'},security:[{BearerAuth:[],DeviceSession:[]}],paths,components:{schemas,securitySchemes:{BearerAuth:{type:'http',scheme:'bearer'},DeviceSession:{type:'apiKey',in:'header',name:'X-Device-Session'}}},'x-limits':boundaryLimits};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/generate-boundary-contract.ts')){const doc=generateBoundaryContract();writeFileSync('docs/specifications/admin-boundaries-api.m4.openapi.json',JSON.stringify(doc,null,2)+'\n');console.log('Wrote WEB-063 implementation contract: 8 operations')}
