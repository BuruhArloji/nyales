export const customerHierarchy1=['retail','wholesale','agen_grosir'] as const;
export type CustomerHierarchy1=typeof customerHierarchy1[number];
export const walletCategoryPreset:Record<CustomerHierarchy1,number>={retail:5_000_000,wholesale:25_000_000,agen_grosir:100_000_000};
export const customerHierarchyLabels:Record<CustomerHierarchy1,string>={retail:'Retail',wholesale:'Wholesale',agen_grosir:'Agen / Grosir'};
/** Monotone currency comparisons; no synthetic uplift of observed purchases to fit an estimate. */
export function walletComparison(wallet:number|null,highest:number|null,current:number){
 const max=Math.max(wallet??0,highest??0,current,1);
 const percent=(value:number)=>Math.max(0,Math.min(100,value/max*100));
 return{wallet_percent:wallet===null?null:percent(wallet),highest_percent:highest===null?null:percent(highest),current_percent:percent(current)};
}
