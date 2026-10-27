import {readFileSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {pilotManifest,reconcilePilot,type PilotIssue} from '../src/shared/pilot';
import {csvFile} from '../src/shared/csv';

/** Local read-only audit. No DB connection, remote API, auth token or import commit. */
export function runPilot(manifestPath:string,outputDirectory:string){
 const manifestFile=resolve(manifestPath),root=dirname(manifestFile),output=resolve(outputDirectory);
 const provenance:Array<{purpose:string;path:string;size_bytes:number;sha256:string}>=[],fileIssues:PilotIssue[]=[];
 function read(path:string,purpose:string,limit=10*1024*1024){const file=resolve(root,path),size=statSync(file).size;if(size>limit)throw Error('FILE_TOO_LARGE');const bytes=readFileSync(file);if(bytes.length>limit)throw Error('FILE_TOO_LARGE');const sha256=createHash('sha256').update(bytes).digest('hex');provenance.push({purpose,path,size_bytes:bytes.length,sha256});return{bytes,sha256};}
 const manifestBytes=read(manifestFile,'manifest').bytes,m=pilotManifest.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes)));
 function json(path:string|null,purpose:string){if(!path)return undefined;try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(read(path,purpose).bytes))}catch(error){fileIssues.push({code:'INPUT_UNAVAILABLE_OR_INVALID',dataset:purpose,key:path,detail:error instanceof SyntaxError?'JSON tidak valid.':(error as NodeJS.ErrnoException).code||'File tidak dapat dibaca/ukuran atau UTF-8 tidak valid.'});return undefined;}}
 const source=json(m.inputs.source_snapshot,'source_snapshot'),nyales=json(m.inputs.nyales_snapshot,'nyales_snapshot'),mapping=json(m.source_review.id_mapping_reference,'id_mapping');
 for(const file of m.inputs.source_files){try{const {sha256}=read(file.path,'original_source',64*1024*1024);if(file.expected_sha256&&sha256!==file.expected_sha256)fileIssues.push({code:'SOURCE_HASH_MISMATCH',dataset:'original_source',key:file.path,detail:'File sumber berubah dari checksum yang ditinjau.'});}catch{fileIssues.push({code:'ORIGINAL_SOURCE_UNAVAILABLE',dataset:'original_source',key:file.path,detail:'File sumber asli tidak dapat diverifikasi.'});}}
 const report={...reconcilePilot(m,source,nyales,mapping),generated_at:new Date().toISOString(),provenance};report.issues.push(...fileIssues);if(report.issues.length)report.status='blocked';
 // New run folder only: do not overwrite original files or prior evidence.
 mkdirSync(dirname(output),{recursive:true});mkdirSync(output,{recursive:false});
 const jsonReport=JSON.stringify(report,null,2)+'\n';writeFileSync(resolve(output,'reconciliation.json'),jsonReport,{flag:'wx'});
 writeFileSync(resolve(output,'discrepancies.csv'),csvFile([['code','dataset','key','detail'],...report.issues.map(i=>[i.code,i.dataset,i.key,i.detail])]),{flag:'wx'});
 writeFileSync(resolve(output,'checksums.json'),JSON.stringify({algorithm:'sha256',inputs:provenance,report_sha256:createHash('sha256').update(jsonReport).digest('hex')},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pilot_id:report.pilot_id,status:report.status,classification:report.data_classification,max_sales:report.capacity.max_sales,named_sales:report.capacity.named_sales,open_slots:report.capacity.open_slots,blockers:report.issues.length,production_accepted:false,output}));
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const args=process.argv.slice(2),allowed=new Set(['--manifest','--out']);if(args.length%2||args.some((v,i)=>i%2===0&&!allowed.has(v)))throw Error('Gunakan --manifest <file.json> --out <folder-baru>');const options=Object.fromEntries(Array.from({length:args.length/2},(_,i)=>[args[i*2],args[i*2+1]]));const report=runPilot(options['--manifest']||'pilot/pilot-01/manifest.json',options['--out']||'test-results/pilot-'+Date.now());process.exitCode=report.status==='blocked'?2:0;}catch(error){console.error('Pilot check failed: '+(error as Error).message);process.exitCode=1;}
}
