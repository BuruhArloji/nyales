import{test}from'node:test';import assert from'node:assert/strict';
import{fixture}from'./sales-fixture';import{digest}from'../src/server/operations';
import{verifyRecoveryObjects,collectRecoveryObjects,recoveryObjectLimits,readRecoveryBytes}from'../src/server/recovery-objects';
const content='Authored private evidence',sha=()=>digest(content);
async function reference(table='evidence_attachment',id='file',key?:string):Promise<Record<string,any>>{
 key??=table==='evidence_attachment'?'evidence/o/'+id:table==='admin_boundary_chunk'?'o/admin-boundaries/'+id+'/0/chunk.geojson':'o/'+({customer_risk_run:'risk',territory_scenario_revision:'scenario',visit_planning_preflight:'visit-readiness'}as Record<string,string>)[table]+'/'+id+'.json';
 const common={organization_id:'o',id,storage_key:key};
 if(table==='evidence_attachment')return{...common,status:'ready',size:Buffer.byteLength(content),sha256:await sha()};
 return{...common,dataset_id:id,chunk_index:0,byte_count:Buffer.byteLength(content),[table==='admin_boundary_chunk'?'checksum':'snapshot_sha256']:await sha()};
}
function bucket(value:string=content){return{get:async()=>({body:new Blob([value]).stream(),size:Buffer.byteLength(value)})}as unknown as R2Bucket}
async function addAttachment(f:ReturnType<typeof fixture>){const row=await reference();f.sqlite.prepare("INSERT INTO evidence_attachment(id,organization_id,activity_id,user_id,storage_key,size,mime,sha256,status,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run('file','o','activity','sr',row.storage_key,row.size,'text/plain',row.sha256,'ready','2099-01-01T00:00:00Z',new Date().toISOString());f.objects.set(row.storage_key,content as any);return row}

test('WEB-057 object verification reads all five supported frozen reference families and never claims an actual restore',async()=>{
 const tables:Record<string,any[]>={};for(const t of ['evidence_attachment','admin_boundary_chunk','customer_risk_run','territory_scenario_revision','visit_planning_preflight'])tables[t]=[await reference(t,t)];
 const r=await verifyRecoveryObjects(bucket(),tables,'o');assert.equal(r.status,'passed');assert.equal(r.object_count,5);assert.equal(r.verified_count,5);assert.equal(r.verified_bytes,5*Buffer.byteLength(content));assert.equal(r.actual_restore_performed,false);
});
test('WEB-057 missing, corrupt, truncated and unreadable objects remain separate failures with no secret storage keys returned',async()=>{
 const row=await reference(),tables={evidence_attachment:[row]};
 let r=await verifyRecoveryObjects({get:async()=>null}as unknown as R2Bucket,tables,'o');assert.equal(r.checks[0].status,'missing');
 r=await verifyRecoveryObjects(bucket('x'.repeat(content.length)),tables,'o');assert.equal(r.checks[0].status,'checksum_mismatch');
 r=await verifyRecoveryObjects(bucket(content+'x'),tables,'o');assert.equal(r.checks[0].status,'size_mismatch');
 r=await verifyRecoveryObjects({get:async()=>{throw Error('private-bucket-provider-secret')}}as unknown as R2Bucket,tables,'o');assert.equal(r.checks[0].status,'unavailable');assert.equal(JSON.stringify(r).includes('private-bucket'),false);assert.equal(JSON.stringify(r).includes(row.storage_key),false);
});
test('WEB-057 invalid tenant paths, conflicting references and bounded object/byte inventories reject before R2 reads',async()=>{
 const row=await reference();let reads=0;const never={get:async()=>{reads++;throw Error('must not read')}}as unknown as R2Bucket;
 for(const change of [{organization_id:'x'},{storage_key:'x/secret'},{storage_key:'o/../x/secret'},{size:NaN},{sha256:'invalid'}])await assert.rejects(verifyRecoveryObjects(never,{evidence_attachment:[{...row,...change}]},'o'),/RECOVERY_OBJECT_/);
 assert.throws(()=>collectRecoveryObjects({evidence_attachment:[row,{...row,sha256:'a'.repeat(64)}]},'o'),/REFERENCE_CONFLICT/);
 assert.throws(()=>collectRecoveryObjects({evidence_attachment:Array.from({length:65},(_,i)=>({...row,id:String(i),storage_key:'evidence/o/key-'+i}))},'o'),/COUNT_LIMIT/);
 assert.throws(()=>collectRecoveryObjects({evidence_attachment:[{...row,size:recoveryObjectLimits.max_object_bytes+1}]},'o'),/BYTES_LIMIT/);assert.throws(()=>collectRecoveryObjects({evidence_attachment:Array.from({length:5},(_,i)=>({...row,id:String(i),storage_key:'evidence/o/large-'+i,size:recoveryObjectLimits.max_object_bytes}))},'o'),/BYTES_LIMIT/);assert.equal(reads,0);
});
test('WEB-057 identical references deduplicate reads; non-ready attachments and transient reports are explicitly outside verification',async()=>{
 const row=await reference();let reads=0;const b={get:async()=>{reads++;return{body:new Blob([content]).stream()}}}as unknown as R2Bucket;
 const r=await verifyRecoveryObjects(b,{evidence_attachment:[row,{...row,id:'same-content'},{...row,id:'pending',status:'pending'}],report_export:[{organization_id:'o',id:'ephemeral',storage_key:'o/report'}]},'o');
 assert.equal(reads,1);assert.equal(r.reference_count,2);assert.equal(r.object_count,1);assert.equal(r.skipped_uncommitted_attachments,1);assert.ok(r.excluded_scope.includes('Transient reports'));
});
test('WEB-057 oversized streaming bodies cancel reading instead of consuming unbounded bytes',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(100));},cancel(){cancelled=true}});
 await assert.rejects(readRecoveryBytes({body},10),/READ_BOUND/);assert.equal(cancelled,true);
});
test('WEB-057 API optional file drill persists real object checks while preserving commercial rows and metadata-only compatibility',async()=>{
 const f=fixture(),row=await addAttachment(f),facts=f.sqlite.prepare('SELECT * FROM customer_outlet').all(),backup=await f.data(await f.req('POST','/api/recovery/backups',{kind:'attachment_metadata',reason:'Synthetic attachment object test'},undefined,'mg'));
 let r=await f.data(await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Legacy metadata drill'},undefined,'mg'));assert.equal(r.reconciliation.objects.status,'not_requested');
 r=await f.data(await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Verify exact private bytes',verify_objects:true},undefined,'mg'));assert.equal(r.reconciliation.objects.verified_count,1);assert.equal(r.actual_restore_performed,false);
 f.objects.delete(row.storage_key);const failed=await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Missing bytes must fail',verify_objects:true},undefined,'mg');assert.equal(failed.status,422);const body=await failed.json()as any;assert.equal(body.code,'RECOVERY_DRILL_FAILED');assert.equal(body.data.checksum_match,true);assert.equal(body.data.reconciliation.objects.checks[0].status,'missing');assert.equal(f.sqlite.prepare('SELECT status FROM recovery_drill ORDER BY started_at DESC').get()!.status,'failed');
 assert.deepEqual(f.sqlite.prepare('SELECT * FROM customer_outlet').all(),facts);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM evidence_attachment').get()!.n,1);
});
test('WEB-057 file verification remains organization/role scoped and refuses forged verification options',async()=>{
 const f=fixture(),backup=await f.data(await f.req('POST','/api/recovery/backups',{kind:'logical',reason:'Scope test backup'},undefined,'mg'));
 assert.equal((await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Sales cannot inspect bytes',verify_objects:true},undefined,'sr')).status,403);
 assert.equal((await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Other organization cannot inspect bytes',verify_objects:true},undefined,'other','MANAGEMENT','x')).status,404);
 assert.equal((await f.req('POST','/api/recovery/drills',{manifest_id:backup.id,notes:'Forged input',verify_objects:'true'},undefined,'mg')).status,422);
});
