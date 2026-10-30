const{test,expect}=require('@playwright/test');
const{build}=require('esbuild');
const{createServer}=require('node:http');
const{readFile,mkdir}=require('node:fs/promises');
const{resolve,extname}=require('node:path');
let server,origin;
test.beforeAll(async()=>{
 await mkdir('test-results/navigation',{recursive:true});
 await build({entryPoints:['src/client/main.tsx'],bundle:true,outfile:'test-results/navigation/app.js',jsx:'automatic',platform:'browser',loader:{'.woff2':'file','.woff':'file','.ttf':'file'},external:['/fonts/*'],define:{'import.meta.env':'{}'},plugins:[
  {name:'navigation-auth-fixture',setup(b){b.onResolve({filter:/^\.\/auth$/},a=>a.importer.includes('src'+require('node:path').sep+'client')?{path:resolve('tests/fixtures/navigation-auth.tsx')}:undefined)}},
  {name:'worker-url-fixture',setup(b){b.onResolve({filter:/maplibre-gl-worker\.mjs\?url$/},()=>({path:'map-worker-url',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/map-worker.js"',loader:'js'}))}}
 ]});
 server=createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});res.end('{"code":"FIXTURE_NO_DATA"}');return}
  const name=req.url.split('?')[0];
  if(name==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');return}
  const file=name.startsWith('/brand/')?resolve('public'+name):resolve('test-results/navigation','.'+name);
  if(!file.startsWith(resolve('test-results/navigation'))&&!file.startsWith(resolve('public/brand')))throw Error('Invalid fixture file');
  const type={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream';
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':type});res.end(bytes);
 }catch{res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(r=>server?.close(r))});

test('real app keeps sidebar mounted and closes/opens pills horizontally across routes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.evaluate(()=>document.fonts.ready);
 const nav=page.getByRole('navigation',{name:'Kelompok workspace'}),analytics=nav.getByRole('button',{name:'Analitik'}),customers=nav.getByRole('button',{name:'Pelanggan'});
 await expect(analytics).toHaveAttribute('aria-current','true');
 await page.evaluate(()=>{window.__sidebar=document.querySelector('.sidebar');window.__analytics=document.querySelector('.rail-item.active');window.__workspace=document.querySelector('.workspace-tabs')});
 await customers.click();
 expect(await page.evaluate(()=>window.__sidebar===document.querySelector('.sidebar')&&window.__analytics.isConnected)).toBe(true);
 const widths=await page.evaluate(async()=>{const old=window.__analytics,next=document.querySelector('.rail-item.active'),samples=[];const start=performance.now();while(performance.now()-start<800){samples.push([old.getBoundingClientRect().width,next.getBoundingClientRect().width]);await new Promise(requestAnimationFrame)}return samples});
 expect(widths.some(([a,b])=>a>45&&a<123&&b>45&&b<123)).toBe(true);
 expect(widths.at(-1)[0]).toBeCloseTo(44,0);expect(widths.at(-1)[1]).toBeCloseTo(124,0);
 await nav.getByRole('button',{name:'Analitik'}).click();await page.waitForTimeout(650);
 await page.evaluate(()=>{window.__overview=document.querySelector('.workspace-tabs button[aria-current="page"]')});
 await page.getByRole('navigation',{name:'Halaman workspace'}).getByRole('button',{name:'Monitoring',exact:true}).click();
 expect(await page.evaluate(()=>window.__overview.isConnected&&window.__sidebar===document.querySelector('.sidebar'))).toBe(true);
 await page.goBack();await expect(page.getByRole('navigation',{name:'Halaman workspace'}).getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-current','page');
 expect(await page.evaluate(()=>window.__overview===document.querySelector('.workspace-tabs button[aria-current="page"]'))).toBe(true);
 await page.screenshot({path:'test-results/navigation/sidebar.png'});expect(errors).toEqual([]);
});

test('mobile rapid navigation and reduced motion preserve sidebar identity',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin);
 await page.evaluate(()=>window.__sidebar=document.querySelector('.sidebar'));
 await page.evaluate(()=>{const nav=document.querySelector('.sidebar nav');for(const label of ['Pelanggan','Penjualan','Analitik'])nav.querySelector(`[aria-label="${label}"]`).click()});
 await expect(page.getByRole('navigation',{name:'Kelompok workspace'}).getByRole('button',{name:'Analitik'})).toHaveAttribute('aria-current','true');
 expect(await page.evaluate(()=>window.__sidebar===document.querySelector('.sidebar'))).toBe(true);
 expect(await page.locator('.rail-item.active').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('same-page URL filters still remount data panels without resetting the shell',async({page})=>{
 await page.goto(origin+'/#page=customers&area_id=first');
 await expect.poll(()=>page.evaluate(()=>window.__navigationFetches?.filter(p=>p?.startsWith('/api/customers')).length||0)).toBeGreaterThan(0);
 const before=await page.evaluate(()=>{window.__sidebar=document.querySelector('.sidebar');return window.__navigationFetches.filter(p=>p?.startsWith('/api/customers')).length});
 await page.evaluate(()=>location.hash='page=customers&area_id=second');
 await expect.poll(()=>page.evaluate(()=>window.__navigationFetches.filter(p=>p?.startsWith('/api/customers')).length)).toBeGreaterThan(before);
 expect(await page.evaluate(()=>window.__sidebar===document.querySelector('.sidebar'))).toBe(true);
 await page.goBack();await expect(page).toHaveURL(/area_id=first/);
 expect(await page.evaluate(()=>window.__sidebar===document.querySelector('.sidebar'))).toBe(true);
});

test('hierarchy cards support clicks, collapse, search, existing forms and responsive canvas',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  const person=(id,name,role_code,channel)=>({id,name,role_code,channel,status:'active',version:1});
  const users=[person('head','Management UAT','MANAGEMENT',null),person('spv','Supervisor UAT','SUPERVISOR','field'),person('ayu','Ayu UAT','SALES_REP','field'),person('tele','Telesales UAT','TELESALES','telesales')];
  window.__navigationResponses={'/api/users':users,'/api/areas':[{id:'west',name:'Barat UAT',status:'active'}],'/api/hierarchy-assignments':[{id:'report',manager_id:'spv',subordinate_id:'ayu',area_id:'west',channel:'field',effective_from_date:'2026-01-01',effective_to_date:null,version:1}],'/api/users/ayu':{...users[2],roles:[],areas:[]}};
 });
 await page.goto(origin+'/#page=people');await page.getByLabel('Tanggal pelaporan',{exact:true}).fill('2026-10-29');
 await expect(page.locator('.org-person')).toHaveCount(3);
 await expect(page.locator('.org-canvas').getByRole('combobox',{name:'Tampilan hirarki',exact:true})).toHaveValue('chart');
 await page.getByRole('button',{name:'Buka tim Supervisor UAT',exact:true}).click();await expect(page.locator('.org-person')).toHaveCount(4);
 await page.getByRole('button',{name:'Lipat tim Supervisor UAT',exact:true}).click();await expect(page.locator('.org-person')).toHaveCount(3);
 await page.getByRole('searchbox',{name:'Cari anggota hirarki'}).fill('Ayu');await page.locator('.org-search-results button').click();
 const detail=page.getByRole('complementary',{name:'Detail Ayu UAT'});await expect(detail).toBeVisible();
 await detail.getByRole('button',{name:'Atur atasan',exact:true}).click();await expect(page.getByRole('combobox',{name:'Anggota',exact:true})).toHaveValue('ayu');await page.getByRole('button',{name:'Tutup popup',exact:true}).click();
 await detail.getByRole('button',{name:'Kelola user',exact:true}).click();await expect(page.getByRole('dialog',{name:'Kelola Ayu UAT',exact:true})).toBeVisible();await page.getByRole('button',{name:'Tutup popup',exact:true}).click();
 await page.getByRole('button',{name:'Tutup detail anggota'}).click();
 await page.getByRole('combobox',{name:'Kanal hirarki',exact:true}).selectOption('telesales');await expect(page.getByRole('button',{name:'Lihat Ayu UAT',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Kanal hirarki',exact:true}).selectOption('');
 await page.getByRole('combobox',{name:'Tampilan hirarki',exact:true}).selectOption('history');await expect(page.getByRole('heading',{name:'Histori pelaporan',exact:true})).toBeVisible();await page.getByRole('combobox',{name:'Tampilan hirarki',exact:true}).selectOption('chart');
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.locator('.org-chart-stage').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.org-person')].some(n=>{const p=n.getBoundingClientRect();return p.left>=r.left&&p.right<=r.right&&p.top>=r.top&&p.bottom<=r.bottom})})).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('hierarchy opens in chart mode after leaving history',async({page})=>{
 await page.addInitScript(()=>{window.__navigationResponses={'/api/users':[],'/api/areas':[],'/api/hierarchy-assignments':[]}});
 await page.goto(origin+'/#page=people');
 const picker=page.locator('.org-canvas').getByRole('combobox',{name:'Tampilan hirarki',exact:true});
 await expect(picker).toHaveValue('chart');await picker.selectOption('history');
 await expect(page.getByRole('heading',{name:'Histori pelaporan',exact:true})).toBeVisible();
 await page.reload();await expect(picker).toHaveValue('chart');
 await expect(page.getByRole('heading',{name:'Histori pelaporan',exact:true})).toHaveCount(0);
});
