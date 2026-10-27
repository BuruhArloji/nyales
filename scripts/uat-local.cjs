const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const cli=path.join(process.cwd(),'node_modules/wrangler/bin/wrangler.js');
const persist='.wrangler/uat-web059-'+Date.now();
function run(args){console.log('[WEB-059 fixture] '+args.slice(0,3).join(' '));const r=spawnSync(process.execPath,[cli,...args],{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status||1)}
// A fresh local fixture per run avoids weakening auth limits or touching the
// user's existing .wrangler/state. No remote flags and no recursive deletion.
run(['d1','migrations','apply','nyales','--local','--persist-to',persist]);
run(['d1','execute','nyales','--local','--persist-to',persist,'--file','scripts/seed.sql']);
const sql=["INSERT OR IGNORE INTO product_group(id,organization_id,code,name) VALUES('uat-group','demo-org','UAT','Produk Uji Lokal');","INSERT OR IGNORE INTO product(id,organization_id,sku,name,base_unit,quantity_scale,product_group_id) VALUES('uat-product','demo-org','UAT-KOPI','Kopi Contoh','pcs',1,'uat-group');"];
for(let n=1;n<=15;n++)sql.push(`INSERT INTO customer_outlet(id,organization_id,area_id,external_code,name,address) VALUES('uat-c${n}','demo-org','area-a','UAT-${n}','Warung Contoh ${String(n).padStart(2,'0')}','Alamat simulasi UAT');`);
fs.mkdirSync('test-results/web059',{recursive:true});fs.writeFileSync('test-results/web059/fixture-extra.sql',sql.join('\n'));
run(['d1','execute','nyales','--local','--persist-to',persist,'--file','test-results/web059/fixture-extra.sql']);
fs.writeFileSync('test-results/web059/fixture.json',JSON.stringify({environment:'local',persist_to:persist,source:'scripts/seed.sql plus synthetic UAT-only extras',user_demo_state_untouched:true},null,2));
const child=spawn(process.execPath,[cli,'dev','--port','5182','--local','--persist-to',persist,'--var','APP_ENV:local','--var','LOCAL_AUTH:true','--live-reload=false'],{stdio:'inherit',windowsHide:true});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill();process.exit(0)});child.on('exit',code=>process.exit(code||0));
