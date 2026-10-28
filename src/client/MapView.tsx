import {LiquidTabs} from './LiquidNav';
import{StreetView}from'./StreetView';
import{Loading}from'./Loading';
import React,{useEffect,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
maplibregl.setWorkerUrl(mapWorkerUrl);
import type {Map as MapLibreMap,Marker,Popup} from 'maplibre-gl';
import {apiFetch} from './auth';

export {GeographyPage as MapPage} from './GeographyPage';
export function MapPanel({url='/api/map',full=false}:{url?:string;full?:boolean}){const [data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[focus,setFocus]=useState<any>(null),[street,setStreet]=useState<any>(null);async function showStreet(customer:any){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});setStreet(customer)}useEffect(()=>{let active=true;setData(null);setError('');apiFetch(url).then(r=>r.json() as any).then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[url,retry]);if(!data)return error?<p role="alert" className="notice danger">{error}<button className="button secondary" onClick={()=>setRetry(r=>r+1)}>Coba lagi</button></p>:<Loading>Memuat peta sesuai scope…</Loading>;return <section className="card map-card"><div className="card-header"><div><h2>Peta distribusi customer</h2><small>{data.total_customer_count} outlet · {data.customers.length} pin · {data.missing_coordinates_count} aktif tanpa koordinat</small></div><div className="data-actions"><span className="scope-chip">Lokasi terakhir diterima</span><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Muat ulang peta</button></div></div><div className="map-layout"><MapLibreCanvas mapData={data} focus={focus} onStreetView={showStreet}/><div className="map-list"><div className="map-legend"><span><i className="map-dot customer-dot"/>Customer</span><span><i className="map-dot sales-dot"/>Sales last seen</span></div>{data.missing_coordinates_count>0&&<p className="callout">{data.missing_coordinates_count} outlet aktif belum mempunyai koordinat. Tetap tercatat pada tabel dan total.</p>}{data.inactive_customer_count>0&&<small>{data.inactive_customer_count} outlet nonaktif tetap tercatat.</small>}<div className="map-sales-scroll" role="region" aria-label="Daftar posisi terakhir sales" tabIndex={0}>{data.sales.map((s:any)=><div className="map-row" key={s.id}><span className="map-dot sales-dot"/><div><strong>{s.name}</strong><small>{s.last_seen} · {s.source}</small><small>Akurasi {s.accuracy_m===null?'belum tersedia':s.accuracy_m+' m'} · {s.age_seconds===null?'Waktu perlu ditinjau':Math.floor(s.age_seconds/60)+' menit lalu'}</small><button className="text-button" onClick={()=>setFocus({...s})}>Lihat posisi {s.name}</button></div></div>)}{!data.sales.length&&<p className="muted">Belum ada posisi diterima pada scope/filter ini.</p>}</div><p className="muted map-position-note">Timestamp menunjukkan lokasi terakhir yang diterima, bukan posisi saat ini. Garis GPS menunggu Android. Tidak ada rute atau ETA.</p></div></div>{full&&<><h3>Customer dalam scope</h3><div className="table-wrap"><table><thead><tr><th>Customer</th><th>Area / PIC lapangan</th><th>Koordinat</th><th>Lokasi</th></tr></thead><tbody>{data.all_customers.map((c:any)=><tr key={c.id}><td>{c.name}<small>{c.external_code||c.id} · {c.status}{c.record_status==='inactive'?' · Nonaktif':''}</small></td><td>Area {c.area}<small>{c.owner}</small></td><td>{c.lat===null||c.lng===null?'Belum diisi':c.lat+', '+c.lng}<small>{c.coordinate_status==='verified'?'Diverifikasi manual':c.coordinate_status==='missing'?'Perlu perbaikan':'Belum diverifikasi'}</small></td><td>{c.lat===null||c.lng===null||c.record_status==='inactive'?<span className="muted">{c.record_status==='inactive'?'Outlet nonaktif':'Perbaiki melalui master Customer'}</span>:<><button className="text-button" onClick={()=>setFocus({...c})}>Lihat pin {c.name}</button><button className="text-button" onClick={()=>void showStreet(c)}>Lihat Street View {c.name}</button></>}</td></tr>)}{!data.all_customers.length&&<tr><td colSpan={4}>Tidak ada customer pada scope/filter ini.</td></tr>}</tbody></table></div></>}{street&&<StreetView customer={street} onClose={()=>setStreet(null)}/>}</section>}

export function MapLibreCanvas({mapData,focus,onStreetView,geometry,selectedBoundary,selectedName,onBoundarySelect,initialCamera,onCameraChange}:{mapData:any;focus:any;onStreetView:(customer:any)=>void;geometry?:any;selectedBoundary?:string;selectedName?:string;onBoundarySelect?:(id:string)=>void;initialCamera?:{center:[number,number];zoom:number;pitch:number;bearing:number};onCameraChange?:(camera:{center:[number,number];zoom:number;pitch:number;bearing:number})=>void}){
 const [showReferences,setShowReferences]=useState(true);
 const [styleLoaded,setStyleLoaded]=useState(false);const callbacks=React.useRef({onBoundarySelect,onCameraChange});callbacks.current={onBoundarySelect,onCameraChange};

 const [basemapState,setBasemapState]=useState('Memuat basemap…'),[ready,setReady]=useState(false),[threeD,setThreeD]=useState(false),[closeZoom,setCloseZoom]=useState(false);
 const stage=React.useRef<HTMLDivElement>(null),container=React.useRef<HTMLDivElement>(null),instance=React.useRef<MapLibreMap|null>(null),markers=React.useRef<Marker[]>([]),popups=React.useRef<Popup[]>([]);
 const vector=Boolean(mapData.basemap?.style_url);
 useEffect(()=>{
  if(!container.current||instance.current)return;
  let map:MapLibreMap;
  try{map=new maplibregl.Map({container:container.current,
   style:mapData.basemap?.style_url||{version:8,sources:{osm:{type:'raster',tiles:[mapData.basemap?.tile_url||'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:mapData.basemap?.attribution||'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]},
   center:initialCamera?.center||[106.823,-6.216],zoom:initialCamera?.zoom??12.3,pitch:initialCamera?.pitch??0,bearing:initialCamera?.bearing??0,attributionControl:{compact:true},dragRotate:false,locale:{'FullscreenControl.Enter':'Layar penuh','FullscreenControl.Exit':'Keluar layar penuh'}})
  }catch{setBasemapState('Peta interaktif tidak tersedia; gunakan tabel koordinat.');return}
  instance.current=map;
  map.on('moveend',()=>{const p=map.getCenter();callbacks.current.onCameraChange?.({center:[p.lng,p.lat],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()})});
  map.on('load',()=>{setStyleLoaded(true);
   if(vector&&map.getSource('openmaptiles')){
    const before=map.getStyle().layers?.find(layer=>layer.type==='symbol')?.id;
    map.addLayer({id:'nyales-buildings-3d',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:14,
     layout:{visibility:'none'},paint:{'fill-extrusion-color':'#ded0b6','fill-extrusion-height':['max',0,['coalesce',['get','render_height'],6]],'fill-extrusion-base':['max',0,['coalesce',['get','render_min_height'],0]],'fill-extrusion-opacity':.9}},before);
   }
   void apiFetch('/api/observability/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'map_2d'})}).catch(()=>{});setReady(Boolean(map.getLayer('nyales-buildings-3d')));setBasemapState('');
  });
  map.on('error',()=>setBasemapState('Sebagian peta belum termuat. Pin tetap memakai koordinat tersimpan; coba muat ulang.'));
  map.on('idle',()=>{if(map.isStyleLoaded()&&map.areTilesLoaded())setBasemapState('')});
  map.on('zoom',()=>setCloseZoom(map.getZoom()>=14));
  map.addControl(new maplibregl.FullscreenControl({container:stage.current!}),'top-right');
  map.addControl(new maplibregl.NavigationControl({showCompass:true}),'top-right');
  return()=>{markers.current.forEach(m=>m.remove());popups.current.forEach(p=>p.remove());map.remove();instance.current=null};
 },[]);
 useEffect(()=>{
  const map=instance.current;if(!map||!styleLoaded||!mapData)return;
  markers.current.forEach(m=>m.remove());popups.current.forEach(p=>p.remove());markers.current=[];popups.current=[];
  const valid=(p:any)=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
  const customers=(mapData.customers||[]).filter(valid),references=showReferences?(mapData.reference_points||[]).filter(valid):[];
  const appendDetail=(content:HTMLElement,detail:any,kind:'customer'|'reference')=>{
   const card=document.createElement('div');card.className='map-popup-detail';
   if(typeof detail.photo_url==='string'&&/^https?:\/\//i.test(detail.photo_url)){const image=document.createElement('img');image.className='map-popup-image';image.alt='Foto '+detail.name;image.loading='lazy';image.referrerPolicy='no-referrer';image.src=detail.photo_url;image.addEventListener('error',()=>image.remove());card.appendChild(image)}
   const facts=document.createElement('div');facts.className='map-popup-facts';
   const addFact=(label:string,value:any)=>{if(value===undefined||value===null||value==='')return;const row=document.createElement('span');row.className='map-popup-fact';const key=document.createElement('b');key.textContent=label;const textNode=document.createElement('span');textNode.textContent=String(value);row.appendChild(key);row.appendChild(textNode);facts.appendChild(row)};
   addFact('Kategori',detail.category);addFact('Rating',detail.rating?(detail.rating+' · '+(detail.reviews||'0')+' ulasan'):undefined);addFact('Status',detail.status);addFact('Alamat',detail.address);addFact('Jam buka',detail.hours);addFact('Wilayah',[detail.area_kelurahan,detail.area_kecamatan,detail.area_kota].filter(Boolean).join(' · '));
   if(detail.phone){const row=document.createElement('span');row.className='map-popup-fact';const key=document.createElement('b');key.textContent='Telepon';const link=document.createElement('a');link.href='tel:'+detail.phone;link.textContent=detail.phone;row.appendChild(key);row.appendChild(link);facts.appendChild(row)}
   if(facts.childElementCount)card.appendChild(facts);
   const links=document.createElement('div');links.className='map-popup-links';
   if(typeof detail.maps_url==='string'&&/^https?:\/\//i.test(detail.maps_url)){const link=document.createElement('a');link.href=detail.maps_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Buka di Google Maps ↗';links.appendChild(link)}
   if(links.childElementCount)card.appendChild(links);content.appendChild(card);
  };
  const loadDetail=(content:HTMLElement,item:any,kind:'customer'|'reference')=>{
   if(kind==='customer'&&!item.directory_dataset_id)return;
   const path=kind==='customer'?'/api/customers/'+encodeURIComponent(item.id)+'/directory-details':'/api/point-directory/'+encodeURIComponent(item.dataset_id)+'/details/'+encodeURIComponent(item.external_code||item.id);
   const loading=document.createElement('small');loading.className='map-popup-loading';loading.textContent='Memuat detail sumber…';content.appendChild(loading);
   void apiFetch(path).then(async response=>{const json=await response.json()as any;if(!response.ok)throw Error('DIRECTORY_DETAIL_UNAVAILABLE');loading.remove();if(json.data)appendDetail(content,json.data,kind)}).catch(()=>{loading.textContent='Detail sumber belum tersedia.'});
  };
  const popup=(item:any,kind:'customer'|'sales'|'reference')=>{
   const content=document.createElement('div');content.className='map-popup-card';const title=document.createElement('strong'),note=document.createElement('small');title.textContent=item.name;content.appendChild(title);content.appendChild(document.createElement('br'));
   note.textContent=kind==='reference'?'Referensi peta · '+(item.category||'Kategori belum tersedia')+' · bukan master customer':kind==='sales'?'Lokasi terakhir: '+item.last_seen+' · '+item.source:'Status: '+item.status+' · PIC: '+item.owner;content.appendChild(note);
   if(kind==='customer'){const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent='Lihat Street View';button.addEventListener('click',()=>onStreetView(item));content.appendChild(button)}
   if(kind!=='sales')loadDetail(content,item,kind);
   return content;
  };
  // Large customer collections use WebGL clusters, avoiding thousands of DOM buttons.
  const clustered=customers.length>300;
  const features=[...(clustered?customers.map((p:any)=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[p.lng,p.lat]},properties:{id:p.id,kind:'customer',churn:p.status==='Churn'}})):[]),...references.map((p:any)=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:[p.lng,p.lat]},properties:{id:p.id,kind:'reference',churn:false}}))];
  const sourceId='nyales-directory-points',source=map.getSource(sourceId)as maplibregl.GeoJSONSource|undefined;
  const collection={type:'FeatureCollection' as const,features};
  if(source)source.setData(collection);else{
   map.addSource(sourceId,{type:'geojson',data:collection,cluster:true,clusterRadius:45,clusterMaxZoom:14});
   map.addLayer({id:sourceId+'-clusters',type:'circle',source:sourceId,filter:['has','point_count'],paint:{'circle-color':'#197b75','circle-radius':['step',['get','point_count'],17,100,22,1000,28],'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
   map.addLayer({id:sourceId+'-counts',type:'symbol',source:sourceId,filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':12},paint:{'text-color':'#fff'}});
   map.addLayer({id:sourceId+'-points',type:'circle',source:sourceId,filter:['!', ['has','point_count']],paint:{'circle-radius':6,'circle-color':['case',['==',['get','kind'],'reference'],'#777c80',['==',['get','churn'],true],'#b8793f','#168e85'],'circle-stroke-width':1.5,'circle-stroke-color':'#fff'}});
  }
  const items=new Map([...customers,...references].map((p:any)=>[p.id,p]));
  const clickPoint=(event:any)=>{const feature=event.features?.[0],item=items.get(feature?.properties?.id);if(!item)return;const tip=new maplibregl.Popup({offset:12,maxWidth:'280px'}).setLngLat([item.lng,item.lat]).setDOMContent(popup(item,feature.properties.kind)).addTo(map);popups.current.push(tip)};
  const clickCluster=async(event:any)=>{const feature=event.features?.[0];if(!feature)return;const src=map.getSource(sourceId)as maplibregl.GeoJSONSource;try{const zoom=await src.getClusterExpansionZoom(feature.properties.cluster_id);if(instance.current===map)map.easeTo({center:feature.geometry.coordinates,zoom})}catch{/* Source may be replaced while a view changes. */}};
  const enter=()=>{map.getCanvas().style.cursor='pointer'},leave=()=>{map.getCanvas().style.cursor=''};
  map.on('click',sourceId+'-points',clickPoint);map.on('click',sourceId+'-clusters',clickCluster);map.on('mouseenter',sourceId+'-points',enter);map.on('mouseleave',sourceId+'-points',leave);
  const add=(item:any,kind:'customer'|'sales')=>{if(!valid(item))return;const el=document.createElement('button');el.type='button';el.className='maplibre-marker '+kind+(item.status==='Churn'?' churn':'')+(item.geo_status&&item.geo_status!=='confirmed'?' geo-unmapped':'');el.setAttribute('aria-label',kind==='sales'?item.name+', posisi terakhir':item.name+', '+item.status);const tip=new maplibregl.Popup({offset:18,maxWidth:'280px'}).setDOMContent(popup(item,kind));markers.current.push(new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([item.lng,item.lat]).setPopup(tip).addTo(map));popups.current.push(tip)};
  if(!clustered)customers.forEach((p:any)=>add(p,'customer'));(mapData.sales||[]).forEach((p:any)=>add(p,'sales'));
  const points=[...customers,...(mapData.sales||[]).filter(valid),...references];if(points.length&&!initialCamera){const bounds=new maplibregl.LngLatBounds();points.forEach((p:any)=>bounds.extend([p.lng,p.lat]));map.fitBounds(bounds,{padding:50,maxZoom:14,duration:0})}
  return()=>{map.off('click',sourceId+'-points',clickPoint);map.off('click',sourceId+'-clusters',clickCluster);map.off('mouseenter',sourceId+'-points',enter);map.off('mouseleave',sourceId+'-points',leave)};
 },[mapData,styleLoaded,showReferences]);
 useEffect(()=>{const map=instance.current;if(!focus||!map)return;const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:450;if(focus.bbox)map.fitBounds([[focus.bbox[0],focus.bbox[1]],[focus.bbox[2],focus.bbox[3]]],{padding:45,maxZoom:15,duration});else map.flyTo({center:[focus.lng,focus.lat],zoom:16,duration})},[focus]);
 useEffect(()=>{
  const map=instance.current;if(!map||!styleLoaded)return;
  const data=geometry||{type:'FeatureCollection',features:[]};
  const source=map.getSource('nyales-admin') as maplibregl.GeoJSONSource|undefined;
  if(source)source.setData(data);else{
   map.addSource('nyales-admin',{type:'geojson',data});
   const before=map.getStyle().layers?.find(layer=>layer.type==='symbol')?.id;
   map.addLayer({id:'nyales-admin-fill',type:'fill',source:'nyales-admin',paint:{'fill-color':['coalesce',['get','fill_color'],'#148e85'],'fill-opacity':.12}},before);
   const hatch=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4,c=(x+y)%8<2?128:220;hatch[i]=hatch[i+1]=hatch[i+2]=c;hatch[i+3]=150}if(!map.hasImage('nyales-unknown-hatch'))map.addImage('nyales-unknown-hatch',{width:16,height:16,data:hatch});
   map.addLayer({id:'nyales-admin-unknown',type:'fill',source:'nyales-admin',filter:['==',['get','metric_unknown'],true],paint:{'fill-pattern':'nyales-unknown-hatch','fill-opacity':.65}},before);
   map.addLayer({id:'nyales-admin-outline',type:'line',source:'nyales-admin',paint:{'line-color':'#127c75','line-width':1.5}},before);
   map.on('click','nyales-admin-fill',e=>{const id=e.features?.[0]?.properties?.boundary_id;if(id)callbacks.current.onBoundarySelect?.(id)});
   const tip=new maplibregl.Popup({closeButton:false,closeOnClick:false,className:'geo-map-tooltip',offset:12});map.on('mousemove','nyales-admin-fill',e=>{map.getCanvas().style.cursor='pointer';const p=e.features?.[0]?.properties;tip.setLngLat(e.lngLat).setText(String(p?.name||'Wilayah')+(p?.metric_label?' · '+p.metric_label:'')).addTo(map)});map.on('mouseleave','nyales-admin-fill',()=>{map.getCanvas().style.cursor='';tip.remove()});
  }
 },[geometry,styleLoaded]);
 useEffect(()=>{const map=instance.current;if(!map?.getLayer('nyales-admin-fill'))return;const analytical=Boolean(geometry?.features?.some((f:any)=>f.properties?.metric_label));map.setPaintProperty('nyales-admin-fill','fill-opacity',['case',['==',['get','boundary_id'],selectedBoundary||''],analytical ? .8 : .32,analytical ? .62 : .09]);map.setPaintProperty('nyales-admin-outline','line-width',['case',['==',['get','boundary_id'],selectedBoundary||''],3,1]);},[selectedBoundary,geometry,styleLoaded]);
 function setMode(enabled:boolean){
  const map=instance.current;if(!map||!ready)return;
  map.setLayoutProperty('nyales-buildings-3d','visibility',enabled?'visible':'none');
  if(map.getLayer('building'))map.setLayoutProperty('building','visibility',enabled?'none':'visible');
  if(enabled)map.dragRotate.enable();else map.dragRotate.disable();
  map.easeTo({pitch:enabled?55:0,bearing:enabled?map.getBearing():0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});
  if(enabled!==threeD)void apiFetch('/api/observability/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:enabled?'map_3d':'map_2d'})}).catch(()=>{});setThreeD(enabled);
 }
 return <div className="map-canvas maplibre-canvas" ref={stage}>
  <div className="map-render-host" ref={container} role="application" aria-label="Peta distribusi customer dan posisi terakhir sales"/>
  {selectedName&&<span className="geo-selection-badge">{selectedName}</span>}
  {(mapData.reference_point_count||0)>0&&<label className="map-reference-toggle"><input type="checkbox" checked={showReferences} onChange={e=>setShowReferences(e.target.checked)}/>Referensi peta · {mapData.reference_point_count.toLocaleString('id-ID')}</label>}
  <LiquidTabs className="map-mode-toggle" role="group" aria-label="Mode tampilan peta"><button type="button" aria-pressed={!threeD} onClick={()=>setMode(false)}>2D</button><button type="button" aria-pressed={threeD} disabled={!ready} onClick={()=>setMode(true)} title={vector?'Bangunan dari data OpenStreetMap':'Sumber raster belum mendukung bangunan 3D'}>3D</button></LiquidTabs>
  {(basemapState||threeD)&&<span className="map-fallback-label" role="status">{basemapState||(closeZoom?'Bangunan OSM · tinggi mengikuti data; dapat berupa estimasi':'Mode 3D · zoom dekat untuk melihat bangunan')}</span>}
 </div>;
}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]??char))}
