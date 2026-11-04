/** Presentation only: source keys remain intact for reconciliation and revisions. */
export function presentationLabel(value:unknown):string {
 return String(value??'').replace(/(?:\s*[·•|—–\uFFFD]\s*)?\bDEMO\b(?:\s*[·•|—–\uFFFD]\s*)?/gi,' ')
  .replace(/\s{2,}/g,' ').replace(/^[\s·•|—–]+|[\s·•|—–]+$/g,'').trim();
}

export function invoiceLabel(value:unknown):string {
 const text=String(value??'');
 const beverage=/^beverage-demo-v1-sale-(\d+)$/.exec(text);
 if(beverage)return `INV/2611/${beverage[1].padStart(6,'0')}`;
 const bekasi=/^DEMO-BKS-(\d{6})-(\d+)$/.exec(text);
 return bekasi?`INV/${bekasi[1].slice(2)}/${bekasi[2].padStart(6,'0')}`:text;
}
