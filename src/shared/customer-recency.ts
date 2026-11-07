/** A recent validated invoice proves activity even when older history is unknown.
 * Absence of an invoice alone never proves churn or a newly acquired customer. */
export function effectiveCustomerStatus(last:string|null|undefined,cutoff:string,stored='Unknown'){
 const age=last?Math.floor((Date.parse(cutoff)-Date.parse(last))/86400000):NaN;
 return Number.isFinite(age)&&age>=0&&age<=90?'Aktif':stored;
}
