const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {DatabaseSync,backup}=require('node:sqlite'),{spawnSync}=require('node:child_process');
const root=process.cwd(),folder=process.argv[2],output=process.argv[3];
if(!folder||!output)throw Error('Usage: node scripts/pilot-local-restore.cjs <prepared local pilot folder> <new evidence folder>');
const state=JSON.parse(fs.readFileSync(path.join(folder,'LOCAL-STATE.json'),'utf8'));
if(state.classification!=='synthetic'||state.production_accepted!==false||!/^\.wrangler\/pilot-\d+$/.test(state.persist_to))throw Error('Only known synthetic pilot state allowed');
const sourceRoot=path.resolve(root,state.persist_to),dir=path.resolve(output),restorePersist='.wrangler/pilot-restore-'+Date.now(),restoreRoot=path.resolve(root,restorePersist);
assert.ok(sourceRoot.startsWith(path.resolve(root,'.wrangler')+path.sep));assert.ok(restoreRoot.startsWith(path.resolve(root,'.wrangler')+path.sep));
fs.mkdirSync(dir,{recursive:false});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function run(args,label){const result=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});fs.writeFileSync(path.join(dir,label+'.log'),(result.stdout||'')+(result.stderr||''),{flag:'wx'});if(result.status!==0)throw Error('Local recovery failed: '+label);return result.stdout;}
function inventory(db){
 const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 const tables={};for(const {name} of schema.filter(x=>x.type==='table')){const values=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort();tables[name]={rows:values.length,sha256:hash(values.join('\n'))};}
 return {schema_sha256:hash(JSON.stringify(schema)),tables};
}
(async()=>{
 const started=Date.now(),d1dir=path.join(sourceRoot,'v3/d1/miniflare-D1DatabaseObject');let sourceFile;
 for(const file of fs.readdirSync(d1dir).filter(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite')){const candidate=path.join(d1dir,file),db=new DatabaseSync(candidate,{readOnly:true});try{if(db.prepare("SELECT id FROM master_audit WHERE id='pilot-operations-v1' AND organization_id='demo-org'").get())sourceFile=candidate;}catch{}finally{db.close()}}
 if(!sourceFile)throw Error('Operational synthetic pilot database not found');
 const source=new DatabaseSync(sourceFile,{readOnly:true}),snapshotPath=path.join(dir,'d1-snapshot.sqlite');
 try{await backup(source,snapshotPath)}finally{source.close()}
 const snapshot=new DatabaseSync(snapshotPath,{readOnly:true});let captured,attachments,boundaryChunks,riskSnapshots,scenarioSnapshots;
 try{assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(snapshot.prepare('PRAGMA foreign_key_check').all().length,0);captured=inventory(snapshot);attachments=snapshot.prepare("SELECT id,storage_key,sha256,size FROM evidence_attachment WHERE organization_id='demo-org' AND status='ready'").all();boundaryChunks=snapshot.prepare("SELECT dataset_id||':'||chunk_index id,storage_key,checksum sha256,byte_count size FROM admin_boundary_chunk WHERE organization_id='demo-org'").all();
  riskSnapshots=snapshot.prepare("SELECT id,storage_key,snapshot_sha256 sha256,byte_count size FROM customer_risk_run WHERE organization_id='demo-org'").all();
  scenarioSnapshots=snapshot.prepare("SELECT id,storage_key,snapshot_sha256 sha256,byte_count size FROM territory_scenario_revision WHERE organization_id='demo-org'").all();
  // Restore the complete database, including schema, history and guards, into
  // a new Wrangler namespace. Never overwrite the source file or its WAL.
  const restoredFile=path.join(restoreRoot,path.relative(sourceRoot,sourceFile));fs.mkdirSync(path.dirname(restoredFile),{recursive:true});await backup(snapshot,restoredFile);
  const restored=new DatabaseSync(restoredFile,{readOnly:true});try{assert.deepEqual(inventory(restored),captured);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[])}finally{restored.close()}
 }finally{snapshot.close()}
 const attachmentResults=[];for(const [i,a] of [...attachments.map(a=>({...a,kind:'attachment',mime:'application/pdf'})),...boundaryChunks.map(a=>({...a,kind:'boundary_chunk',mime:'application/geo+json'})),...riskSnapshots.map(a=>({...a,kind:'risk_snapshot',mime:'application/json'})),...scenarioSnapshots.map(a=>({...a,kind:'scenario_snapshot',mime:'application/json'}))].entries()){
  const sourceBytes=path.join(dir,`attachment-${i}.bin`),restoredBytes=path.join(dir,`restored-attachment-${i}.bin`),object='nyales-import-sources/'+a.storage_key;
  run(['r2','object','get',object,'--local','--persist-to',state.persist_to,'--file',sourceBytes],'r2-capture-'+i);
  const bytes=fs.readFileSync(sourceBytes);assert.equal(bytes.length,a.size);assert.equal(hash(bytes),a.sha256);
  run(['r2','object','put',object,'--local','--persist-to',restorePersist,'--file',sourceBytes,'--content-type',a.mime],'r2-restore-'+i);
  run(['r2','object','get',object,'--local','--persist-to',restorePersist,'--file',restoredBytes],'r2-verify-'+i);assert.deepEqual(fs.readFileSync(restoredBytes),bytes);
  attachmentResults.push({id:a.id,kind:a.kind,size:a.size,sha256:a.sha256,restored_bytes_match:true});
 }
 // Read through Wrangler D1 itself, beyond SQLite file-level comparison.
 const raw=run(['d1','execute','nyales','--local','--persist-to',restorePersist,'--command',"SELECT (SELECT COUNT(*) FROM invoice) invoice_count,(SELECT COUNT(*) FROM activity) activity_count,(SELECT COUNT(*) FROM evidence_attachment WHERE status='ready') ready_attachments,(SELECT SUM(net_minor) FROM invoice WHERE status='validated' AND is_current=1 AND invoice_date BETWEEN '2026-10-01' AND '2026-10-21') october_net;",'--json'],'restored-d1-query');
 const query=JSON.parse(raw),facts=query[0].results[0];assert.equal(facts.invoice_count,80);assert.equal(facts.activity_count,12);assert.equal(facts.october_net,36520000);assert.equal(facts.ready_attachments,attachments.length);
 const report={classification:'synthetic',status:'local_full_database_and_attachment_restore_passed',verified_at:new Date().toISOString(),source_persist:state.persist_to,restored_persist:restorePersist,method:'SQLite online backup of running local D1, full inventory comparison, Wrangler D1 query, R2 byte copy and download comparison',snapshot_sha256:hash(fs.readFileSync(snapshotPath)),schema_sha256:captured.schema_sha256,tables:captured.tables,table_count:Object.keys(captured.tables).length,attachments:attachmentResults.filter(a=>a.kind==='attachment'),boundary_chunks:attachmentResults.filter(a=>a.kind==='boundary_chunk'),risk_snapshots:attachmentResults.filter(a=>a.kind==='risk_snapshot'),scenario_snapshots:attachmentResults.filter(a=>a.kind==='scenario_snapshot'),restored_d1:facts,duration_ms:Date.now()-started,source_database_modified:false,cloud_restore_verified:false,rpo_rto_sla_accepted:false,production_accepted:false};
 fs.writeFileSync(path.join(dir,'SUMMARY.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,tables:report.table_count,attachments:report.attachments.length,boundary_chunks:report.boundary_chunks.length,risk_snapshots:attachmentResults.filter(a=>a.kind==='risk_snapshot'),scenario_snapshots:attachmentResults.filter(a=>a.kind==='scenario_snapshot'),restored_d1:facts,duration_ms:report.duration_ms}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
