import {CustomerRisk} from './CustomerRisk';
import {RegionalAnalytics} from './RegionalAnalytics';
import {LiquidTabs} from './LiquidNav';
import {readBoundaryDatasets} from './boundary-data';
import React,{useEffect,useMemo,useRef,useState} from 'react';

import {MapLibreCanvas} from './MapView';

import {apiFetch,useIdentity} from './auth';

import {Loading} from './Loading';

import {StreetView} from './StreetView';

import {geoNavigate,readGeoContext,replaceGeoContext} from './geo-navigation';

import {geoStatusLabels,type GeoContext} from '../shared/geography';



async function get(url:string){return (await(await apiFetch(url)).json() as {data:any}).data}

const levels=['province','regency','district','village'] as const;

export function GeographyPage(){

 const initial=useRef(readGeoContext()).current,camera=useRef(initial.camera);

 const {identity}=useIdentity(),canManage=identity.capabilities.includes('settings:manage');

 const [riskRunId,setRiskRunId]=useState(initial.risk_run_id);
 const [mode,setMode]=useState(initial.mode||'scatter'),[branchTeam,setBranchTeam]=useState({branch_id:initial.branch_id||'',team_id:initial.team_id||''});
 const [area,setArea]=useState(initial.area_id||''),[rep,setRep]=useState(initial.rep_id||''),[channel,setChannel]=useState(initial.channel??(initial.mode&&initial.mode!=='scatter'?'':'field')),[status,setStatus]=useState(initial.customer_status||''),[period,setPeriod]=useState(initial.period||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}).slice(0,7));

 const [areas,setAreas]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]),[datasets,setDatasets]=useState<any[]>([]),[datasetId,setDatasetId]=useState(initial.dataset_id||''),[data,setData]=useState<any>(null),[geometry,setGeometry]=useState<any>(null),[selected,setSelected]=useState(initial.boundary_id||''),[search,setSearch]=useState(''),[hierarchy,setHierarchy]=useState<Record<string,string>>({}),[error,setError]=useState(''),[geometryError,setGeometryError]=useState(''),[retry,setRetry]=useState(0),[focus,setFocus]=useState<any>(null),[street,setStreet]=useState<any>(null);

 useEffect(()=>{let active=true;Promise.all([get('/api/areas'),get('/api/users'),canManage?readBoundaryDatasets():Promise.resolve([])]).then(([a,u,d])=>{if(active){setAreas(a);setUsers(u);setDatasets(d)}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[canManage,retry]);

 const query=new URLSearchParams({period});if(channel)query.set('channel',channel);if(area)query.set('area_id',area);if(rep)query.set('rep_id',rep);if(status)query.set('customer_status',status);if(datasetId)query.set('dataset_id',datasetId);

 const queryString=query.toString();

 useEffect(()=>{let active=true;setData(null);setGeometry(null);setError('');get('/api/geo/map?'+queryString).then(d=>{if(active){setData(d);if(selected&&!d.boundaries.some((b:any)=>b.id===selected))setSelected('')}}).catch(e=>active&&setError(e.message));return()=>{active=false}},[queryString,retry]);

 const boundaries:any[]=data?.boundaries||[];

 const visible=useMemo(()=>boundaries.filter(b=>levels.every(l=>!hierarchy[l]||b.hierarchy[l].code===hierarchy[l])&&[b.name,...levels.flatMap(l=>[b.hierarchy[l].name,b.hierarchy[l].code])].join(' ').toLowerCase().includes(search.toLowerCase())),[data,hierarchy,search]);

 const ids=visible.slice(0,50).map(b=>b.id);if(selected&&!ids.includes(selected))ids.splice(49,1,selected);const geometryKey=ids.join(',');

 useEffect(()=>{let active=true;setGeometry(null);setGeometryError('');if(data?.dataset&&geometryKey)void get('/api/geo/geometry?'+new URLSearchParams({dataset_id:data.dataset.id,ids:geometryKey})).then(g=>active&&setGeometry(g)).catch(e=>active&&setGeometryError(e.message));return()=>{active=false}},[data?.dataset?.id,data?.dataset?.version,geometryKey,retry]);

 const riskFilterKey=JSON.stringify([branchTeam,area,rep,channel,period,datasetId]),previousRiskFilter=useRef(riskFilterKey);
 useEffect(()=>{if(previousRiskFilter.current!==riskFilterKey){setRiskRunId(undefined);previousRiskFilter.current=riskFilterKey}},[riskFilterKey]);
 const chosen=boundaries.find(b=>b.id===selected),customers=selected?data?.map.all_customers.filter((c:any)=>c.geo_boundary_id===selected)||[]:[];

 function context(extra:GeoContext={}):GeoContext{return {risk_run_id:mode==='risk'?riskRunId:undefined,mode,...branchTeam,area_id:area,rep_id:rep,channel,customer_status:mode==='scatter'?status:undefined,period,dataset_id:data?.dataset?.id,boundary_id:selected,camera:camera.current,...extra}}

 useEffect(()=>{if(data)replaceGeoContext(context())},[riskRunId,mode,branchTeam,area,rep,channel,status,period,selected,data?.dataset?.id]);

 function select(id:string){const b=boundaries.find(x=>x.id===id);setSelected(id);if(b)setFocus({bbox:b.bbox});}

 function hierarchyOptions(level:typeof levels[number]){const index=levels.indexOf(level);return [...new Map(boundaries.filter(b=>levels.slice(0,index).every(l=>!hierarchy[l]||b.hierarchy[l].code===hierarchy[l])).map(b=>[b.hierarchy[level].code,b.hierarchy[level]])).values()].sort((a:any,b:any)=>a.name.localeCompare(b.name));}

 async function showStreet(c:any){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});setStreet(c)}

 return <><div className="page-heading"><div><h1>Peta & Wilayah</h1></div></div>

 <section className="card geo-filters" aria-label="Filter peta dan wilayah"><div className="assignment-filters">

 <label>Area peta<select aria-label="Area peta" value={area} onChange={e=>{setArea(e.target.value);setSelected('')}}><option value="">Semua area dalam scope</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>

 <label>Kanal peta<select aria-label="Kanal peta" value={channel} onChange={e=>{setChannel(e.target.value);setRep('');setSelected('')}}>{mode!=='scatter'&&<option value="">Gabungan kanal</option>}<option value="field">Sales lapangan</option><option value="telesales">Telesales</option></select></label>

 <label>Sales peta<select aria-label="Sales peta" value={rep} onChange={e=>setRep(e.target.value)}><option value="">Semua sales dalam scope</option>{users.filter(u=>(!channel||u.channel===channel)&&['SALES_REP','TELESALES'].includes(u.role_code)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>

 {mode==='scatter'&&<label>Status customer<select aria-label="Status customer" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option>{['Aktif','Churn','New','Unknown'].map(x=><option key={x}>{x}</option>)}</select></label>}

 <label>Periode laporan<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>

 {canManage&&<label>Rilis batas<select aria-label="Rilis batas" value={datasetId} onChange={e=>{setDatasetId(e.target.value);setSelected('');setHierarchy({})}}><option value="">Rilis aktif</option>{datasets.filter(d=>d.status==='active'||d.status==='draft'&&d.uploaded_features===d.expected_features&&d.uploaded_chunks===d.expected_chunks).map(d=><option key={d.id} value={d.id}>{d.release_version} · {d.status==='draft'?'Draft (pratinjau)':'Aktif'}</option>)}</select></label>}

 </div><small>Pemetaan dan posisi menunjukkan data terkini. Mode Kinerja / Coverage membaca periode laporan; snapshot mapping yang sama dipakai pada periode pembanding.</small></section>

 {error&&<p className="notice danger" role="alert">{error}<button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Coba lagi</button></p>}

 {!data&&!error&&<Loading>Memuat wilayah sesuai scope…</Loading>}

 <div className="page-toolbar geo-mode-toolbar"><LiquidTabs role="group" aria-label="Mode analisis wilayah">{[['scatter','Sebaran'],['performance','Kinerja'],['coverage','Coverage'],['risk','Risiko']].map(([key,label])=><button key={key} type="button" className={'button '+(mode===key?'':'secondary')} aria-pressed={mode===key} onClick={()=>{setMode(key);setStatus('');if(key==='scatter'){setBranchTeam({branch_id:'',team_id:''});if(!channel)setChannel('field')}}}>{label}</button>)}</LiquidTabs></div>
 {mode!=='scatter'&&(branchTeam.branch_id||branchTeam.team_id)&&<p className="callout">Filter cabang / tim dari Monitoring dipertahankan.<button className="text-button" onClick={()=>setBranchTeam({branch_id:'',team_id:''})}>Hapus filter cabang / tim</button></p>}
 {data&&mode!=='scatter'&&(data.preview||!data.dataset?<section className="card geo-analysis-empty" role="status"><h2>Analisis wilayah belum siap</h2><p>{data.preview?'Rilis ini masih draft. Aktifkan batas wilayah untuk menggunakan analisis.':'Tambahkan dan aktifkan batas kelurahan untuk menggunakan Kinerja, Coverage, dan Risiko.'}</p><div className="data-actions"><button type="button" className="button secondary" onClick={()=>setMode('scatter')}>Kembali ke Sebaran</button>{canManage&&<button type="button" className="button" onClick={()=>geoNavigate('settings',{settings_section:'boundaries'})}>Kelola batas wilayah</button>}</div></section>:mode==='risk'?<CustomerRisk filters={{...branchTeam,area_id:area,rep_id:rep,channel,period,dataset_id:data.dataset.id}} baseMap={data.map} context={context()} selected={selected} onSelect={setSelected} camera={camera.current} onCameraChange={c=>{camera.current=c;replaceGeoContext(context())}} runId={riskRunId} onRunChange={setRiskRunId}/>:<RegionalAnalytics mode={mode} filters={{...branchTeam,area_id:area,rep_id:rep,channel,period,dataset_id:data.dataset.id}} baseMap={data.map} context={context()} selected={selected} onSelect={setSelected} camera={camera.current} onCameraChange={c=>{camera.current=c;replaceGeoContext(context())}}/>)}
 {data&&mode==='scatter'&&<section className="card geo-map"><div className="card-header"><div><h2>Sebaran pelanggan</h2><small>{data.stats.total} pelanggan · {data.map.customers.length} pin · {data.preview?'—':data.stats.confirmed} terpetakan · {data.stats.unmapped} belum terpetakan / perlu review</small></div><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Muat ulang peta</button></div>

 {data.preview&&<p className="callout" role="status">Pratinjau draft · batas belum aktif. Jumlah terkonfirmasi pada draft belum tersedia. Hasil belum boleh dipublikasikan.</p>}

 {!data.dataset&&<p className="callout">Belum ada rilis batas aktif. Pin dan total pelanggan tetap tersedia.{canManage&&' Pilih draft untuk meninjau batas, atau kelola rilis di Pengaturan.'}</p>}

 {geometryError&&<p className="notice danger" role="alert">Polygon belum tersedia: {geometryError}. Daftar wilayah tetap dapat digunakan. Persempit pilihan atau muat ulang.</p>}

 <div className="geo-legend" aria-label="Legenda peta"><span><i className="geo-legend-region"/>Batas wilayah</span><span><i className="geo-legend-confirmed"/>Pelanggan terpetakan</span><span><i className="geo-legend-unknown"/>Belum terpetakan / perlu review</span></div><div className="geo-layout"><div className="geo-stage"><MapLibreCanvas mapData={data.map} focus={focus} onStreetView={showStreet} geometry={geometry} selectedBoundary={selected} selectedName={chosen?chosen.name+' · '+chosen.hierarchy.village.code:undefined} onBoundarySelect={select} initialCamera={initial.camera} onCameraChange={c=>{camera.current=c;replaceGeoContext(context())}}/></div>

 <aside className="geo-panel" aria-label="Wilayah dan pelanggan"><label>Cari wilayah<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama atau kode wilayah…"/></label><div className="geo-hierarchy">{levels.map((l,i)=><label key={l}>{['Provinsi','Kabupaten / kota','Kecamatan','Desa / kelurahan'][i]}<select value={hierarchy[l]||''} onChange={e=>setHierarchy(h=>({...Object.fromEntries(levels.slice(0,i).map(k=>[k,h[k]||''])),[l]:e.target.value}))}><option value="">Semua</option>{hierarchyOptions(l).map((v:any)=><option key={v.code} value={v.code}>{v.name}</option>)}</select></label>)}</div>

 <small>{visible.length} wilayah dalam scope{visible.length>50?' · maksimal 50 polygon ditampilkan; persempit pencarian':''}</small>

 <div className="geo-region-list" role="group" aria-label="Pilih wilayah">{visible.map(b=><button key={b.id} className="geo-region" aria-pressed={selected===b.id} onClick={()=>select(b.id)}><span><strong>{b.name}</strong><small>{b.hierarchy.village.code} · {b.hierarchy.district.name}</small></span><b>{data.preview?'—':b.confirmed_customer_count}</b></button>)}{!visible.length&&<p className="muted">Tidak ada batas tersedia untuk pilihan ini.</p>}</div>

 <section className="geo-detail" aria-label="Rincian wilayah" onKeyDown={e=>{if(e.key==='Escape')setSelected('')}}>{chosen?<><h3>{chosen.name}</h3>{!data.preview&&<small>Area bisnis: {chosen.area_business?.area_name||'Belum dibagi'}{chosen.area_business&&chosen.area_business.boundary_id!==chosen.id?' · basis rilis sebelumnya':''}</small>}<small>{levels.map(l=>chosen.hierarchy[l].name).join(' / ')}</small><p>{data.preview?'Jumlah pelanggan belum tersedia untuk draft.':`${customers.length} pelanggan terkonfirmasi dalam filter saat ini.`}</p><div className="data-actions"><button className="button secondary" onClick={()=>setSelected('')}>Hapus pilihan</button><button className="button" disabled={data.preview} onClick={()=>geoNavigate('customers',context())}>Lihat pelanggan wilayah</button>{canManage&&<button className="button secondary" disabled={data.preview} onClick={()=>geoNavigate('assignments',context())}>Atur pembagian wilayah</button>}</div>{customers.slice(0,8).map((c:any)=><div className="geo-customer" key={c.id}><span>{c.name}<small>{geoStatusLabels[c.geo_status]}</small></span>{canManage&&<button className="text-button" onClick={()=>geoNavigate('settings',context({customer_id:c.id}))}>Review</button>}</div>)}</>:<p className="muted">Klik polygon atau pilih wilayah dari daftar. Daftar dapat digunakan dengan keyboard.</p>}</section>

 <button className="button secondary" disabled={data.preview} onClick={()=>geoNavigate('customers',context({boundary_id:undefined,mapping_bucket:'unmapped'}))}>Belum terpetakan / perlu review · {data.stats.unmapped}</button>

 {canManage&&<button className="text-button" onClick={()=>geoNavigate('settings',{customer_id:data.map.all_customers[0]?.id,dataset_id:data.dataset?.id})}>Kelola review pemetaan</button>}

 <details className="geo-sales"><summary>Posisi sales terakhir · {data.map.sales.length}</summary><div className="geo-sales-list">{data.map.sales.map((s:any)=><div className="geo-customer" key={s.id}><span><strong>{s.name}</strong><small>{s.last_seen} · {s.source}</small><small>Akurasi {s.accuracy_m===null?'belum tersedia':s.accuracy_m+' m'}</small></span><button className="text-button" onClick={()=>setFocus({...s})}>Lihat posisi</button></div>)}{!data.map.sales.length&&<p className="muted">Belum ada posisi diterima pada filter ini.</p>}</div></details></aside></div>

 <footer className="geo-source"><small>{data.dataset?`${data.dataset.release_version} · ${data.dataset.code_namespace} · ${data.dataset.attribution||'Atribusi sedang direview'}`:'Batas administrasi belum aktif.'}</small><small>Lokasi sales bertimestamp, bukan tracking langsung. Garis GPS menunggu Android. Tanpa rute / ETA.</small></footer>

 </section>}{street&&<StreetView customer={street} onClose={()=>setStreet(null)}/>}</>;

}

