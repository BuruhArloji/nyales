import {useEffect,useState}from'react';
import{apiFetch}from'./auth';
import{Loading}from'./Loading';
import{Modal}from'./Modal';

export function StreetView({customer,onClose}:{customer:{id:string;name:string;lat:number;lng:number};onClose:()=>void}){
 const[url,setUrl]=useState(''),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;void apiFetch('/api/observability/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'street_view_open'})}).catch(()=>{});apiFetch('/api/customers/'+encodeURIComponent(customer.id)+'/street-view').then(async r=>{const json=await r.json() as any;if(!r.ok)throw Error(json.detail||'Street View belum dapat dimuat.');if(active)setUrl(json.data.embed_url)}).catch(()=>{if(active)setError('Street View belum dapat dimuat. Periksa konfigurasi atau coba buka di Google Maps.')});return()=>{active=false}},[customer.id]);
 const external='https://www.google.com/maps/@?'+new URLSearchParams({api:'1',map_action:'pano',viewpoint:customer.lat+','+customer.lng});
 return <Modal title={'Street View · '+customer.name} className="street-view-dialog" busy={false} onClose={onClose}>
  <p className="street-view-note">Panorama terdekat dari Google. Foto dapat sudah lama dan belum tentu menghadap tepat ke customer.</p>
  {error?<p role="alert" className="notice danger">{error}</p>:<div className="street-view-frame">{!loaded&&<Loading>Memuat panorama…</Loading>}{url&&<iframe title={'Panorama Street View '+customer.name} src={url} referrerPolicy="strict-origin-when-cross-origin" allowFullScreen onLoad={()=>setLoaded(true)} onError={()=>setError('Panorama gagal dimuat. Coba buka di Google Maps.')}/>}</div>}
  <div className="street-view-actions"><span>Jika panorama tidak tersedia atau Google menampilkan kendala akses:</span><a className="button secondary" href={external} target="_blank" rel="noopener noreferrer">Buka di Google Maps ↗</a></div>
 </Modal>;
}
