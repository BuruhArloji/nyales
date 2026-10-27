// One local dev process owns a persistence directory. Never launch two writers.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process'),{randomUUID}=require('node:crypto');
async function reserveRuntime(root,port,persist){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
 const base=path.resolve(root,'.wrangler'),directory=path.resolve(root,persist);
 if(!directory.startsWith(base+path.sep))throw Error('Local persistence must be inside this workspace .wrangler');
 const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',()=>reject(Error('Local port '+port+' is already in use. Reuse its server; do not start a second writer.')));probe.listen(port,'127.0.0.1',resolve)});await new Promise(resolve=>probe.close(resolve));
 fs.mkdirSync(directory,{recursive:true});const lock=path.join(directory,'NYALES-RUNTIME.lock.json'),nonce=randomUUID();let descriptor;
 try{descriptor=fs.openSync(lock,'wx')}catch(e){if(e.code==='EEXIST')throw Error('Persistence already reserved. Reuse the running server. If a previous shutdown was interrupted, verify its parent/child processes have stopped before removing '+lock);throw e}
 const owner={nonce,pid:process.pid,port,persist:directory,started_at:new Date().toISOString()};fs.writeFileSync(descriptor,JSON.stringify(owner));fs.closeSync(descriptor);
 return{lock,owner,release(){try{const current=JSON.parse(fs.readFileSync(lock,'utf8'));if(current.nonce===nonce)fs.unlinkSync(lock)}catch{/* Unknown ownership is retained for operator review. */}}};
}
async function startRuntime({root=process.cwd(),port,persist}){
 const reservation=await reserveRuntime(root,port,persist),cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
 const child=spawn(process.execPath,[cli,'dev','--ip','127.0.0.1','--port',String(port),'--local','--persist-to',persist,'--var','APP_ENV:local','--var','LOCAL_AUTH:true','--live-reload=false'],{cwd:root,stdio:'inherit',windowsHide:true});
 fs.writeFileSync(reservation.lock,JSON.stringify({...reservation.owner,child_pid:child.pid}));
 let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{if(!stopping){stopping=true;child.kill(signal)}});
 child.once('error',()=>{reservation.release();process.exitCode=1});child.once('exit',code=>{reservation.release();process.exitCode=code||0});return child;
}
module.exports={reserveRuntime,startRuntime};
if(require.main===module)startRuntime({port:Number(process.argv[2]),persist:process.argv[3]||''}).catch(e=>{console.error(e.message);process.exitCode=1});
