import {createReadStream,existsSync,statSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const configuredPmtiles=process.env.NYALES_DEMO_TERRITORY_PMTILES||'';
const pmtilesPath=configuredPmtiles?path.resolve(configuredPmtiles):'';
const demoDirectory=pmtilesPath?path.dirname(pmtilesPath):'';
const demoAvailable=Boolean(pmtilesPath&&existsSync(pmtilesPath));
const demoUrl=demoAvailable?'/__demo-territory/territories-demo.pmtiles':'';

function localDemoTerritories(){
 return{
  name:'nyales-local-demo-territories',
  configureServer(server:any){
   if(!demoAvailable)return;
   server.middlewares.use('/__demo-territory',(req:any,res:any,next:any)=>{
    let requestPath:string;
    try{requestPath=new URL(req.url||'/', 'http://127.0.0.1').pathname.replace(/^\/+/, '')}
    catch{res.statusCode=400;res.end('Bad request');return}
    const allowed=new Set(['territories-demo.pmtiles','manifest.json','area-summary.json','exceptions.csv']);
    if(!allowed.has(requestPath)){res.statusCode=404;res.end('Not found');return}
    const file=requestPath==='territories-demo.pmtiles'?pmtilesPath:path.join(demoDirectory,requestPath);
    if(!existsSync(file)){res.statusCode=404;res.end('Not found');return}
    const stat=statSync(file);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('ETag',`W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`);
    if(requestPath.endsWith('.json')||requestPath.endsWith('.csv')){
     if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end('Method not allowed');return}
     res.setHeader('Content-Type',requestPath.endsWith('.csv')?'text/csv; charset=utf-8':'application/json; charset=utf-8');
     res.setHeader('Content-Length',String(stat.size));
     if(req.method==='HEAD'){res.statusCode=200;res.end();return}
     createReadStream(file).pipe(res);return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end('Method not allowed');return}
    res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Content-Type','application/vnd.pmtiles');
    res.setHeader('Vary','Range');
    const range=String(req.headers.range||'');
    if(!range){
     res.statusCode=200;res.setHeader('Content-Length',String(stat.size));
     if(req.method==='HEAD'){res.end();return}
     createReadStream(file).pipe(res);return;
    }
    const match=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if(!match||(!match[1]&&!match[2])){res.statusCode=416;res.setHeader('Content-Range',`bytes */${stat.size}`);res.end();return}
    let start:number,end:number;
    if(!match[1]){
     const suffix=Number(match[2]);
     if(!Number.isSafeInteger(suffix)||suffix<=0){res.statusCode=416;res.setHeader('Content-Range',`bytes */${stat.size}`);res.end();return}
     start=Math.max(0,stat.size-suffix);end=stat.size-1;
    }else{
     start=Number(match[1]);end=match[2]?Number(match[2]):stat.size-1;
    }
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=stat.size){res.statusCode=416;res.setHeader('Content-Range',`bytes */${stat.size}`);res.end();return}
    end=Math.min(end,stat.size-1);
    res.statusCode=206;
    res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length',String(end-start+1));
    if(req.method==='HEAD'){res.end();return}
    createReadStream(file,{start,end}).on('error',()=>{if(!res.headersSent){res.statusCode=500;res.end()}}).pipe(res);
   });
  },
 };
}

// Deliberately no Cloudflare plugin: browser HMR talks only to the loopback emulator.
// This optional source serves PMTiles only from the localhost prototype when explicitly configured.
export default defineConfig({
 define:{'import.meta.env.VITE_NYALES_DEMO_TERRITORY_URL':JSON.stringify(demoUrl)},
 plugins:[react(),localDemoTerritories(),{name:'nyales-local-prototype',transformIndexHtml(html){
  return html.replace(/<title>.*?<\/title>/,'<title>NYALES · Prototipe lokal</title>').replace('</head>','<link rel="stylesheet" href="/tools/ui-prototype/studio.css"></head>').replace('</body>','<script type="module" src="/tools/ui-prototype/studio.ts"></script></body>');
 }}],
 envDir:'.nyales-agent/ui-prototype/env',
 server:{host:'127.0.0.1',port:5190,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5191'}}}
});
