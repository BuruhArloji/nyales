const {test,expect}=require('@playwright/test');
const {default:AxeBuilder}=require('@axe-core/playwright');

const pages=[
 ['Analitik','Overview','overview'],['Analitik','Monitoring','monitoring'],['Analitik','Insentif','incentives'],
 ['Pelanggan','Pelanggan','customers'],['Pelanggan','Distribusi sales','assignments'],['Pelanggan','Peta customer','map'],
 ['Penjualan','Target & pencapaian','targets'],['Penjualan','Invoice & actual','invoices'],['Penjualan','Pipeline & order','commercial'],['Penjualan','Produk & harga','products'],['Penjualan','Status & tier','segmentation'],
 ['Aktivitas','Aktivitas lapangan','work'],['Aktivitas','Telesales','telesales'],
 ['Kelola','User & Hirarki','people'],['Kelola','Pengaturan','settings'],['Kelola','Sesi perangkat','sessions'],['Kelola','Import & duplikat','data'],['Kelola','Kesehatan sistem','observability'],['Kelola','Recovery & retensi','recovery']
];
async function navigate(page,name){const [group,,id]=pages.find(x=>x[1]===name);if(!await page.getByRole('navigation',{name:'Halaman workspace'}).getByRole('button',{name,exact:true}).count())await page.getByRole('navigation',{name:'Kelompok workspace'}).getByRole('button',{name:group,exact:true}).click();await page.getByRole('navigation',{name:'Halaman workspace'}).getByRole('button',{name,exact:true}).click();await expect(page.locator('.page-scene')).toHaveAttribute('data-page',id);await expect(page.locator('.page-scene h1')).toBeVisible();await page.locator('.page-scene .nyales-loading').first().waitFor({state:'hidden',timeout:20000}).catch(()=>{});}
async function login(page){await page.goto('/');await page.getByRole('button',{name:'Masuk demo lokal',exact:true}).click();await expect(page.getByRole('navigation',{name:'Halaman workspace'})).toBeVisible();await expect(page.getByRole('group',{name:'Tren actual invoice enam bulan'})).toBeVisible();}
async function api(page,path){return page.evaluate(async path=>{const session=JSON.parse(sessionStorage.getItem('nyales-device-session'));const r=await fetch(path,{headers:{Authorization:'Bearer nyales-local-demo','X-Device-Session':session.session_token}});if(!r.ok)throw new Error('API '+r.status+' '+path);return (await r.json()).data},path)}
async function readStore(page,store){return page.evaluate(store=>new Promise((resolve,reject)=>{const r=indexedDB.open('nyales-work-v1',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>{resolve(q.result);db.close()};q.onerror=()=>reject(q.error)};r.onerror=()=>reject(r.error)}),store)}
async function close(page){await page.getByRole('dialog').getByRole('button',{name:'Tutup popup',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)}
async function audit(page,testInfo,label){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await testInfo.attach('axe-'+label,{body:JSON.stringify({url:result.url,violations:result.violations},null,2),contentType:'application/json'});expect.soft(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),label).toEqual([])}
test.beforeAll(async({request})=>{const response=await request.get('/api/health');expect(response.ok()).toBe(true);expect((await response.json()).environment).toBe('local')});
test.beforeEach(async({page})=>{await login(page)});

test('smoke all workspace pages and 320/390/768/1440 reflow retain chart and scoped content',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const[,name,id]of pages){await navigate(page,name);for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1100});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),{message:name+' overflow at '+width}).toBe(true)}
  if(['overview','monitoring','recovery'].includes(id))await page.screenshot({path:testInfo.outputPath(id+'-desktop.png'),fullPage:true});
 }
 await navigate(page,'Overview');await expect(page.getByRole('group',{name:'Tren actual invoice enam bulan'})).toBeVisible();const overview=await api(page,'/api/dashboard');expect(Object.hasOwn(overview,'customer_status_unknown_count')).toBe(true);if(overview.active_customer_count===null)await expect(page.locator('.metric').filter({hasText:'Customer aktif'})).toContainText('Belum lengkap');expect(errors).toEqual([]);
});

test('automated accessibility audit of representative pages and dialogs',async({page},testInfo)=>{
 for(const name of ['Overview','Monitoring','Insentif','Pelanggan','Pipeline & order','User & Hirarki','Recovery & retensi']){await navigate(page,name);await audit(page,testInfo,name)}
 await navigate(page,'User & Hirarki');await page.getByRole('button',{name:'Tambah pelaporan',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await audit(page,testInfo,'hierarchy-dialog');await close(page);
});

test('keyboard modal focus trapping Escape restoration and tab arrow navigation',async({page})=>{
 await navigate(page,'User & Hirarki');const trigger=page.getByRole('button',{name:'Tambah pelaporan',exact:true});await trigger.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 for(let n=0;n<18;n++){await page.keyboard.press('Tab');expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true)}
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await navigate(page,'Insentif');const statements=page.getByRole('tab',{name:'Statement',exact:true});await statements.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Skema',exact:true})).toBeFocused();await expect(page.getByRole('tab',{name:'Skema',exact:true})).toHaveAttribute('aria-selected','true');
});

test('smoke Monitoring paginated drilldown export and channel filters',async({page})=>{
 await navigate(page,'Monitoring');const freshness=await page.getByText(/Refresh layar tidak mengubah tanggal sumber/).innerText();
 const trigger=page.getByRole('button',{name:'Pelanggan dalam scope: Lihat record sumber',exact:true}).first();await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Record per halaman')).toBeVisible();await dialog.getByLabel('Record per halaman').selectOption('10');await expect(dialog.getByText(/Halaman 1 ·/)).toBeVisible();if(await dialog.getByRole('button',{name:'Berikutnya',exact:true}).isEnabled()){await dialog.getByRole('button',{name:'Berikutnya',exact:true}).click();await expect(dialog.getByText(/Halaman 2 ·/)).toBeVisible();await dialog.getByRole('button',{name:'Sebelumnya',exact:true}).click();await expect(dialog.getByText(/Halaman 1 ·/)).toBeVisible()}await close(page);
 for(const channel of ['field','telesales','']){await page.getByLabel('Kanal monitoring',{exact:true}).selectOption(channel);await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan'})).toBeVisible()}
 await page.getByRole('button',{name:'Ekspor laporan',exact:true}).click();await page.getByLabel('Alasan / penyelesaian',{exact:true}).fill('UAT WEB-059 synthetic local export');const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Simpan',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/^NYALES-/);await expect(dialog).toHaveCount(0);expect(freshness).toContain('sumber');
});

test('request failure preserves an actionable retry in drilldown and recovers',async({page})=>{
 await navigate(page,'Monitoring');await page.route('**/api/dashboard/sources?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'UAT_TEMPORARY_UNAVAILABLE',detail:'Gangguan uji sementara'})}));
 await page.getByRole('button',{name:'Pelanggan dalam scope: Lihat record sumber',exact:true}).first().click();const d=page.getByRole('dialog');await expect(d.getByRole('alert')).toContainText('Gangguan uji sementara');await page.unroute('**/api/dashboard/sources?**');await d.getByRole('button',{name:'Coba lagi',exact:true}).click();await expect(d.getByText(/Halaman 1 ·/)).toBeVisible();await close(page);
 await page.route('**/api/dashboard/summary?**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'UAT_TEMPORARY_UNAVAILABLE',detail:'Gangguan ringkasan sementara'})}));await page.getByLabel('Kanal monitoring',{exact:true}).selectOption('field');await expect(page.getByRole('alert')).toContainText('Gangguan ringkasan sementara');await page.unroute('**/api/dashboard/summary?**');await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan'})).toBeVisible();
});

test('4G simulation loads scoped Monitoring and reduced motion remains available',async({page,context},testInfo)=>{
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8});
 const start=Date.now();await navigate(page,'Monitoring');await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan'})).toBeVisible();expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 await testInfo.attach('4g-local',{body:JSON.stringify({simulated_rtt_ms:150,download_bps:1600000,upload_bps:750000,wall_ms:Date.now()-start,boundary:'Chrome network simulation; not physical 4G or field SLA'}),contentType:'application/json'});await cdp.detach();
});

test('offline order draft survives reload and sync retry keeps one order and original invoice totals',async({page,context})=>{
 const before=(await api(page,'/api/invoices')).map(i=>[i.id,i.net_minor,i.status]);const customers=await api(page,'/api/customers'),products=await api(page,'/api/products');const c=customers.find(c=>c.record_status==='active'),product=products.find(p=>p.status==='active');expect(c).toBeTruthy();expect(product).toBeTruthy();const reason='UAT WEB-059 order '+crypto.randomUUID();
 await navigate(page,'Pipeline & order');await page.getByRole('tab',{name:'Order',exact:true}).click();await page.getByRole('button',{name:'Tambah order',exact:true}).click();let d=page.getByRole('dialog');await d.getByLabel('Pelanggan',{exact:true}).selectOption(c.id);await d.getByLabel('Produk',{exact:true}).selectOption(product.id);await d.getByLabel('Kuantitas',{exact:true}).fill('1');await d.getByLabel('Harga satuan (Rp)',{exact:true}).fill('10000');await d.getByLabel('Sumber / dasar harga',{exact:true}).fill('Synthetic UAT price');await d.getByLabel('Alasan / dasar keputusan',{exact:true}).fill(reason);await d.getByRole('button',{name:'Simpan draft perangkat',exact:true}).click();await expect.poll(()=>readStore(page,'drafts').then(rows=>rows.find(r=>r.id==='demo-org:demo-management:order')?.payload?.draft?.reason)).toBe(reason);await close(page);
 await page.reload();await navigate(page,'Pipeline & order');await page.getByRole('tab',{name:'Order',exact:true}).click();await page.getByRole('button',{name:'Tambah order',exact:true}).click();d=page.getByRole('dialog');await d.getByRole('button',{name:'Pulihkan draft',exact:true}).click();await expect(d.getByLabel('Alasan / dasar keputusan',{exact:true})).toHaveValue(reason);
 await context.setOffline(true);await d.getByRole('button',{name:'Simpan',exact:true}).click();await expect(d).toHaveCount(0);await expect(page.getByRole('button',{name:'Sinkronkan 1 event',exact:true})).toBeVisible();const pending=(await readStore(page,'events')).find(e=>e.payload.reason===reason);expect(pending.status).toBe('pending');
 await page.route('**/api/sync/events',async route=>{await route.fetch();await route.abort('failed')});await context.setOffline(false);
 await expect.poll(async()=>{const orders=await api(page,'/api/orders');return orders.filter(o=>o.reason===reason).length},{timeout:30000}).toBe(1);
 expect((await readStore(page,'events')).find(e=>e.id===pending.id).status).toBe('pending');await page.unroute('**/api/sync/events');await page.getByRole('button',{name:'Sinkronkan 1 event',exact:true}).click();await expect.poll(()=>readStore(page,'events').then(es=>es.find(e=>e.id===pending.id)?.status)).toBe('synced');expect((await api(page,'/api/orders')).filter(o=>o.reason===reason)).toHaveLength(1);
 const orders=await api(page,'/api/orders'),order=orders.find(o=>o.reason===reason);const row=page.getByRole('row').filter({hasText:reason});await row.getByRole('button',{name:'Batalkan',exact:true}).click();await page.getByLabel('Alasan / dasar keputusan',{exact:true}).fill('UAT selesai; order simulasi dibatalkan');await page.getByRole('dialog').getByRole('button',{name:'Simpan',exact:true}).click();await expect.poll(async()=>(await api(page,'/api/orders')).find(o=>o.id===order.id)?.status).toBe('cancelled');expect((await api(page,'/api/invoices')).map(i=>[i.id,i.net_minor,i.status])).toEqual(before);
});

test('smoke logout revokes current token and second browser session stays active',async({page,browser})=>{
 const context=await browser.newContext({timezoneId:'Asia/Jakarta'});const other=await context.newPage();await login(other);const s=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('nyales-device-session')));
 await page.getByRole('button',{name:'Keluar',exact:true}).click();await expect(page.getByRole('button',{name:'Masuk demo lokal',exact:true})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('nyales-device-session'))).toBeNull();
 const status=await page.evaluate(async s=>(await fetch('/api/me',{headers:{Authorization:'Bearer nyales-local-demo','X-Device-Session':s.session_token}})).status,s);expect(status).toBe(401);expect((await api(other,'/api/me')).id).toBe('demo-management');await other.getByRole('button',{name:'Keluar',exact:true}).click();await context.close();
});
