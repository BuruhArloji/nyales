import React, {useLayoutEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';

const navigationSpring={type:'spring' as const,stiffness:420,damping:38,mass:.85};

// Sliding motion adapted from Uiverse.io by gleydson_9898.
// Measure real labels so the motion supports variable-width, scrollable navigation.
function useIndicator<T extends HTMLElement>(dependency:unknown,selector:string){
 const ref=useRef<T>(null);
 const [box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 useLayoutEffect(()=>{
  const nav=ref.current;if(!nav)return;
  let alive=true;
  const measure=()=>{
   const selected=nav.querySelector<HTMLElement>(selector);
   if(!alive)return;if(!selected){setBox(null);return;}
   const next={x:selected.offsetLeft,y:selected.offsetTop,width:selected.offsetWidth,height:selected.offsetHeight};
   setBox(previous=>previous&&Object.keys(next).every(key=>previous[key as keyof typeof next]===next[key as keyof typeof next])?previous:next);
  };
  measure();
  const observer=new ResizeObserver(measure);observer.observe(nav);
  nav.querySelectorAll('button').forEach(button=>observer.observe(button));
  void document.fonts.ready.then(measure);
  return()=>{alive=false;observer.disconnect()};
 },[dependency,selector]);
 return {ref,box};
}
function Indicator({box}:{box:{x:number;y:number;width:number;height:number}|null}){const reduced=useReducedMotion();return box?<motion.span className="liquid-slider" data-spring="true" aria-hidden="true" initial={false} animate={{x:box.x,y:box.y,width:box.width,height:box.height}} transition={reduced?{duration:0}:navigationSpring}/>:null}
export function LiquidNav({activeKey,children}:{activeKey:string;children:React.ReactNode}){
 const ref=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const nav=ref.current;if(!nav)return;
  let frame=0;
  const reveal=()=>{const nav=ref.current,selected=nav?.querySelector<HTMLElement>('[aria-current="page"]');if(!nav||!selected)return;const outer=nav.getBoundingClientRect(),inner=selected.getBoundingClientRect(),left=outer.left+nav.clientLeft+4,right=outer.left+nav.clientLeft+nav.clientWidth-4;const delta=inner.left<left?inner.left-left:inner.right>right?inner.right-right:0;if(delta)nav.scrollLeft+=delta;};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(reveal)};
  const observer=new ResizeObserver(schedule);observer.observe(nav);nav.querySelectorAll('button').forEach(button=>observer.observe(button));
  schedule();return()=>{cancelAnimationFrame(frame);observer.disconnect()};
 },[activeKey]);
 return <nav ref={ref} className="workspace-tabs glass-card liquid-nav workspace-compact" aria-label="Halaman workspace" data-active={activeKey}>
  {children}
 </nav>;
}

export function WorkspaceNavButton({active,label,onClick,children}:{active:boolean;label:string;onClick:()=>void;children:React.ReactNode}){
 const labelRef=useRef<HTMLSpanElement>(null),reducedMotion=useReducedMotion();
 const [labelWidth,setLabelWidth]=useState(0);
 useLayoutEffect(()=>{
  const node=labelRef.current;if(!node)return;let alive=true;
  const measure=()=>{if(alive)setLabelWidth(node.getBoundingClientRect().width)};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);void document.fonts.ready.then(measure);
  return()=>{alive=false;observer.disconnect()};
 },[label]);
 const spring=reducedMotion?{duration:0}:navigationSpring;
 return <motion.button type="button" className={active?'active':''} aria-label={label} title={active?undefined:label} aria-current={active?'page':undefined} onClick={onClick} initial={false} animate={{width:active?52+labelWidth:44}} transition={{width:spring,scale:spring}} whileTap={reducedMotion?undefined:{scale:.96}}>
  {children}
  <motion.span ref={labelRef} className="workspace-label" aria-hidden="true" initial={false} animate={{opacity:active?1:0,x:active?0:-4}} transition={{x:spring,opacity:{duration:reducedMotion?0:(active ? .18 : .12),ease:'easeOut'}}}>{label}</motion.span>
 </motion.button>;
}

export function LiquidTabs({children,className='settings-tabs',...props}:React.ComponentProps<'div'>){
 const {ref,box}=useIndicator<HTMLDivElement>(children,'button[aria-selected="true"],button[aria-pressed="true"],button.button:not(.secondary)');
 useLayoutEffect(()=>{if(props.role!=='tablist')return;ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach(tab=>{tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1})},[children,props.role]);
 function onKeyDown(event:React.KeyboardEvent<HTMLDivElement>){
  props.onKeyDown?.(event);if(event.defaultPrevented||props.role!=='tablist')return;
  const tabs=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')||[]),index=tabs.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
  let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
  event.preventDefault();tabs[next].focus();tabs[next].click();
 }
 return <div {...props} aria-label={props['aria-label']||(props.role==='tablist'?'Pilihan tampilan':undefined)} onKeyDown={onKeyDown} ref={ref} className={className+' liquid-tabs'} data-ready={box!==null}><Indicator box={box}/>{children}</div>;
}

