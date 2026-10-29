import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import{DataTools}from'../../src/client/DataTools';
import{MapLibreCanvas}from'../../src/client/MapView';
import * as maplibre from'maplibre-gl';
const addSource=maplibre.Map.prototype.addSource;
maplibre.Map.prototype.addSource=function(id:string,source:any){(window as any).__directoryFixtureMap=this;return addSource.call(this,id,source)};
const customers=Array.from({length:12624},(_,i)=>({id:'customer-'+i,name:'Warung fixture '+i,lat:-6.3+Math.floor(i/180)*.002,lng:106.8+i%180*.002,status:'Unknown',owner:'Belum assigned'}));
const references=Array.from({length:2638},(_,i)=>({id:'reference-'+i,name:'Reference fixture '+i,lat:-6.29+Math.floor(i/70)*.002,lng:106.81+i%70*.002,category:'Referensi non-customer'}));
const detailMode=new URLSearchParams(location.search).has('details');
const detailCustomers=[{id:'photo-customer',directory_dataset_id:'detail-dataset',name:'Warung Foto',lat:-6.21,lng:106.82,status:'Unknown',owner:'Belum assigned'},{id:'missing-photo',directory_dataset_id:'detail-dataset',name:'Warung Tanpa Foto',lat:-6.22,lng:106.83,status:'Unknown',owner:'Belum assigned'}];
const detailReferences=[{id:'source-reference',external_code:'source-reference',dataset_id:'detail-dataset',name:'Titik Referensi',lat:-6.215,lng:106.825,category:'Restoran'}];
function App(){const[points,setPoints]=useState(detailMode?detailCustomers:customers);const refs=detailMode?detailReferences:references;return <main><h1>Uji peta direktori</h1><button onClick={()=>setPoints(points.length?[]:customers)}>Ubah customer fixture</button><MapLibreCanvas mapData={{customers:points,sales:[],reference_points:refs,reference_point_count:refs.length,basemap:{style_url:{version:8,sources:{},layers:[],glyphs:'/fonts/{fontstack}/{range}.pbf'}}}} focus={null} onStreetView={()=>{}}/></main>}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('data-tools')?<DataTools/>:<App/>);
