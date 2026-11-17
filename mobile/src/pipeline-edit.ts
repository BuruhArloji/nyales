export type PipelineStage='new'|'contacted'|'qualified'|'proposal'|'negotiation'|'won'|'lost';
export type PipelinePayload={customer_id:string;source:string;need:string;stage:PipelineStage;expected_minor:number;expected_invoice_date:string|null;next_action:string;next_due_at:string;lost_reason:string;proposal_summary:string;order_id:string|null};
export function pipelinePayload(row:Record<string,unknown>,form:Record<string,string>):PipelinePayload {
 const str=(k:string)=>typeof row[k]==='string'?row[k] as string:'';
 const stages=['new','contacted','qualified','proposal','negotiation','won','lost'];const stage=form.stage as PipelineStage;
 if(!stages.includes(stage)||!str('customer_id')||!form.source.trim()||!form.need.trim()||!form.next_action.trim())throw Error('Lengkapi sumber, kebutuhan, dan tindak lanjut.');
 const amount=Number(form.expected_minor);if(!Number.isSafeInteger(amount)||amount<0)throw Error('Nilai harus berupa angka rupiah penuh.');
 const day=form.expected_invoice_date.trim();if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Tanggal invoice gunakan format YYYY-MM-DD.');
 const due=form.next_due_at.trim();if(!/(Z|[+-]\d{2}:\d{2})$/.test(due)||!Number.isFinite(Date.parse(due)))throw Error('Tenggat gunakan format 2026-11-18T10:00:00+07:00.');
 if(stage==='lost'&&!form.lost_reason.trim())throw Error('Isi alasan peluang hilang.');
 if(['proposal','negotiation','won'].includes(stage)&&(!amount||!day||!form.proposal_summary.trim()))throw Error('Isi nilai, tanggal invoice, dan ringkasan proposal.');
 if(stage==='won'&&!form.order_id.trim())throw Error('Won memerlukan ID order yang sudah disetujui.');
 return {customer_id:str('customer_id'),source:form.source.trim(),need:form.need.trim(),stage,expected_minor:amount,expected_invoice_date:day||null,next_action:form.next_action.trim(),next_due_at:new Date(due).toISOString(),lost_reason:form.lost_reason.trim(),proposal_summary:form.proposal_summary.trim(),order_id:form.order_id.trim()||null};
}
