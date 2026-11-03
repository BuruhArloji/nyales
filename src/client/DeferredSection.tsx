import React,{useEffect,useRef,useState} from 'react';
/** Mount expensive below-the-fold widgets once, only when approaching the viewport. */
export function DeferredSection({children,label}:{children:React.ReactNode;label:string}){
 const host=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{if(!host.current)return;if(!('IntersectionObserver' in window)){setVisible(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'160px'});observer.observe(host.current);return()=>observer.disconnect()},[]);
 return <div ref={host} style={{minHeight:visible?undefined:160}}>{visible?<React.Suspense fallback={<p role="status">Memuat {label}…</p>}>{children}</React.Suspense>:<p className="muted">{label}</p>}</div>;
}
