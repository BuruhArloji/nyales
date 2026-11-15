export type MapPoint={id:string;name:string;lat:number;lng:number;status?:string;owner?:string;metrics?:{invoice_count?:number;actual_minor?:number;meaningful_count?:number;activity_count?:number};demo_operation_overlay?:{invoice_count?:number;actual_minor?:number;productive_count?:number;follow_up_count?:number}};
export function validMapPoints(input:unknown):MapPoint[]{
 if(!Array.isArray(input))throw new Error('INVALID_MAP_DATA');
 return input.filter((p):p is MapPoint=>!!p&&typeof p==='object'&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&p.lat>=-90&&p.lat<=90&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&p.lng>=-180&&p.lng<=180);
}
export function pointMapFacts(point:MapPoint){const o=point.demo_operation_overlay;return o?{invoice_count:o.invoice_count||0,actual_minor:o.actual_minor||0,meaningful_count:(o.productive_count||0)+(o.follow_up_count||0)}:{invoice_count:point.metrics?.invoice_count||0,actual_minor:point.metrics?.actual_minor||0,meaningful_count:point.metrics?.meaningful_count||0}}
export function visibleMapPoints(points:MapPoint[],transactionsOnly:boolean){return transactionsOnly?points.filter(p=>pointMapFacts(p).invoice_count>0):points}
