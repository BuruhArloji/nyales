// Offline, synthetic benchmark. Never uses Wrangler, credentials or remote D1.
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Hono} from 'hono';
import {database} from '../tests/sqlite-helper';
import {scopedRoutes} from '../src/server/index';

const label=process.argv[2]||'local';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Use a simple output label');
const size=Number(process.argv[3]||1000);
if(!Number.isInteger(size)||size<100||size>50000)throw new Error('Fixture size must be 100..50000');
const output=resolve('test-results/read-efficiency',label+'-'+size);
mkdirSync(output,{recursive:true});
const {sqlite,adapter}=database();
const today=new Date().toISOString().slice(0,10),month=today.slice(0,7)+'-01';
sqlite.exec(`INSERT INTO organization(id,name) VALUES('bench','Synthetic benchmark');
 INSERT INTO area(id,organization_id,name) VALUES('bench-area','bench','Area Synthetic');
 INSERT INTO app_user(id,organization_id,name) VALUES('bench-manager','bench','Synthetic Management'),('bench-rep','bench','Synthetic Rep');`);
const customer=sqlite.prepare("INSERT INTO customer_outlet(id,organization_id,area_id,name,transaction_history_unverified) VALUES(?,'bench','bench-area',?,?)");
const assignment=sqlite.prepare("INSERT INTO customer_assignment(id,organization_id,outlet_id,rep_id,channel,area_id,effective_from_date) VALUES(?,'bench',?,'bench-rep','field','bench-area','2020-01-01')");
const invoice=sqlite.prepare("INSERT INTO invoice(id,organization_id,source_invoice_id,source_version,outlet_id,rep_id,area_id,channel,invoice_date,net_minor,status,validation_state) VALUES(?,'bench',?,'1',?,'bench-rep','bench-area','field',?,10000,'validated','validated')");
sqlite.exec('BEGIN');
for(let i=0;i<size;i++){
 const id='bench-'+String(i).padStart(6,'0');
 customer.run(id,'Synthetic shop '+String(i).padStart(6,'0'),i<20?0:1);
 assignment.run('assignment-'+i,id);
 invoice.run('invoice-'+i,'source-'+i,id,month);
}
sqlite.exec('COMMIT');
type Trace={sql:string;params:any[];returned_rows:number;elapsed_ms:number};
let trace:Trace[]=[];
const measured={...adapter,prepare(sql:string){
 let params:any[]=[];
 const statement={bind(...p:any[]){params=p;return statement},
  async all(){const started=performance.now();const result=await adapter.prepare(sql).bind(...params).all();trace.push({sql,params,returned_rows:result.results.length,elapsed_ms:performance.now()-started});return result},
  async first(){const result=await statement.all();return result.results[0]??null},
  async run(){return adapter.prepare(sql).bind(...params).run()}};
 return statement;
}} as unknown as D1Database;
const app=new Hono();
app.use('*',async(c,next)=>{c.set('identity' as never,{id:'bench-manager',organization_id:'bench',name:'Synthetic',role:'MANAGEMENT'} as never);await next()});
app.route('/',scopedRoutes);
// Prepares the segmentation snapshot. Cold rebuilds are deliberately separate.
await app.request('/api/customers?limit=1',{}, {DB:measured});
const journeys:any[]=[];
for(const [name,path] of [['directory','/api/customers'],['detail','/api/customers/bench-000000'],['page','/api/customers?limit=100'],['missing','/api/customers/not-present']]){
 trace=[];const started=performance.now();const response=await app.request(path,{}, {DB:measured});
 const body=await response.json() as any;
 if(response.status!==(name==='missing'?404:200))throw new Error(name+': '+JSON.stringify(body));
 journeys.push({name,status:response.status,elapsed_ms:performance.now()-started,result_count:Array.isArray(body.data)?body.data.length:body.data?1:0,queries:trace});
}
const dbFile=join(output,'synthetic.sqlite');
// Repeated execution cannot accidentally reuse an earlier fixture.
const {existsSync,unlinkSync}=await import('node:fs');
if(existsSync(dbFile))unlinkSync(dbFile);
sqlite.prepare('VACUUM INTO ?').run(dbFile);
const traceFile=join(output,'query-traces.json');
writeFileSync(traceFile,JSON.stringify(journeys,null,2));
const replay=spawnSync('python',['scripts/read-efficiency-vm.py',dbFile,traceFile],{encoding:'utf8'});
if(replay.status!==0)throw new Error(replay.stderr||'Local SQLite replay failed');
const vm=JSON.parse(replay.stdout);
const report={schema_version:1,label,recorded_at:new Date().toISOString(),environment:'offline-synthetic-node-sqlite',customers:size,invoices:size,known_history_customers:20,source_date:today,
 source_sha256:createHash('sha256').update(readFileSync('src/server/index.ts')).digest('hex'),local_migrations:readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort(),
 caveats:['Single warm sample, no latency percentile or billing savings claim.','SQLite VM instructions and returned rows are local proxies, not D1 rows_read.','Snapshot construction excluded; scope queries included; Firebase/session gate and production telemetry excluded.','No network calls or remote D1 usage.'],
 d1_rows_read:null,journeys:journeys.map((j,index)=>({...j,queries:j.queries.map((q:Trace,i:number)=>({query_id:createHash('sha256').update(q.sql).digest('hex').slice(0,16),returned_rows:q.returned_rows,elapsed_ms:q.elapsed_ms,...vm[index][i]}))}))};
writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({report:join(output,'report.json'),customers:size,journeys:report.journeys.map(j=>({name:j.name,status:j.status,returned_rows:j.queries.reduce((sum:number,q:any)=>sum+q.returned_rows,0),sqlite_vm_steps:j.queries.reduce((sum:number,q:any)=>sum+q.sqlite_vm_steps,0)}))},null,2));
sqlite.close();
