import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import{DataTools}from'../../src/client/DataTools';
import{MapLibreCanvas}from'../../src/client/MapView';
import * as maplibre from'maplibre-gl';
const addSource=maplibre.Map.prototype.addSource;
maplibre.Map.prototype.addSource=function(id:string,source:any){(window as any).__directoryFixtureMap=this;if(id==='nyales-directory-points')(window as any).__directoryFixtureSourceData=source.data;return addSource.call(this,id,source)};
const setData=maplibre.GeoJSONSource.prototype.setData;
maplibre.GeoJSONSource.prototype.setData=function(data:any,...args:any[]){if(this.id==='nyales-directory-points')(window as any).__directoryFixtureSourceData=data;return (setData as any).call(this,data,...args)};
const customers=Array.from({length:12624},(_,i)=>({id:'customer-'+i,name:'Warung fixture '+i,lat:-6.3+Math.floor(i/180)*.002,lng:106.8+i%180*.002,status:'Unknown',owner:'Belum assigned'}));
const references=Array.from({length:2638},(_,i)=>({id:'reference-'+i,name:'Reference fixture '+i,lat:-6.29+Math.floor(i/70)*.002,lng:106.81+i%70*.002,category:'Referensi non-customer'}));
const detailMode=new URLSearchParams(location.search).has('details');
const overlay=(id:string)=>({mapping_id:'mapping-'+id,demo_customer_id:'bekasi-demo-customer-001',demo_customer_name:'Outlet DEMO Bekasi',demo_area_id:'area-bekasi',demo_area_name:'Bekasi',demo_rep_id:'rep-001',demo_rep_name:'Rina DEMO',period_start:'2026-08-01',period_end:'2026-10-31',activity_count:12,productive_count:8,follow_up_count:2,no_show_count:2,order_count:4,invoice_count:3,actual_minor:12500000,disclaimer:'Operasi DEMO sintetis; bukan transaksi, kunjungan, atau histori nyata dari tempat sumber ini.',source_customer_id:id,source_dataset_id:'detail-dataset',coordinate_status:'unverified'});
const detailCustomers=[{id:'photo-customer',directory_dataset_id:'detail-dataset',name:'Warung Foto',lat:-6.21,lng:106.82,status:'Unknown',owner:'Belum assigned',demo_operation_overlay:overlay('photo-customer')},{id:'missing-photo',directory_dataset_id:'detail-dataset',name:'Warung Tanpa Foto',lat:-6.22,lng:106.83,status:'Unknown',owner:'Belum assigned'}];
const detailReferences=[{id:'source-reference',external_code:'source-reference',dataset_id:'detail-dataset',name:'Titik Referensi',lat:-6.215,lng:106.825,category:'Restoran'}];
const largeOverlayCustomers=customers.map((customer,i)=>i<200?{...customer,demo_operation_overlay:overlay(customer.id)}:customer);
const initialPoints=detailMode?detailCustomers:new URLSearchParams(location.search).has('large-demo')?largeOverlayCustomers:customers;
function App(){const[points,setPoints]=useState(initialPoints);const refs=detailMode?detailReferences:references;return <main>{detailMode&&<style>{'.maplibre-canvas{height:640px}@media(max-width:520px){.maplibre-canvas{height:560px}}'}</style>}<h1>Uji peta direktori</h1><button onClick={()=>setPoints(points.length?[]:initialPoints)}>Ubah customer fixture</button><MapLibreCanvas mapData={{customers:points,sales:[],reference_points:refs,reference_point_count:refs.length,demo_operation_overlay_count:points.filter((p:any)=>Boolean(p.demo_operation_overlay)).length,demo_operation_overlay_note:'Riwayat operasi adalah simulasi dan ditampilkan sebagai overlay pada titik direktori yang sudah ada; bukan transaksi, kunjungan, atau GPS nyata.',basemap:{style_url:{version:8,sources:{},layers:[],glyphs:'/fonts/{fontstack}/{range}.pbf'}}}} focus={null} onStreetView={item=>{(window as any).__streetViewItem=item.id}}/></main>}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('data-tools')?<DataTools/>:<App/>);
