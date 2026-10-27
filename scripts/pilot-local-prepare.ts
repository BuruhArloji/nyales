import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {DatabaseSync} from 'node:sqlite';
import {runDemo} from './pilot-demo';
import {database} from '../tests/sqlite-helper';

/** Local-only synthetic seed. Domain APIs create the facts first, then this
 * exports a fixture with all normal migration constraints still enabled. */
export function localSeed(sqlite:DatabaseSync){
 const literal=(v:unknown):string=>v===null?'NULL':typeof v==='number'||typeof v==='bigint'?String(v):"'"+String(v).replaceAll('nyales-training-only','demo-org').replaceAll("'","''")+"'";
 const tables=(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {name:string}[]).map(r=>r.name);
 const priority=['organization','branch','area','app_user','auth_role_assignment','user_area_scope','reporting_assignment','customer_outlet','customer_assignment','target_plan','target_version','target_item'];
 const ordered=[...priority,...tables.filter(t=>!priority.includes(t)&&!['finance_epoch','geo_distribution_epoch','visit_planning_revision'].includes(t))];
 const sql=['-- SYNTHETIC LOCAL PILOT ONLY. Apply once to a new migrated local D1.'];
 const approved:string[]=[];let staged=false,ordinal=0;
 for(const table of ordered){
  for(const row of sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string,unknown>[]){
   if(table==='target_version'&&row.status==='approved'){approved.push(String(row.id));row.status='draft'}
   const keys=Object.keys(row),large=keys.filter(k=>typeof row[k]==='string'&&(row[k] as string).length>8000);
   const rowKey=++ordinal;
   if(large.length){
    if(!staged){sql.push('CREATE TABLE nyales_seed_immutable_chunks(resource INTEGER NOT NULL,field TEXT NOT NULL,seq INTEGER NOT NULL,fragment TEXT NOT NULL,PRIMARY KEY(resource,field,seq));');staged=true}
    for(const key of large){const characters=Array.from(String(row[key]).replaceAll('nyales-training-only','demo-org'));for(let offset=0;offset<characters.length;offset+=8000)sql.push(`INSERT INTO nyales_seed_immutable_chunks VALUES(${rowKey},${literal(key)},${offset/8000},${literal(characters.slice(offset,offset+8000).join(''))});`)}
   }
   const value=(key:string)=>large.includes(key)?`(SELECT group_concat(fragment,'') FROM(SELECT fragment FROM nyales_seed_immutable_chunks WHERE resource=${rowKey} AND field=${literal(key)} ORDER BY seq))`:literal(row[key]);
   sql.push(`INSERT INTO "${table}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(value).join(',')});`);
   if(large.length)sql.push(`DELETE FROM nyales_seed_immutable_chunks WHERE resource=${rowKey};`);
  }
 }
 if(staged)sql.push('DROP TABLE nyales_seed_immutable_chunks;');
 for(const id of approved)sql.push(`UPDATE target_version SET status='approved' WHERE id=${literal(id)};`);
 // The login identity is the existing local demo operator, distinct from PIC.
 sql.push("INSERT INTO app_user(id,organization_id,name) VALUES('demo-management','demo-org','Dina Pratiwi');");
 sql.push("INSERT INTO auth_role_assignment(id,organization_id,user_id,role_code,effective_from_date) VALUES('pilot-local-operator','demo-org','demo-management','MANAGEMENT','2026-01-01');");
 sql.push("INSERT INTO work_calendar(id,organization_id,branch_id,name,weekdays_json,start_time,end_time,holidays_json) VALUES('pilot-calendar','demo-org','demo-branch','Kalender latihan','[1,2,3,4,5,6]','08:00','18:00','[]');");
 sql.push("INSERT INTO product_group(id,organization_id,code,name) VALUES('pilot-product-group','demo-org','DUMMY','Produk simulasi');");
 sql.push("INSERT INTO product(id,organization_id,sku,name,base_unit,quantity_scale,product_group_id) VALUES('pilot-product','demo-org','DUMMY-KOPI','Kopi Simulasi','pcs',1,'pilot-product-group');");
 sql.push("INSERT INTO product_price(id,organization_id,product_id,amount_minor,currency,unit_code,effective_from_date,source,created_by,created_at) VALUES('pilot-price','demo-org','pilot-product',10000,'IDR','pcs','2026-01-01','synthetic local pilot','demo-management',CURRENT_TIMESTAMP);");
 // Existing client demo indicator. The audit payload identifies this seed.
 sql.push("INSERT INTO master_audit(id,organization_id,actor_id,resource_type,resource_id,action,after_json,occurred_at) VALUES('pilot-local-marker','demo-org','demo-management','demo_fixture','showcase-v1-','create','{\"fixture\":\"pilot-local-10-sales\",\"synthetic\":true}',CURRENT_TIMESTAMP);");
 for(const row of sqlite.prepare('SELECT * FROM finance_epoch').all() as any[])sql.push(`INSERT INTO finance_epoch(organization_id,epoch) VALUES(${literal(row.organization_id)},${row.epoch}) ON CONFLICT(organization_id) DO UPDATE SET epoch=excluded.epoch;`);
 for(const row of sqlite.prepare('SELECT * FROM geo_distribution_epoch').all() as any[])sql.push(`INSERT INTO geo_distribution_epoch(organization_id,epoch) VALUES(${literal(row.organization_id)},${row.epoch}) ON CONFLICT(organization_id) DO UPDATE SET epoch=excluded.epoch;`);
 for(const row of sqlite.prepare('SELECT * FROM visit_planning_revision').all() as any[])sql.push(`INSERT INTO visit_planning_revision(organization_id,source_epoch,agenda_epoch) VALUES(${literal(row.organization_id)},${row.source_epoch},${row.agenda_epoch}) ON CONFLICT(organization_id) DO UPDATE SET source_epoch=excluded.source_epoch,agenda_epoch=excluded.agenda_epoch;`);
 return sql.join('\n')+'\n';
}

export async function prepareLocalPilot(output:string){
 const dir=resolve(output);mkdirSync(dir,{recursive:false});
 const source=JSON.parse(readFileSync('pilot/demo-10-sales/source-data.json','utf8'));
 // Preserve the reviewed September source. A clearly labelled derivative uses
 // October dates so the current-month overview has useful demonstration data.
 const shifted=JSON.stringify(source).replace(/2026-(06|07|08|09)-(\d{2})/g,(_m,month,day)=>`2026-${String(Number(month)+1).padStart(2,'0')}-${month==='09'&&day==='30'?'31':day}`);
 const data=JSON.parse(shifted);data.scope.cutoff=new Date().toISOString();
 data.description='Synthetic local pilot derivative: reviewed June–September dates shifted to July–October 2026. No real role/area/account assignment.';
 // Explicit synthetic locations around Jakarta, not observed customer GPS.
 for(const [i,c] of data.customers.entries()){c.latitude_e7=Math.round((-6.20+Math.floor(i/5)*0.012)*1e7);c.longitude_e7=Math.round((106.80+(i%5)*0.012)*1e7)}
 const input=resolve(dir,'source-data.json');writeFileSync(input,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 let sql='';const report=await runDemo(resolve(dir,'rehearsal'),input,sqlite=>{sql=localSeed(sqlite)});
 // Prove this exact SQL restores through current migrations and constraints.
 const check=database();try{check.sqlite.exec('PRAGMA foreign_keys=ON;');check.sqlite.exec(sql);if(check.sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Seed foreign key violation');if((check.sqlite.prepare("SELECT COUNT(*) n FROM invoice WHERE organization_id='demo-org'").get() as any).n!==80)throw Error('Incomplete seed');}finally{check.sqlite.close()}
 writeFileSync(resolve(dir,'seed.sql'),sql,{flag:'wx'});
 writeFileSync(resolve(dir,'PREPARED.json'),JSON.stringify({classification:'synthetic',url:'http://127.0.0.1:5183',source_derivative:'source-data.json',original_source:'pilot/demo-10-sales/source-data.json',period:data.scope.period_start+' / '+data.scope.period_end,synthetic_map_coordinates:true,login_operator:'Dina Pratiwi (local demo)',pic:'Rizky Aditya',totals:report.totals.nyales,production_accepted:false},null,2)+'\n',{flag:'wx'});
 return {dir,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')throw Error('Use --out <new folder>');await prepareLocalPilot(args[1]);console.log('Local synthetic pilot seed prepared and restored with constraints.');}
