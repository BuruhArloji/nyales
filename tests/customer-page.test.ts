import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Hono} from 'hono';
import {database} from './sqlite-helper';
import {scopedRoutes} from '../src/server/index';

function harness(role='MANAGEMENT',userArea?:string){
  const {sqlite,adapter}=database();
  sqlite.exec(`
    INSERT INTO organization(id,name) VALUES('o','Org');
    INSERT INTO area(id,organization_id,name) VALUES('a1','o','Area Satu'),('a2','o','Area Dua');
    INSERT INTO app_user(id,organization_id,name) VALUES('mg','o','Management'),('am','o','Manager');
    ${userArea?`INSERT INTO user_area_scope VALUES('o','am','${userArea}','2020-01-01',NULL);`:''}
  `);
  for(let i=1;i<=12;i++){
    const area=i<=7?'a1':'a2';
    sqlite.exec(`INSERT INTO customer_outlet(id,organization_id,area_id,name,address,latitude_e7,longitude_e7,record_status,coordinate_status) VALUES('c${String(i).padStart(2,'0')}','o','${area}','Warung ${String(i).padStart(2,'0')}','Jl. ${i}',${i%3===0?'NULL':'-61000000'},${i%3===0?'NULL':'106800000'},'${i%4===0?'inactive':'active'}','${i%3===0?'missing':'unverified'}')`);
  }
  const app=new Hono();
  app.use('*',async(c,next)=>{
    c.set('identity' as never,{id:role==='AREA_MANAGER'?'am':'mg',name:'Actor',organization_id:'o',role} as never);
    await next();
  });
  app.route('/',scopedRoutes);
  return{get:(path:string)=>app.request(path,{method:'GET'},{DB:adapter})};
}

test('paged customer directory returns one page and the real total',async()=>{
  const {get}=harness();
  const first=await get('/api/customers?limit=5');
  assert.equal(first.status,200);
  const body=await first.json() as any;
  assert.equal(body.data.length,5);
  assert.equal(body.meta.total,12);
  assert.equal(body.meta.limit,5);
  assert.equal(body.meta.offset,0);
  assert.equal(body.data[0].name,'Warung 01');
  assert.equal(body.data[0].area,'Satu');

  const last=await get('/api/customers?limit=5&offset=10');
  const tail=await last.json() as any;
  assert.equal(tail.data.length,2);
  assert.equal(tail.data[1].name,'Warung 12');
});

test('paged customer directory filters inside SQLite',async()=>{
  const {get}=harness();
  const byQuery=await (await get('/api/customers?limit=10&q=warung 03')).json() as any;
  assert.equal(byQuery.meta.total,1);
  assert.equal(byQuery.data[0].name,'Warung 03');

  const byArea=await (await get('/api/customers?limit=10&area_id=a2')).json() as any;
  assert.equal(byArea.meta.total,5);
  assert.ok(byArea.data.every((row:any)=>row.area==='Dua'));

  const archived=await (await get('/api/customers?limit=10&record_status=inactive')).json() as any;
  assert.equal(archived.meta.total,3);
  assert.ok(archived.data.every((row:any)=>row.record_status==='inactive'));

  const missing=await (await get('/api/customers?limit=10&location=missing')).json() as any;
  assert.equal(missing.meta.total,4);
});

test('paged customer directory honours scope and validates paging',async()=>{
  const areaManager=harness('AREA_MANAGER','a1');
  const scoped=await (await areaManager.get('/api/customers?limit=100')).json() as any;
  assert.equal(scoped.meta.total,7);
  assert.ok(scoped.data.every((row:any)=>row.area_id==='a1'));

  const {get}=harness();
  assert.equal((await get('/api/customers?limit=0')).status,422);
  assert.equal((await get('/api/customers?limit=500')).status,422);
  assert.equal((await get('/api/customers?limit=5&offset=-1')).status,422);
});

test('full directory mode still returns the whole scoped list',async()=>{
  const {get}=harness();
  const response=await get('/api/customers');
  assert.equal(response.status,200);
  const body=await response.json() as any;
  assert.equal(body.data.length,12);
});
