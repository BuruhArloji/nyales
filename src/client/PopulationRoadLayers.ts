import {useEffect,useState,useRef} from 'react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {ensurePMTilesProtocol} from './TerritoryLayer';

export const populationRasterUrl=String((import.meta as any).env?.VITE_NYALES_POPULATION_RASTER_URL||'');
/** Public raster reads R2 byte ranges only; switching the layer never queries D1. */
export function usePopulationRaster(map:MapLibreMap|null,ready:boolean,visible:boolean,opacity:number){
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!map||!ready||!populationRasterUrl||!visible)return;
  ensurePMTilesProtocol();
  if(!map.getSource('nyales-worldpop-2026')){
   map.addSource('nyales-worldpop-2026',{type:'raster',url:'pmtiles://'+new URL(populationRasterUrl,window.location.origin).href,tileSize:256,attribution:'<a href="https://hub.worldpop.org/" target="_blank" rel="noopener noreferrer">WorldPop 2026</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>'});
   // Below roads, symbols and NYALES overlays, never above customer pins.
   const before=map.getStyle().layers?.find(l=>l.id==='nyales-national-fill'||l.type==='line'||l.type==='symbol'||l.id.startsWith('nyales-'))?.id;
   map.addLayer({id:'nyales-worldpop-density',type:'raster',source:'nyales-worldpop-2026',paint:{'raster-opacity':opacity,'raster-resampling':'nearest','raster-fade-duration':0}},before);
  }
  const onError=(e:any)=>{if(e.sourceId==='nyales-worldpop-2026')setError('Raster WorldPop belum termuat.')};
  const onData=(e:any)=>{if(e.sourceId==='nyales-worldpop-2026'&&e.isSourceLoaded)setError('')};
  map.on('error',onError);map.on('sourcedata',onData);
  return()=>{map.off('error',onError);map.off('sourcedata',onData)};
 },[map,ready,visible]);
 useEffect(()=>{if(!map||!ready||!map.getLayer('nyales-worldpop-density'))return;map.setLayoutProperty('nyales-worldpop-density','visibility',visible?'visible':'none');map.setPaintProperty('nyales-worldpop-density','raster-opacity',opacity)},[map,ready,visible,opacity]);
 return error;
}

export function useRoadVisibility(map:MapLibreMap|null,ready:boolean,visible:boolean){
 const original=useRef(new Map<string,'visible'|'none'>());
 useEffect(()=>{
  if(!map||!ready)return;
  for(const layer of map.getStyle().layers||[]){
   if(!('source-layer' in layer)||!['transportation','transportation_name'].includes(layer['source-layer']||''))continue;
   if(/rail|ferry|aerialway/i.test(layer.id))continue;
   if(!original.current.has(layer.id))original.current.set(layer.id,(map.getLayoutProperty(layer.id,'visibility') as 'visible'|'none')||'visible');
   map.setLayoutProperty(layer.id,'visibility',visible?original.current.get(layer.id)!:'none');
  }
 },[map,ready,visible]);
}
