/** Presentation only: source keys remain intact for reconciliation and revisions. */
export function presentationLabel(value:unknown):string {
 return String(value??'').replace(/\s*[·•|—–]?\s*penempatan awal sumber\b/gi,'').replace(/(?:\s*[·•|—–\uFFFD]\s*)?\bDEMO\b(?:\s*[·•|—–\uFFFD]\s*)?/gi,' ')
  .replace(/\s{2,}/g,' ').replace(/^[\s·•|—–]+|[\s·•|—–]+$/g,'').trim();
}

export function invoiceLabel(value:unknown):string {
 const text=String(value??'');
 const beverage=/^beverage-demo-v1-sale-(\d+)$/.exec(text);
 if(beverage)return `INV/2611/${beverage[1].padStart(6,'0')}`;
 const bekasi=/^DEMO-BKS-(\d{6})-(\d+)$/.exec(text);
 return bekasi?`INV/${bekasi[1].slice(2)}/${bekasi[2].padStart(6,'0')}`:text;
}

/** Directory relationship label only; never changes segmentation or coordinate evidence. */
export function customerRelationshipLabel(row:{has_invoice_history?:boolean;last?:unknown;[key:string]:unknown}):string {
 return row.has_invoice_history===true||/^\d{4}-\d{2}-\d{2}/.test(String(row.last??''))?'Pernah bertransaksi':'Leads';
}
