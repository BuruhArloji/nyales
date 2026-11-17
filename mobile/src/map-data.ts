import type { FeatureCollection } from 'geojson';
export type MapPoint={id:string;name:string;lat:number;lng:number;status?:string;owner?:string;field_rep_id?:string;telesales_rep_id?:string;telesales_owner?:string;metrics?:{invoice_count?:number;actual_minor?:number;meaningful_count?:number;activity_count?:number};demo_operation_overlay?:{invoice_count?:number;actual_minor?:number;productive_count?:number;follow_up_count?:number}};
export function validMapPoints(input:unknown):MapPoint[]{
 if(!Array.isArray(input))throw new Error('INVALID_MAP_DATA');
 return input.filter((p):p is MapPoint=>!!p&&typeof p==='object'&&typeof p.id==='string'&&typeof p.name==='string'&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&p.lat>=-90&&p.lat<=90&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&p.lng>=-180&&p.lng<=180);
}
export function pointMapFacts(point:MapPoint){const o=point.demo_operation_overlay;return o?{invoice_count:o.invoice_count||0,actual_minor:o.actual_minor||0,meaningful_count:(o.productive_count||0)+(o.follow_up_count||0)}:{invoice_count:point.metrics?.invoice_count||0,actual_minor:point.metrics?.actual_minor||0,meaningful_count:point.metrics?.meaningful_count||0}}
export function visibleMapPoints(points:MapPoint[],transactionsOnly:boolean){return transactionsOnly?points.filter(p=>pointMapFacts(p).invoice_count>0):points}

export function validMapPeriod(value:string){const m=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);return Boolean(m&&Number(m[1])>=2000&&Number(m[1])<=2100)}

export function validSelectedBoundary(data:unknown,id:string):data is FeatureCollection {
 if(!data||typeof data!=='object')return false;const d=data as FeatureCollection;if(d.type!=='FeatureCollection'||!Array.isArray(d.features)||d.features.length!==1)return false;const f=d.features[0];return f.type==='Feature'&&String(f.id??f.properties?.boundary_id??'')===id&&(f.geometry?.type==='Polygon'||f.geometry?.type==='MultiPolygon');
}

/** Google Maps receives coordinates only after an explicit user action. */
export function externalMapUrl(point:Pick<MapPoint,'lat'|'lng'>,streetView:boolean):string {
 if(typeof point.lat!=='number'||!Number.isFinite(point.lat)||point.lat < -90||point.lat > 90||typeof point.lng!=='number'||!Number.isFinite(point.lng)||point.lng < -180||point.lng > 180)throw Error('INVALID_COORDINATES');
 const position=`${point.lat},${point.lng}`;
 return streetView?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(position)}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(position)}`;
}
