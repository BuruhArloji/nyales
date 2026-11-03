import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {scopedRoutes} from '../src/server/index';

function fixture(){
 const {sqlite,adapter}=database();
 sqlite.exec(`INSERT INTO organization(id,name) VALUES('o','Org'),('x','Other');
 INSERT INTO area(id,organization_id,name) VALUES('a','o','Area A'),('b','o','Area B'),('x','x','Other');
 INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Manager'),('am','o','Area Manager'),('sr','o','Rep'),('tele','o','Tele');
 INSERT INTO user_area_scope VALUES('o','am','a','2020-01-01',NULL),('o','sr','a','2020-01-01',NULL);
 INSERT INTO customer_outlet(id,organization_id,area_id,name) VALUES('foreign','x','x','Foreign');`);
 const insert=sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,external_code) VALUES(?,'o',?,?,?)");
 for(let i=0;i<235;i++)insert.run('c'+String(i).padStart(3,'0'),i<220?'a':'b','Toko '+String(i).padStart(3,'0'),'ERP-'+i);
 sqlite.exec(`INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,effective_from_date) VALUES('f','o','c000','sr','field','2020-01-01'),('t','o','c001','tele','telesales','2020-01-01');`);
 const queries:string[]=[];
 const db=new Proxy(adapter,{get(target,key){if(key==='prepare')return(sql:string)=>{queries.push(sql);return target.prepare(sql)};const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}});
 const get=(query:string,role='MANAGEMENT')=>{
  const app=new Hono();app.use('*',async(c,next)=>{c.set('identity' as never,{id:role==='TELESALES'?'tele':role==='SALES_REP'?'sr':role==='AREA_MANAGER'?'am':'mg',organization_id:'o',name:'Actor',role} as never);await next()});app.route('/',scopedRoutes);
  return app.request('/api/customers?limit=100&projection=assignment&'+query,{}, {DB:db});
 };
 return{sqlite,queries,get};
}
test('assignment projection pages globally and omits segmentation and invoice work',async()=>{
 const {sqlite,queries,get}=fixture();
 const first=await (await get('')).json() as any;
 const second=await (await get('offset=100')).json() as any;
 assert.equal(first.meta.total,235);assert.equal(first.data.length,100);assert.equal(second.data[0].id,'c100');
 assert.equal(first.data[0].owner,'Rep');assert.equal(first.data[1].telesales_owner,'Tele');
 assert.ok(!('actual_minor' in first.data[0]));assert.ok(!('segmentation' in first.data[0]));
 assert.ok(!queries.some(q=>/\b(invoice|customer_status_snapshot|customer_segmentation_run)\b/i.test(q)));
 assert.equal((sqlite.prepare('SELECT COUNT(*) n FROM customer_segmentation_run').get() as any).n,0);
 const outsideFirstPage=await(await get('q=ERP-234')).json() as any;
 assert.equal(outsideFirstPage.meta.total,1);assert.equal(outsideFirstPage.data[0].id,'c234');
 const tail=await(await get('offset=200')).json() as any;assert.equal(tail.data.length,35);
 assert.equal((await get('status=Aktif')).status,422);
 sqlite.close();
});
test('assignment filters and role scope count the entire cohort, not only the first page',async()=>{
 const {sqlite,get}=fixture();
 const assigned=await(await get('channel=field&assignment_status=assigned')).json() as any;
 assert.equal(assigned.meta.total,1);assert.equal(assigned.data[0].id,'c000');
 const unassigned=await(await get('channel=telesales&assignment_status=unassigned')).json() as any;assert.equal(unassigned.meta.total,234);
 const area=await(await get('area_id=b')).json() as any;assert.equal(area.meta.total,15);
 for(const [role,count] of [['MANAGEMENT',235],['NSM',235],['AREA_MANAGER',220],['SALES_REP',220],['TELESALES',1],['SUPERVISOR',0]] as const){
  const result=await(await get('',role)).json() as any;assert.equal(result.meta.total,count,role);assert.ok(result.data.every((r:any)=>r.id!=='foreign'));
 }
 sqlite.close();
});
test('merged source ownership remains searchable in bounded assignment projection',async()=>{
 const {sqlite,get}=fixture();
 sqlite.exec("UPDATE customer_outlet SET merged_into_id='c002',record_status='inactive' WHERE id='c000';INSERT INTO customer_alias VALUES('o','c000','c002','ERP-0','2020-01-01','mg','Same location')");
 const row=await(await get('rep_id=sr&channel=field&assignment_status=assigned')).json() as any;
 assert.equal(row.meta.total,1);assert.equal(row.data[0].id,'c002');assert.equal(row.data[0].field_rep_id,'sr');
 sqlite.close();
});
