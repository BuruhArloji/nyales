import {Hono} from 'hono';
import {z} from 'zod';
import {customerPredicate} from './scope';
import {readMapMetrics} from './map-metrics';
import type {OperationEnv} from './operations';
export const customerWallet=new Hono<OperationEnv>();
const query=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),channel:z.enum(['field','telesales']).optional()}).strict();
customerWallet.get('/api/customers/:id/wallet',async c=>{
 const parsed=query.safeParse(c.req.query());if(!parsed.success)return c.json({code:'INVALID_WALLET_QUERY'},422);
 const scope=c.get('scope'),predicate=customerPredicate(scope),org=scope.identity.organization_id;
 const alias=await c.env.DB.prepare('SELECT canonical_id FROM customer_alias WHERE organization_id=? AND source_id=?').bind(org,c.req.param('id')).first<{canonical_id:string}>();
 const customer=await c.env.DB.prepare('SELECT co.id FROM customer_outlet co WHERE co.id=? AND co.merged_into_id IS NULL AND '+predicate.sql).bind(alias?.canonical_id??c.req.param('id'),...predicate.params).first<{id:string}>();
 if(!customer)return c.json({code:'NOT_FOUND'},404);
 const period=parsed.data.period??scope.date.slice(0,7),channel=parsed.data.channel??scope.channel??'all';
 if(scope.channel&&scope.channel!==channel)return c.json({code:'SCOPE_DENIED'},403);
 const metrics=(await readMapMetrics(c.env.DB,scope,[customer.id],period,channel,undefined,undefined,true)).get(customer.id);
 c.header('Cache-Control','private, no-store');return c.json({data:{customer_id:customer.id,channel,...metrics}});
});
