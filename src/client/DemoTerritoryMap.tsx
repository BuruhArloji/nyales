import React,{useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import {Protocol} from 'pmtiles';

type AreaSummary={demo_area_id:string;demo_area_name:string;region:string;provinces:string[];assigned_units:number;estimated_population_2026:number;population_is_estimate_not_census:boolean;synthetic_owner_id:string};
type DensityMetadata={field:string;source_field:string;units:string;method:string;quantile_percentiles:number[];quantile_breaks:number[];valid_feature_count:number;missing_feature_count:number;minimum:number;maximum:number;caveat:string};
type Manifest={demo_classification:string;operational_status:string;production_eligible:boolean;boundary_source:{label:string;reuse_rights_status:string};population_source:{label:string};population_density?:DensityMetadata;source_validation:{feature_count:number;pum_unique_code_count:number;pum_missing_feature_count:number;pum_duplicate_code_count:number};assignment:{assigned_code_count:number;exception_feature_count:number;exception_issue_rows:number;effective_from:string};geometry_validation:{valid_geometry_count:number};tiles:{verified_by_pmtiles_cli:boolean;maxzoom:number;size_bytes:number}|null};
type MapMode='area'|'density';
type DensityLegendItem={label:string;color:string;percentile:string};

type ProtocolGlobal=typeof globalThis&{__nyalesDemoPmtilesProtocol?:Protocol};
function ensurePmtilesProtocol(){
 const root=globalThis as ProtocolGlobal;
 if(!root.__nyalesDemoPmtilesProtocol){
  const protocol=new Protocol();
  maplibregl.addProtocol('pmtiles',protocol.tile);
  root.__nyalesDemoPmtilesProtocol=protocol;
 }
}

const areaPalette=['#2563eb','#16a34a','#f59e0b','#a855f7'] as const;
const densityPalette=['#eff3ff','#c6dbef','#6baed6','#2171b5','#08306b'] as const;
const labels=[
 {id:'DEMO-AREA-01',name:'DEMO Area 01 – Sumatra',owner:'DEMO-PIC-01'},
 {id:'DEMO-AREA-02',name:'DEMO Area 02 – Jawa–Bali',owner:'DEMO-PIC-02'},
 {id:'DEMO-AREA-03',name:'DEMO Area 03 – Kalimantan–Sulawesi',owner:'DEMO-PIC-03'},
 {id:'DEMO-AREA-04',name:'DEMO Area 04 – Nusa Tenggara–Maluku–Papua',owner:'DEMO-PIC-04'},
];
const numberFormat=new Intl.NumberFormat('id-ID',{maximumFractionDigits:0});
const densityFormat=new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
const areaFillExpression:any=['match',['get','demo_area_id'],'DEMO-AREA-01',areaPalette[0],'DEMO-AREA-02',areaPalette[1],'DEMO-AREA-03',areaPalette[2],'DEMO-AREA-04',areaPalette[3],'#8a9691'];
function densityFillExpression(breaks:number[]):any{
	return ['step',['coalesce',['to-number',['get','population_density_km2']],0],densityPalette[0],breaks[0],densityPalette[1],breaks[1],densityPalette[2],breaks[2],densityPalette[3],breaks[3],densityPalette[4]];
}
function applyMapMode(map:maplibregl.Map,mode:MapMode,density?:DensityMetadata){
 if(!map.getLayer('demo-territory-fill'))return;
 const breaks=density?.quantile_breaks;
 if(mode==='density'&&breaks?.length===4){
  map.setPaintProperty('demo-territory-fill','fill-color',densityFillExpression(breaks));
  map.setPaintProperty('demo-territory-fill','fill-opacity',0.72);
 }else{
  map.setPaintProperty('demo-territory-fill','fill-color',areaFillExpression);
  map.setPaintProperty('demo-territory-fill','fill-opacity',0.38);
 }
}
function densityLegendItems(metadata:DensityMetadata):DensityLegendItem[]{
 const breaks=metadata.quantile_breaks;
 if(breaks.length!==4)return [];
 const format=(value:number)=>densityFormat.format(value);
 return [
  {color:densityPalette[0],label:`< ${format(breaks[0])}`,percentile:'P0–P20'},
  {color:densityPalette[1],label:`${format(breaks[0])}–<${format(breaks[1])}`,percentile:'P20–P40'},
  {color:densityPalette[2],label:`${format(breaks[1])}–<${format(breaks[2])}`,percentile:'P40–P60'},
  {color:densityPalette[3],label:`${format(breaks[2])}–<${format(breaks[3])}`,percentile:'P60–P80'},
  {color:densityPalette[4],label:`≥ ${format(breaks[3])}`,percentile:'P80–P100'},
 ];
}
function demoDataBasePath(tilesUrl:string){try{return new URL(tilesUrl,window.location.origin).pathname.replace(/\/[^/]*$/,'')}catch{return ''}}

export function DemoTerritoryMap({tilesUrl}:{tilesUrl:string}){
 const canvas=useRef<HTMLDivElement>(null),mapRef=useRef<maplibregl.Map|null>(null);
 const [manifest,setManifest]=useState<Manifest|null>(null),[areas,setAreas]=useState<AreaSummary[]>([]),[selected,setSelected]=useState<Record<string,any>|null>(null),[mapError,setMapError]=useState(''),[mapReady,setMapReady]=useState(false),[dataError,setDataError]=useState(''),[mapMode,setMapMode]=useState<MapMode>('area');
 const dataBasePath=demoDataBasePath(tilesUrl);
 const densityMeta=manifest?.population_density;
 const densityLegend=densityMeta?densityLegendItems(densityMeta):[];

 useEffect(()=>{
  let active=true;
  Promise.all([
   fetch(`${dataBasePath}/manifest.json`).then(r=>{if(!r.ok)throw Error('Manifest demo belum tersedia.');return r.json() as Promise<Manifest>}),
   fetch(`${dataBasePath}/area-summary.json`).then(r=>{if(!r.ok)throw Error('Ringkasan Area demo belum tersedia.');return r.json() as Promise<AreaSummary[]>}),
  ]).then(([m,a])=>{if(active){setManifest(m);setAreas(a)}}).catch(e=>{if(active)setDataError(e instanceof Error?e.message:'Data DEMO tidak dapat dimuat.')});
  return()=>{active=false};
 },[dataBasePath]);

 useEffect(()=>{
  const node=canvas.current;if(!node||mapRef.current||!tilesUrl)return;
  ensurePmtilesProtocol();
  const map=new maplibregl.Map({
   container:node,
   style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},layers:[{id:'osm',type:'raster',source:'osm'}]},
   center:[118,-2],zoom:3.4,attributionControl:{compact:true},dragRotate:false,
  });
  mapRef.current=map;
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.on('load',()=>{
   const url=`pmtiles://${window.location.origin}${tilesUrl}`;
   map.addSource('demo-territories',{type:'vector',url});
   map.addLayer({
    id:'demo-territory-fill',type:'fill',source:'demo-territories','source-layer':'desa_pop_2026',
    paint:{'fill-color':areaFillExpression,'fill-opacity':0.38},
   });
   map.addLayer({
    id:'demo-territory-outline',type:'line',source:'demo-territories','source-layer':'desa_pop_2026',minzoom:5,
    paint:{'line-color':'#243a34','line-opacity':0.68,'line-width':['interpolate',['linear'],['zoom'],5,0.35,11,1.05]},
   });
   map.fitBounds([[94,-12],[142,7]],{padding:24,duration:0});
   setMapReady(true);
   map.on('click','demo-territory-fill',(event:any)=>{
    const properties=event.features?.[0]?.properties;
    if(properties)setSelected({...properties});
   });
   map.on('mouseenter','demo-territory-fill',()=>{map.getCanvas().style.cursor='pointer'});
   map.on('mouseleave','demo-territory-fill',()=>{map.getCanvas().style.cursor=''});
  });
  map.on('error',(event:any)=>{
   const message=String(event?.error?.message||'');
   if(message.includes('PMTiles')||message.includes('Range')||message.includes('fetch'))setMapError('Tile demo belum dapat dimuat. Periksa endpoint PMTiles dan byte-range.');
  });
 return()=>{map.remove();mapRef.current=null};
 },[tilesUrl]);

 useEffect(()=>{
  const map=mapRef.current;
  if(map&&mapReady)applyMapMode(map,mapMode,densityMeta);
 },[mapMode,densityMeta,mapReady]);

 const chooseMapMode=(next:MapMode)=>{
  setMapMode(next);
 };
 const formatPopulation=(value:unknown)=>numberFormat.format(Number(value||0));
 const formatDensity=(value:unknown)=>densityFormat.format(Number(value||0));
 return <section className="card geo-map demo-territory-card" aria-labelledby="demo-territory-title">
  <div className="card-header">
   <div><h2 id="demo-territory-title">Area Territory Management · DEMO</h2><small>{manifest?`${numberFormat.format(manifest.source_validation.feature_count)} polygon · ${numberFormat.format(manifest.assignment.assigned_code_count)} assignment sintetis · ${numberFormat.format(manifest.assignment.exception_feature_count)} perlu review`: 'Memuat ringkasan demo…'}</small></div>
   <span className="badge">PORTOFOLIO · DEMO</span>
  </div>
  <p className="callout" role="note">Ini simulasi kepemilikan berdasarkan kelompok provinsi, bukan pembagian outlet/workload yang sudah dioptimalkan. Owner `DEMO-PIC-01` s.d. `DEMO-PIC-04` adalah placeholder; tidak ada assignment sales nyata.</p>
  {dataError&&<p className="notice danger" role="alert">{dataError}</p>}
  {mapError&&<p className="notice danger" role="alert">{mapError}</p>}
  {manifest&&<div className="demo-territory-stats" aria-label="Ringkasan peta DEMO">
   <div><small>Unit berbatas</small><strong>{numberFormat.format(manifest.source_validation.feature_count)}</strong></div>
   <div><small>Assignment DEMO</small><strong>{numberFormat.format(manifest.assignment.assigned_code_count)}</strong></div>
   <div><small>Exception review</small><strong>{numberFormat.format(manifest.assignment.exception_feature_count)}</strong></div>
   <div><small>Mulai efektif (demo)</small><strong>{manifest.assignment.effective_from}</strong></div>
  </div>}
  {manifest&&<div className="data-actions"><a className="button secondary" href={`${dataBasePath}/exceptions.csv`} download="nyales-demo-exceptions.csv">Unduh CSV pengecualian · {numberFormat.format(manifest.assignment.exception_feature_count)} unit / {numberFormat.format(manifest.assignment.exception_issue_rows)} isu</a></div>}
  {manifest&&<div className="demo-map-mode" role="group" aria-label="Pilih lapisan peta DEMO">
   <span>Lapisan peta</span>
   <button type="button" className="button secondary" aria-pressed={mapMode==='area'} onClick={()=>chooseMapMode('area')}>Area DEMO</button>
   <button type="button" className="button secondary" aria-pressed={mapMode==='density'} disabled={!densityMeta||densityLegend.length!==5} onClick={()=>chooseMapMode('density')}>Kepadatan penduduk</button>
  </div>}
  <div className="geo-layout demo-territory-layout">
   <div className="geo-stage demo-territory-stage"><div ref={canvas} className="map-canvas maplibre-canvas" role="img" aria-label={mapMode==='density'?'Peta kepadatan penduduk per desa dan kelurahan':'Peta empat wilayah owner DEMO per desa dan kelurahan'}/>{!mapReady&&!mapError&&<div className="demo-map-loading" role="status">Memuat peta DEMO…</div>}</div>
   <aside className="geo-panel" aria-label={mapMode==='density'?'Legenda kepadatan dan detail polygon':'Ringkasan Area demo dan detail polygon'}>
    {mapMode==='density'&&densityMeta?<div className="demo-density-legend" aria-label="Legenda kepadatan penduduk">
     <h3>Kepadatan penduduk</h3>
     <p>Orang/km² · 5 kelas kuantil</p>
     {densityLegend.map((item,index)=><div className="demo-density-row" key={item.percentile}>
      <span className="demo-density-swatch" style={{background:item.color}}/>
      <span><strong>{item.label}</strong><small>{item.percentile}</small></span>
     </div>)}
     <small className="demo-density-note">Ambang P20/P40/P60/P80 dihitung dari {numberFormat.format(densityMeta.valid_feature_count)} unit yang memiliki data. Kelas membagi unit administrasi, bukan luas wilayah.</small>
    </div>:<>
     <div className="demo-area-legend" aria-label="Legenda Area demo">{labels.map((item,index)=><div className="demo-area-row" key={item.id}><span className="demo-area-swatch" style={{background:areaPalette[index]}}/><span><strong>{item.name}</strong><small>{item.owner}</small></span></div>)}<div className="demo-area-row"><span className="demo-area-swatch review"/><span><strong>DEMO – Perlu review</strong><small>Tidak diberi owner</small></span></div></div>
     {areas.map((item,index)=><article className="demo-area-summary" key={item.demo_area_id}>
      <div><span className="demo-area-swatch" style={{background:areaPalette[index]}}/><strong>{item.demo_area_name}</strong></div>
      <small>{numberFormat.format(item.assigned_units)} unit · {item.synthetic_owner_id}</small>
      <small>Populasi 2026 (estimasi): {formatPopulation(item.estimated_population_2026)}</small>
     </article>)}
    </>}
    <section className="geo-detail demo-territory-detail" aria-live="polite" aria-label="Detail polygon terpilih">
     {selected?<><h3>{selected.desa_name||'Nama tidak tersedia'}</h3><small>{selected.admin_type||'Unit admin'} · {selected.admin_code_pum||'PUM kosong'}</small><dl>
      <div><dt>Provinsi</dt><dd>{selected.province_name||'Tidak diketahui'}</dd></div>
      <div><dt>Area DEMO</dt><dd>{selected.demo_area_name||'Tidak diketahui'}</dd></div>
      <div><dt>Owner DEMO</dt><dd>{selected.demo_owner_id||'Tidak ada · review'}</dd></div>
      <div><dt>Populasi 2026</dt><dd>{selected.population_2026==null?'Tidak tersedia':formatPopulation(selected.population_2026)+' (estimasi)'}</dd></div>
      <div><dt>Kepadatan penduduk</dt><dd>{selected.population_density_km2==null?'Tidak tersedia':formatDensity(selected.population_density_km2)+' orang/km² (estimasi)'}</dd></div>
      <div><dt>Status</dt><dd>{selected.assignment_status||'Tidak diketahui'}</dd></div>
     </dl></>:<p className="muted">Klik polygon untuk melihat unit administrasi, Area/owner placeholder, estimasi populasi, dan kepadatannya.</p>}
    </section>
    <small className="demo-territory-note">Batas: {manifest?.boundary_source.label||'BIG 2022-based'} · Populasi dan kepadatan: WorldPop 2026 (estimasi, bukan sensus). Hak redistribusi batas belum diverifikasi.</small>
   </aside>
  </div>
  <footer className="geo-source"><small>PMTiles nasional · max zoom {manifest?.tiles?.maxzoom??'—'} · arsip {manifest?.tiles?.verified_by_pmtiles_cli?'terverifikasi':'belum tersedia'} · kepadatan {densityMeta?.valid_feature_count?numberFormat.format(densityMeta.valid_feature_count)+' nilai':'—'}</small><small>Assignment sintetis untuk portofolio · D1 tidak diubah · tidak untuk operasi.</small></footer>
 </section>;
}
