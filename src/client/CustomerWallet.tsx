import {useEffect,useRef,useState} from 'react';
import {apiFetch} from './auth';
import {renderMapWallet} from './map-wallet';

export function CustomerWallet({customerId,channel,period}:{customerId:string;channel?:string;period?:string}){
 const host=useRef<HTMLDivElement>(null),[status,setStatus]=useState('Memuat wallet…');
 useEffect(()=>{
  const controller=new AbortController();setStatus('Memuat wallet…');
  const params=new URLSearchParams();if(channel)params.set('channel',channel);if(period)params.set('period',period);
  void apiFetch('/api/customers/'+encodeURIComponent(customerId)+'/wallet?'+params,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw Error('WALLET_UNAVAILABLE');const result=await response.json()as any;
   if(!controller.signal.aborted&&host.current){renderMapWallet(host.current,result.data);setStatus('')}
  }).catch(()=>{if(!controller.signal.aborted)setStatus('Wallet belum tersedia.')});
  return()=>controller.abort();
 },[customerId,channel,period]);
 return <section className="customer-wallet-detail" aria-label="Wallet pelanggan"><div ref={host}/>{status&&<small role="status">{status}</small>}</section>;
}
