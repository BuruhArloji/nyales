import {Hono} from 'hono';

type Bindings={APP_ENV:string;IMPORT_FILES?:R2Bucket};
type ParsedRange={offset:number;length:number;end:number};
type DemoFile={key:string;contentType:string;range:boolean};
const MAX_RANGE_BYTES=8_000_000;
const files:Record<string,DemoFile>=Object.assign(Object.create(null),{
 'territories-demo.pmtiles':{key:'portfolio-demo/territories-demo.pmtiles',contentType:'application/vnd.pmtiles',range:true},
 'manifest.json':{key:'portfolio-demo/manifest.json',contentType:'application/json; charset=utf-8',range:false},
 'area-summary.json':{key:'portfolio-demo/area-summary.json',contentType:'application/json; charset=utf-8',range:false},
 'exceptions.csv':{key:'portfolio-demo/exceptions.csv',contentType:'text/csv; charset=utf-8',range:false},
});

function parseRange(value:string,size:number):ParsedRange|null{
 const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());
 if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(size)||size<=0)return null;
 let offset:number,end:number;
 if(!match[1]){
  const suffix=Number(match[2]);
  if(!Number.isSafeInteger(suffix)||suffix<=0)return null;
  offset=Math.max(0,size-suffix);end=size-1;
 }else{
  offset=Number(match[1]);end=match[2]?Number(match[2]):size-1;
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset<0||end<offset||offset>=size)return null;
  end=Math.min(end,size-1);
 }
 return {offset,length:end-offset+1,end};
}

function commonHeaders(c:any,etag?:string){
 c.header('X-Content-Type-Options','nosniff');
 c.header('Cache-Control','public, max-age=300');
 if(etag)c.header('ETag',etag);
}

export const demoTerritoryFiles=new Hono<{Bindings:Bindings}>();

demoTerritoryFiles.use('/demo/*',async(c,next)=>{
 if(c.env.APP_ENV!=='staging')return c.notFound();
 await next();
});

demoTerritoryFiles.all('/demo/:asset',async c=>{
 const file=files[c.req.param('asset')];
 if(!file)return c.notFound();
 if(c.req.method!=='GET'&&c.req.method!=='HEAD')return c.text('Method not allowed',405,{'Allow':'GET, HEAD'});
 const bucket=c.env.IMPORT_FILES;
 if(!bucket)return c.json({code:'DEMO_TILE_STORAGE_UNAVAILABLE'},503);
 const rangeHeader=c.req.header('Range');
 try{
  if(file.range){
   const head=await bucket.head(file.key);
   if(!head)return c.notFound();
   commonHeaders(c,head.httpEtag);
   c.header('Content-Type',file.contentType);
   c.header('Accept-Ranges','bytes');
   c.header('Vary','Range');
   if(!rangeHeader){
    c.header('Content-Length',String(head.size));
    if(c.req.method==='HEAD')return c.body(null,200);
    c.header('Content-Range',`bytes */${head.size}`);
    return c.body(null,416);
   }
   const range=parseRange(rangeHeader,head.size);
   if(!range||range.length>MAX_RANGE_BYTES){
    c.header('Content-Range',`bytes */${head.size}`);
    return c.body(null,416);
   }
   c.header('Content-Range',`bytes ${range.offset}-${range.end}/${head.size}`);
   c.header('Content-Length',String(range.length));
   if(c.req.method==='HEAD')return c.body(null,206);
   const object=await bucket.get(file.key,{range:{offset:range.offset,length:range.length}});
   if(!object)return c.notFound();
   const returnedRange=object.range;
   const actualLength=returnedRange&&'length' in returnedRange?returnedRange.length:range.length;
   const actualOffset=returnedRange&&'offset' in returnedRange?returnedRange.offset:range.offset;
   if(!actualLength||actualLength>range.length||actualOffset!==range.offset)return c.json({code:'DEMO_TILE_STORAGE_UNAVAILABLE'},503);
   c.header('Content-Length',String(actualLength));
   c.header('Content-Range',`bytes ${range.offset}-${range.offset+actualLength-1}/${head.size}`);
   return c.body(object.body,206);
  }
  const object=await (c.req.method==='HEAD'?bucket.head(file.key):bucket.get(file.key));
  if(!object)return c.notFound();
  commonHeaders(c,object.httpEtag);
  c.header('Content-Type',file.contentType);
  c.header('Content-Length',String(object.size));
  if(c.req.method==='HEAD')return c.body(null,200);
  return c.body((object as R2ObjectBody).body,200);
 }catch{
  return c.json({code:'DEMO_TILE_STORAGE_UNAVAILABLE'},503);
 }
});
