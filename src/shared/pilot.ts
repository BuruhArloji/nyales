import {z} from 'zod';
import {stableJson,sourceVersion} from './invoices';

const id=z.string().min(1).max(160).refine(v=>v===v.trim(),'ID must not contain surrounding whitespace');
const money=z.number().int().min(0).max(1_000_000_000_000);
const targetMoney=z.number().int().min(0).max(1_000_000_000_000_000);
const channel=z.enum(['field','telesales']);
const role=z.enum(['SALES_REP','TELESALES']);
const ids=z.array(id).refine(a=>new Set(a).size===a.length,'Duplicate IDs');
const nullableDate=z.iso.date().nullable();
const scopeShape={organization_id:id.nullable(),area_ids:ids,period_start:nullableDate,period_end:nullableDate,history_start:nullableDate,cutoff:z.iso.datetime().nullable()};
export const pilotManifest=z.object({
 schema_version:z.literal(1),pilot_id:id,data_classification:z.enum(['real_pilot','synthetic']),timezone:z.literal('Asia/Jakarta'),max_sales:z.number().int().min(1).max(10),
 pic:z.object({name:id,user_id:id.nullable()}).strict(),
 participants:z.array(z.object({name:id,user_id:id.nullable(),role:role.nullable(),area_ids:ids}).strict()).max(10),
 scope:z.object(scopeShape).strict(),
 source_review:z.object({source_system:id.nullable(),reviewer:id.nullable(),reviewed_at:z.iso.datetime().nullable(),net_definition:z.string().min(1).nullable(),id_mapping_reference:z.string().min(1).nullable()}).strict(),
 inputs:z.object({source_snapshot:z.string().min(1).nullable(),nyales_snapshot:z.string().min(1).nullable(),source_files:z.array(z.object({path:z.string().min(1),expected_sha256:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict())}).strict()
}).strict();
export type PilotManifest=z.infer<typeof pilotManifest>;
export const pilotIdMapping=z.object({schema_version:z.literal(1),mappings:z.array(z.object({entity:z.enum(['customer','user','area']),source_system:id,source_id:id,nyales_id:id,kind:z.enum(['canonical','alias']),reason:z.string().min(1)}).strict())}).strict();
const snapshotScope=z.object({organization_id:id,area_ids:ids,period_start:z.iso.date(),period_end:z.iso.date(),history_start:z.iso.date(),cutoff:z.iso.datetime()}).strict();
export const pilotSnapshot=z.object({
 schema_version:z.literal(1),origin:z.enum(['source','nyales']),data_classification:z.enum(['real_pilot','synthetic']),exported_at:z.iso.datetime(),scope:snapshotScope,current_only:z.literal(true),complete:z.literal(true),
 users:z.array(z.object({id,name:id,role,channel,area_ids:ids}).strict()),
 customers:z.array(z.object({id,external_code:id,name:id,area_id:id,record_status:z.enum(['active','inactive']),latitude_e7:z.number().int().min(-900000000).max(900000000).nullable(),longitude_e7:z.number().int().min(-1800000000).max(1800000000).nullable()}).strict()),
 owners:z.array(z.object({customer_id:id,rep_id:id,area_id:id,channel,effective_from_date:z.iso.date(),effective_to_date:nullableDate}).strict()),
 invoices:z.array(z.object({source_system:id,source_invoice_id:id,source_version:sourceVersion,customer_id:id,rep_id:id,area_id:id,channel,invoice_date:z.iso.date(),status:z.enum(['validated','draft','cancelled']),validation_state:z.enum(['validated','needs_review','unmapped']),source_net_minor:money,net_minor:money,net_includes_credit:z.boolean()}).strict()),
 credits:z.array(z.object({source_system:id,source_credit_id:id,source_invoice_id:id,source_version:sourceVersion,credit_date:z.iso.date(),amount_minor:money,status:z.enum(['validated','cancelled'])}).strict()),
 target_versions:z.array(z.object({plan_key:id,version:sourceVersion,period_start:z.iso.date(),period_end:z.iso.date(),channel,status:z.enum(['draft','approved']),parent_minor:targetMoney,reserve_minor:targetMoney}).strict()),
 targets:z.array(z.object({plan_key:id,version:sourceVersion,customer_id:id.nullable(),rep_id:id.nullable(),area_id:id,product_id:id.nullable(),product_group_id:id.nullable(),target_minor:targetMoney}).strict())
}).strict();
export type PilotSnapshot=z.infer<typeof pilotSnapshot>;
export type PilotIssue={code:string;dataset:string;key:string;detail:string};
const datasets=['users','customers','owners','invoices','credits','target_versions','targets'] as const;
type Dataset=typeof datasets[number];
const keyOf:Record<Dataset,(r:any)=>string>={users:r=>r.id,customers:r=>r.id,owners:r=>stableJson([r.customer_id,r.channel,r.effective_from_date]),invoices:r=>stableJson([r.source_system,r.source_invoice_id]),credits:r=>stableJson([r.source_system,r.source_credit_id]),target_versions:r=>r.plan_key,targets:r=>stableJson([r.plan_key,r.version,r.customer_id,r.rep_id,r.area_id,r.product_id,r.product_group_id])};
const canonical=(row:any)=>stableJson(row&&typeof row==='object'&&!Array.isArray(row)&&row.area_ids?{...row,area_ids:[...row.area_ids].sort()}:row);
const within=(date:string,from:string,to:string|null)=>from<=date&&(!to||date<to);
const sum=(rows:any[],field:string)=>rows.reduce((n,r)=>n+BigInt(r[field]),0n).toString();

/** Independent, read-only comparison of explicitly mapped snapshots.
 * Import validators remain authoritative for hierarchy, locks and attribution.
 * A clean report permits named review; it never signs off or commits a pilot.
 */
export function reconcilePilot(manifestInput:unknown,sourceInput?:unknown,nyalesInput?:unknown,mappingInput?:unknown){
 const m=pilotManifest.parse(manifestInput),issues:PilotIssue[]=[];
 const add=(code:string,dataset:string,key:string,detail:string)=>issues.push({code,dataset,key,detail});
 const required=(ok:unknown,key:string)=>{if(!ok)add('SETUP_REQUIRED','manifest',key,'Lengkapi dan tinjau sebelum pilot data nyata.');};
 required(m.pic.user_id,'pic.user_id');required(m.participants.length,'participants');
 if(m.participants.length>m.max_sales)add('CAPACITY_EXCEEDED','participants','count','Jumlah peserta melebihi kapasitas pilot.');
 for(const [i,p] of m.participants.entries()){required(p.user_id,'participants.'+i+'.user_id');required(p.role,'participants.'+i+'.role');required(p.area_ids.length,'participants.'+i+'.area_ids');}
 const participantIds=m.participants.flatMap(p=>p.user_id?[p.user_id]:[]);
 if(new Set(participantIds).size!==participantIds.length)add('DUPLICATE_PARTICIPANT','participants','user_id','Satu user hanya sekali dalam cohort.');
 required(m.scope.organization_id,'scope.organization_id');required(m.scope.area_ids.length,'scope.area_ids');required(m.scope.period_start,'scope.period_start');required(m.scope.period_end,'scope.period_end');required(m.scope.history_start,'scope.history_start');required(m.scope.cutoff,'scope.cutoff');
 if(m.scope.period_start&&m.scope.history_start){const baseline=new Date(m.scope.period_start.slice(0,7)+'-01T00:00:00Z');baseline.setUTCMonth(baseline.getUTCMonth()-3);if(m.scope.history_start>baseline.toISOString().slice(0,10))add('BASELINE_WINDOW_INCOMPLETE','manifest','history_start','Histori sumber harus mencakup sedikitnya tiga bulan sebelum bulan target.');}
 if(m.scope.period_start&&m.scope.period_end&&m.scope.period_start>m.scope.period_end)add('INVALID_PERIOD','manifest','scope','Tanggal awal melebihi tanggal akhir.');
 for(const [key,value] of Object.entries(m.source_review))required(value,'source_review.'+key);
 required(m.inputs.source_snapshot,'inputs.source_snapshot');required(m.inputs.nyales_snapshot,'inputs.nyales_snapshot');required(m.inputs.source_files.length,'inputs.source_files');
 let source:PilotSnapshot|undefined,nyales:PilotSnapshot|undefined;
 for(const [origin,input] of [['source',sourceInput],['nyales',nyalesInput]] as const){
  if(input===undefined){add('SNAPSHOT_REQUIRED',origin,'file','Snapshot lengkap belum tersedia.');continue;}
  const parsed=pilotSnapshot.safeParse(input);if(!parsed.success){for(const e of parsed.error.issues)add('INVALID_SNAPSHOT',origin,e.path.join('.'),e.message);continue;}
  const s=parsed.data;if(origin==='source')source=s;else nyales=s;
  if(s.origin!==origin)add('WRONG_ORIGIN',origin,'origin','Snapshot harus berasal dari sisi yang berbeda.');
  if(s.data_classification!==m.data_classification)add('DATA_CLASSIFICATION_MISMATCH',origin,'data_classification','Data sintetis tidak menjadi evidence pilot nyata.');
  if(stableJson({...s.scope,area_ids:[...s.scope.area_ids].sort()})!==stableJson({...m.scope,area_ids:[...m.scope.area_ids].sort()}))add('SCOPE_MISMATCH',origin,'scope','Organisasi, area, periode dan cutoff harus sama dengan manifest.');
  if(Date.parse(s.exported_at)<Date.parse(s.scope.cutoff))add('EXPORT_BEFORE_CUTOFF',origin,'exported_at','Ekspor harus dilakukan sesudah cutoff yang dibandingkan.');
  for(const dataset of datasets){const seen=new Set<string>();for(const row of s[dataset]){const key=keyOf[dataset](row);if(seen.has(key))add('DUPLICATE_KEY',origin+'.'+dataset,key,'Snapshot hanya memuat satu record current per identitas.');seen.add(key);}}
  const users=new Map(s.users.map(u=>[u.id,u])),customers=new Map(s.customers.map(c=>[c.id,c])),versions=new Map(s.target_versions.map(v=>[v.plan_key,v]));
  const expectedUsers=new Set(participantIds);
  for(const u of s.users){if(!expectedUsers.has(u.id))add('OUTSIDE_COHORT',origin+'.users',u.id,'User tidak terdaftar sebagai peserta.');if(u.channel!==(u.role==='SALES_REP'?'field':'telesales'))add('ROLE_CHANNEL_MISMATCH',origin+'.users',u.id,'Role dan kanal berbeda.');if(u.area_ids.some(a=>!m.scope.area_ids.includes(a)))add('OUTSIDE_AREA',origin+'.users',u.id,'Scope area di luar pilot.');}
  for(const p of m.participants){if(!p.user_id)continue;const u=users.get(p.user_id);if(!u||u.name!==p.name||u.role!==p.role||stableJson([...u.area_ids].sort())!==stableJson([...p.area_ids].sort()))add('PARTICIPANT_MISMATCH',origin+'.users',p.user_id,'Nama, ID, role dan area harus sesuai cohort yang dipilih.');}
  for(const c of s.customers){if(!m.scope.area_ids.includes(c.area_id))add('OUTSIDE_AREA',origin+'.customers',c.id,'Customer di luar area pilot.');if((c.latitude_e7===null)!==(c.longitude_e7===null))add('COORDINATE_PAIR_REQUIRED',origin+'.customers',c.id,'Koordinat harus berpasangan.');}
  const codes=new Set<string>();for(const c of s.customers){const code=c.external_code.trim().toUpperCase();if(codes.has(code))add('DUPLICATE_CUSTOMER_CODE',origin+'.customers',code,'Selesaikan mapping canonical/alias terlebih dahulu.');codes.add(code);}
  for(const o of s.owners){const u=users.get(o.rep_id),c=customers.get(o.customer_id),key=keyOf.owners(o);if(!c||!u||u.channel!==o.channel||!u.area_ids.includes(o.area_id)||!m.scope.area_ids.includes(o.area_id))add('OWNER_REFERENCE_INVALID',origin+'.owners',key,'Customer, sales, kanal atau area owner belum cocok.');if(o.effective_to_date&&o.effective_to_date<=o.effective_from_date)add('OWNER_INTERVAL_INVALID',origin+'.owners',key,'Tanggal akhir assignment bersifat eksklusif dan harus setelah tanggal awal.');}
  const owners=new Map<string,PilotSnapshot['owners']>();for(const o of s.owners){const key=stableJson([o.customer_id,o.channel]),list=owners.get(key)||[];list.push(o);owners.set(key,list);}
  for(const [key,list] of owners){list.sort((a,b)=>a.effective_from_date.localeCompare(b.effective_from_date));for(let i=1;i<list.length;i++)if(!list[i-1].effective_to_date||list[i].effective_from_date<list[i-1].effective_to_date!)add('OWNER_OVERLAP',origin+'.owners',key,'Dua owner pada kanal dan tanggal yang sama.');}
  const invoices=new Map(s.invoices.map(i=>[keyOf.invoices(i),i]));
  const creditTotals=new Map<string,bigint>();for(const c of s.credits)if(c.status==='validated'){const key=stableJson([c.source_system,c.source_invoice_id]);creditTotals.set(key,(creditTotals.get(key)||0n)+BigInt(c.amount_minor));}
  const cutoffDate=new Intl.DateTimeFormat('en-CA',{timeZone:m.timezone}).format(new Date(s.scope.cutoff));
  for(const c of s.credits){const invoice=invoices.get(stableJson([c.source_system,c.source_invoice_id]));if(!invoice)add('CREDIT_INVOICE_MISSING',origin+'.credits',keyOf.credits(c),'Invoice asal harus ada di snapshot periode invoice.');else if(c.credit_date<invoice.invoice_date||c.credit_date>cutoffDate)add('CREDIT_DATE_INVALID',origin+'.credits',keyOf.credits(c),'Tanggal retur sebelum invoice atau setelah cutoff.');}
  for(const i of s.invoices){const key=keyOf.invoices(i),u=users.get(i.rep_id),c=customers.get(i.customer_id);if(!c||!u||u.channel!==i.channel||!u.area_ids.includes(i.area_id)||!m.scope.area_ids.includes(i.area_id))add('INVOICE_REFERENCE_INVALID',origin+'.invoices',key,'Customer/sales/kanal/area invoice belum cocok.');if(i.invoice_date<s.scope.history_start||i.invoice_date>s.scope.period_end||i.invoice_date>cutoffDate)add('INVOICE_OUTSIDE_PERIOD',origin+'.invoices',key,'Tanggal invoice di luar periode/cutoff pilot.');if(i.source_system!==m.source_review.source_system)add('SOURCE_SYSTEM_MISMATCH',origin+'.invoices',key,'Sistem sumber invoice belum disetujui pada manifest.');if(i.validation_state!=='validated')add('INVOICE_NEEDS_REVIEW',origin+'.invoices',key,'Atribusi/validasi invoice belum selesai.');const dated=(owners.get(stableJson([i.customer_id,i.channel]))||[]).filter(o=>within(i.invoice_date,o.effective_from_date,o.effective_to_date));if(dated.length!==1||dated[0]?.rep_id!==i.rep_id||dated[0]?.area_id!==i.area_id)add('DATED_OWNER_MISMATCH',origin+'.invoices',key,'Invoice harus cocok dengan satu owner historis pada tanggal invoice.');const credit=creditTotals.get(key)||0n,expected=BigInt(i.source_net_minor)-(i.net_includes_credit?0n:credit);if(expected<0n||expected!==BigInt(i.net_minor))add('CREDIT_NET_MISMATCH',origin+'.invoices',key,'Net sumber/retur berbeda atau retur terkurangi dua kali.');}
  for(const v of s.target_versions){if(v.period_start>v.period_end||v.period_start!==s.scope.period_start||v.period_end!==s.scope.period_end)add('TARGET_PERIOD_MISMATCH',origin+'.target_versions',v.plan_key,'Target harus menggunakan periode pilot yang sama.');const leaves=s.targets.filter(t=>t.plan_key===v.plan_key&&t.version===v.version);if(BigInt(v.parent_minor)!==BigInt(sum(leaves,'target_minor'))+BigInt(v.reserve_minor))add('TARGET_DOES_NOT_RECONCILE',origin+'.target_versions',v.plan_key,'Leaf + reserve harus sama dengan parent; parent tidak dijumlah ulang.');}
  for(const t of s.targets){const v=versions.get(t.plan_key),key=keyOf.targets(t);if(!v||v.version!==t.version||Boolean(t.customer_id)===Boolean(t.rep_id)||(t.customer_id&&!customers.has(t.customer_id))||(t.rep_id&&!users.has(t.rep_id))||!m.scope.area_ids.includes(t.area_id)||(t.product_id&&t.product_group_id))add('TARGET_REFERENCE_INVALID',origin+'.targets',key,'Versi/subject/area/product scope target tidak valid.');}
 }
 const mapping=pilotIdMapping.safeParse(mappingInput);
 if(!mapping.success)add('ID_MAPPING_REQUIRED','mapping','file','Lengkapi ledger ID canonical, alias eksplisit dan alasan.');
 else{const seen=new Set<string>(),canonicalTargets=new Map<string,number>();for(const row of mapping.data.mappings){const key=stableJson([row.entity,row.source_system,row.source_id]);if(seen.has(key))add('AMBIGUOUS_SOURCE_ID','mapping',key,'Satu ID sumber memiliki beberapa tujuan.');seen.add(key);if(row.source_system!==m.source_review.source_system)add('SOURCE_SYSTEM_MISMATCH','mapping',key,'Sistem sumber ledger berbeda dari manifest.');const target=stableJson([row.entity,row.nyales_id]);if(row.kind==='canonical')canonicalTargets.set(target,(canonicalTargets.get(target)||0)+1);else if(row.entity!=='customer')add('INVALID_ALIAS','mapping',key,'Alias migrasi hanya untuk customer dengan alasan eksplisit.');}
  for(const row of mapping.data.mappings)if(canonicalTargets.get(stableJson([row.entity,row.nyales_id]))!==1)add('CANONICAL_MAPPING_REQUIRED','mapping',row.nyales_id,'Setiap tujuan harus punya tepat satu mapping canonical; kode lain menjadi alias.');
  if(source){for(const [entity,values] of [['customer',source.customers.map(c=>c.id)],['user',source.users.map(u=>u.id)],['area',source.scope.area_ids]] as const)for(const value of values)if(canonicalTargets.get(stableJson([entity,value]))!==1)add('ID_MAPPING_INCOMPLETE','mapping',entity+':'+value,'ID snapshot belum memiliki mapping canonical.');for(const c of source.customers)if(!mapping.data.mappings.some(row=>row.entity==='customer'&&row.source_id===c.external_code&&row.nyales_id===c.id))add('CUSTOMER_CODE_MAPPING_MISMATCH','mapping',c.id,'Kode ERP customer harus cocok dengan ledger ID.');}
 }
 const comparisons:any[]=[];
 if(source&&nyales){for(const dataset of datasets){const a=new Map(source[dataset].map(r=>[keyOf[dataset](r),r])),b=new Map(nyales[dataset].map(r=>[keyOf[dataset](r),r]));let matched=0,missing=0,unexpected=0,changed=0;for(const [key,row] of a){const actual=b.get(key);if(!actual){missing++;add('MISSING_RECORD',dataset,key,'Record sumber tidak ditemukan di snapshot NYALES.');}else if(canonical(row)!==canonical(actual)){changed++;const fields=Object.keys(row).filter(k=>canonical((row as any)[k])!==canonical((actual as any)[k]));add('CHANGED_RECORD',dataset,key,'Field berbeda: '+fields.join(', '));}else matched++;}for(const key of b.keys())if(!a.has(key)){unexpected++;add('UNEXPECTED_RECORD',dataset,key,'Record NYALES tidak ditemukan pada snapshot sumber.');}comparisons.push({dataset,source_count:source[dataset].length,nyales_count:nyales[dataset].length,matched,missing,unexpected,changed});}}
 const totals=(s:PilotSnapshot)=>{const eligible=s.invoices.filter(i=>i.status==='validated'&&i.validation_state==='validated'),invoices=eligible.filter(i=>i.invoice_date>=s.scope.period_start&&i.invoice_date<=s.scope.period_end),approved=new Set(s.target_versions.filter(v=>v.status==='approved').map(v=>stableJson([v.plan_key,v.version])));return{customers:s.customers.length,sales:s.users.length,owners:s.owners.length,imported_invoice_records:s.invoices.length,imported_net_idr:sum(eligible,'net_minor'),eligible_invoices:invoices.length,excluded_invoices:s.invoices.filter(i=>i.invoice_date>=s.scope.period_start&&i.invoice_date<=s.scope.period_end).length-invoices.length,validated_credits:s.credits.filter(c=>c.status==='validated').length,invoice_net_idr:sum(invoices,'net_minor'),field_net_idr:sum(invoices.filter(i=>i.channel==='field'),'net_minor'),telesales_net_idr:sum(invoices.filter(i=>i.channel==='telesales'),'net_minor'),credit_idr:sum(s.credits.filter(c=>c.status==='validated'),'amount_minor'),approved_target_leaf_idr:sum(s.targets.filter(t=>approved.has(stableJson([t.plan_key,t.version]))),'target_minor'),approved_target_reserve_idr:sum(s.target_versions.filter(v=>v.status==='approved'),'reserve_minor')};};
 return{format:'nyales-pilot-reconciliation-1',pilot_id:m.pilot_id,data_classification:m.data_classification,status:issues.length?'blocked':'ready_for_named_review',production_accepted:false,live_mutations:false,pic:m.pic,capacity:{max_sales:m.max_sales,named_sales:m.participants.length,open_slots:Math.max(0,m.max_sales-m.participants.length)},scope:m.scope,comparisons,totals:{source:source?totals(source):null,nyales:nyales?totals(nyales):null},issues,acceptance_note:'Perbandingan snapshot terpetakan; bukan pengganti dry-run API, actual restore, UAT role/perangkat atau sign-off Finance/PIC.'};
}
