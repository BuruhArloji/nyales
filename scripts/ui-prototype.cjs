// Isolated local API + Vite HMR. This launcher has no remote deployment mode.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const{spawn,spawnSync}=require('node:child_process');
const{reserveRuntime}=require('./local-runtime.cjs');
const{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function readTrainingPackage(directory){
 const seed=path.resolve(root,directory),manifest=JSON.parse(fs.readFileSync(path.join(seed,'manifest.json'),'utf8'));
 if(manifest.classification!=='synthetic'||manifest.local_only!==true||manifest.remote_allowed!==false||manifest.organization_id!=='demo-org'||!/^training-v1-[a-f0-9]{12}$/.test(manifest.dataset)||manifest.validation?.idempotent!==true||manifest.validation?.foreign_keys!=='ok')throw Error('A validated local-only training package is required.');
 const sql=path.join(seed,'seed.local.sql'),digest=createHash('sha256').update(fs.readFileSync(sql)).digest('hex');
 if(digest!==manifest.sql_sha256)throw Error('Training SQL checksum differs from the validated manifest. Regenerate the package.');
 return{seed,sql,digest,manifest};
}
let base=path.join(root,'.nyales-agent/ui-prototype'),persist='.wrangler/ui-prototype-v1',training=null;
const config=path.join(root,'tools/ui-prototype/wrangler.jsonc');
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js'),children=[];
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
// The prototype never needs these provider credentials, even if the parent shell has them.
for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_ACCOUNT_ID','GOOGLE_APPLICATION_CREDENTIALS'])delete env[key];
function runNode(args,label){
 const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 fs.writeFileSync(path.join(base,label+'.log'),(result.stdout||'')+(result.stderr||''));
 if(result.status!==0)throw Error('Prototype '+label+' failed; see .nyales-agent/ui-prototype/'+label+'.log');
}
async function freePort(port){const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',()=>reject(Error('Port '+port+' is occupied; reuse the existing prototype or stop that server first.')));probe.listen(port,'127.0.0.1',resolve)});await new Promise(resolve=>probe.close(resolve))}
async function ready(url,child){
 const start=Date.now();while(Date.now()-start<60000){if(child.exitCode!==null)throw Error('Prototype process stopped before becoming ready.');try{if((await fetch(url,{signal:AbortSignal.timeout(1500)})).ok)return}catch{}await new Promise(r=>setTimeout(r,500))}
 throw Error('Prototype did not start within 60 seconds.');
}
function start(args){const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});children.push(child);return child}
async function main(){
 const args=process.argv.slice(2);
 if(args.length){if(args.length!==2||args[0]!=='--training-package')throw Error('Usage: npm run ui:prototype -- [--training-package DIRECTORY]');training=readTrainingPackage(args[1]);persist='.wrangler/ui-'+training.manifest.dataset;base=path.join(root,'.nyales-agent/ui-'+training.manifest.dataset);if(!fs.existsSync(path.join(base,'INITIALIZED.json'))&&fs.existsSync(path.join(root,persist))&&fs.readdirSync(path.join(root,persist)).length)throw Error('Training persistence exists without its initialization marker. Choose a fresh package; existing local databases are preserved.');}
 await freePort(5190);fs.mkdirSync(base,{recursive:true});
 const lease=await reserveRuntime(root,5191,persist);let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);process.once('exit',()=>{stop();lease.release()});
 try{
  const state=path.join(base,'INITIALIZED.json');
  if(!fs.existsSync(state)){
   if(training){
    runNode([cli,'d1','migrations','apply','nyales-ui-prototype','--local','--persist-to',persist,'--config',config],'migrate');
    runNode([cli,'d1','execute','nyales-ui-prototype','--local','--persist-to',persist,'--config',config,'--file',training.sql],'seed');
    fs.writeFileSync(state,JSON.stringify({classification:'synthetic',persist,remote:false,dataset:training.manifest.dataset,sql_sha256:training.digest,seed_applied_at:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
   }else{
   const seed=path.join(base,'seed');
   if(!fs.existsSync(path.join(seed,'PREPARED.json'))){console.log('Preparing a new synthetic 10-sales dataset…');runNode(['node_modules/tsx/dist/cli.mjs','scripts/pilot-local-prepare.ts','--out',seed],'prepare')}
   const prepared=JSON.parse(fs.readFileSync(path.join(seed,'PREPARED.json'),'utf8'));if(prepared.classification!=='synthetic'||prepared.production_accepted!==false)throw Error('Only a synthetic prototype seed is allowed.');
   runNode([cli,'d1','migrations','apply','nyales-ui-prototype','--local','--persist-to',persist,'--config',config],'migrate');
   runNode([cli,'d1','execute','nyales-ui-prototype','--local','--persist-to',persist,'--config',config,'--file',path.join(seed,'seed.sql')],'seed');
   fs.writeFileSync(state,JSON.stringify({classification:'synthetic',persist,seed_applied_at:new Date().toISOString(),remote:false},null,2)+'\n',{flag:'wx'});
   }
  }else{
   const prior=JSON.parse(fs.readFileSync(state,'utf8'));if(prior.classification!=='synthetic'||prior.persist!==persist||prior.remote!==false)throw Error('Prototype state does not match this isolated directory.');
   if(training&&(prior.dataset!==training.manifest.dataset||prior.sql_sha256!==training.digest))throw Error('Training package changed after initialization. Regenerate a distinct package; existing data is preserved.');
   runNode([cli,'d1','migrations','apply','nyales-ui-prototype','--local','--persist-to',persist,'--config',config],'migrate');
  }
  const api=start([cli,'dev','--config',config,'--local','--ip','127.0.0.1','--port','5191','--persist-to',persist,'--live-reload=false']);
  fs.writeFileSync(lease.lock,JSON.stringify({...lease.owner,child_pid:api.pid}));
  await ready('http://127.0.0.1:5191/api/health',api);
  const ui=start(['node_modules/vite/bin/vite.js','--config','vite.prototype.config.ts']);
  for(const child of children){child.once('error',error=>{console.error(error.message);stop()});child.once('exit',()=>{stop();if(children.every(c=>c.exitCode!==null))lease.release()})}
  await ready('http://127.0.0.1:5190/',ui);
  console.log('\nNYALES UI PROTOTYPE → http://127.0.0.1:5190/\nSynthetic local data · local D1/R2 emulator · Vite hot reload · Ctrl+C to stop.\n');
 }catch(error){stop();lease.release();throw error}
}
module.exports={readTrainingPackage};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
