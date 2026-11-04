import {Hono} from 'hono';
import {z} from 'zod';
import {customerPredicate,type Scope} from './scope';
import {digest,fail,type OperationEnv} from './operations';
import {scopeCacheKey} from './cache';

export const customerOptionsQuery=z.object({q:z.string().trim().max(100).default(''),limit:z.coerce.number().int().min(1).max(50).default(20),after:z.string().max(1400).optional(),id:z.string().min(1).max(128).optional(),record_status:z.enum(['active','all']).default('active')}).strict().refine(q=>!q.id||!q.after&&!q.q);
const cursorSchema=z.object({v:z.literal(1),name:z.string().max(160),id:z.string().min(1).max(128),fingerprint:z.string().length(64)}).strict();
type Query=z.infer<typeof customerOptionsQuery>;
const encode=(value:unknown)=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=(value:string)=>{try{return cursorSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),s=>s.charCodeAt(0)))))}catch{fail(422,'INVALID_CUSTOMER_OPTIONS_CURSOR')}};
const prefix=(value:string)=>value.replace(/[\\%_]/g,'\\$&')+'%';

/** Selector projection: never invokes segmentation, invoice facts or COUNT. */
export async function readCustomerOptions(db:D1Database,s:Scope,q:Query){
 const predicate=customerPredicate(s),where=[predicate.sql,'co.merged_into_id IS NULL'],params:any[]=[...predicate.params];
 if(q.record_status==='active')where.push("co.record_status='active'");
 const fingerprint=await digest(scopeCacheKey(s,'customer-options',JSON.stringify([q.q,q.record_status])));
 if(q.id){where.push('co.id=?');params.push(q.id)}
 if(q.after){const cursor=decode(q.after);if(cursor.fingerprint!==fingerprint)fail(422,'INVALID_CUSTOMER_OPTIONS_CURSOR');where.push('(co.name COLLATE NOCASE,co.id)>(? COLLATE NOCASE,?)');params.push(cursor.name,cursor.id)}
 const columns='co.id,co.name,co.external_code,co.area_id,co.record_status,co.visit_window';
 const resultColumns='id,name,external_code,area_id,record_status,visit_window';
 const from=`FROM customer_outlet co ${q.id?'':'INDEXED BY customer_options_name'} WHERE ${where.join(' AND ')}`;
 let sql:string;
 if(q.q){
  // Keep both branches bounded before UNION. Name and ERP code have separate
  // indexes; LIKE wildcards supplied by the caller are escaped literally.
  sql=`WITH names AS (SELECT ${columns} ${from} AND co.name COLLATE NOCASE LIKE ? ESCAPE '\\' ORDER BY co.name COLLATE NOCASE,co.id LIMIT ?),
   codes AS (SELECT ${columns} ${from.replace('INDEXED BY customer_options_name','INDEXED BY customer_options_code')} AND co.external_code COLLATE NOCASE LIKE ? ESCAPE '\\' ORDER BY co.name COLLATE NOCASE,co.id LIMIT ?)
   SELECT ${resultColumns} FROM(SELECT ${resultColumns} FROM names UNION SELECT ${resultColumns} FROM codes) ORDER BY name COLLATE NOCASE,id LIMIT ?`;
  const branch=[...params,prefix(q.q),q.limit+1];params.splice(0,params.length,...branch,...branch,q.limit+1);
 }else{sql=`SELECT ${columns} ${from} ORDER BY co.name COLLATE NOCASE,co.id LIMIT ?`;params.push(q.id?1:q.limit+1)}
 const rows=(await db.prepare(sql).bind(...params).all<any>()).results,hasMore=!q.id&&rows.length>q.limit,data=rows.slice(0,q.id?1:q.limit),last=data.at(-1);
 return{data,meta:{has_more:hasMore,next:hasMore&&last?encode({v:1,name:last.name,id:last.id,fingerprint}):null,limit:q.limit,search_mode:'name_or_erp_prefix'}};
}

export const customerOptions=new Hono<OperationEnv>();
customerOptions.get('/api/customer-options',async c=>{const p=customerOptionsQuery.safeParse(c.req.query());if(!p.success)return c.json({code:'INVALID_CUSTOMER_OPTIONS_QUERY'},422);c.header('Cache-Control','private, no-store');return c.json(await readCustomerOptions(c.env.DB,c.get('scope'),p.data))});
customerOptions.onError((e,c)=>{const m=/^(403|404|422|503):([A-Z_]+)$/.exec(e.message);return c.json({code:m?.[2]||'CUSTOMER_OPTIONS_UNAVAILABLE'},(m?Number(m[1]):503)as any)});
