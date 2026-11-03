import {MetricCorner,type MetricKind} from './MetricCorner';
import {RegionalSummary} from './RegionalAnalytics';
import {geoNavigate} from './geo-navigation';
import {LiquidNav,WorkspaceNavButton} from './LiquidNav';
import{Observability}from'./Observability';
import{Recovery}from'./Recovery';
import{Loading}from'./Loading';
import{ChannelContribution}from'./ChannelContribution';
import{Incentives}from'./Incentives';
import{Monitoring}from'./Monitoring';
import {FieldWork} from './Work';
import {Commercial} from './Commercial';
import {TelesalesWorkbench} from './Telesales';
import {Segmentation,Targets} from './Planning';
import {Catalog} from './Catalog';
import {Transactions} from './Transactions';
import {MapPanel,MapPage} from './MapView';
import {Assignments} from './Assignments';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Binoculars,Settings as SettingsIcon,Users,Phone,ShieldCheck,Upload,Network,MapPin,Package,Receipt,Target,CalendarDays,ChartNoAxesCombined} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import './styles.css';
import './theme.css';
import './select.css';
import './mobile.css';
import {compactNumber} from './numbers';
import {DataTools} from './DataTools';
import {Customers} from './Customers';
import {Sessions} from './Sessions';
import {People} from './People';
import {Settings} from './Settings';
import {AuthGate,apiFetch,useIdentity} from './auth';
type Page='recovery'|'observability'|'incentives'|'monitoring'|'work'|'commercial'|'segmentation'|'targets'|'overview'|'customers'|'telesales'|'settings'|'people'|'sessions'|'data'|'assignments'|'map'|'products'|'invoices';
type Customer={id:string;name:string;area:string;owner:string;status:string;tier:string;actual:number;last:string;dnc?:boolean|null;contact_permission?:string};
function useData<T>(url:string){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);useEffect(()=>{let active=true;setData(null);setError('');apiFetch(url).then(r=>r.json() as Promise<{data:T}>).then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[url,retry]);return {data,error,reload:()=>setRetry(x=>x+1)}}
function Feedback({error,reload}:{error:string;reload:()=>void}){return error?<div role="alert" className="notice danger">{error} <button className="button secondary" onClick={reload}>Coba lagi</button></div>:<Loading>Memuat data sesuai scope…</Loading>}
function formatRp(v:number){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v)}
function PageHeading({title,period}:{title:string;period?:string}){return <div className="page-heading"><div><h1>{title}</h1></div>{period&&<span className="overview-period">{new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(new Date(period+'-01T00:00:00Z'))}</span>}</div>}
function Metric({label,value,note,featured=false,currency=false,kind,onDetail,detailLabel}:{label:string;value:string|number;note:string;featured?:boolean;currency?:boolean;kind:MetricKind;onDetail:()=>void;detailLabel?:string}){const [open,setOpen]=useState(false);const tip=React.useId();const display=typeof value==='number'?compactNumber(value,currency):null;return <article className={'card metric '+(featured?'featured':'')}><MetricCorner kind={kind} onClick={onDetail} label={detailLabel||'Lihat rincian '+label}/><span>{label}</span>{display?<div className="metric-number" data-open={open}><button type="button" className="metric-value" aria-label={label+': '+display.short+' ('+display.full+')'} aria-describedby={tip} aria-expanded={open} onClick={()=>setOpen(x=>!x)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}><strong>{display.short}</strong></button><span id={tip} className="metric-full" role="tooltip">{display.full}</span></div>:<strong className="metric-placeholder">{value}</strong>}<small>{note}</small></article>}

function Shell({page,setPage,children}:{page:Page;setPage:(p:Page)=>void;children:React.ReactNode}){
 const {identity,logout,loggingOut}=useIdentity();
 const navigation=[{id:'overview' as Page,label:'Overview',icon:Binoculars,cap:'dashboard:read'},{id:'monitoring' as Page,label:'Monitoring',icon:ChartNoAxesCombined,cap:'dashboard:read'},{id:'incentives' as Page,label:'Insentif',icon:Receipt,cap:'dashboard:read'},{id:'customers' as Page,label:'Pelanggan',icon:Users,cap:'customers:read'},{id:'assignments' as Page,label:'Distribusi sales',icon:Network,cap:'customers:read'},{id:'map' as Page,label:'Peta & Wilayah',icon:MapPin,cap:'map:read'},{id:'products' as Page,label:'Produk & harga',icon:Package,cap:'customers:read'},{id:'invoices' as Page,label:'Invoice & actual',icon:Receipt,cap:'customers:read'},{id:'segmentation' as Page,label:'Status & tier',icon:Users,cap:'customers:read'},{id:'targets' as Page,label:'Target & pencapaian',icon:Target,cap:'dashboard:read'},{id:'work' as Page,label:'Aktivitas lapangan',icon:CalendarDays,cap:'customers:read'},{id:'commercial' as Page,label:'Pipeline & order',icon:ChartNoAxesCombined,cap:'customers:read'},{id:'telesales' as Page,label:'Telesales',icon:Phone,cap:'telesales:read'},{id:'observability' as Page,label:'Kesehatan sistem',icon:ChartNoAxesCombined,cap:'settings:manage'},{id:'recovery' as Page,label:'Recovery & retensi',icon:ShieldCheck,cap:'settings:manage'},{id:'settings' as Page,label:'Pengaturan',icon:SettingsIcon,cap:'settings:manage'},{id:'people' as Page,label:'User & Hirarki',icon:Users,cap:'settings:manage'},{id:'sessions' as Page,label:'Sesi perangkat',icon:ShieldCheck,cap:'dashboard:read'},{id:'data' as Page,label:'Import & duplikat',icon:Upload,cap:'settings:manage'}].filter(x=>identity.capabilities.includes(x.cap));
 const groups=[
  {id:'analytics',label:'Analitik',icon:Binoculars,pages:['overview','monitoring','incentives']},
  {id:'customers',label:'Pelanggan',icon:Users,pages:['customers','assignments','map']},
  {id:'sales',label:'Penjualan',icon:ChartNoAxesCombined,pages:['targets','invoices','commercial','products','segmentation']},
  {id:'activity',label:'Aktivitas',icon:CalendarDays,pages:['work','telesales']},
  {id:'manage',label:'Kelola',icon:SettingsIcon,pages:['people','settings','sessions','data','observability','recovery']}
 ].filter(g=>navigation.some(n=>g.pages.includes(n.id)));
 const group=groups.find(g=>g.pages.includes(page))??groups[0];

 const lastPages=React.useRef<Record<string,Page>>({});
 useEffect(()=>{if(group)lastPages.current[group.id]=page},[group?.id,page]);
 const initials=identity.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('');
 return <div className="app-shell"><svg className="glass-filter-definitions" width="0" height="0" aria-hidden="true" focusable="false"><defs><filter id="nyales-dock-refraction" x="-10%" y="-30%" width="120%" height="160%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.014 0.045" numOctaves="1" seed="8" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="smoothNoise"/><feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg><a className="skip-link" href="#workspace-main">Lewati navigasi ke konten</a><aside className="sidebar">
  <button className="brand brand-home" onClick={()=>setPage('overview')} aria-label="NYALES · Overview"><img src="/brand/nyales-mark.svg" alt=""/></button>
  <nav aria-label="Kelompok workspace">{groups.map(g=><button key={g.id} className={'rail-item '+(group?.id===g.id?'active':'')} aria-label={g.label} data-label={g.label} aria-current={group?.id===g.id?'true':undefined} onClick={()=>{const remembered=lastPages.current[g.id];const destination=navigation.find(n=>n.id===remembered&&g.pages.includes(n.id))||g.pages.map(id=>navigation.find(n=>n.id===id)).find(Boolean);if(destination)setPage(destination.id)}}><g.icon size={20}/><span className="rail-text" aria-hidden="true">{g.label}</span></button>)}</nav>
  <div className="rail-brand">NYALES</div>
 </aside><main id="workspace-main" tabIndex={-1} className="main-content">
  <header className="topbar"><LiquidNav key={group?.id} activeKey={page}>{navigation.filter(n=>group?.pages.includes(n.id)).sort((a,b)=>group.pages.indexOf(a.id)-group.pages.indexOf(b.id)).map(n=><WorkspaceNavButton key={n.id} active={page===n.id} label={n.label} onClick={()=>setPage(n.id)}><n.icon size={15} aria-hidden="true"/></WorkspaceNavButton>)}</LiquidNav>
   <div className="top-actions"><div className="profile"><span className="avatar" aria-hidden="true">{initials}</span><div><strong>{identity.name}</strong><small>{identity.role}</small></div></div><button className="button secondary logout-button" disabled={loggingOut} onClick={()=>void logout()}>{loggingOut?'Keluar…':'Keluar'}</button></div>
  </header>
  {identity.bekasi_demo_data&&<details className="demo-data-banner"><summary>{identity.bekasi_demo_ready?"DEMO · Simulasi operasi Bekasi (Agu–Okt 2026)":"DEMO · Simulasi Bekasi sedang dimuat"}</summary><p>{identity.bekasi_demo_ready?"Tim sales, outlet, kunjungan, tindak lanjut, order, invoice, dan target Bekasi sepenuhnya sintetis untuk portofolio; tidak mewakili kegiatan atau transaksi nyata. Target masih draft. Lokasi outlet tanpa GPS atau bukti kunjungan. Operasi DEMO ditampilkan sebagai overlay pada titik directory yang sudah ada sebagai referensi; tidak ada titik tambahan, koordinat DEMO, atau bukti GPS/kunjungan nyata.":"Data sintetis Bekasi sedang dimuat ke staging; angka pada halaman dapat belum lengkap. Record baru ditandai DEMO dan tidak mewakili kegiatan atau transaksi nyata. Lokasi tanpa GPS atau bukti kunjungan. Operasi DEMO ditampilkan sebagai overlay pada titik directory yang sudah ada sebagai referensi; tidak ada titik tambahan, koordinat DEMO, atau bukti GPS/kunjungan nyata."}</p></details>}

  <div className="page-scene" key={page} data-page={page}>{children}</div>
 </main></div>
}
function Overview(){const {data,error,reload}=useData<{period:string;actual_net_minor:number;target_net_minor:number|null;target_needs_review:boolean;achievement:number|null;active_customer_count:number|null;customer_status_unknown_count:number;observed_active_customer_count:number;sales_rep_count:number;trend:Array<{month:string;actual_minor:number;target_minor:number|null}>;channels:Array<{channel:string;actual_minor:number}>}>('/api/dashboard');return <><PageHeading title="Setiap target, lebih dekat." period={data?.period}/>{!data?<Feedback error={error} reload={reload}/>:<><div className="metric-grid"><Metric kind="sales" onDetail={()=>geoNavigate('invoices',{period:data.period})} featured label="Actual penjualan" currency value={data.actual_net_minor} note="Invoice net"/><Metric kind="target" onDetail={()=>geoNavigate('targets',{period:data.period})} label="Pencapaian target" value={data.achievement===null?'Belum tersedia':data.achievement.toLocaleString('id-ID',{maximumFractionDigits:2})+'%'} note={data.target_net_minor===null?'Target belum disahkan':data.target_needs_review?'Alokasi perlu ditinjau':'Target '+formatRp(data.target_net_minor)}/><Metric kind="customers" detailLabel={data.active_customer_count===null?'Lihat customer yang statusnya belum lengkap':'Lihat rincian Customer aktif'} onDetail={()=>geoNavigate('customers',{customer_status:data.active_customer_count===null?'Unknown':'Aktif'})} label="Customer aktif" value={data.active_customer_count??'Belum lengkap'} note={data.active_customer_count===null?data.customer_status_unknown_count+' status belum lengkap':'Transaksi dalam 90 hari terakhir'}/><Metric kind="workforce" onDetail={()=>{history.pushState(null,'','#'+new URLSearchParams({page:'monitoring',period:data.period,focus:'workforce'}));window.dispatchEvent(new PopStateEvent('popstate'))}} label="Sales bertransaksi" value={data.sales_rep_count} note="Sales unik per kanal"/></div><div className="content-grid"><SalesTrend trend={data.trend}/><ChannelContribution channels={data.channels} period={data.period}/></div><MapPanel/><RegionalSummary filters={{period:data.period}}/></>}</>}
function SalesTrend({trend}:{trend:Array<{month:string;actual_minor:number;target_minor:number|null}>}){
 const [range,setRange]=useState('6');const [selected,setSelected]=useState<string|null>(null);
 const data=trend.slice(-Number(range));
 const largest=Math.max(1,...data.map(x=>x.actual_minor));const magnitude=10**Math.floor(Math.log10(largest));
 const ceiling=Math.ceil(largest/magnitude)*magnitude;
 const chosen=data.find(x=>x.month===selected)||data.reduce((a,b)=>b.actual_minor>=a.actual_minor?b:a,data[0]);
 const gradient=React.useId().replace(/[^a-zA-Z0-9]/g,'');
 const monthLabel=(month:string)=>new Intl.DateTimeFormat('id-ID',{month:'short',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));
 const top=30,bottom=244,left=54,right=414;const plotWidth=right-left;const slot=plotWidth/Math.max(1,data.length);const barWidth=Math.min(42,slot*.62);
 const ticks=Array.from({length:5},(_,i)=>({value:ceiling*i/4,y:bottom-(bottom-top)*i/4}));
 return <section className="card chart-card sales-trend"><div className="sales-chart-header"><h2>Penjualan</h2><select value={range} onChange={e=>{setRange(e.target.value);setSelected(null)}} aria-label="Rentang grafik penjualan"><option value="6">6 bulan</option><option value="3">3 bulan</option></select></div><svg className="sales-chart-svg" viewBox="0 0 430 280" role="group" aria-label="Tren actual invoice enam bulan"><defs><linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#0D9488"/><stop offset="100%" stopColor="#A7E8DC"/></linearGradient></defs>{ticks.map((t,i)=><g key={i}><line x1={left} x2={right} y1={t.y} y2={t.y} stroke="#E1E2DE" strokeDasharray="4 5"/><text x={left-12} y={t.y+4} textAnchor="end" className="axis-label">{compactNumber(Math.round(t.value)).short}</text></g>)}{data.map((x,i)=>{
 const active=chosen?.month===x.month;const barX=left+slot*i+(slot-barWidth)/2;const height=x.actual_minor/ceiling*(bottom-top);const y=bottom-height;const middle=barX+barWidth/2;
 return <React.Fragment key={x.month}><g role="button" tabIndex={0} aria-label={monthLabel(x.month)+': '+formatRp(x.actual_minor)} aria-pressed={active} onMouseEnter={()=>setSelected(x.month)} onFocus={()=>setSelected(x.month)} onClick={()=>setSelected(x.month)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(x.month)}}} className="chart-column"><rect x={left+slot*i} y={top} width={slot} height={bottom-top+26} fill="transparent"/><rect x={barX} y={y} width={barWidth} height={Math.max(height,1)} rx="5" fill={active?`url(#${gradient})`:'#EEEEEC'}/><text x={middle} y={bottom+23} textAnchor="middle" className={'axis-label '+(active?'active-month':'')}>{monthLabel(x.month)}</text></g>{active&&<g role="tooltip" aria-hidden="true" className="chart-tooltip"><rect x={middle-36} y={Math.max(2,y-35)} width="72" height="25" rx="12.5" fill="#111111"/><path d={`M${middle-4} ${Math.max(2,y-35)+24}l4 5 4-5Z`} fill="#111111"/><text x={middle} y={Math.max(2,y-35)+17} textAnchor="middle" fill="#FFFFFF">{compactNumber(x.actual_minor).short}</text><circle cx={middle} cy={y+4} r="3" fill="#111111" stroke="#FFFFFF" strokeWidth="1"/></g>}</React.Fragment>
 })}</svg><details className="chart-data"><summary>Lihat data grafik</summary><div className="table-wrap"><table><thead><tr><th>Bulan</th><th className="number">Actual invoice</th></tr></thead><tbody>{data.map(x=><tr key={x.month}><td>{x.month}</td><td className="number">{formatRp(x.actual_minor)}</td></tr>)}</tbody></table></div></details></section>;
}

const pages:Page[]=['recovery','observability','incentives','monitoring','work','commercial','segmentation','targets','overview','customers','telesales','settings','people','sessions','data','assignments','map','products','invoices'];
function currentPage():Page{const value=new URLSearchParams(location.hash.slice(1)).get('page') as Page;return pages.includes(value)?value:'overview'}
// Keep the shell mounted for continuous navigation motion; reset only route content.
function App(){const [page,setPage]=useState<Page>(currentPage),[route,setRoute]=useState(location.hash);useEffect(()=>{const change=()=>{setPage(currentPage());setRoute(location.hash)};window.addEventListener('popstate',change);window.addEventListener('hashchange',change);return()=>{window.removeEventListener('popstate',change);window.removeEventListener('hashchange',change)}},[]);return <Shell page={page} setPage={p=>geoNavigate(p)}><React.Fragment key={route}>
{page==='recovery'?<Recovery/>:page==='observability'?<Observability/>:page==='monitoring'?<Monitoring/>:page==='incentives'?<Incentives/>:page==='overview'?<Overview/>:page==='customers'?<Customers/>:page==='segmentation'?<Segmentation/>:page==='targets'?<Targets/>:page==='work'?<FieldWork/>:page==='commercial'?<Commercial/>:page==='telesales'?<TelesalesWorkbench/>:page==='settings'?<Settings/>:page==='people'?<People/>:page==='sessions'?<Sessions/>:page==='assignments'?<Assignments/>:page==='map'?<MapPage/>:page==='products'?<Catalog/>:page==='invoices'?<Transactions/>:<DataTools/>}</React.Fragment></Shell>}
createRoot(document.getElementById('root')!).render(<AuthGate><App/></AuthGate>);
