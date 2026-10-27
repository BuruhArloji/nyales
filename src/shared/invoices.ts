import {z} from 'zod';
export const money=z.number().int().min(0).max(1000000000000);
const id=z.string().trim().min(1).max(128);
export const sourceVersion=z.string().regex(/^[1-9]\d{0,14}$/,'Versi sumber harus bilangan bulat positif, naik setiap revisi.');
export const lineInput=z.object({source_line_id:id,product_id:id.optional(),sku:id.optional(),quantity_scaled:z.number().int().min(0).max(1000000000000),quantity_scale:z.number().int().min(1).max(1000000),unit_code:z.string().trim().min(1).max(32),net_minor:money}).strict().refine(l=>Boolean(l.product_id||l.sku),{message:'product_id atau SKU wajib.'});
export const invoiceInput=z.object({source_invoice_id:id,source_version:sourceVersion,customer_id:id.optional(),source_customer_code:id.optional(),invoice_date:z.iso.date(),currency:z.literal('IDR'),channel:z.enum(['field','telesales']),source_rep_id:id.optional(),area_id:id.optional(),status:z.enum(['validated','draft','cancelled']),net_minor:money,net_includes_credit:z.boolean(),source_updated_at:z.iso.datetime().optional(),lines:z.array(lineInput).max(100).default([])}).strict().refine(i=>Boolean(i.customer_id||i.source_customer_code),{message:'Customer ID atau kode customer wajib.'});
export const creditInput=z.object({source_credit_id:id,source_invoice_id:id,source_version:sourceVersion,credit_date:z.iso.date(),amount_minor:money,status:z.enum(['validated','cancelled'])}).strict();
export {invoiceCsvFields} from './invoice-fields';
import {invoiceCsvFields} from './invoice-fields';
export type InvoiceInput=z.infer<typeof invoiceInput>;
export type CreditInput=z.infer<typeof creditInput>;
export function stableJson(value:any):string{if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stableJson(value[k])).join(',')+'}';return JSON.stringify(value)}
export function invoiceCsv(parsed:{headers:string[];rows:{line:number;values:string[]}[]},mapping:Record<string,string>){
 const errors:any[]=[],invoices:any[]=[],credit_notes:any[]=[],lines:any[]=[];const get=(v:string[],key:string)=>mapping[key]?v[parsed.headers.indexOf(mapping[key])]?.trim()||'':'';const number=(s:string)=>/^\d+$/.test(s)?Number(s):null;
 for(const [k,v] of Object.entries(mapping))if(!(invoiceCsvFields as readonly string[]).includes(k)||!parsed.headers.includes(v))throw new Error('Mapping kolom tidak valid.');
 for(const k of ['record_type','source_invoice_id','source_version'])if(!mapping[k])throw new Error('Mapping wajib: '+k);
 for(const row of parsed.rows){const v=row.values,g=(key:string)=>get(v,key);if(v.length!==parsed.headers.length){errors.push({row_no:row.line,kind:'csv',key:'',errors:['Jumlah kolom tidak sesuai header.']});continue}
 const type=g('record_type'),shared={source_invoice_id:g('source_invoice_id'),source_version:g('source_version')};
 if(type==='invoice')invoices.push({...shared,...(g('customer_code')?{source_customer_code:g('customer_code').toUpperCase()}:{}),invoice_date:g('invoice_date'),currency:g('currency'),channel:g('channel'),...(g('rep_id')?{source_rep_id:g('rep_id')}:{}),...(g('area_id')?{area_id:g('area_id')}:{}),status:g('status'),net_minor:number(g('net_minor')),net_includes_credit:g('net_includes_credit')==='true'?true:g('net_includes_credit')==='false'?false:null,lines:[],_row:row.line});
 else if(type==='line')lines.push({...shared,source_line_id:g('source_line_id'),sku:g('sku').toUpperCase(),quantity_scaled:number(g('quantity_scaled')),quantity_scale:number(g('quantity_scale')),unit_code:g('unit_code'),net_minor:number(g('line_net_minor')),_row:row.line});
 else if(type==='credit')credit_notes.push({...shared,source_credit_id:g('source_credit_id'),credit_date:g('credit_date'),amount_minor:number(g('credit_amount_minor')),status:g('status'),_row:row.line});
 else errors.push({row_no:row.line,kind:'csv',key:shared.source_invoice_id,errors:['record_type harus invoice, line, atau credit.']});
 }
 for(const l of lines){const headers=invoices.filter(i=>i.source_invoice_id===l.source_invoice_id&&i.source_version===l.source_version);if(headers.length!==1)errors.push({row_no:l._row,kind:'line',key:l.source_invoice_id,errors:['Line harus merujuk tepat satu header invoice/version di file yang sama.']});else{const {source_invoice_id,source_version,_row,...line}=l;headers[0].lines.push(line)}}
 return {invoices,credit_notes,errors};
}
