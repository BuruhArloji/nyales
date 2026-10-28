import React,{useState}from'react';
import{createRoot}from'react-dom/client';
import{MapLibreCanvas}from'../../src/client/MapView';
import * as maplibre from'maplibre-gl';
const addSource=maplibre.Map.prototype.addSource;
maplibre.Map.prototype.addSource=function(id:string,source:any){(window as any).__directoryFixtureMap=this;return addSource.call(this,id,source)};
const customers=Array.from({length:12624},(_,i)=>({id:'customer-'+i,name:'Warung fixture '+i,lat:-6.3+Math.floor(i/180)*.002,lng:106.8+i%180*.002,status:'Unknown',owner:'Belum assigned'}));
const references=Array.from({length:2638},(_,i)=>({id:'reference-'+i,name:'Reference fixture '+i,lat:-6.29+Math.floor(i/70)*.002,lng:106.81+i%70*.002,category:'Referensi non-customer'}));
function App(){const[points,setPoints]=useState(customers);return <main><h1>Uji peta direktori</h1><button onClick={()=>setPoints(points.length?[]:customers)}>Ubah customer fixture</button><MapLibreCanvas mapData={{customers:points,sales:[],reference_points:references,reference_point_count:references.length,basemap:{style_url:{version:8,sources:{},layers:[],glyphs:'/fonts/{fontstack}/{range}.pbf'}}}} focus={null} onStreetView={()=>{}}/></main>}
createRoot(document.getElementById('root')!).render(<App/>);
