import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function stagingOrigin(raw){
 const url=new URL(raw);
 if(url.protocol!=='https:'||!/^nyales-staging\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)||url.port||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw Error('NYALES_STAGING_WORKERS_ORIGIN_REQUIRED');
 return url.origin;
}
async function bodyText(response,limit){
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('SMOKE_RESPONSE_LIMIT')}
 const reader=response.body?.getReader();if(!reader)throw Error('SMOKE_RESPONSE_EMPTY');
 const parts=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw Error('SMOKE_RESPONSE_LIMIT');parts.push(part.value)}}
 catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
/** Public endpoint smoke only. No credentials, account mutation, data import or auth bypass. */
export async function inspectStaging(raw,{fetcher=fetch}={}){
 const origin=stagingOrigin(raw),checks=[];
 async function inspect(name,path,options,test){
  try{
   const response=await fetcher(origin+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:path==='/'?'text/html':'application/json',...(options?.headers||{})}});
   const text=await bodyText(response,path==='/'?2*1024*1024:65536);
   const data=path==='/'?text:JSON.parse(text);
   checks.push({id:name,status:test(response,data)?'passed':'failed',http_status:response.status});
  }catch{checks.push({id:name,status:'failed',detail:'Endpoint unreachable, redirected, oversized or response invalid'})}
 }
 const jsonType=r=>(r.headers.get('content-type')||'').includes('application/json');
 await inspect('HTML_ENTRY','/',{},(r,s)=>r.status===200&&(r.headers.get('content-type')||'').includes('text/html')&&/id=["']root["']/.test(s)&&s.includes('/assets/'));
 await inspect('HEALTH_STAGING','/api/health',{},(r,d)=>r.status===200&&jsonType(r)&&d.name==='NYALES'&&d.status==='ok'&&d.environment==='staging');
 await inspect('AUTH_MODE','/api/auth/config',{},(r,d)=>r.status===200&&jsonType(r)&&d.configured===true&&(d.mode==='local'||d.mode==='firebase'&&d.google_only===true&&d.portfolio_enabled===true));
 await inspect('NO_AUTH_DENIED','/api/me',{},(r,d)=>r.status===401&&jsonType(r)&&d.code==='UNAUTHENTICATED'&&(r.headers.get('cache-control')||'').includes('no-store')&&r.headers.get('x-content-type-options')==='nosniff');
 await inspect('LOCAL_DEMO_REQUIRES_SESSION','/api/me',{headers:{Authorization:'Bearer nyales-local-demo'}},(r,d)=>r.status===401&&jsonType(r));
 await inspect('CUSTOMERS_UNAUTHENTICATED','/api/customers',{},(r,d)=>r.status===401&&jsonType(r)&&d.code==='UNAUTHENTICATED');
 return {format:'nyales-staging-smoke-1',checked_at:new Date().toISOString(),origin,status:checks.every(c=>c.status==='passed')?'passed':'failed',checks,
  scope:'Public HTML/API and unauthenticated access boundaries only; no D1/R2 data path or real Firebase/MFA/user-role verification',
  real_login_verified:false,database_contents_verified:false,r2_bytes_verified:false,production_accepted:false,mutated_data:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==4)throw Error('USAGE_staging-smoke_URL_NEW_OUTPUT_JSON');
  const report=await inspectStaging(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({origin:report.origin,status:report.status,checks:report.checks}));if(report.status!=='passed')process.exitCode=1;
 }catch(error){console.error(/^[A-Z][A-Z_]+$/.test(error.message)?error.message:'STAGING_SMOKE_INPUT_OR_RUNTIME_FAILED');process.exitCode=1}
}
