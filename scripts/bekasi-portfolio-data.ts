import {createHash} from 'node:crypto';

export type SqlValue=string|number|null;
export type SeedRow=Record<string,SqlValue>;
export type BekasiPortfolio={
  organizationId:string;
  managementId:string;
  createdAt:string;
  financeEpoch:number;
  businessDays:string[];
  visits:Array<{index:number;date:string;scheduledAt:string;occurredAt:string;planId:string;activityId:string;customerId:string;repId:string;areaId:string;outcome:'productive'|'follow_up'|'no_show'}>;
  rows:Record<string,SeedRow[]>;
  manifest:Record<string,unknown>;
};

const DATASET_ID='bekasi-field-sales-2026-08-10';
const PREFIX='bekasi-demo-';
const BRANCH_ID=PREFIX+'branch-2026';
const AREAS=[
  {id:PREFIX+'area-kota',name:'Kota Bekasi · DEMO',label:'Kota Bekasi'},
  {id:PREFIX+'area-kabupaten',name:'Kabupaten Bekasi · DEMO',label:'Kabupaten Bekasi'},
] as const;
const MONTHS=[
  {key:'2026-08',start:'2026-08-01',end:'2026-08-31',label:'Agu'},
  {key:'2026-09',start:'2026-09-01',end:'2026-09-30',label:'Sep'},
  {key:'2026-10',start:'2026-10-01',end:'2026-10-31',label:'Okt'},
] as const;
const REP_DEFS=[
  {id:PREFIX+'sales-kota-01',name:'Sales DEMO Kota Bekasi 01',area:AREAS[0]},
  {id:PREFIX+'sales-kota-02',name:'Sales DEMO Kota Bekasi 02',area:AREAS[0]},
  {id:PREFIX+'sales-kab-01',name:'Sales DEMO Kabupaten Bekasi 01',area:AREAS[1]},
  {id:PREFIX+'sales-kab-02',name:'Sales DEMO Kabupaten Bekasi 02',area:AREAS[1]},
] as const;
const SUPERVISOR_ID=PREFIX+'supervisor-01';
const PRODUCTS=[
  {id:PREFIX+'product-beras',sku:'SKU-BKS-DEMO-BERAS',name:'Beras 5 kg · DEMO',unit:'pack',price:50_000},
  {id:PREFIX+'product-minyak',sku:'SKU-BKS-DEMO-MINYAK',name:'Minyak goreng karton · DEMO',unit:'case',price:100_000},
  {id:PREFIX+'product-gula',sku:'SKU-BKS-DEMO-GULA',name:'Gula 1 kg · DEMO',unit:'pack',price:25_000},
] as const;
const PRODUCT_GROUP_ID=PREFIX+'product-group';
const CREATED_AT_DEFAULT='2026-11-03T01:00:00.000Z';
const TARGET_PER_REP_MINOR=50_000_000;
const EXPECTED={visits:5_200,productive:3_640,followUp:780,noShow:780,orders:1_274,invoices:1_147,openTasks:312,doneTasks:468};

function iso(value:string|number|Date){return new Date(value).toISOString()}
function dateOnly(value:number){return new Date(value).toISOString().slice(0,10)}
function addMinutes(value:string,minutes:number){return new Date(Date.parse(value)+minutes*60_000).toISOString()}
function addDays(value:string,days:number){return new Date(Date.parse(value)+days*86_400_000).toISOString()}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}
function businessDays(){
  const start=Date.UTC(2026,7,1),end=Date.UTC(2026,9,31),days:string[]=[];
  for(let time=start;time<=end;time+=86_400_000){const weekday=new Date(time).getUTCDay();if(weekday>=1&&weekday<=5)days.push(dateOnly(time))}
  return days;
}
function linesForOrder(orderIndex:number,amount:number){
  const berasQty=2+(orderIndex%3);
  const minyakQty=amount>=500_000&&orderIndex%2===0?2:1;
  const gulaQty=(amount-berasQty*50_000-minyakQty*100_000)/25_000;
  if(!Number.isInteger(gulaQty)||gulaQty<0)throw new Error('INVALID_DEMO_ORDER_MIX');
  return [
    {product_id:PRODUCTS[0].id,quantity_scaled:berasQty,quantity_scale:1,unit_code:'pack',unit_price_minor:50_000,discount_minor:0,tax_minor:0,price_source:'Harga paket sintetis DEMO',sku_snapshot:PRODUCTS[0].sku,name_snapshot:PRODUCTS[0].name,product_version:1,net_minor:berasQty*50_000},
    {product_id:PRODUCTS[1].id,quantity_scaled:minyakQty,quantity_scale:1,unit_code:'case',unit_price_minor:100_000,discount_minor:0,tax_minor:0,price_source:'Harga paket sintetis DEMO',sku_snapshot:PRODUCTS[1].sku,name_snapshot:PRODUCTS[1].name,product_version:1,net_minor:minyakQty*100_000},
    ...(gulaQty? [{product_id:PRODUCTS[2].id,quantity_scaled:gulaQty,quantity_scale:1,unit_code:'pack',unit_price_minor:25_000,discount_minor:0,tax_minor:0,price_source:'Harga paket sintetis DEMO',sku_snapshot:PRODUCTS[2].sku,name_snapshot:PRODUCTS[2].name,product_version:1,net_minor:gulaQty*25_000}]:[]),
  ];
}

export function buildBekasiPortfolio(input:{organizationId:string;managementId:string;createdAt?:string;financeEpoch?:number}):BekasiPortfolio{
  if(!input.organizationId||!input.managementId)throw new Error('STAGING_ORGANIZATION_AND_MANAGEMENT_REQUIRED');
  const createdAt=iso(input.createdAt||CREATED_AT_DEFAULT),financeEpoch=input.financeEpoch||0;
  const days=businessDays();
  if(days.length!==65)throw new Error('UNEXPECTED_BUSINESS_DAY_COUNT');
  const users=[{id:SUPERVISOR_ID,name:'Supervisor DEMO Bekasi'} ,...REP_DEFS.map(x=>({id:x.id,name:x.name}))];
  const customers:SeedRow[]=[],assignments:SeedRow[]=[],roleAssignments:SeedRow[]=[],scopes:SeedRow[]=[],reporting:SeedRow[]=[];
  const customerByRep=new Map<string,string[]>();
  for(const user of users){
    const role=user.id===SUPERVISOR_ID?'SUPERVISOR':'SALES_REP';
    roleAssignments.push({id:`${PREFIX}role-${user.id.slice(PREFIX.length)}`,organization_id:input.organizationId,user_id:user.id,role_code:role,effective_from_date:'2026-08-01',effective_to_date:null,channel:'field'});
  }
  for(const area of AREAS)scopes.push({organization_id:input.organizationId,user_id:SUPERVISOR_ID,area_id:area.id,effective_from_date:'2026-08-01',effective_to_date:null});
  for(const [repIndex,rep] of REP_DEFS.entries()){
    scopes.push({organization_id:input.organizationId,user_id:rep.id,area_id:rep.area.id,effective_from_date:'2026-08-01',effective_to_date:null});
    const repCustomers:string[]=[];
    for(let localIndex=0;localIndex<50;localIndex++){
      const globalIndex=repIndex*50+localIndex+1,id=`${PREFIX}customer-${String(globalIndex).padStart(3,'0')}`;
      const externalCode=`BKS-DEMO-${String(globalIndex).padStart(4,'0')}`;
      const customerName=`Outlet DEMO ${rep.area.label} ${String(localIndex+1).padStart(3,'0')}`;
      repCustomers.push(id);
      customers.push({id,organization_id:input.organizationId,area_id:rep.area.id,external_code:externalCode,name:customerName,address:`Area simulasi ${rep.area.label}; alamat fisik tidak digunakan`,latitude_e7:null,longitude_e7:null,created_at:createdAt,version:1,record_status:'active',coordinate_status:'missing',location_note:'Lokasi sintetis hanya pada level area; GPS tidak disediakan.',outlet_type:'retail_demo',service_frequency_days:3,visit_window:'08:00-18:00',external_code_key:externalCode.toUpperCase(),external_code_review:0,merged_into_id:null,directory_dataset_id:null,transaction_history_unverified:0});
      assignments.push({id:`${PREFIX}assignment-${String(globalIndex).padStart(3,'0')}`,organization_id:input.organizationId,outlet_id:id,rep_id:rep.id,channel:'field',effective_from_date:'2026-08-01',effective_to_date:null,area_id:rep.area.id,reason:'DEMO/SINTETIS: assignment operasional portofolio Bekasi; bukan kepemilikan sales nyata.',created_by:input.managementId,created_at:createdAt,ended_reason:null,ended_by:null,ended_at:null});
    }
    customerByRep.set(rep.id,repCustomers);
    reporting.push({id:`${PREFIX}reporting-${String(repIndex+1).padStart(2,'0')}`,organization_id:input.organizationId,subordinate_id:rep.id,manager_id:SUPERVISOR_ID,area_id:rep.area.id,effective_from_date:'2026-08-01',effective_to_date:null,channel:'field',version:1});
  }
  const branch=[{id:BRANCH_ID,organization_id:input.organizationId,name:'Bekasi Portfolio · DEMO',timezone:'Asia/Jakarta',status:'active',version:1}];
  const areas=AREAS.map(area=>({id:area.id,organization_id:input.organizationId,name:area.name,branch_id:BRANCH_ID,version:1,status:'active'}));
  const calendar=[{id:`${PREFIX}calendar`,organization_id:input.organizationId,branch_id:BRANCH_ID,name:'Hari kerja DEMO Bekasi',weekdays_json:'[1,2,3,4,5]',start_time:'08:00',end_time:'18:00',holidays_json:'[]',status:'active',version:1}];
  const appUsers=users.map(user=>({id:user.id,organization_id:input.organizationId,auth_subject:null,name:user.name,status:'active',created_at:createdAt,version:1}));
  const productGroup=[{id:PRODUCT_GROUP_ID,organization_id:input.organizationId,code:'BKS-DEMO-BASKET',name:'Paket outlet Bekasi · DEMO',status:'active',version:1}];
  const products=PRODUCTS.map(product=>({id:product.id,organization_id:input.organizationId,sku:product.sku,name:product.name,base_unit:product.unit,group_code:'BKS-DEMO-BASKET',status:'active',version:1,quantity_scale:1,product_group_id:PRODUCT_GROUP_ID}));
  const productPrices=PRODUCTS.map((product,index)=>({id:`${PREFIX}price-${index+1}`,organization_id:input.organizationId,product_id:product.id,amount_minor:product.price,currency:'IDR',unit_code:product.unit,effective_from_date:'2026-08-01',effective_to_date:null,source:'synthetic_demo',created_by:input.managementId,created_at:createdAt}));
  const visits:BekasiPortfolio['visits']=[];
  for(let dayIndex=0;dayIndex<days.length;dayIndex++){
    const [year,month,day]=days[dayIndex].split('-').map(Number);
    for(let repIndex=0;repIndex<REP_DEFS.length;repIndex++){
      const rep=REP_DEFS[repIndex],repCustomers=customerByRep.get(rep.id)!;
      for(let slot=0;slot<20;slot++){
        const index=dayIndex*80+repIndex*20+slot,cycle=index%20;
        const outcome=cycle<3?'no_show':cycle<6?'follow_up':'productive';
        const scheduledAt=new Date(Date.UTC(year,month-1,day,1,slot*30)).toISOString();
        const customerId=repCustomers[(dayIndex*20+slot)%repCustomers.length];
        visits.push({index,date:days[dayIndex],scheduledAt,occurredAt:addMinutes(scheduledAt,15),planId:`${PREFIX}plan-${String(index+1).padStart(5,'0')}`,activityId:`${PREFIX}activity-${String(index+1).padStart(5,'0')}`,customerId,repId:rep.id,areaId:rep.area.id,outcome});
      }
    }
  }
  const workPlans=visits.map(visit=>({id:visit.planId,organization_id:input.organizationId,customer_id:visit.customerId,user_id:visit.repId,scheduled_at:visit.scheduledAt,original_scheduled_at:visit.scheduledAt,kind:'visit',status:'done',reason:`DEMO/SINTETIS: agenda historis ${visit.date}; kunjungan usaha simulasi tanpa rute/GPS nyata.`,version:1,created_by:input.managementId,created_at:createdAt,calendar_snapshot_json:JSON.stringify({synthetic:true,timezone:'Asia/Jakarta',slot_minutes:30,workdays:[1,2,3,4,5],start_time:'08:00',end_time:'18:00',public_holidays_included_as_workdays:true})}));
  const activities=visits.map(visit=>({id:visit.activityId,organization_id:input.organizationId,outlet_id:visit.customerId,user_id:visit.repId,channel:'field',activity_kind:'visit',status:'done',occurred_at:visit.occurredAt,notes:`DEMO/SINTETIS — ${visit.outcome==='productive'?'bertemu outlet':visit.outcome==='follow_up'?'perlu tindak lanjut':'outlet tidak dapat ditemui'}; tanpa GPS dan tanpa bukti lapangan.`,version:1,metadata_json:JSON.stringify({synthetic:true,dataset:DATASET_ID,work_plan_id:visit.planId,outcome:visit.outcome,meaningful:visit.outcome!=='no_show',gps:'not_collected',evidence:'none'})}));
  const followUps=visits.filter(visit=>visit.outcome==='follow_up');
  const followUpTasks=followUps.map((visit,index)=>{
    const dueAt=addDays(visit.occurredAt,2),created=addMinutes(visit.occurredAt,30),done=index<EXPECTED.doneTasks;
    return{id:`${PREFIX}task-${String(index+1).padStart(4,'0')}`,organization_id:input.organizationId,customer_id:visit.customerId,user_id:visit.repId,channel:'field',title:`Tindak lanjut DEMO ${String(index+1).padStart(3,'0')}`,due_at:dueAt,original_due_at:dueAt,status:done?'done':'open',created_by:visit.repId,version:1,reason:'DEMO/SINTETIS: tindak lanjut hasil kunjungan; bukan catatan bisnis nyata.',outcome:done?'follow_up_completed':'',completed_at:done?addMinutes(dueAt,60):null,created_at:created,priority:2};
  });
  const openFollowUps=followUps.slice(EXPECTED.doneTasks);
  const leads=openFollowUps.map((visit,index)=>{
    const created=addMinutes(visit.occurredAt,30),dueAt=addDays(visit.occurredAt,2),proposal=index%2===1;
    return{id:`${PREFIX}lead-${String(index+1).padStart(4,'0')}`,organization_id:input.organizationId,customer_id:visit.customerId,user_id:visit.repId,source:'Kunjungan lapangan · DEMO',need:'Tindak lanjut kebutuhan outlet simulasi',stage:proposal?'proposal':'qualified',expected_minor:350_000+(index%5)*50_000,expected_invoice_date:proposal?dueAt.slice(0,10):null,next_action:proposal?'Tinjau proposal demo dengan outlet':'Jadwalkan kunjungan ulang demo',next_due_at:dueAt,lost_reason:'',version:1,created_at:created,stage_changed_at:created,proposal_summary:proposal?'Proposal sintetis untuk portofolio; bukan penawaran aktual.':'',order_id:null};
  });
  const productiveVisits=visits.filter(visit=>visit.outcome==='productive');
  const chosenVisits=Array.from({length:EXPECTED.orders},(_,index)=>productiveVisits[Math.floor((index+0.5)*productiveVisits.length/EXPECTED.orders)]);
  if(chosenVisits.some(visit=>!visit))throw new Error('ORDER_SELECTION_FAILED');
  const invoicedOrderIndexes=new Set(Array.from({length:EXPECTED.invoices},(_,index)=>Math.floor((index+0.5)*EXPECTED.orders/EXPECTED.invoices)));
  const invoiceByOrder=new Map<number,{id:string;externalId:string;date:string;amount:number;sourcePayload:string;lines:ReturnType<typeof linesForOrder>}>();
  const orders:SeedRow[]=[],invoices:SeedRow[]=[],invoiceLines:SeedRow[]=[],sourceEvents:SeedRow[]=[];
  let invoiceSequence=0,invoiceTotal=0;
  const sourceSystem='bekasi-demo-synthetic',importJobId=`${PREFIX}invoice-import-2026-08-10`;
  const importPayload=JSON.stringify({synthetic:true,dataset:DATASET_ID,period_start:'2026-08-01',period_end:'2026-10-31',invoice_count:EXPECTED.invoices,source_system:sourceSystem});
  const importJob=[{id:importJobId,organization_id:input.organizationId,source_system:sourceSystem,source_cutoff:'2026-10-31T23:59:59.999+07:00',attachment_id:null,payload_hash:hash(importPayload),payload_json:importPayload,request_json:JSON.stringify({reason:'DEMO/SINTETIS: paket invoice simulasi Bekasi.'}),plan_json:JSON.stringify({accepted:EXPECTED.invoices,rejected:0,synthetic:true}),epoch:financeEpoch,status:'committed',valid_count:EXPECTED.invoices,invalid_count:0,errors_json:'[]',version:1,created_by:input.managementId,created_at:createdAt,committed_at:createdAt}];
  for(let orderIndex=0;orderIndex<chosenVisits.length;orderIndex++){
    const visit=chosenVisits[orderIndex],amount=350_000+(orderIndex%5)*50_000,orderId=`${PREFIX}order-${String(orderIndex+1).padStart(4,'0')}`;
    const lines=linesForOrder(orderIndex,amount);
    if(lines.reduce((sum,line)=>sum+line.net_minor,0)!==amount)throw new Error('ORDER_TOTAL_MISMATCH');
    const clientOrderId=`BKS-DEMO-ORD-${String(orderIndex+1).padStart(4,'0')}`;
    const externalInvoiceId=`DEMO-BKS-${visit.date.slice(0,7).replace('-','')}-${String(orderIndex+1).padStart(4,'0')}`;
    const hasInvoice=invoicedOrderIndexes.has(orderIndex),submitSnapshot=JSON.stringify({synthetic:true,submitted_at:visit.occurredAt,lines,stock:{status:'simulated_not_verified',source:'DEMO',freshness:null},credit:{status:'simulated_not_verified',source:'DEMO',freshness:null}});
    const approval=hasInvoice?JSON.stringify({actor:SUPERVISOR_ID,reviewed_at:visit.occurredAt,stock_reviewed:true,credit_reviewed:true,price_reviewed:null,source:'synthetic_demo_not_actual_review',provider_verified:false,external_source_as_of:null,reason:'DEMO/SINTETIS: status approval disimulasikan untuk portofolio; bukan review stok/kredit aktual.',policy_version:null}):null;
    const orderInput={customer_id:visit.customerId,channel:'field',client_order_id:clientOrderId,lines,reason:'DEMO/SINTETIS: order portofolio dari kunjungan; bukan transaksi nyata.'};
    orders.push({id:orderId,organization_id:input.organizationId,customer_id:visit.customerId,user_id:visit.repId,channel:'field',client_order_id:clientOrderId,status:hasInvoice?'approved':'submitted',version:1,lines_json:JSON.stringify(lines),net_minor:amount,reason:orderInput.reason,created_at:visit.occurredAt,submitted_by:visit.repId,approved_by:hasInvoice?SUPERVISOR_ID:null,external_reference:hasInvoice?externalInvoiceId:null,input_hash:hash(JSON.stringify(orderInput)),submit_snapshot_json:submitSnapshot,approval_review_json:approval});
    if(!hasInvoice)continue;
    invoiceSequence++;
    const invoiceId=`${PREFIX}invoice-${String(invoiceSequence).padStart(4,'0')}`;
    const attribution=JSON.stringify([{rep_id:visit.repId,area_id:visit.areaId,channel:'field',effective_from_date:'2026-08-01',synthetic:true}]);
    const payload=JSON.stringify({synthetic:true,source_system:sourceSystem,external_invoice_id:externalInvoiceId,source_version:'1',invoice_date:visit.date,outlet_id:visit.customerId,rep_id:visit.repId,area_id:visit.areaId,channel:'field',currency:'IDR',net_minor:amount,order_id:orderId});
    invoiceByOrder.set(orderIndex,{id:invoiceId,externalId:externalInvoiceId,date:visit.date,amount,sourcePayload:payload,lines});
    invoices.push({id:invoiceId,organization_id:input.organizationId,source_invoice_id:externalInvoiceId,source_version:'1',outlet_id:visit.customerId,rep_id:visit.repId,area_id:visit.areaId,channel:'field',invoice_date:visit.date,currency:'IDR',net_minor:amount,status:'validated',validation_state:'validated',created_at:createdAt,source_system:sourceSystem,external_invoice_id:externalInvoiceId,origin_source_version:'1',source_updated_at:visit.occurredAt,source_net_minor:amount,net_includes_credit:1,is_current:1,revision_no:1,previous_revision_id:null,reason:'DEMO/SINTETIS: invoice untuk simulasi portofolio; bukan dokumen transaksi nyata.',created_by:input.managementId,import_job_id:importJobId,attribution_basis:'synthetic_assignment',assignment_snapshot_json:attribution});
    invoiceTotal+=amount;
  }
  for(const [orderIndex,invoice] of invoiceByOrder){
    const visit=chosenVisits[orderIndex];
    invoice.lines.forEach((line,lineIndex)=>invoiceLines.push({id:`${invoice.id}-line-${lineIndex+1}`,organization_id:input.organizationId,invoice_id:invoice.id,source_line_id:String(lineIndex+1),product_id:line.product_id,sku_snapshot:line.sku_snapshot,quantity_scaled:line.quantity_scaled,quantity_scale:line.quantity_scale,unit_code:line.unit_code,net_minor:line.net_minor,product_name_snapshot:line.name_snapshot,product_group_id_snapshot:PRODUCT_GROUP_ID,group_code_snapshot:'BKS-DEMO-BASKET',group_snapshot_known:1}));
    sourceEvents.push({organization_id:input.organizationId,source_system:sourceSystem,external_invoice_id:invoice.externalId,source_version:'1',payload_hash:hash(invoice.sourcePayload),payload_json:invoice.sourcePayload,invoice_id:invoice.id,created_at:createdAt});
    const order=orders.find(row=>row.id===`${PREFIX}order-${String(orderIndex+1).padStart(4,'0')}`)!;
    order.external_reference=invoice.externalId;
  }
  const targetPlans:SeedRow[]=[],targetVersions:SeedRow[]=[],targetItems:SeedRow[]=[];
  for(const month of MONTHS){
    const planId=`${PREFIX}target-plan-${month.key}`,versionId=`${PREFIX}target-version-${month.key}`;
    targetPlans.push({id:planId,organization_id:input.organizationId,name:`Bekasi · DEMO — target field ${month.label} 2026`,method:'top_down',period_start:month.start,period_end:month.end,status:'draft',channel:'field',basis:'synthetic_demo',created_by:input.managementId,created_at:createdAt});
    targetVersions.push({id:versionId,organization_id:input.organizationId,target_plan_id:planId,revision_no:1,status:'draft',version:1,parent_minor:TARGET_PER_REP_MINOR*REP_DEFS.length,reserve_minor:0,created_by:input.managementId,created_at:createdAt,submitted_by:null,approved_by:null,approved_at:null,reason:'DEMO/SINTETIS: target per sales Rp50 juta/bulan; draft, belum disahkan.',baseline_json:JSON.stringify({synthetic:true,dataset:DATASET_ID,assumption:'Rp50 juta per rep per month'})});
    for(const [repIndex,rep] of REP_DEFS.entries())targetItems.push({id:`${PREFIX}target-item-${month.key}-${String(repIndex+1).padStart(2,'0')}`,organization_id:input.organizationId,target_plan_id:planId,user_id:rep.id,outlet_id:null,target_minor:TARGET_PER_REP_MINOR,baseline_kind:'synthetic_demo',status:'draft',target_version_id:versionId,area_id_snapshot:rep.area.id,rep_id_snapshot:rep.id,channel_snapshot:'field',product_id:null,product_group_id:null,input_reason:'Asumsi portofolio DEMO: target Rp50 juta per sales per bulan.',hierarchy_snapshot_json:JSON.stringify([{id:SUPERVISOR_ID,name:'Supervisor DEMO Bekasi',depth:1}])});
  }
  const manifest={synthetic:1,demo:true,dataset_id:DATASET_ID,source:'Deterministic synthetic scenario; existing directory and records preserved.',period_start:'2026-08-01',period_end:'2026-10-31',business_days:days.length,national_holidays_applied:false,counts:{branches:1,areas:2,synthetic_staff:users.length,sales_reps:REP_DEFS.length,outlets:customers.length,assignments:assignments.length,planned_visit_slots:workPlans.length,visit_attempts:activities.length,productive_visits:visits.filter(x=>x.outcome==='productive').length,follow_up_visits:followUps.length,no_show_visits:visits.filter(x=>x.outcome==='no_show').length,follow_up_tasks:followUpTasks.length,open_follow_up_tasks:followUpTasks.filter(x=>x.status==='open').length,done_follow_up_tasks:followUpTasks.filter(x=>x.status==='done').length,open_leads:leads.length,orders:orders.length,invoices:invoices.length,invoice_lines:invoiceLines.length,target_drafts:targetPlans.length,target_items:targetItems.length},invoice_total_minor:invoiceTotal,target_total_minor:TARGET_PER_REP_MINOR*REP_DEFS.length*MONTHS.length,gps:'not_collected',evidence:'none',approval_states:'synthetic only; no real stock or credit review'};
  const marker=[{id:`${PREFIX}manifest`,organization_id:input.organizationId,actor_id:input.managementId,resource_type:'training_dataset',resource_id:DATASET_ID,action:'seed_applied',occurred_at:createdAt,before_json:null,after_json:JSON.stringify(manifest)}];
  const rows:Record<string,SeedRow[]>={branch,area:areas,work_calendar:calendar,app_user:appUsers,auth_role_assignment:roleAssignments,user_area_scope:scopes,customer_outlet:customers,customer_assignment:assignments,reporting_assignment:reporting,product_group:productGroup,product:products,product_price:productPrices,target_plan:targetPlans,target_version:targetVersions,target_item:targetItems,work_plan:workPlans,activity:activities,sales_task:followUpTasks,sales_lead:leads,sales_order:orders,invoice_import_job:importJob,invoice:invoices,invoice_line:invoiceLines,invoice_source_event:sourceEvents,master_audit:marker};
  return{organizationId:input.organizationId,managementId:input.managementId,createdAt,financeEpoch,businessDays:days,visits,rows,manifest};
}

const TABLE_ORDER=['branch','area','work_calendar','app_user','auth_role_assignment','user_area_scope','customer_outlet','customer_assignment','reporting_assignment','product_group','product','product_price','target_plan','target_version','target_item','work_plan','activity','sales_task','sales_lead','sales_order','invoice_import_job','invoice','invoice_line','invoice_source_event','master_audit'];
function sqlLiteral(value:SqlValue){
  if(value===null)return 'NULL';
  if(typeof value==='number')return Number.isFinite(value)?String(value):(()=>{throw new Error('INVALID_SQL_NUMBER')})();
  return `'${value.replaceAll("'","''")}'`;
}
const NATURAL_KEYS:Record<string,string[]>={
  user_area_scope:['organization_id','user_id','area_id','effective_from_date'],
  invoice_source_event:['organization_id','source_system','external_invoice_id','source_version'],
};
function seedKey(table:string,columns:string[]){
  const keys=NATURAL_KEYS[table]||(columns.includes('organization_id')&&columns.includes('id')?['organization_id','id']:null);
  if(!keys||keys.some(key=>!columns.includes(key)))throw new Error(`UNSUPPORTED_SEED_KEY_${table}`);
  return keys;
}
export function createBekasiStartMarker(dataset:BekasiPortfolio):SeedRow{return{id:`${PREFIX}manifest-started`,organization_id:dataset.organizationId,actor_id:dataset.managementId,resource_type:'training_dataset',resource_id:DATASET_ID,action:'seed_started',occurred_at:dataset.createdAt,before_json:null,after_json:JSON.stringify({...dataset.manifest,seed_status:'in_progress'})}};
export function toInsertStatements(dataset:BekasiPortfolio,rowsPerStatement=16){
  const statements:string[]=[];
  for(const table of TABLE_ORDER){
    const rows=dataset.rows[table]||[];
    for(let start=0;start<rows.length;start+=rowsPerStatement){
      const subset=rows.slice(start,start+rowsPerStatement),columns=Object.keys(subset[0]||{});
      if(!columns.length)continue;
      const keys=seedKey(table,columns);
      const values=subset.map(row=>`(${columns.map(column=>sqlLiteral(row[column])).join(',')})`).join(',\n');
      const projection=columns.map(column=>`seed_row.${column}`).join(',');
      const exists=keys.map(key=>`existing.${key}=seed_row.${key}`).join(' AND ');
      statements.push(`WITH seed_row (${columns.join(',')}) AS (VALUES\n${values}\n)\nINSERT OR IGNORE INTO ${table} (${columns.join(',')})\nSELECT ${projection} FROM seed_row\nWHERE NOT EXISTS (SELECT 1 FROM ${table} AS existing WHERE ${exists});`);
    }
  }
  return statements;
}

export {DATASET_ID,EXPECTED,PREFIX};
