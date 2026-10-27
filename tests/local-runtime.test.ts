import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {createRequire} from 'node:module';
const {reserveRuntime}=createRequire(import.meta.url)('../scripts/local-runtime.cjs');
async function unusedPort(){const server=net.createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as net.AddressInfo).port;await new Promise<void>(r=>server.close(()=>r()));return port}
test('Local runtime refuses an occupied port and a second writer even on another port, without removing another reservation',async()=>{const root=mkdtempSync(join(tmpdir(),'nyales-runtime-')),port=await unusedPort(),first=await reserveRuntime(root,port,'.wrangler/qa');const otherPort=await unusedPort();await assert.rejects(reserveRuntime(root,otherPort,'.wrangler/qa'),/already reserved/);assert.equal(JSON.parse(readFileSync(first.lock,'utf8')).nonce,first.owner.nonce);first.release();const server=net.createServer();await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));try{await assert.rejects(reserveRuntime(root,port,'.wrangler/another'),/already in use/)}finally{await new Promise<void>(r=>server.close(()=>r()))}const second=await reserveRuntime(root,otherPort,'.wrangler/qa');writeFileSync(second.lock,JSON.stringify({nonce:'different-owner'}));second.release();assert.equal(JSON.parse(readFileSync(second.lock,'utf8')).nonce,'different-owner');await assert.rejects(reserveRuntime(root,otherPort,'../outside'),/inside this workspace/)});
