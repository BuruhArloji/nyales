import React from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

type PaginationProps={
 label?:string;page:number;pageCount?:number;total?:number;pageSize?:number;itemLabel?:string;
 busy?:boolean;hasPrevious?:boolean;hasNext?:boolean;onPrevious:()=>void;onNext:()=>void;
 children?:React.ReactNode;compact?:boolean;
};

/** One layout for indexed and cursor-backed lists. The parent owns page data. */
export function Pagination({label='Navigasi halaman',page,pageCount,total,pageSize,itemLabel='data',busy=false,hasPrevious,hasNext,onPrevious,onNext,children,compact=false}:PaginationProps){
 const current=Math.max(0,page),pages=pageCount===undefined?undefined:Math.max(1,pageCount);
 const previous=hasPrevious??current>0,next=hasNext??(pages!==undefined&&current+1<pages);
 const count=total===undefined?null:Math.max(0,total);
 const range=count===null||!pageSize?null:count===0?'0':`${Math.min(current*pageSize+1,count).toLocaleString('id-ID')}–${Math.min((current+1)*pageSize,count).toLocaleString('id-ID')}`;
 return <nav className={'pagination'+(compact?' pagination--compact':'')} aria-label={label} aria-busy={busy}>
  <div className="pagination-summary" role="status" aria-live="polite">
   {count!==null&&<span>{range?range+' dari ':''}{count.toLocaleString('id-ID')} {itemLabel}</span>}
   <span>Halaman {current+1}{pages!==undefined?' dari '+pages.toLocaleString('id-ID'):''}</span>
  </div>
  <div className="pagination-controls">
   {children&&<div className="pagination-options">{children}</div>}
   <div className="pagination-buttons">
    <button type="button" className="button secondary pagination-button" disabled={busy||!previous} onClick={onPrevious}><ChevronLeft size={16} aria-hidden="true"/><span>Sebelumnya</span></button>
    <button type="button" className="button secondary pagination-button" disabled={busy||!next} onClick={onNext}><span>Berikutnya</span><ChevronRight size={16} aria-hidden="true"/></button>
   </div>
  </div>
 </nav>;
}
