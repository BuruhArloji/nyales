import React,{useEffect,useRef} from 'react';

export function Modal({title,busy,onClose,children,className=''}:{title:string;busy:boolean;onClose:()=>void;children:React.ReactNode;className?:string}){
 const ref=useRef<HTMLDialogElement>(null);
 const heading=React.useId();
 useEffect(()=>{const dialog=ref.current;const previous=document.activeElement;dialog?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement)previous.focus()}},[]);
 function trapFocus(e:React.KeyboardEvent<HTMLDialogElement>){
  if(e.key!=='Tab')return;
  const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.closest('fieldset:disabled'));
  const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();e.currentTarget.focus();return}
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
 return <dialog ref={ref} tabIndex={-1} onKeyDown={trapFocus} className={'app-dialog '+className} aria-labelledby={heading} aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><header className="app-dialog-header"><h2 id={heading}>{title}</h2><button type="button" className="icon-button" aria-label="Tutup popup" disabled={busy} onClick={onClose}>×</button></header><div className="app-dialog-body">{children}</div></dialog>;
}
