import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {resolve}from'node:path';
import {pathToFileURL}from'node:url';
import {createHash}from'node:crypto';
import {database}from'../tests/sqlite-helper';
import {runDemo}from'./pilot-demo';
import {localSeed}from'./pilot-local-prepare';

export type TrainingContext={environment:'staging';organization_id:string;operator_id:string;organization_name:'NYALES Pilot';as_of:string};
const literal=(v:string)=>"'"+v.replaceAll("'","''")+"'";
const names=['Novely','Didik','Mursal','Ayu Lestari','Bima Saputra','Citra Dewi','Deni Pratama','Eka Putri','Fajar Ramadhan','Gita Permata'];
const stores=['Warung Sumber Rezeki','Toko Berkah Jaya','Warung Bu Sari','Toko Maju Bersama','Warung Pak Budi','Toko Sinar Baru','Warung Melati','Toko Sahabat','Warung Bu Rina','Toko Harapan Jaya','Warung Sejahtera','Toko Cahaya','Warung Pak Agus','Toko Makmur','Warung Anggrek','Toko Bintang','Warung Nusantara','Toko Pelangi','Warung Kenanga','Toko Sentosa'];
export function trainingDerivative(raw:any,asOf:string){
 if(raw.data_classification!=='synthetic'||raw.scope.organization_id!=='nyales-training-only')throw Error('SYNTHETIC_SOURCE_REQUIRED');
 if(!/^2026-10-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf)))throw Error('REVIEWED_OCTOBER_2026_ONLY');
 const shifted=JSON.stringify(raw).replace(/2026-(06|07|08|09)-(\d{2})/g,(_m,month,day)=>`2026-${String(Number(month)+1).padStart(2,'0')}-${month==='09'&&day==='30'?'31':day}`),data=JSON.parse(shifted);
 data.scope.cutoff=asOf+'T00:00:00Z';data.description='Synthetic staging training only. Dates shifted July–October 2026; roles and coordinates are illustrative, not real business assignments.';
 for(const [i,user]of data.users.entries())user.name=names[i];
 for(const [i,customer]of data.customers.entries()){customer.name=stores[i];customer.address='Lokasi simulasi Jakarta untuk latihan; bukan alamat kunjungan nyata';customer.latitude_e7=Math.round((-6.20+Math.floor(i/5)*.012)*1e7);customer.longitude_e7=Math.round((106.80+i%5*.012)*1e7)}
 if(data.invoices.some((i:any)=>i.invoice_date>asOf)||data.credits.some((c:any)=>c.credit_date>asOf))throw Error('AS_OF_PRECEDES_SYNTHETIC_INVOICES');
 return data;
}
export async function prepareStagingTraining(output:string,context:TrainingContext){
 if(context.environment!=='staging'||context.organization_name!=='NYALES Pilot'||![context.organization_id,context.operator_id].every(id=>/^[a-f0-9-]{36}$/.test(id)))throw Error('EXPLICIT_STAGING_PILOT_CONTEXT_REQUIRED');
 const dir=resolve(output);mkdirSync(dir,{recursive:false});
 const raw=readFileSync('pilot/demo-10-sales/source-data.json'),input=trainingDerivative(JSON.parse(raw.toString('utf8')),context.as_of);
 const source=resolve(dir,'source-data.json');writeFileSync(source,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
 let seed='';await runDemo(resolve(dir,'rehearsal'),source,sqlite=>{
  // Names are illustrative; fixture role separation and amounts remain intact.
  const leaderNames:Record<string,string>={'demo-pic':'Rizky Aditya','demo-reviewer':'Nadia Prameswari','spv-field':'Nanda Wijaya','spv-telesales':'Rina Puspita','am-field':'Agus Santoso','am-telesales':'Ratna Sari'};
  for(const [id,name]of Object.entries(leaderNames))sqlite.prepare('UPDATE app_user SET name=? WHERE id=?').run(name,id);
  sqlite.prepare("UPDATE branch SET name='Cabang Jakarta Simulasi'").run();sqlite.prepare("UPDATE area SET name='Jakarta Pusat Simulasi'").run();
  seed=localSeed(sqlite);
 });
 const sourceLines=seed.split('\n').filter(line=>!line.startsWith('INSERT INTO "organization"')&&!line.startsWith("INSERT INTO app_user(id,organization_id,name) VALUES('demo-management'")&&!line.startsWith("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('pilot-local-operator'"));
 seed=sourceLines.join('\n').replaceAll('demo-management',context.operator_id).replaceAll('demo-org',context.organization_id).replaceAll('demo-', 'training-v1-')
  .replace('-- SYNTHETIC LOCAL PILOT ONLY. Apply once to a new migrated local D1.','-- SYNTHETIC STAGING TRAINING. Reviewed derivative, preserve existing real operator.')
  .replace("'demo_fixture','showcase-v1-'","'training_dataset','staging-pilot-10-sales'");
 const businessTables=['branch','area','work_calendar','customer_outlet','customer_assignment','invoice','credit_note','target_plan','product','activity'];
 const guard=`INSERT INTO master_mutation_guard(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM organization)=1 AND EXISTS(SELECT 1 FROM organization WHERE id=${literal(context.organization_id)} AND name='NYALES Pilot') AND (SELECT COUNT(*) FROM app_user)=1 AND EXISTS(SELECT 1 FROM app_user u JOIN auth_role_assignment r ON r.user_id=u.id AND r.organization_id=u.organization_id WHERE u.id=${literal(context.operator_id)} AND u.organization_id=${literal(context.organization_id)} AND u.status='active' AND u.auth_subject IS NOT NULL AND r.role_code='MANAGEMENT' AND r.effective_to_date IS NULL) AND (SELECT COUNT(*) FROM auth_role_assignment)=1 AND ${businessTables.map(t=>`NOT EXISTS(SELECT 1 FROM ${t})`).join(' AND ')} THEN 1 ELSE 0 END;\n`;
 seed=guard+seed+`\nINSERT INTO customer_source_coverage(organization_id,complete_from,complete_through,reason,updated_by,updated_at,history_complete) VALUES(${literal(context.organization_id)},'2026-07-01',${literal(context.as_of)},'Cakupan lengkap khusus dataset sintetis latihan; bukan data transaksi produksi',${literal(context.operator_id)},CURRENT_TIMESTAMP,1);\nDELETE FROM master_mutation_guard;\n`;
 const check=database();
 try{
  check.sqlite.exec('PRAGMA foreign_keys=ON');
  check.sqlite.prepare('INSERT INTO organization(id,name) VALUES(?,?)').run(context.organization_id,context.organization_name);
  check.sqlite.prepare("INSERT INTO app_user(id,organization_id,name,auth_subject) VALUES(?,?,'Existing operator','existing-operator-fixture')").run(context.operator_id,context.organization_id);
  check.sqlite.prepare("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,channel,effective_from_date) VALUES('existing-role',?,?,'MANAGEMENT',NULL,'2026-01-01')").run(context.organization_id,context.operator_id);
  check.sqlite.exec('BEGIN');try{check.sqlite.exec(seed);check.sqlite.exec('COMMIT')}catch(e){check.sqlite.exec('ROLLBACK');throw e}
  const count=(table:string)=>(check.sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get()as{n:number}).n;
  if(check.sqlite.prepare('PRAGMA foreign_key_check').all().length||count('invoice')!==80||count('customer_outlet')!==20||count('app_user')!==17)throw Error('STAGING_TRAINING_RESTORE_FAILED');
  const preserved=check.sqlite.prepare('SELECT * FROM app_user WHERE id=?').get(context.operator_id)as any;if(preserved.auth_subject!=='existing-operator-fixture'||preserved.name!=='Existing operator')throw Error('OPERATOR_WAS_MODIFIED');
  const testReplay=()=>{check.sqlite.exec('BEGIN');try{check.sqlite.exec(seed);check.sqlite.exec('COMMIT');throw Error('REPLAY_ACCEPTED')}catch(e){check.sqlite.exec('ROLLBACK');if((e as Error).message==='REPLAY_ACCEPTED')throw e}};testReplay();
 }finally{check.sqlite.close()}
 const report={classification:'synthetic',environment:'staging',period_start:input.scope.period_start,period_end:input.scope.period_end,as_of:context.as_of,source:'pilot/demo-10-sales/source-data.json',source_sha256:createHash('sha256').update(raw).digest('hex'),seed_sha256:createHash('sha256').update(seed).digest('hex'),organization_id:context.organization_id,preserves_existing_operator:true,creates_firebase_accounts:false,synthetic_staff:16,sales_reps:8,telesales:2,customers:20,invoices:80,credits:4,approved_target_plans:2,leaf_target_minor:80000000,source_reconciliation:'passed',local_exact_seed_restore:'passed',duplicate_seed:'rejected',production_accepted:false};
 writeFileSync(resolve(dir,'seed.sql'),seed,{flag:'wx'});writeFileSync(resolve(dir,'PREPARED.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--context'||args[2]!=='--out')throw Error('Use --context <private-context.json> --out <new directory>');console.log(JSON.stringify(await prepareStagingTraining(args[3],JSON.parse(readFileSync(args[1],'utf8')))))}
