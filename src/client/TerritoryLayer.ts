import type {MapLayers} from '../shared/map-analysis';
import {useEffect,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import {Protocol} from 'pmtiles';

let protocol:Protocol|undefined;
export function useTerritoryLayer(map:maplibregl.Map|null,ready:boolean,url:string,layers:Pick<MapLayers,'boundary'|'density'>){
 const [error,setError]=useState(''),[detail,setDetail]=useState<Record<string,any>|null>(null);
 useEffect(()=>{
  if(!map||!ready||!url)return;
  if(!protocol){protocol=new Protocol();maplibregl.addProtocol('pmtiles',protocol.tile)}
  if(!map.getSource('nyales-national')){
   map.addSource('nyales-national',{type:'vector',url:'pmtiles://'+new URL(url,window.location.origin).href});
   const before=map.getLayer('nyales-directory-points-clusters')?'nyales-directory-points-clusters':undefined;
   map.addLayer({id:'nyales-national-fill',type:'fill',source:'nyales-national','source-layer':'desa_pop_2026',layout:{visibility:'none'},paint:{'fill-color':['step',['coalesce',['to-number',['get','population_density_km2']],0],'#edf5f1',100,'#c5e4d8',1000,'#82bfa9',5000,'#398b78',10000,'#0b5f54'],'fill-opacity':.55}},before);
   map.addLayer({id:'nyales-national-line',type:'line',source:'nyales-national','source-layer':'desa_pop_2026',minzoom:7,layout:{visibility:'none'},paint:{'line-color':'#4f776e','line-opacity':.5,'line-width':.7}},before);
  }
  const click=(event:any)=>{if(event.originalEvent?.defaultPrevented)return;const features=map.queryRenderedFeatures(event.point,{layers:['nyales-directory-points-points','nyales-directory-points-clusters','nyales-admin-fill'].filter(id=>Boolean(map.getLayer(id)))});if(features.length)return;const p=event.features?.[0]?.properties;if(p)setDetail({...p})};
  const err=(e:any)=>{if(e.sourceId==='nyales-national')setError('Batas nasional belum termuat. Titik pelanggan tetap tersedia.')};
  map.on('click','nyales-national-fill',click);map.on('error',err);
  return()=>{map.off('click','nyales-national-fill',click);map.off('error',err)};
 },[map,ready,url]);
 useEffect(()=>{if(!map||!ready)return;if(map.getLayer('nyales-national-line'))map.setLayoutProperty('nyales-national-line','visibility',layers.boundary?'visible':'none');if(map.getLayer('nyales-national-fill')){map.setLayoutProperty('nyales-national-fill','visibility',layers.boundary||layers.density?'visible':'none');map.setPaintProperty('nyales-national-fill','fill-opacity',layers.density?.55:.015)}setDetail(null)},[map,ready,layers.boundary,layers.density]);
 return {error,detail,close:()=>setDetail(null)};
}
