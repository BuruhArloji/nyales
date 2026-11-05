import type {GeoContext} from '../shared/geography';
export function readGeoContext():GeoContext {
 const q=new URLSearchParams(location.hash.slice(1)),out:GeoContext={};
 for(const key of ['assignment_view','scenario_id','risk_run_id','settings_section','branch_id','team_id','area_id','rep_id','boundary_id','dataset_id','mapping_bucket','customer_id'] as const){const v=q.get(key);if(v&&v.length<=128)out[key]=v}
 const mode=q.get('mode');if(mode&&['scatter','performance','coverage','risk','sales'].includes(mode))out.mode=mode;
 const salesLevel=q.get('sales_level');if(salesLevel&&['rep','supervisor','area_manager'].includes(salesLevel))out.sales_level=salesLevel;
 const channel=q.get('channel');if(channel==='field'||channel==='telesales')out.channel=channel;
 const period=q.get('period');if(period&&/^\d{4}-(0[1-9]|1[0-2])$/.test(period))out.period=period;
 const status=q.get('customer_status');if(status&&['Aktif','Churn','New','Unknown'].includes(status))out.customer_status=status;
 try{const camera=JSON.parse(q.get('camera')||'null');if(camera&&Array.isArray(camera.center)&&camera.center.length===2&&[...camera.center,camera.zoom,camera.pitch,camera.bearing].every(Number.isFinite)&&Math.abs(camera.center[0])<=180&&Math.abs(camera.center[1])<=90&&camera.zoom>=0&&camera.zoom<=24&&camera.pitch>=0&&camera.pitch<=85&&Math.abs(camera.bearing)<=360)out.camera=camera}catch{}
 return out;
}
export function geoNavigate(page:string,context:GeoContext={}){const q=new URLSearchParams({page});for(const [k,v] of Object.entries(context))if(v!==undefined&&v!=='')q.set(k,typeof v==='object'?JSON.stringify(v):String(v));history.pushState(null,'','#'+q);window.dispatchEvent(new PopStateEvent('popstate'))}

export function replaceGeoContext(context:GeoContext){const q=new URLSearchParams({page:'map'});for(const [k,v] of Object.entries(context))if(v!==undefined&&v!=='')q.set(k,typeof v==='object'?JSON.stringify(v):String(v));history.replaceState(null,'','#'+q)}
