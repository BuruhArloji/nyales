import {createReadStream} from 'node:fs';
import {lstat,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {z} from 'zod';
import {visitGraphManifest} from '../shared/visit-generator';
import {canonicalJson} from '../shared/boundaries';
const sha=z.string().regex(/^[a-f0-9]{64}$/);
export const installedGraph=z.object({format:z.literal('nyales-osrm-installation-1'),graph:visitGraphManifest,routing_profile:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),files:z.array(z.object({path:z.string().min(1).max(500).refine(p=>!p.includes('\\')&&!p.includes(':')&&!p.startsWith('/')&&p.split('/').every(s=>s!==''&&s!=='.'&&s!=='..'),'Relative forward-slash path required'),kind:z.enum(['extract','profile','graph']),bytes:z.number().int().safe().positive(),sha256:sha}).strict()).min(3).max(2000)}).strict().superRefine((v,c)=>{if(new Set(v.files.map(f=>f.path.toLowerCase())).size!==v.files.length)c.addIssue({code:'custom',message:'Duplicate file path'});if(v.files.filter(f=>f.kind==='extract').length!==1||v.files.filter(f=>f.kind==='profile').length!==1||!v.files.some(f=>f.kind==='graph'))c.addIssue({code:'custom',message:'One extract, one profile and graph files required'})});
/** Content manifest definition; graph_sha256 is excluded to avoid a circular digest. */
export function installedGraphContentHash(raw:z.infer<typeof installedGraph>){const value=installedGraph.parse(raw);return createHash('sha256').update(canonicalJson({format:value.format,engine:value.graph.engine,engine_version:value.graph.engine_version,profile:value.graph.profile,profile_version:value.graph.profile_version,routing_profile:value.routing_profile,files:[...value.files].sort((a,b)=>a.path.localeCompare(b.path))})).digest('hex')}
function inside(root:string,path:string){const r=relative(root,path);return r!==''&&!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r)}
/** Explicit operator-owned directory only. No path or URL is read from an untrusted job. */
export async function verifyGraphInstallation(directory:string,raw:unknown,signal?:AbortSignal){
 const manifest=installedGraph.parse(raw),root=await realpath(resolve(directory));if(!(await stat(root)).isDirectory())throw Error('GRAPH_DIRECTORY_REQUIRED');if(installedGraphContentHash(manifest)!==manifest.graph.graph_sha256)throw Error('GRAPH_MANIFEST_HASH_MISMATCH');
 const files:{path:string;bytes:number;sha256:string;kind:string}[]=[];let total=0;
 for(const entry of manifest.files){signal?.throwIfAborted();const target=resolve(root,...entry.path.split('/'));if(!inside(root,target))throw Error('GRAPH_PATH_OUTSIDE_DIRECTORY');let current=root;for(const part of entry.path.split('/')){current=resolve(current,part);if((await lstat(current)).isSymbolicLink())throw Error('GRAPH_SYMLINK_DENIED')}
  const resolved=await realpath(target);if(!inside(root,resolved))throw Error('GRAPH_PATH_OUTSIDE_DIRECTORY');const before=await stat(resolved);if(!before.isFile()||before.size!==entry.bytes)throw Error('GRAPH_FILE_SIZE_MISMATCH');const h=createHash('sha256');let bytes=0;const stream=createReadStream(resolved,{highWaterMark:64*1024,signal});for await(const chunk of stream){bytes+=chunk.length;if(bytes>entry.bytes){stream.destroy();throw Error('GRAPH_FILE_SIZE_MISMATCH')}h.update(chunk)}const digest=h.digest('hex'),after=await stat(resolved);if(bytes!==entry.bytes||digest!==entry.sha256||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('GRAPH_FILE_CHANGED');total+=bytes;if(!Number.isSafeInteger(total))throw Error('GRAPH_BYTES_OVERFLOW');if(entry.kind==='extract'&&digest!==manifest.graph.extract_sha256)throw Error('GRAPH_EXTRACT_HASH_MISMATCH');files.push({...entry,sha256:digest});
 }
 return{format:manifest.format,graph_id:manifest.graph.id,graph_sha256:manifest.graph.graph_sha256,profile:manifest.graph.profile,profile_version:manifest.graph.profile_version,engine_version:manifest.graph.engine_version,routing_profile:manifest.routing_profile,files_verified:files.length,total_bytes:total,verified_at:new Date().toISOString(),files,osrm_process_identity_verified:false as const,benchmark_complete:false as const};
}
