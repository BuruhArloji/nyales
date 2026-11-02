const{test,expect}=require('@playwright/test');
const{mkdir,writeFile}=require('node:fs/promises');
test.beforeEach(async({page})=>{page.uiErrors=[];page.on('pageerror',error=>page.uiErrors.push(error.message))});
test.afterEach(async({page})=>{expect(page.uiErrors).toEqual([])});

async function enter(page,path){
 await page.goto('/#page='+path,{waitUntil:'domcontentloaded'});
 const login=page.getByRole('button',{name:'Masuk sebagai Management',exact:true});
 await expect(login).toBeVisible();await login.click();
 await expect(page.getByRole('navigation',{name:'Halaman workspace'})).toBeVisible();
}
function requests(page){
 const seen=[];page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname.startsWith('/api/'))seen.push(new URL(r.url()))});
 return{seen,count:path=>seen.filter(u=>u.pathname===path).length};
}
async function evidence(name,data){await mkdir('test-results/read-frontend',{recursive:true});await writeFile('test-results/read-frontend/'+name+'.json',JSON.stringify(data,null,2))}

test('customer filters fetch only the directory; references remain available',async({page})=>{
 const r=requests(page);await enter(page,'customers');
 await expect(page.getByRole('searchbox',{name:'Cari customer'})).toBeVisible();
 const before={customers:r.count('/api/customers'),contacts:r.count('/api/contacts'),areas:r.count('/api/areas')};
 expect(before.contacts).toBe(1);expect(before.areas).toBe(1);
 await page.getByRole('searchbox',{name:'Cari customer'}).fill('Toko');
 await expect.poll(()=>r.seen.filter(u=>u.pathname==='/api/customers'&&u.searchParams.get('q')==='Toko').length).toBe(1);
 await expect(page.getByRole('searchbox',{name:'Cari customer'})).toBeVisible();
 const after={customers:r.count('/api/customers'),contacts:r.count('/api/contacts'),areas:r.count('/api/areas')};
 await evidence('customer-filter',{before,after});
 expect(after.contacts).toBe(before.contacts);expect(after.areas).toBe(before.areas);
 await page.getByRole('tab',{name:'Kontak',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Kontak',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/read-frontend/contacts.png'});
});

test('customer reference failure can be retried without leaving an empty form',async({page})=>{
 const r=requests(page);let failures=0;
 await page.route('**/api/areas',route=>{if(failures++===0)return route.fulfill({status:503,json:{code:'REFERENCE_TEST_UNAVAILABLE'}});return route.continue()});
 await enter(page,'customers');
 await expect(page.getByRole('alert')).toContainText('REFERENCE_TEST_UNAVAILABLE');
 await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
 await expect(page.getByRole('searchbox',{name:'Cari customer'})).toBeVisible();
 expect(r.count('/api/areas')).toBe(2);
 await page.getByRole('button',{name:'Tambah pelanggan',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.locator('dialog select[aria-label="Area"] option').count()).toBeGreaterThan(1);
});

test('customer save refreshes references rather than retaining an obsolete copy',async({page})=>{
 const r=requests(page);await enter(page,'customers');
 await expect(page.getByRole('searchbox',{name:'Cari customer'})).toBeVisible();
 // Simulates a successful write acknowledgement without modifying the synthetic DB.
 let writes=0;await page.route('**/api/customers/*',route=>{
  if(route.request().method()==='PUT'){writes++;return route.fulfill({status:200,json:{data:{}}})}
  return route.continue();
 });
 await page.getByRole('button',{name:/^Edit /}).first().click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Simpan pelanggan',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('searchbox',{name:'Cari customer'})).toBeVisible();
 expect(writes).toBe(1);expect(r.count('/api/contacts')).toBe(2);expect(r.count('/api/areas')).toBe(2);
});

test('monitoring loads customer choices only for a relevant form and waits for them',async({page})=>{
 const r=requests(page);await enter(page,'monitoring');
 await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan',exact:true})).toBeVisible();
 expect(r.count('/api/customers')).toBe(0);
 await page.getByRole('tab',{name:'Coaching',exact:true}).click();
 await expect(page.getByRole('button',{name:'Tambah coaching',exact:true})).toBeVisible();
 let release;const hold=new Promise(resolve=>release=resolve);
 await page.route('**/api/customers',async route=>{await hold;return route.continue()});
 await page.getByRole('button',{name:'Tambah coaching',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await expect.poll(()=>r.count('/api/customers')).toBe(1);
 await expect(dialog.getByRole('button',{name:'Simpan',exact:true})).toBeDisabled();
 release();
 await expect(dialog.getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
 expect(await dialog.locator('select[aria-label="Pelanggan"] option').count()).toBeGreaterThan(1);
 await evidence('monitoring-options',{initial_customer_requests:0,after_open:r.count('/api/customers')});
 await page.screenshot({path:'test-results/read-frontend/coaching-ready.png'});
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Tambah coaching',exact:true}).click();
 await expect.poll(()=>r.count('/api/customers')).toBe(2);
 await expect(page.getByRole('dialog').getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
});

test('failed monitoring choices block submit, retry, and ignore late errors after close',async({page})=>{
 const r=requests(page);await enter(page,'monitoring');
 await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Coaching',exact:true}).click();
 let attempts=0;await page.route('**/api/customers',route=>{if(attempts++===0)return route.fulfill({status:503,json:{code:'OPTIONS_TEST_UNAVAILABLE'}});return route.continue()});
 await page.getByRole('button',{name:'Tambah coaching',exact:true}).click();
 let dialog=page.getByRole('dialog');await expect(dialog.getByRole('alert')).toContainText('OPTIONS_TEST_UNAVAILABLE');
 await expect(dialog.getByRole('button',{name:'Simpan',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Muat ulang pilihan pelanggan',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
 expect(r.count('/api/customers')).toBe(2);
 await page.keyboard.press('Escape');await page.unroute('**/api/customers');
 let release;const hold=new Promise(resolve=>release=resolve);
 await page.route('**/api/customers',async route=>{await hold;return route.fulfill({status:503,json:{code:'LATE_OPTIONS_ERROR'}})});
 await page.getByRole('button',{name:'Tambah coaching',exact:true}).click();
 await expect.poll(()=>r.count('/api/customers')).toBe(3);
 const lateResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/customers');
 await page.keyboard.press('Escape');release();
 await lateResponse;
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByText('LATE_OPTIONS_ERROR',{exact:false})).toHaveCount(0);
});

test('mobile exception form loads choices on demand without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});const r=requests(page);
 await enter(page,'monitoring');
 await expect(page.getByRole('heading',{name:'Tenaga sales dan beban pekerjaan',exact:true})).toBeVisible();
 expect(r.count('/api/customers')).toBe(0);
 await page.getByRole('tab',{name:'Exception',exact:true}).click();
 await page.getByRole('button',{name:'Tambah exception',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
 expect(r.count('/api/customers')).toBe(1);
 expect(await dialog.locator('select[aria-label="Pelanggan"] option').count()).toBeGreaterThan(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/read-frontend/mobile-exception.png'});
});
