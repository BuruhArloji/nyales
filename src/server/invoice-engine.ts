import {invoiceInput,creditInput,stableJson} from '../shared/invoices';
import {digest,fail} from './operations';
export type FinancePayload={source_system:string;source_cutoff:string;invoices:any[];credit_notes:any[];errors?:any[]};
export type FinancePlan={invoices:any[];credits:any[];events:any[];errors:any[];summary:any};
export async function epoch(db:D1Database,org:string){return (await db.prepare('SELECT epoch FROM finance_epoch WHERE organization_id=?').bind(org).first<{epoch:number}>())?.epoch||0}
const ids=(rows:any[],key:string)=>JSON.stringify([...new Set(rows.map(r=>r[key]).filter(Boolean))]);
function at(row:any,date:string){return row.effective_from_date<=date&&(!row.effective_to_date||row.effective_to_date>date)}
function sum(values:number[]){const value=values.reduce((a,v)=>a+BigInt(v),0n);if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER))fail(422,'TOTAL_EXCEEDS_SAFE_INTEGER');return Number(value)}
export async function validateInvoices(db:D1Database,org:string,date:string,p:FinancePayload,jobId:string,manual=false):Promise<FinancePlan>{
 const errors:any[]=[...(p.errors||[])],inputs:any[]=[],creditsIn:any[]=[];
 p.invoices.forEach((raw,i)=>{const {_row,...body}=raw;const v=invoiceInput.safeParse(body);if(v.success)inputs.push({...v.data,_row:_row||i+1});else errors.push({row_no:_row||i+1,kind:'invoice',key:raw.source_invoice_id||'',errors:v.error.issues.map(x=>x.path.join('.')+': '+x.message)})});
 p.credit_notes.forEach((raw,i)=>{const {_row,...body}=raw;const v=creditInput.safeParse(body);if(v.success)creditsIn.push({...v.data,_row:_row||i+1});else errors.push({row_no:_row||i+1,kind:'credit',key:raw.source_credit_id||'',errors:v.error.issues.map(x=>x.path.join('.')+': '+x.message)})});
 const touched=JSON.stringify([...new Set([...inputs.map(x=>x.source_invoice_id),...creditsIn.map(x=>x.source_invoice_id)])]);
 const current=(await db.prepare('SELECT * FROM invoice WHERE organization_id=? AND source_system=? AND COALESCE(external_invoice_id,source_invoice_id) IN(SELECT value FROM json_each(?)) AND is_current=1').bind(org,p.source_system,touched).all<any>()).results;
 const customers=(await db.prepare(`WITH picked AS(SELECT COALESCE(merged_into_id,id) id FROM customer_outlet WHERE organization_id=? AND (id IN(SELECT value FROM json_each(?)) OR UPPER(TRIM(external_code)) IN(SELECT value FROM json_each(?)))) SELECT co.* FROM customer_outlet co WHERE co.organization_id=? AND (co.id IN(SELECT id FROM picked) OR co.merged_into_id IN(SELECT id FROM picked))`).bind(org,JSON.stringify([...inputs.map(x=>x.customer_id),...current.map(x=>x.outlet_id)].filter(Boolean)),JSON.stringify(inputs.map(x=>x.source_customer_code?.toUpperCase()).filter(Boolean)),org).all<any>()).results;
 const results=await Promise.all([
  db.prepare('SELECT * FROM invoice_line WHERE organization_id=? AND invoice_id IN(SELECT value FROM json_each(?))').bind(org,ids(current,'id')).all<any>(),
  db.prepare('SELECT * FROM credit_note WHERE organization_id=? AND source_system=? AND (source_invoice_id IN(SELECT value FROM json_each(?)) OR source_credit_id IN(SELECT value FROM json_each(?)))').bind(org,p.source_system,touched,ids(creditsIn,'source_credit_id')).all<any>(),
  db.prepare('SELECT * FROM invoice_source_event WHERE organization_id=? AND source_system=? AND external_invoice_id IN(SELECT value FROM json_each(?))').bind(org,p.source_system,touched).all<any>(),
  db.prepare('SELECT * FROM customer_assignment WHERE organization_id=? AND outlet_id IN(SELECT value FROM json_each(?))').bind(org,ids(customers,'id')).all<any>(),
  db.prepare('SELECT * FROM customer_territory_transfer WHERE organization_id=? AND outlet_id IN(SELECT value FROM json_each(?))').bind(org,ids(customers,'id')).all<any>(),
  db.prepare('SELECT * FROM auth_role_assignment WHERE organization_id=?').bind(org).all<any>(),
  db.prepare('SELECT * FROM user_area_scope WHERE organization_id=?').bind(org).all<any>(),
  db.prepare('SELECT id FROM app_user WHERE organization_id=?').bind(org).all<any>(),
  db.prepare('SELECT id FROM area WHERE organization_id=?').bind(org).all<any>(),
  db.prepare('SELECT * FROM product WHERE organization_id=? AND (id IN(SELECT value FROM json_each(?)) OR sku IN(SELECT value FROM json_each(?)))').bind(org,JSON.stringify(inputs.flatMap(i=>i.lines.map((l:any)=>l.product_id)).filter(Boolean)),JSON.stringify(inputs.flatMap(i=>i.lines.map((l:any)=>l.sku?.toUpperCase())).filter(Boolean))).all<any>()
 ]);
 const [oldLines,oldCredits,sourceEvents,assignments,transfers,roles,scopes,users,areas,products]=results.map(x=>x.results);
 const out:FinancePlan={invoices:[],credits:[],events:[],errors,summary:{currency:'IDR',currency_exponent:0,before_minor:0,after_minor:0,delta_minor:0,field_minor:0,telesales_minor:0,noops:0}};
 const error=(kind:string,row:any,message:string)=>errors.push({row_no:row._row||0,kind,key:row.source_credit_id||row.source_invoice_id,errors:[message]});
 // Merge latest credit versions in memory; historical IDs cannot move to another invoice.
 const latest=oldCredits.filter(c=>c.is_current===1),creditChanges=new Set<string>(),seenCredits=new Map<string,string>();
 for(const raw of creditsIn){const {_row,...body}=raw,key=raw.source_credit_id,rawHash=await digest(stableJson(body));if(seenCredits.has(key)){if(seenCredits.get(key)===rawHash)out.summary.noops++;else error('credit',raw,'ID credit berulang dengan payload berbeda di batch.');continue}seenCredits.set(key,rawHash);if(raw.credit_date>date){error('credit',raw,'Tanggal credit melampaui cut-off bisnis.');continue}
  const hash=await digest(stableJson(body)),event=oldCredits.find(c=>c.source_credit_id===key&&c.source_version===raw.source_version),prior=latest.find(c=>c.source_credit_id===key);
  if(event){if(event.payload_hash!==hash)error('credit',raw,'Versi credit yang sama membawa payload berbeda.');else out.summary.noops++;continue}
  if(prior&&(prior.source_invoice_id!==raw.source_invoice_id||BigInt(raw.source_version)<=BigInt(prior.source_version))){error('credit',raw,'Referensi invoice credit tetap; versi baru harus lebih besar.');continue}
  if(!current.some(i=>(i.external_invoice_id||i.source_invoice_id)===raw.source_invoice_id)&&!inputs.some(i=>i.source_invoice_id===raw.source_invoice_id)){error('credit',raw,'Invoice asal credit belum terdaftar pada sumber yang sama.');continue}
  const next={...body,id:jobId+':c:'+out.credits.length,previous_id:prior?.id||null,payload_hash:hash,is_current:1};out.credits.push(next);if(prior)latest.splice(latest.indexOf(prior),1);latest.push(next);creditChanges.add(raw.source_invoice_id);
 }
 const seen=new Map<string,string>(),changedHeaders=new Map<string,any>();
 for(const raw of inputs){const key=raw.source_invoice_id;
  const {_row,...body}=raw;body.lines.sort((a:any,b:any)=>a.source_line_id<b.source_line_id?-1:a.source_line_id>b.source_line_id?1:0);const hash=await digest(stableJson(body));if(seen.has(key)){if(seen.get(key)===hash)out.summary.noops++;else error('invoice',raw,'Header invoice berulang dengan payload berbeda; jangan ulang header per SKU.');continue}seen.set(key,hash);const event=sourceEvents.find(e=>e.external_invoice_id===key&&e.source_version===raw.source_version),before=current.find(i=>(i.external_invoice_id||i.source_invoice_id)===key);
  if(event){if(event.payload_hash!==hash)error('invoice',raw,'Versi invoice yang sama membawa payload berbeda.');else out.summary.noops++;continue}
  const version=before?.origin_source_version||before?.source_version;if(before&&(!/^[1-9]\d*$/.test(version)?!(manual&&before.source_system==='legacy'):BigInt(raw.source_version)<=BigInt(version))){error('invoice',raw,'Versi invoice harus meningkat; snapshot legacy perlu versi sumber baru.');continue}
  if(raw.source_updated_at&&Date.parse(raw.source_updated_at)>Date.parse(p.source_cutoff)){error('invoice',raw,'Waktu pembaruan sumber melampaui cutoff.');continue}
  if(raw.invoice_date>date){error('invoice',raw,'Tanggal invoice melampaui cut-off bisnis.');continue}
  const candidates=customers.filter(c=>raw.customer_id?c.id===raw.customer_id:c.external_code?.trim().toUpperCase()===raw.source_customer_code?.toUpperCase());
  if(candidates.length!==1){error('invoice',raw,'Customer tidak ditemukan atau kode ambigu; review mapping.');continue}
  const physical=candidates[0],canonical=physical.merged_into_id||physical.id,co=customers.find(c=>c.id===canonical);if(!co){error('invoice',raw,'Customer kanonik tidak tersedia.');continue}
  if(raw.customer_id&&raw.source_customer_code&&physical.external_code?.trim().toUpperCase()!==raw.source_customer_code.toUpperCase()){error('invoice',raw,'ID dan kode customer tidak cocok.');continue}
  const family=customers.filter(c=>c.id===canonical||c.merged_into_id===canonical).map(c=>c.id),history=transfers.filter(t=>family.includes(t.outlet_id)).sort((a,b)=>a.effective_from_date<b.effective_from_date?-1:1),priorMoves=history.filter(t=>t.effective_from_date<=raw.invoice_date);
  const latestDate=priorMoves.at(-1)?.effective_from_date,areaCandidates=new Set(priorMoves.filter(t=>t.effective_from_date===latestDate).map(t=>t.to_area_id));if(areaCandidates.size>1){error('invoice',raw,'Histori area ambigu pada tanggal invoice.');continue}
  const area=priorMoves.at(-1)?.to_area_id||history[0]?.from_area_id||co.area_id;
  if(!areas.some(a=>a.id===area)||raw.area_id&&raw.area_id!==area){error('invoice',raw,'Area invoice berbeda dari territory pada tanggal invoice.');continue}
  const owners=assignments.filter(a=>family.includes(a.outlet_id)&&a.channel===raw.channel&&at(a,raw.invoice_date)&&a.rep_id),ownerIds=[...new Set(owners.map(o=>o.rep_id))];
  if(ownerIds.length>1){error('invoice',raw,'Lebih dari satu PIC pada tanggal invoice.');continue}
  const rep=raw.source_rep_id||ownerIds[0];if(!rep){error('invoice',raw,'Sales Rep tidak tersedia; tidak ada assignment tanggal invoice.');continue}
  if(raw.source_rep_id&&ownerIds.length&&ownerIds[0]!==rep){error('invoice',raw,'Rep dari sumber bertentangan dengan assignment; review atribusi.');continue}
  if(owners.some(o=>o.area_id&&o.area_id!==area)){error('invoice',raw,'Area assignment tidak sama dengan area historis invoice.');continue}
  if(!users.some(u=>u.id===rep)||!roles.some(r=>r.user_id===rep&&r.role_code===(raw.channel==='field'?'SALES_REP':'TELESALES')&&r.channel===raw.channel&&at(r,raw.invoice_date))||!scopes.some(a=>a.user_id===rep&&a.area_id===area&&at(a,raw.invoice_date))){error('invoice',raw,'Role/kanal/area Rep tidak valid pada tanggal invoice.');continue}
  const lines:any[]=[],lineIds=new Set<string>();let invalid=false;
  for(const l of body.lines){const product=products.find(p=>l.product_id?p.id===l.product_id:p.sku===l.sku?.toUpperCase());if(!product||l.sku&&product.sku!==l.sku.toUpperCase()||product.base_unit!==l.unit_code||product.quantity_scale!==l.quantity_scale||lineIds.has(l.source_line_id)){invalid=true;break}lineIds.add(l.source_line_id);const historical=oldLines.find(old=>old.invoice_id===before?.id&&old.source_line_id===l.source_line_id&&old.product_id===product.id);lines.push({...l,product_id:product.id,sku_snapshot:product.sku,product_name_snapshot:historical?historical.product_name_snapshot:product.name,product_group_id_snapshot:historical?historical.product_group_id_snapshot:product.product_group_id,group_code_snapshot:historical?historical.group_code_snapshot:product.group_code,group_snapshot_known:historical?historical.group_snapshot_known:product.product_group_id?1:0})}
  if(invalid||lines.length&&sum(lines.map(l=>l.net_minor))!==raw.net_minor){error('invoice',raw,'Line: SKU/unit/scale/ID harus valid dan jumlah net line tepat sama net header.');continue}
  const record={key,id:jobId+':i:'+out.invoices.length,source_invoice_id:before?.source_invoice_id||stableJson([p.source_system,key]),external_invoice_id:key,origin_source_version:raw.source_version,source_updated_at:raw.source_updated_at||p.source_cutoff,previous_revision_id:before?.id||null,revision_no:(before?.revision_no||0)+1,source_net_minor:raw.net_minor,net_includes_credit:raw.net_includes_credit?1:0,outlet_id:physical.id,rep_id:rep,area_id:area,channel:raw.channel,invoice_date:raw.invoice_date,currency:'IDR',status:raw.status,validation_state:'validated',reason:manual?'Manual revision':'Source import',attribution_basis:raw.source_rep_id?'source_rep':'dated_assignment',assignment_snapshot_json:stableJson(owners),lines,credits:[],net_minor:raw.net_minor};
  changedHeaders.set(key,record);out.invoices.push(record);out.events.push({external_invoice_id:key,source_version:raw.source_version,payload_hash:hash,payload_json:stableJson(body),invoice_id:record.id});
 }
 for(const key of creditChanges){if(changedHeaders.has(key))continue;const before=current.find(i=>(i.external_invoice_id||i.source_invoice_id)===key);if(!before)continue;
  if(before.net_includes_credit){error('credit',{source_invoice_id:key},'Net sumber sudah termasuk credit: kirim versi header net baru bersama perubahan credit agar tidak mengurangi dua kali.');continue}
  const copy={...before,key,id:jobId+':i:'+out.invoices.length,previous_revision_id:before.id,revision_no:before.revision_no+1,lines:oldLines.filter(l=>l.invoice_id===before.id),credits:[],reason:'Credit revision',source_net_minor:before.source_net_minor??before.net_minor};out.invoices.push(copy);
 }
 for(const record of out.invoices){const credits=latest.filter(c=>c.source_invoice_id===record.key&&c.status==='validated');if(credits.some(c=>c.credit_date<record.invoice_date)){error('credit',{source_invoice_id:record.key},'Tanggal credit tidak boleh sebelum invoice asal.');continue}const total=sum(credits.map(c=>c.amount_minor));record.credits=credits.map(c=>({id:c.id,amount_minor:c.amount_minor}));record.net_minor=record.source_net_minor-(record.net_includes_credit?0:total);if(record.net_minor<0)error('invoice',{source_invoice_id:record.key},'Credit melebihi net sumber; perlu rekonsiliasi.');const before=current.find(i=>(i.external_invoice_id||i.source_invoice_id)===record.key);out.summary.before_minor+=before?.status==='validated'&&before.validation_state==='validated'?before.net_minor:0;const eligible=record.status==='validated'?Math.max(0,record.net_minor):0;out.summary.after_minor+=eligible;out.summary[record.channel==='field'?'field_minor':'telesales_minor']+=eligible}
 // An invoice header was invalid while its credits were otherwise valid: strict commit still blocks the entire batch.
 out.summary.delta_minor=out.summary.after_minor-out.summary.before_minor;
 for(const value of Object.values(out.summary))if(typeof value==='number'&&!Number.isSafeInteger(value))fail(422,'TOTAL_EXCEEDS_SAFE_INTEGER');
 return out;
}
