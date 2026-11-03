const{test,expect}=require('@playwright/test');
const{mkdir}=require('node:fs/promises');
// Test the localhost app and local D1; public, already-published map assets are
// read-only range requests from R2. Never calls a staging business API.
test.beforeEach(async({page})=>{
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.route('**/__demo-territory/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  const response=await route.fetch({url:'https://nyales-staging.azaracourse.workers.dev/demo/'+name});
  await route.fulfill({response});
 });
 await page.goto('/#page=map',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Masuk sebagai Management',exact:true}).click();
 await expect(page.locator('.demo-map-workspace canvas')).toBeVisible();
 await expect(page.locator('.demo-map-loading')).toHaveCount(0);
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'ignoreErrors'});expect(page.errors).toEqual([])});
async function inside(page,selector){
 const stage=await page.locator('.demo-map-workspace').boundingBox();
 const box=await page.locator(selector).boundingBox();
 expect(box).toBeTruthy();expect(box.x).toBeGreaterThanOrEqual(stage.x-1);expect(box.y).toBeGreaterThanOrEqual(stage.y-1);
 expect(box.x+box.width).toBeLessThanOrEqual(stage.x+stage.width+1);expect(box.y+box.height).toBeLessThanOrEqual(stage.y+stage.height+1);
}
test('desktop map includes layers, legend, source disclosure, and fullscreen in one canvas',async({page})=>{
 const workspace=page.locator('.demo-map-workspace');
 for(const s of ['.demo-map-heading','.demo-map-mode','.demo-map-panel','.demo-map-info'])await inside(page,s);
 await expect(page.getByRole('button',{name:'Area DEMO',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Kepadatan penduduk',exact:true}).click();
 await expect(page.getByLabel('Legenda kepadatan penduduk',{exact:true})).toBeVisible();
 await page.locator('.demo-map-panel>summary').click();await expect(page.locator('.demo-map-panel')).not.toHaveAttribute('open','');
 await page.locator('.demo-map-panel>summary').click();
 await page.locator('.demo-map-info>summary').click();
 await expect(page.getByRole('note')).toContainText('tidak ada assignment sales nyata');
 await expect(page.getByRole('link',{name:/Unduh CSV pengecualian/})).toHaveAttribute('href',/__demo-territory\/exceptions.csv$/);
 await page.locator('.demo-map-info>summary').click();
 const fullscreen=workspace.locator('.maplibregl-ctrl-fullscreen');await fullscreen.click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('demo-map-workspace'))).toBe(true);
 await inside(page,'.demo-map-panel');await inside(page,'.demo-map-mode');
 await workspace.locator('.maplibregl-ctrl-shrink').click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await mkdir('test-results/map-overlay',{recursive:true});await workspace.screenshot({path:'test-results/map-overlay/desktop.png'});
});
test('mobile starts with collapsed information and all controls stay inside the map',async({page})=>{
 // Reload at a narrow viewport so the responsive panel default is exercised.
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('.demo-map-workspace canvas')).toBeVisible();
 await expect(page.locator('.demo-map-panel')).not.toHaveAttribute('open','');
 for(const s of ['.demo-map-heading','.demo-map-mode','.demo-map-panel','.demo-map-info'])await inside(page,s);
 await page.locator('.demo-map-panel>summary').click();await inside(page,'.demo-map-panel');
 await page.getByRole('button',{name:'Kepadatan penduduk',exact:true}).click();
 await expect(page.getByLabel('Legenda kepadatan penduduk',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.demo-map-workspace').screenshot({path:'test-results/map-overlay/mobile.png'});
 await page.locator('.demo-map-info>summary').click();await inside(page,'.demo-map-info');
 await expect(page.getByRole('note')).toBeVisible();
});
