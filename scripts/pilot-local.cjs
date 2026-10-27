const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=process.cwd(),dir=process.argv[2],cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
if(!dir||!fs.existsSync(path.join(dir,'PREPARED.json')))throw Error('Pass a prepared synthetic pilot folder.');
const info=JSON.parse(fs.readFileSync(path.join(dir,'PREPARED.json'),'utf8'));
if(info.classification!=='synthetic'||info.production_accepted!==false)throw Error('Only synthetic local pilot allowed.');
const state=path.join(dir,'LOCAL-STATE.json');let config;
function run(args){console.log('Local pilot: '+args.slice(0,3).join(' '));const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});fs.writeFileSync(path.join(dir,args[1]==='migrations'?'migration.log':'seed.log'),(r.stdout||'')+(r.stderr||''));if(r.status!==0)throw Error('Local pilot setup failed; see log in prepared folder.');}
if(fs.existsSync(state)){config=JSON.parse(fs.readFileSync(state,'utf8'));if(config.classification!=='synthetic'||!config.persist_to.startsWith('.wrangler/pilot-'))throw Error('Invalid local persistence');}
else{
 config={classification:'synthetic',persist_to:'.wrangler/pilot-'+Date.now(),url:'http://127.0.0.1:5183',prepared_folder:path.resolve(dir),initialized_at:new Date().toISOString(),production_accepted:false};
 run(['d1','migrations','apply','nyales','--local','--persist-to',config.persist_to]);
 run(['d1','execute','nyales','--local','--persist-to',config.persist_to,'--file',path.join(dir,'seed.sql')]);
 fs.writeFileSync(state,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
}
console.log('NYALES synthetic local pilot: '+config.url+' | isolated state: '+config.persist_to);
require('./local-runtime.cjs').startRuntime({root,port:5183,persist:config.persist_to}).catch(e=>{console.error(e.message);process.exitCode=1});
