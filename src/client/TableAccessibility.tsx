import {useEffect} from 'react';

/** Keep wide data tables reachable by keyboard without adding stops to fitting tables. */
export function TableAccessibility(){
 useEffect(()=>{
  let frame=0;
  const observed=new Set<HTMLElement>();
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)};
  const resize=new ResizeObserver(schedule);
  function update(){
   for(const el of observed)if(!el.isConnected){resize.unobserve(el);observed.delete(el)}
   document.querySelectorAll<HTMLElement>('.table-wrap').forEach(el=>{
    if(!observed.has(el)){observed.add(el);resize.observe(el)}
    const overflowing=el.scrollWidth>el.clientWidth+2;
    if(overflowing&&!el.hasAttribute('tabindex')){
     el.tabIndex=0;el.dataset.keyboardScroll='true';
     if(!el.hasAttribute('role')){el.setAttribute('role','region');el.dataset.keyboardScrollRole='true'}
     if(!el.hasAttribute('aria-label')){
      const title=el.querySelector('caption')?.textContent||el.closest('section,article,dialog')?.querySelector('h2,h3')?.textContent;
      el.setAttribute('aria-label',title?'Tabel '+title.trim():'Tabel data');el.dataset.keyboardScrollLabel='true';
     }
    }else if(!overflowing&&el.dataset.keyboardScroll==='true'){
     el.removeAttribute('tabindex');if(el.dataset.keyboardScrollRole==='true')el.removeAttribute('role');if(el.dataset.keyboardScrollLabel==='true')el.removeAttribute('aria-label');delete el.dataset.keyboardScroll;delete el.dataset.keyboardScrollRole;delete el.dataset.keyboardScrollLabel;
    }
   });
  }
  const mutation=new MutationObserver(schedule);mutation.observe(document.body,{childList:true,subtree:true});schedule();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect()};
 },[]);
 return null;
}
