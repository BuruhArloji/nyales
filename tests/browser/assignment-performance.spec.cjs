const{test,expect}=require('@playwright/test');
const{mkdir,writeFile}=require('node:fs/promises');
async function login(page){await page.goto('/#page=assignments',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Masuk sebagai Management',exact:true}).click();await expect(page.getByRole('heading',{name:'Distribusi sales',exact:true})).toBeVisible()}
test('12,320-customer assignment directory stays bounded, searches beyond page one, and rejects late results',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 const rows=Array.from({length:12320},(_,i)=>({id:'lag-'+i,name:'Toko '+String(i).padStart(5,'0'),external_code:'ERP-'+i,area_id:'a',area:'A',version:1,record_status:'active',owner:i%2?'Belum assigned':'Field fixture',field_rep_id:i%2?null:'field',telesales_owner:'Tele fixture',telesales_rep_id:'tele'}));
 let releaseOld;const oldResponse=new Promise(resolve=>releaseOld=resolve);
 await page.route('**/api/customers?**',async route=>{
  const q=new URL(route.request().url()).searchParams;requests.push(Object.fromEntries(q));
  if(!q.has('limit')||q.get('projection')!=='assignment')return route.fulfill({status:500,json:{code:'UNBOUNDED_REQUEST_REGRESSION'}});
  const search=q.get('q')||'';
  if(search==='Toko 00000')await oldResponse;
  const filtered=rows.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())||r.external_code.toLowerCase().includes(search.toLowerCase()));
  const offset=Number(q.get('offset')||0),limit=Number(q.get('limit'));
  try{await route.fulfill({json:{data:filtered.slice(offset,offset+limit),meta:{total:filtered.length,limit,offset}}})}catch(e){if(!route.request().failure()&&!page.isClosed())throw e}
 });
 await login(page);
 const table=page.locator('table').filter({has:page.getByRole('columnheader',{name:'PIC Sales lapangan',exact:true})});
 await expect(table.locator('tbody tr')).toHaveCount(100);
 await expect(page.getByLabel('Halaman distribusi')).toContainText('12.320 pelanggan');
 await page.getByRole('button',{name:'Berikutnya',exact:true}).click();
 await expect(table).toContainText('Toko 00100');
 const refsBefore=requests.length;
 await page.getByLabel('Cari customer distribusi',{exact:true}).fill('Toko 12319');
 await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table).toContainText('Toko 12319');
 expect(requests.at(-1).offset).toBe('0');
 await page.getByLabel('Cari customer distribusi',{exact:true}).fill('Toko 00000');
 await expect.poll(()=>requests.at(-1).q).toBe('Toko 00000');
 await page.getByLabel('Cari customer distribusi',{exact:true}).fill('Toko 12319');
 await expect(table).toContainText('Toko 12319');releaseOld();
 await expect(table).not.toContainText('Toko 00000');
 await page.getByLabel('Cari customer distribusi',{exact:true}).fill('');
 await expect(table.locator('tbody tr')).toHaveCount(100);
 await page.getByLabel('Kanal distribusi',{exact:true}).selectOption('telesales');
 await expect(page.getByRole('columnheader',{name:'PIC Telesales',exact:true})).toBeVisible();
 await expect.poll(()=>requests.at(-1).channel).toBe('telesales');
 expect(requests.every(r=>r.limit==='100')).toBe(true);expect(refsBefore).toBeGreaterThanOrEqual(2);
 await mkdir('test-results/assignment-performance',{recursive:true});
 await page.screenshot({path:'test-results/assignment-performance/desktop.png'});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/assignment-performance/mobile.png'});
 await writeFile('test-results/assignment-performance/bounded-requests.json',JSON.stringify({classification:'synthetic',total:12320,max_visible_rows:100,requests,page_errors:errors},null,2));
 await page.unrouteAll({behavior:'ignoreErrors'});expect(errors).toEqual([]);
});
test('real local API assignment history still opens after paging',async({page})=>{
 const requestReady=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/customers');
 await login(page);await expect(page.getByRole('button',{name:/^Riwayat /}).first()).toBeVisible();
 const request=await requestReady,headers=await request.allHeaders();
 const auth={Authorization:headers.authorization,'X-Device-Session':headers['x-device-session']};
 // Compare local telemetry for the legacy full load and bounded assignment load.
 // Keep credentials in memory and never include them in evidence files.
 const warm=await page.request.get('/api/customers',{headers:auth});expect(warm.status()).toBe(200);
 const measurements=[];
 for(const [name,url] of [['legacy-full-warm-cache','/api/customers'],['unprojected-page','/api/customers?limit=100&record_status=active&channel=field'],['assignment-page','/api/customers?limit=100&projection=assignment&record_status=active&channel=field']]){
  const response=await page.request.get(url,{headers:auth});expect(response.status()).toBe(200);
  const body=await response.json();measurements.push({name,request_id:response.headers()['x-request-id'],status:response.status(),cache_status:response.headers()['x-nyales-cache']||'uncached',customer_count:body.data.length});
 }
 await mkdir('test-results/assignment-performance',{recursive:true});await writeFile('test-results/assignment-performance/local-query-requests.json',JSON.stringify(measurements,null,2));
 await page.getByRole('button',{name:/^Riwayat /}).first().click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').getByRole('button',{name:'Tutup popup',exact:true})).toBeEnabled();
 await page.getByRole('dialog').getByRole('button',{name:'Tutup popup',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('territory exceptions load bounded choices only on expansion and retain a selection across searches',async({page})=>{
 const queries=[];
 await page.route('**/api/admin-boundaries/datasets',route=>route.fulfill({json:{data:[{id:'lookup-fixture',status:'active',release_version:'Lookup fixture'}],next:null}}));
 await page.route('**/api/admin-boundaries/datasets/lookup-fixture/boundaries',route=>route.fulfill({json:{data:[],next:null}}));
 await page.route('**/api/customers?**',route=>{
  const q=new URL(route.request().url()).searchParams;queries.push(Object.fromEntries(q));
  const id=q.get('q')==='Kedua'?'second':'first';
  return route.fulfill({json:{data:[{id,name:id==='second'?'Kedua':'Pertama',record_status:'active',version:1,area_id:'a',area:'A'}],meta:{total:1,limit:100,offset:0}}});
 });
 await login(page);await expect(page.getByRole('button',{name:'Riwayat Pertama',exact:true})).toBeVisible();
 expect(queries).toHaveLength(1);
 await page.getByRole('button',{name:'Atur pembagian wilayah',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Tindakan pelanggan',{exact:true})).toBeEnabled();
 await dialog.getByLabel('Tindakan pelanggan',{exact:true}).selectOption('field');
 expect(queries).toHaveLength(1);
 await dialog.locator('summary').filter({hasText:'Pengecualian pelanggan di luar pilihan kelurahan'}).click();
 const choices=dialog.getByLabel('Pelanggan pengecualian',{exact:true});
 await expect(choices).toBeEnabled();await expect(choices.locator('option')).toHaveCount(1);
 await choices.selectOption('first');
 await dialog.getByLabel('Cari pelanggan pengecualian',{exact:true}).fill('Kedua');
 await expect(choices.locator('option')).toHaveCount(2);
 await expect(choices.locator('option:checked')).toHaveText('Pertama');
 expect(queries.every(q=>q.limit==='100'&&q.projection==='assignment')).toBe(true);
 await dialog.getByRole('button',{name:'Tutup popup',exact:true}).click();await expect(dialog).toHaveCount(0);
});

test('opening workload directly does not fetch the hidden assignment directory',async({page})=>{
 const customerRequests=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/customers')customerRequests.push(r.url())});
 await page.goto('/#page=assignments&assignment_view=workload',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Masuk sebagai Management',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Beban kerja & simulasi wilayah',exact:true})).toBeVisible();
 expect(customerRequests).toHaveLength(0);
});
