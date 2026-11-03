import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyBekasiOverlay,validBekasiOverlayLinks} from '../src/server/bekasi-point-overlay';
import {BEKASI_DIRECTORY_DATASET_ID,BEKASI_POINT_OVERLAY_ID} from '../src/shared/bekasi-demo-overlay';

function rows(){
 const out:any[]=[];
 for(let i=1;i<=200;i++){
  const n=String(i).padStart(3,'0'),area=i<=100?'bekasi-demo-area-kota':'bekasi-demo-area-kabupaten',sourceArea=i<=100?'maps-area-bekasi-kota':'maps-area-bekasi-kab';
  out.push({id:`bekasi-demo-customer-${n}`,organization_id:'org',area_id:area,name:`DEMO ${n}`,address:'synthetic',latitude_e7:null,longitude_e7:null,coordinate_status:'missing',directory_dataset_id:null,version:1,record_status:'active',merged_into_id:null,field_rep_id:i<=100?'rep-kota':'rep-kab',owner:i<=100?'Rep Kota':'Rep Kab',status:i%2?'Aktif':'Churn',lat:null,lng:null});
  out.push({id:`source-${n}`,organization_id:'org',area_id:sourceArea,name:`Source ${n}`,address:`Address ${n}`,latitude_e7:-62000000-i,longitude_e7:1069000000+i,coordinate_status:'unverified',directory_dataset_id:BEKASI_DIRECTORY_DATASET_ID,version:3,record_status:'active',merged_into_id:null,field_rep_id:'source-rep',status:'Unknown',lat:-6.2-i/1e7,lng:106.9+i/1e7});
 }
 return out;
}
function links(rs:any[]){return Array.from({length:200},(_,j)=>{const i=j+1,n=String(i).padStart(3,'0'),d=rs.find(x=>x.id===`bekasi-demo-customer-${n}`),s=rs.find(x=>x.id===`source-${n}`);return {mapping_id:BEKASI_POINT_OVERLAY_ID,synthetic_activity:true as const,existing_point_overlay:true as const,demo_customer_id:d.id,demo_area_id:d.area_id,source_customer_id:s.id,source_external_code:null,source_dataset_id:BEKASI_DIRECTORY_DATASET_ID,source_area_id:s.area_id,source_name:s.name,source_address:s.address,source_latitude_e7:s.latitude_e7,source_longitude_e7:s.longitude_e7,source_version:s.version,source_coordinate_status:s.coordinate_status,before:{...d}}})}
const metrics=new Map(Array.from({length:200},(_,i)=>[`bekasi-demo-customer-${String(i+1).padStart(3,'0')}`,{activity_count:2,productive_count:1,follow_up_count:1,no_show_count:0,order_count:1,invoice_count:1,actual_minor:500000}]));

test('overlay validation requires the complete immutable 200-link sidecar',()=>{
 const rs=rows(),ls=links(rs);const audits=ls.map((p:any)=>({organization_id:'org',resource_id:p.demo_customer_id,resource_type:'demo_operation_point_link',action:'operation_point_link_selected',before_json:JSON.stringify(p.before),after_json:JSON.stringify(p)}));
 assert.equal(validBekasiOverlayLinks(rs,audits,'org').length,200);
 assert.equal(validBekasiOverlayLinks(rs,audits.slice(1),'org').length,0);
 assert.equal(validBekasiOverlayLinks(rs,audits.map((a:any,i)=>i===0?{...a,organization_id:'foreign'}:a),'org').length,0);
});

test('overlay enriches existing source points without changing DEMO or source coordinates and supports DEMO filters',()=>{
 const rs=rows(),before=JSON.stringify(rs),ls=links(rs),result=applyBekasiOverlay(rs,ls,metrics,{channel:'field',areaId:'bekasi-demo-area-kota',repId:null,status:null});
 assert.equal(result.linkedDemoCustomerCount,100);
 assert.equal(result.allCustomers.filter((x:any)=>x.demo_operation_overlay).length,100);
 assert.equal(new Set(result.allCustomers.filter((x:any)=>x.demo_operation_overlay).map((x:any)=>x.id)).size,100);
 assert.equal(JSON.stringify(rs),before);
 const source=result.allCustomers.find((x:any)=>x.id==='source-001')!;
 assert.ok(Math.abs(source.lat! -(-6.2000001))<1e-12);assert.equal(source.demo_operation_overlay.demo_customer_id,'bekasi-demo-customer-001');
 assert.equal(result.allCustomers.find((x:any)=>x.id==='bekasi-demo-customer-001')!.lat,null);
 const kab=applyBekasiOverlay(rs,ls,metrics,{channel:'field',areaId:'bekasi-demo-area-kabupaten',repId:null,status:null});
 assert.equal(kab.linkedDemoCustomerCount,100);
 const telesales=applyBekasiOverlay(rs,ls,metrics,{channel:'telesales',areaId:null,repId:null,status:null});
 assert.equal(telesales.linkedDemoCustomerCount,0);assert.equal(telesales.allCustomers.some((x:any)=>x.demo_operation_overlay),false);
});

test('status and rep filters match source or DEMO values collectively, not copied identity',()=>{
 const rs=rows(),ls=links(rs);const byDemo=applyBekasiOverlay(rs,ls,metrics,{channel:'field',areaId:null,repId:'rep-kota',status:'Churn'});
 assert.equal(byDemo.linkedDemoCustomerCount,50);
 const bySource=applyBekasiOverlay(rs,ls,metrics,{channel:'field',areaId:null,repId:'source-rep',status:'Unknown'});
 assert.equal(bySource.linkedDemoCustomerCount,200);
});
