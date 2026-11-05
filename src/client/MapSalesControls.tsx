import React from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {LiquidTabs} from './LiquidNav';
import {salesMapLevels,type SalesMapLevel} from '../shared/map-sales';
export function MapSalesControls({open,level,onChange}:{open:boolean;level:SalesMapLevel;onChange:(level:SalesMapLevel)=>void}){
 const reduced=useReducedMotion();
 return <motion.div className="map-sales-reveal" initial={false} animate={{width:open?'auto':0,opacity:open?1:0}} transition={reduced?{duration:0}:{type:'spring',stiffness:420,damping:38,mass:.85}} aria-hidden={!open} inert={!open}>
  <LiquidTabs role="group" aria-label="Hirarki pewarnaan sales">{Object.entries(salesMapLevels).map(([key,label])=><button type="button" key={key} className={'button '+(level===key?'':'secondary')} aria-pressed={level===key} onClick={()=>onChange(key as SalesMapLevel)}>{label}</button>)}</LiquidTabs>
 </motion.div>;
}
