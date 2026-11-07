import {z} from 'zod';
import {Hono,type MiddlewareHandler} from 'hono';
import type {Identity} from './auth';

export const ownerSalesModeInput=z.object({sales_id:z.string().min(1).max(128).nullable()}).strict();
type Env={Bindings:{DB:D1Database;APP_ENV:string};Variables:{identity:Identity;portfolioOwner:boolean}};
const eligible=`(SELECT COUNT(*) FROM auth_role_assignment active_role WHERE active_role.organization_id=u.organization_id AND active_role.user_id=u.id AND active_role.effective_from_date<=date('now','+7 hours') AND(active_role.effective_to_date IS NULL OR active_role.effective_to_date>date('now','+7 hours')))=1 AND u.status='active' AND r.role_code='SALES_REP' AND r.channel='field' AND r.effective_from_date<=date('now','+7 hours') AND(r.effective_to_date IS NULL OR r.effective_to_date>date('now','+7 hours'))`;
async function target(db:D1Database,org:string,id:string){const rows=await db.prepare(`SELECT u.id,u.name,u.organization_id,r.role_code role,r.channel FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=? AND u.id=? AND ${eligible}`).bind(org,id).all<Identity>();return rows.results.length===1?rows.results[0]:null}
function allowed(c:any){return c.get('portfolioOwner')===true&&c.get('identity')?.role==='MANAGEMENT'&&c.env.APP_ENV==='staging'}
export const ownerSalesMode=new Hono<Env>();
ownerSalesMode.get('/api/owner-sales-mode',async c=>{
 if(!allowed(c))return c.json({code:'SCOPE_DENIED'},403);
 const rows=await c.env.DB.prepare(`SELECT u.id,u.name FROM app_user u JOIN auth_role_assignment r ON r.organization_id=u.organization_id AND r.user_id=u.id WHERE u.organization_id=? AND ${eligible} GROUP BY u.id HAVING COUNT(*)=1 ORDER BY u.name,u.id`).bind(c.get('identity').organization_id).all();
 return c.json({data:rows.results});
});
ownerSalesMode.post('/api/owner-sales-mode',async c=>{
 if(!allowed(c))return c.json({code:'SCOPE_DENIED'},403);
 const parsed=ownerSalesModeInput.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json({code:'INVALID_SALES_MODE'},422);const body=parsed.data;
 const owner=c.get('identity'),sales=body.sales_id===null?null:await target(c.env.DB,owner.organization_id,body.sales_id);
 if(body.sales_id&&!sales)return c.json({code:'SALES_MODE_TARGET_UNAVAILABLE',detail:'Sales tidak aktif atau tidak tersedia di organisasi ini.'},422);
 await c.env.DB.prepare('INSERT INTO master_audit VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner.organization_id,owner.id,'owner_sales_mode',sales?.id||owner.id,sales?'enter':'exit',new Date().toISOString(),null,JSON.stringify({owner_id:owner.id,sales_id:sales?.id||null})).run();
 return c.json({data:{sales_id:sales?.id||null}});
});
/** Runs after real-owner bearer and device verification; never trusts a client role. */
export const ownerSalesScope:MiddlewareHandler<Env>=async(c,next)=>{
 const id=c.req.header('X-NYALES-Sales');if(!id){await next();return}
 if(!allowed(c))return c.json({code:'SCOPE_DENIED'},403);
 const owner=c.get('identity'),sales=await target(c.env.DB,owner.organization_id,id);
 if(!sales)return c.json({code:'SALES_MODE_TARGET_UNAVAILABLE',detail:'Sales tidak aktif atau tidak tersedia. Kembali ke Management.'},422);
 // Device administration remains bound to the authenticating Management account outside this router.
 c.set('identity',{...sales,performed_by:{id:owner.id,name:owner.name}});
 await next();
};
