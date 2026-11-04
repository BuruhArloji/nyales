import {z} from 'zod';

export const commercialPageQuery=z.object({
 limit:z.coerce.number().int().min(1).max(100),
 offset:z.coerce.number().int().min(0).max(1000000).default(0),
 customer_id:z.string().trim().min(1).max(128).optional(),
}).strict();
export type CommercialPage=z.infer<typeof commercialPageQuery>;
export function commercialPageRequested(query:Record<string,string>){return Object.keys(query).length>0}
export function commercialPageEnvelope(rows:any[],page:CommercialPage){
 return {data:rows.slice(0,page.limit),meta:{pagination:{limit:page.limit,offset:page.offset,has_more:rows.length>page.limit,consistency:'live_offset'}}};
}
