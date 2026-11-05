/** Bound the whole request, including token retrieval and JSON body decoding.
 * A slow/ignored AbortSignal must not leave the page spinner hanging forever. */
export async function readMapData(send:(url:string,init:RequestInit)=>Promise<Response>,url:string,signal?:AbortSignal,timeoutMs=30000){
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,onAbort:()=>void=()=>{};
 const stop=new Promise<never>((_,reject)=>{
  onAbort=()=>{controller.abort();reject(new DOMException('Aborted','AbortError'))};
  if(signal?.aborted){onAbort();return}signal?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(Error('Pemuatan peta terlalu lama. Coba muat ulang atau pilih area yang lebih kecil.'))},timeoutMs);
 });
 const request=(async()=>{const response=await send(url,{signal:controller.signal}),body=await response.json()as any;if(!response.ok)throw Error(body.code||'Data peta belum tersedia.');if(!body||typeof body.data!=='object'||body.data===null)throw Error('Respons peta belum valid. Muat ulang halaman.');return body.data})();
 try{return await Promise.race([request,stop])}finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',onAbort)}
}
