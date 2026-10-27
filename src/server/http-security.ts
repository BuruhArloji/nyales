import type {MiddlewareHandler} from 'hono';

// Browser API access is same-origin. Native clients may omit Origin but must
// still pass the bearer and device-session gates; cookies are never credentials.
export const httpSecurity:MiddlewareHandler=async(c,next)=>{
 c.header('Cache-Control','no-store');
 c.header('X-Content-Type-Options','nosniff');
 c.header('X-Frame-Options','DENY');
 c.header('Referrer-Policy','same-origin');
 const origin=c.req.header('Origin');
 if(origin&&origin!==new URL(c.req.url).origin||c.req.header('Sec-Fetch-Site')==='cross-site')return c.json({code:'CROSS_ORIGIN_DENIED'},403);
 if(c.req.method==='OPTIONS')return c.body(null,204);
 await next();
};

export const apiBodyLimit:MiddlewareHandler=async(c,next)=>{
 const max=c.req.path.startsWith('/api/visit-agent/')?65536:c.req.path==='/api/import-files'?600*1024:/^\/api\/attachments\/[^/]+\/upload$/.test(c.req.path)?5*1024*1024:2*1024*1024;
 const body=c.req.raw.body;if(!body){await next();return}
 if(Number(c.req.header('Content-Length'))>max)return c.json({code:'REQUEST_TOO_LARGE'},413);
 const reader=body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){void reader.cancel().catch(()=>{});return c.json({code:'REQUEST_TOO_LARGE'},413)}chunks.push(value)}
 }catch{return c.json({code:'INVALID_REQUEST_BODY'},400)}
 // Enforce actual stream bytes even when Content-Length is absent or false.
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 c.req.raw=new Request(c.req.raw,{body:bytes});
 await next();
};
