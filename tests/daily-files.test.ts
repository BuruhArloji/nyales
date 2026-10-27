import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {runDailyFiles} from '../src/agent/daily-files';
import {installedGraphContentHash} from '../src/agent/graph-installation';
import {policy,snapshot} from './visit-generator-fixture';
import {canonicalJson} from '../src/shared/boundaries';
import {agentSha256} from '../src/shared/visit-agent-proof';
const python=resolve(process.platform==='win32'?'.nyales-agent/solver-python/Scripts/python.exe':'.nyales-agent/solver-python/bin/python');

test('WEB-071 file-to-HTTP-matrix-to-native-solver creates a bounded review artifact and never claims live-engine proof',{skip:!existsSync(python)},async(t)=>{
 const root=await mkdtemp(join(tmpdir(),'nyales-daily-files-')),p=policy(),s=snapshot();p.runtime.solver_seconds=1;s.policy_sha256=await agentSha256(canonicalJson(p));
 const files=[];for(const[kind,path,text]of [['extract','region.osm.pbf','synthetic extract'],['profile','car.lua','synthetic Lua bytes'],['graph','region.osrm','synthetic graph bytes']]){
  await writeFile(join(root,path),text);files.push({path,kind,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
 }
 const installation={format:'nyales-osrm-installation-1' as const,graph:s.graph,routing_profile:'driving',files:files as any};
 s.graph.extract_sha256=files[0].sha256;s.graph.graph_sha256=installedGraphContentHash(installation);
 await writeFile(join(root,'snapshot.json'),JSON.stringify(s));await writeFile(join(root,'policy.json'),JSON.stringify(p));await writeFile(join(root,'installation.json'),JSON.stringify(installation));
 let requests=0;const server=createServer((req,res)=>{requests++;const u=new URL(req.url!,'http://127.0.0.1');assert.equal(u.searchParams.get('annotations'),'duration,distance');assert.equal(u.searchParams.has('fallback_speed'),false);
 const points=u.pathname.split('/').at(-1)!.split(';').map(v=>v.split(',').map(Number)),n=points.length;
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code:'Ok',durations:points.map((_,i)=>points.map((_,j)=>i===j?0:60)),distances:points.map((_,i)=>points.map((_,j)=>i===j?0:100)),sources:points.map(location=>({location,distance:0})),destinations:points.map(location=>({location,distance:0}))}));});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close()});
 const options={snapshot:join(root,'snapshot.json'),policy:join(root,'policy.json'),installation:join(root,'installation.json'),graphDirectory:root,python,osrmOrigin:'http://127.0.0.1:'+(server.address() as any).port,output:join(root,'candidate.json')};
 const report=await runDailyFiles(options),artifact=JSON.parse(await readFile(options.output,'utf8'));
 assert.equal(report.scheduled,1);assert.equal(report.structurally_valid,true);assert.equal(report.publishable,false);assert.equal(requests,1);
 assert.equal(artifact.installation.files_verified,3);assert.equal(artifact.osrm_process_identity_verified,false);assert.equal(artifact.agenda_written,false);assert.equal(artifact.uploaded,false);
 const bytes=await readFile(options.output);await assert.rejects(runDailyFiles(options),/OUTPUT_EXISTS/);assert.deepEqual(await readFile(options.output),bytes);assert.equal(requests,1);
 s.graph.version='changed';await writeFile(options.snapshot,JSON.stringify(s));await assert.rejects(runDailyFiles({...options,output:join(root,'changed.json')}),/INSTALLATION_SNAPSHOT_MISMATCH/);assert.equal(requests,1);
});

test('WEB-071 daily files reject public routing URLs and preserve an existing destination without reading inputs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nyales-daily-reject-')),output=join(root,'existing.json');await writeFile(output,'KEEP');
 const options={snapshot:'absent',policy:'absent',installation:'absent',graphDirectory:'absent',python:'absent',osrmOrigin:'https://router.project-osrm.org',output};
 await assert.rejects(runDailyFiles(options),/OUTPUT_EXISTS/);assert.equal(await readFile(output,'utf8'),'KEEP');
 await assert.rejects(runDailyFiles({...options,output:join(root,'fresh.json')}),/LOOPBACK_ORIGIN_REQUIRED/);
});
