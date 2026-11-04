/** In-flight GET deduplication only. Never persists customer responses, never
 * reuses a completed response, and never coalesces writes or file downloads. */
type PendingRead={controller:AbortController;promise:Promise<Response>;users:number};
const eligible=/^\/api\/(?:areas|users|branches|me|dashboard|customers|customer-options|geo\/map)(?:$|\/|\?)/;
export function createReadRequests(send:typeof fetch=fetch){
 const pending=new Map<string,PendingRead>();let generation=0;
 function clear(){generation++;for(const read of pending.values())read.controller.abort();pending.clear()}
 async function request(url:string,init:RequestInit,owner:string):Promise<Response>{
  const parsed=new URL(url,'https://nyales.internal');
  if((init.method||'GET').toUpperCase()!=='GET'||!eligible.test(parsed.pathname))return send(url,init);
  if(init.signal?.aborted)throw init.signal.reason||new DOMException('Aborted','AbortError');
  // Scope/filter/session/token differences must never share a request.
  const params=new URLSearchParams(parsed.search);params.sort();
  const key=JSON.stringify([generation,owner,parsed.pathname,params.toString(),[...new Headers(init.headers).entries()].sort()]);
  let read=pending.get(key);
  if(!read){
   const controller=new AbortController();
   read={controller,users:0,promise:Promise.resolve(null as unknown as Response)};
   const current=read;
   current.promise=send(url,{...init,signal:controller.signal}).finally(()=>{if(pending.get(key)===current)pending.delete(key)});
   pending.set(key,current);
  }
  const current=read;current.users++;const ownGeneration=generation;
  return new Promise<Response>((resolve,reject)=>{
   let settled=false;
   const release=()=>{settled=true;init.signal?.removeEventListener('abort',abort);current.users--};
   const abort=()=>{if(settled)return;release();reject(init.signal?.reason||new DOMException('Aborted','AbortError'));if(current.users===0){if(pending.get(key)===current)pending.delete(key);current.controller.abort()}};
   init.signal?.addEventListener('abort',abort,{once:true});
   current.promise.then(response=>{if(settled)return;release();if(ownGeneration!==generation)reject(new DOMException('Session changed','AbortError'));else resolve(response.clone())},error=>{if(settled)return;release();reject(error)});
  });
 }
 return{request,clear};
}

/** Keep the security heartbeat, but focus/visibility events cannot duplicate it. */
export function identityHeartbeat(check:()=>Promise<void>,now=()=>Date.now()){
 let pending=false,last=now();
 return async(visible:boolean)=>{if(!visible||pending||now()-last<15000)return;pending=true;last=now();try{await check()}finally{pending=false}};
}
