import {createHash} from 'node:crypto';
import {buildBekasiPortfolio,type SeedRow} from './bekasi-portfolio-data';
import {calculateIncentive} from '../src/server/incentive-engine';
import {demoRules} from './bekasi-analysis-data';

export const BEVERAGE_DEMO='beverage-demo-v1';
export const BEVERAGE_PREFIX=BEVERAGE_DEMO+'-';
const j=JSON.stringify,h=(x:unknown)=>createHash('sha256').update(j(x)).digest('hex');
type Point=Record<string,any>;
const variants:Array<[string,string,number,string,number]>=[
 ...[250,330].map(n=>['Coca Kola','Original',n,'Kaleng',6000] as [string,string,number,string,number]),
 ...[250,390,1000,1500].map(n=>['Coca Kola','Original',n,'PET',n<500?5000:n===1000?12000:17000] as [string,string,number,string,number]),
 ['Coca Kola','Zero Sugar',250,'Kaleng',6500],['Coca Kola','Zero Sugar',390,'PET',6500],['Coca Kola','Light',330,'Kaleng',7000],
 ['Spritz','Original',250,'Kaleng',5500],['Spritz','Original',330,'Kaleng',6500],['Spritz','Original',390,'PET',5000],['Spritz','Waterlymon',390,'PET',5500],
 ['Franta','Stroberi',250,'PET',4000],['Franta','Stroberi',390,'PET',5500],['Franta','Jeruk',390,'PET',5500],['Franta','Stroberi Zero',390,'PET',6000],['Franta','Fruit Punch',1500,'PET',17000],['Franta','Anggur',390,'PET',5500],
 ['A en W','Sarsaparilla',330,'Kaleng',7500],['Schweps','Ginger Ale',330,'Kaleng',8000],['Schweps','Tonic Water',330,'Kaleng',8000],
 ['FresTea','Melati',350,'PET',4000],['FresTea','Hijau Madu',500,'PET',6000],['FresTea','Apel',350,'PET',5000],['FresTea','Markisa',350,'PET',5000],['FresTea','Markisa',500,'PET',6000],
 ['Adez','Mineral',600,'PET',3000],['Adez','Mineral',1500,'PET',5000],['Adez','Mineral',19000,'Galon',22000],
 ['Minut Made','Pulpy Jeruk',300,'PET',6500],['NutriBost','Jeruk',300,'PET',7000],['NutriBost','Stroberi',300,'PET',7000],['PowerAdey','Isotonik',500,'PET',8000],
];

/** Deterministic synthetic package. Directory coordinates are references, never visit GPS. */
export function buildBeverageDemo(org:string,actor:string,now:string,sourcePoints:Point[],existingLinks:Point[]){
 const base=buildBekasiPortfolio({organizationId:org,managementId:actor,createdAt:now,financeEpoch:0}),rows:Record<string,SeedRow[]>={};
 const add=(table:string,row:SeedRow)=>{(rows[table]||=[]).push({organization_id:org,...row});return row};
 const template=(table:string)=>base.rows[table][0];
 const reason='DEMO/SINTETIS: minuman plesetan, operasi simulasi tanpa GPS, stok atau verifikasi kredit nyata.';
 const areas=['bekasi-demo-area-kota','bekasi-demo-area-kabupaten'];
 const reps=base.rows.app_user.filter(r=>String(r.id).includes('sales-')).map(r=>({id:String(r.id),name:String(r.name),area:String(base.rows.customer_assignment.find(a=>a.rep_id===r.id)!.area_id)}));
 for(let n=0;n<6;n++){
  const id=BEVERAGE_PREFIX+'sales-'+(n+1),area=areas[n<3?0:1],name=['Aulia Rahma','Bagas Setiawan','Citra Lestari','Damar Prakoso','Elsa Maharani','Fikri Ramadhan'][n];
  add('app_user',{...template('app_user'),id,name});
  add('auth_role_assignment',{...template('auth_role_assignment'),id:id+'-role',user_id:id,role_code:'SALES_REP',effective_from_date:'2026-11-01'});
  add('user_area_scope',{user_id:id,area_id:area,effective_from_date:'2026-11-01',effective_to_date:null});
  add('reporting_assignment',{...template('reporting_assignment'),id:id+'-reporting',subordinate_id:id,area_id:area,effective_from_date:'2026-11-01'});
  reps.push({id,name,area});
 }
 const group=BEVERAGE_PREFIX+'group';
 add('product_group',{...template('product_group'),id:group,code:'DEMO-DRINKS',name:'Minuman · DEMO'});
 const products=variants.map(([brand,flavour,size_ml,packaging,price],n)=>{
  const id=BEVERAGE_PREFIX+'product-'+(n+1),sku=String(1001+n),name=[brand,flavour,size_ml+' ml',packaging].join(' · ');
  const product=add('product',{...template('product'),id,sku,name,base_unit:'unit',group_code:'DEMO-DRINKS',product_group_id:group,brand,flavour,size_ml,packaging});
  add('product_price',{...template('product_price'),id:id+'-price',product_id:id,amount_minor:price,unit_code:'unit',effective_from_date:'2026-11-01'});
  return {...product,price};
 });
 const used=new Set(existingLinks.map(l=>l.source_customer_id)),links:Point[]=[],newCustomers:SeedRow[]=[];
 for(let a=0;a<2;a++){
  const points=sourcePoints.filter(p=>p.area_id===(a?'maps-area-bekasi-kab':'maps-area-bekasi-kota')&&!used.has(p.id)&&p.record_status==='active'&&!p.merged_into_id&&Number.isInteger(p.latitude_e7)&&Number.isInteger(p.longitude_e7)).sort((x,y)=>x.longitude_e7-y.longitude_e7||x.latitude_e7-y.latitude_e7||x.id.localeCompare(y.id));
  if(points.length<400)throw Error('INSUFFICIENT_EXISTING_DIRECTORY_POINTS');
  const team=reps.filter(r=>r.area===areas[a]),counts=new Map(team.map(r=>[r.id,0]));
  for(let n=0;n<400;n++){
   // Existing four reps already own 50 each; new reps receive 100 each.
   const rep=team.find(r=>counts.get(r.id)!<(r.id.startsWith('bekasi-demo-')?50:100))!;counts.set(rep.id,counts.get(rep.id)!+1);
   const source=points[Math.floor(n*points.length/400)],id=BEVERAGE_PREFIX+'customer-'+(a*400+n+1),external=String(700001+a*400+n);
   used.add(source.id);
   const customer=add('customer_outlet',{...template('customer_outlet'),id,area_id:areas[a],external_code:external,external_code_key:external,name:source.name,created_at:now,service_frequency_days:7});newCustomers.push(customer);
   add('customer_assignment',{...template('customer_assignment'),id:id+'-assignment',outlet_id:id,rep_id:rep.id,area_id:rep.area,effective_from_date:'2026-11-01',reason});
   const link={mapping_id:BEVERAGE_DEMO,synthetic_activity:true,existing_point_overlay:true,demo_customer_id:id,demo_area_id:rep.area,source_customer_id:source.id,source_external_code:source.external_code,source_dataset_id:source.directory_dataset_id,source_area_id:source.area_id,source_name:source.name,source_address:source.address,source_latitude_e7:source.latitude_e7,source_longitude_e7:source.longitude_e7,source_version:source.version,source_coordinate_status:source.coordinate_status};links.push(link);
   add('master_audit',{id:BEVERAGE_PREFIX+'link-'+id,actor_id:actor,resource_type:'demo_operation_point_link',resource_id:id,action:'operation_point_link_selected',occurred_at:now,before_json:j(customer),after_json:j(link)});
  }
 }
 const importId=BEVERAGE_PREFIX+'import',sources:SeedRow[]=[];
 add('invoice_import_job',{...template('invoice_import_job'),id:importId,source_system:'nyales-beverage-demo',source_cutoff:'2026-11-03T12:00:00Z',payload_hash:h({dataset:BEVERAGE_DEMO}),payload_json:j({synthetic:true,dataset:BEVERAGE_DEMO}),request_json:j({reason}),plan_json:j({accepted:400,synthetic:true}),valid_count:400,created_at:now,committed_at:now});
 const customerRep=new Map([...base.rows.customer_assignment,...rows.customer_assignment].map(r=>[String(r.outlet_id),String(r.rep_id)]));
 for(const [repIndex,rep] of reps.entries()){
  const old=base.rows.customer_outlet.filter(c=>customerRep.get(String(c.id))===rep.id),fresh=newCustomers.filter(c=>customerRep.get(String(c.id))===rep.id),pool:SeedRow[]=[];
  for(let n=0;n<100;n++){if(old[n])pool.push(old[n]);if(fresh[n])pool.push(fresh[n])}
  if(pool.length!==100)throw Error('REP_CUSTOMER_COHORT_MUST_BE_100');
  for(const day of ['2026-11-02','2026-11-03'])add('work_session',{id:BEVERAGE_PREFIX+'session-'+rep.id+'-'+day,user_id:rep.id,kind:'work',started_at:new Date(day+'T08:00:00+07:00').toISOString(),ended_at:new Date(day+'T18:00:00+07:00').toISOString(),reason,version:1});
  for(let n=0;n<40;n++){
   const customer=pool[n],id=BEVERAGE_PREFIX+'sale-'+(repIndex*40+n+1),date=n<20?'2026-11-02':'2026-11-03',time=new Date(date+'T08:00:00+07:00');time.setMinutes(time.getMinutes()+(n%20)*30);const occurred=time.toISOString(),activityId=id+'-visit',planId=id+'-plan';
   const lines=[0,1,2].map(k=>{const p=products[(repIndex*3+n+k*7)%products.length],quantity=p.size_ml===19000?2:24*(1+(n+k)%3),amount=quantity*p.price;return{product_id:p.id,sku_snapshot:p.sku,name_snapshot:p.name,unit_code:'unit',quantity_scaled:quantity,quantity_scale:1,unit_price_minor:p.price,net_minor:amount}}),amount=lines.reduce((n,l)=>n+l.net_minor,0);
   add('work_plan',{...template('work_plan'),id:planId,customer_id:customer.id,user_id:rep.id,scheduled_at:occurred,original_scheduled_at:occurred,reason,created_at:now});
   add('activity',{...template('activity'),id:activityId,outlet_id:customer.id,user_id:rep.id,occurred_at:occurred,notes:reason,metadata_json:j({synthetic:true,location_quality:'synthetic_not_verified',session_id:BEVERAGE_PREFIX+'session-'+rep.id+'-'+date,dataset:BEVERAGE_DEMO,work_plan_id:planId,outcome:'productive',meaningful:true,gps:'not_collected',order_id:id+'-order'})});
   for(const event of ['check-in','check-out']){const at=event==='check-in'?occurred:new Date(time.getTime()+15*60000).toISOString();add('visit_event',{id:activityId+'-'+event,activity_id:activityId,user_id:rep.id,event_kind:event,occurred_at:at,received_at:now,latitude_e7:null,longitude_e7:null,accuracy_cm:null,source:'synthetic_demo',quality:'synthetic_not_verified',payload_json:j({synthetic:true,dataset:BEVERAGE_DEMO,reason,outcome:'productive',notes:reason,occurred_at:at})})}
   add('sales_order',{...template('sales_order'),id:id+'-order',customer_id:customer.id,user_id:rep.id,client_order_id:id,status:'approved',lines_json:j(lines),net_minor:amount,reason,created_at:occurred,submitted_by:rep.id,external_reference:id,input_hash:h({customer:customer.id,lines}),submit_snapshot_json:j({synthetic:true,lines,activity_id:activityId,work_plan_id:planId,stock:{status:'simulated_not_verified'},credit:{status:'simulated_not_verified'}}),approval_review_json:j({synthetic:true,source:'simulation',provider_verified:false,actor:'bekasi-demo-supervisor-01',reason})});
   const payload={synthetic:true,dataset:BEVERAGE_DEMO,order_id:id+'-order',activity_id:activityId,work_plan_id:planId,net_minor:amount};
   const invoice=add('invoice',{...template('invoice'),id:id+'-invoice',source_invoice_id:id,external_invoice_id:id,outlet_id:customer.id,rep_id:rep.id,area_id:rep.area,invoice_date:date,net_minor:amount,source_net_minor:amount,created_at:now,source_system:'nyales-beverage-demo',source_updated_at:occurred,reason,import_job_id:importId,assignment_snapshot_json:j([{rep_id:rep.id,area_id:rep.area,channel:'field',synthetic:true}])});sources.push(invoice);
   lines.forEach((line,k)=>add('invoice_line',{...template('invoice_line'),...line,id:id+'-line-'+k,invoice_id:invoice.id,source_line_id:String(k+1),product_name_snapshot:line.name_snapshot,product_group_id_snapshot:group,group_code_snapshot:'DEMO-DRINKS'}));
   // name_snapshot/unit_price belong to the order snapshot, not the invoice_line schema.
   for(const line of rows.invoice_line.slice(-3)){delete line.name_snapshot;delete line.unit_price_minor}
   add('invoice_source_event',{...template('invoice_source_event'),source_system:'nyales-beverage-demo',external_invoice_id:id,invoice_id:invoice.id,payload_hash:h(payload),payload_json:j(payload),created_at:now});
   if(n%5===0)add('sales_task',{...template('sales_task'),id:id+'-followup',customer_id:customer.id,user_id:rep.id,status:'open',due_at:new Date(Date.parse('2026-11-06T08:00:00+07:00')+n/5*30*60000).toISOString(),original_due_at:new Date(Date.parse('2026-11-06T08:00:00+07:00')+n/5*30*60000).toISOString(),completed_at:null,outcome:'',created_by:rep.id,created_at:occurred,title:'Follow-up minuman · DEMO',reason});
  }
 }
 const plan=BEVERAGE_PREFIX+'target',version=plan+'-v1',incentive=BEVERAGE_PREFIX+'incentive',iv=incentive+'-v1';
 const leaves=reps.map((rep,n)=>{const actual=sources.filter(i=>i.rep_id===rep.id).reduce((v,i)=>v+Number(i.net_minor),0),target=Math.round(actual/[.85,.95,1.05,1.15][n%4]/100000)*100000;return{id:BEVERAGE_PREFIX+'target-'+rep.id,organization_id:org,target_plan_id:plan,target_version_id:version,user_id:rep.id,outlet_id:null,target_minor:target,baseline_kind:'synthetic_demo',status:'approved',area_id_snapshot:rep.area,rep_id_snapshot:rep.id,channel_snapshot:'field',product_id:null,product_group_id:null,input_reason:reason,hierarchy_snapshot_json:j([{id:'bekasi-demo-supervisor-01',name:'Supervisor DEMO Bekasi',depth:1}])} as SeedRow});
 add('target_plan',{...template('target_plan'),id:plan,name:'Target minuman November · DEMO',status:'approved',period_start:'2026-11-01',period_end:'2026-11-30',method:'bottom_up',basis:'invoice_net_idr'});
 add('target_version',{...template('target_version'),id:version,target_plan_id:plan,submitted_by:actor,approved_by:actor,approved_at:now,parent_minor:leaves.reduce((n,l)=>n+Number(l.target_minor),0),baseline_json:j({synthetic:true,dataset:BEVERAGE_DEMO}),reason});
 for(const leaf of leaves)add('target_item',leaf);
 add('incentive_plan',{id:incentive,name:'Minuman November · DEMO',role_code:'SALES_REP',channel:'field',model:demoRules.model,basis:'invoice_net',status:'active',created_by:actor,created_at:now});
 add('incentive_plan_version',{id:iv,plan_id:incentive,revision_no:1,target_version_id:version,period_start:'2026-11-01',period_end:'2026-11-30',timezone:'Asia/Jakarta',role_code:'SALES_REP',channel:'field',rules_json:j(demoRules),status:'active',version:1,created_by:actor,submitted_by:actor,approved_by:actor,created_at:now,reason,preview_json:j({synthetic:true})});
 for(const leaf of leaves){const eid=iv+'-'+leaf.user_id,run=eid+'-run',invoices=sources.filter(i=>i.rep_id===leaf.user_id),actual=invoices.reduce((n,i)=>n+Number(i.net_minor),0),result=calculateIncentive(demoRules,Number(leaf.target_minor),actual),inputs={synthetic:true,dataset:BEVERAGE_DEMO,engine_version:'nyales-incentive-1',plan_version_id:iv,user_id:leaf.user_id,timezone:'Asia/Jakarta',cutoff:'2026-11-03',target_minor:leaf.target_minor,actual_minor:actual,target_items:[leaf],rules:demoRules,sources:invoices.map(i=>({id:i.id,source_system:i.source_system,external_invoice_id:i.external_invoice_id,invoice_date:i.invoice_date,net_minor:i.net_minor,credited_minor:i.net_minor,eligible:true})),review_flags:['SYNTHETIC_DEMO_ONLY','PERIOD_NOT_CLOSED']};
  add('incentive_enrollment',{id:eid,plan_version_id:iv,user_id:leaf.user_id,role_code:'SALES_REP',channel:'field',period_start:'2026-11-01',period_end:'2026-11-30',area_ids_json:j([leaf.area_id_snapshot]),target_items_json:j([leaf]),status:'active'});
  add('calculation_run',{id:run,enrollment_id:eid,plan_version_id:iv,user_id:leaf.user_id,cutoff:'2026-11-03',source_hash:h(inputs),inputs_json:j(inputs),result_json:j(result),created_by:actor,created_at:now});
  add('incentive_statement',{id:eid+'-statement',enrollment_id:eid,run_id:run,user_id:leaf.user_id,plan_version_id:iv,period_start:'2026-11-01',period_end:'2026-11-30',revision_no:1,status:'prepared',review_flags_json:j(inputs.review_flags),entitlement_minor:result.payout_minor,payable_delta_minor:result.payout_minor,version:1,created_by:actor,created_at:now,dispute_deadline:'2026-12-07T00:00:00Z'});
 }
 const manifest={synthetic:true,dataset:BEVERAGE_DEMO,source_points:800,total_linked_points:1000,sales_reps:10,new_sales_reps:6,new_customers:800,products:products.length,visits:400,invoices:400,invoice_lines:1200,actual_minor:sources.reduce((n,i)=>n+Number(i.net_minor),0),prepared_statements:10,period:'2026-11',gps:'not_collected',source_system:'nyales-beverage-demo',payment_executed:false};
 add('master_audit',{id:BEVERAGE_DEMO,actor_id:actor,resource_type:'training_dataset',resource_id:BEVERAGE_DEMO,action:'beverage_demo_applied',occurred_at:now,before_json:null,after_json:j(manifest)});
 return {rows,links,manifest,reps};
}
