const{test,expect}=require('@playwright/test');
const{build}=require('esbuild');
const{createServer}=require('node:http');
const{readFile,mkdir}=require('node:fs/promises');
const{resolve}=require('node:path');
let server,origin;
test.beforeAll(async()=>{
 await mkdir('test-results/directory-map',{recursive:true});
 await build({entryPoints:['tests/fixtures/directory-map.tsx'],bundle:true,outfile:'test-results/directory-map/fixture.js',jsx:'automatic',platform:'browser',define:{'import.meta.env':'{}'},plugins:[{name:'worker-url-fixture',setup(b){b.onResolve({filter:/maplibre-gl-worker\.mjs\?url$/},()=>({path:'map-worker-url',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/map-worker.js"',loader:'js'}))}}]});
 server=createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/')){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"code":"UNAUTHENTICATED"}');return}
  if(req.url.startsWith('/fonts/')){res.writeHead(204);res.end();return}
  const files={'/fixture.js':['test-results/directory-map/fixture.js','text/javascript'],'/map-worker.js':['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs','text/javascript'],'/styles.css':['src/client/styles.css','text/css'],'/theme.css':['src/client/theme.css','text/css'],'/map.css':['node_modules/maplibre-gl/dist/maplibre-gl.css','text/css']};
  if(files[req.url]){const[f,type]=files[req.url];res.writeHead(200,{'Content-Type':type});res.end(await readFile(f));return}
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/map.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
 }catch{res.writeHead(500);res.end('Fixture error')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(r=>server.close(r))});
test('15k points use canvas clusters, reference toggle and fullscreen without thousands of DOM pins',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await expect(page.locator('.maplibregl-canvas')).toBeVisible();
 const toggle=page.getByRole('checkbox',{name:/Referensi peta/});await expect(toggle).toBeChecked();
 await expect(page.locator('.map-fallback-label')).toHaveCount(0,{timeout:25000});
 await expect.poll(()=>page.evaluate(()=>{const m=window.__directoryFixtureMap;return m?.isSourceLoaded('nyales-directory-points')?m.queryRenderedFeatures({layers:['nyales-directory-points-clusters','nyales-directory-points-points']}).length:0}),{timeout:25000}).toBeGreaterThan(0);
 expect(await page.locator('.maplibre-marker.customer').count()).toBe(0);
 await toggle.uncheck();await expect(toggle).not.toBeChecked();await toggle.check();
 await page.getByRole('button',{name:'Ubah customer fixture'}).click();await page.getByRole('button',{name:'Ubah customer fixture'}).click();
 await expect.poll(()=>page.evaluate(()=>{const m=window.__directoryFixtureMap;return m?.isSourceLoaded('nyales-directory-points')?m.queryRenderedFeatures({layers:['nyales-directory-points-clusters','nyales-directory-points-points']}).length:0}),{timeout:25000}).toBeGreaterThan(0);
 await page.locator('.maplibregl-ctrl-fullscreen').click();await expect(page.locator('.maplibregl-ctrl-shrink')).toBeVisible();await page.locator('.maplibregl-ctrl-shrink').click();
 await page.screenshot({path:'test-results/directory-map/large-points.png'});expect(errors).toEqual([]);
});

async function detailFixture(page,{failedPhoto=false}={}){
 const calls=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.includes('directory-details')||path.includes('/details/')){
   calls.push(path);await route.fulfill({json:{data:{name:'Warung Foto',category:'Warung kelontong',address:'Jalan Contoh 12, Bekasi',rating:'4.8',reviews:'25',status:'Buka saat pendataan',hours:'Senin–Minggu 08.00–21.00; '.repeat(12),phone:'+6281234567890',area_kelurahan:'Kelurahan Contoh',photo_url:origin+'/fixture-photo.svg',maps_url:'https://www.google.com/maps/place/example'}}});
  }else await route.fulfill({json:{data:{}}});
 });
 await page.route('**/fixture-photo.svg',route=>route.fulfill(failedPhoto?{status:404,body:''}:{contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="116"><rect width="240" height="116" fill="#168e85"/></svg>'}));
 await page.goto(origin+'/?details=1');await expect(page.locator('.maplibre-marker.customer')).toHaveCount(2);return calls;
}
test('small maps fetch details only on open, retain loaded popup and show source photo and facts',async({page})=>{
 const calls=await detailFixture(page);expect(calls).toEqual([]);
 const pin=page.getByRole('button',{name:'Warung Foto, Unknown',exact:true});await pin.click();
 const card=page.locator('.map-popup-card');await expect(card.getByText('Jalan Contoh 12, Bekasi')).toBeVisible();await expect(card.getByText('4.8 · 25 ulasan')).toBeVisible();
 await expect.poll(()=>card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(card.getByRole('link',{name:'+6281234567890'})).toHaveAttribute('href','tel:+6281234567890');expect(calls).toEqual(['/api/customers/photo-customer/directory-details']);await expect(card.locator('.map-popup-heading')).not.toContainText('Unknown');await expect(card.locator('.map-popup-facts')).toContainText('Status pelangganUnknown');await expect(card.locator('.map-popup-facts')).toContainText('Sales / PICBelum ditugaskan');await expect(card.getByRole('button',{name:'Street View',exact:true})).toBeVisible();await card.getByRole('button',{name:'Street View',exact:true}).click();expect(await page.evaluate(()=>window.__streetViewItem)).toBe('photo-customer');
 expect(await card.locator('.map-popup-body').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.locator('.maplibregl-popup-close-button').click();await pin.click();await expect(card.locator('img')).toBeVisible();expect(calls).toHaveLength(1);
 await expect.poll(async()=>{const a=await card.boundingBox(),b=await page.locator('.maplibre-canvas').boundingBox();return a.y>=b.y&&a.y+a.height<=b.y+b.height}).toBe(true);
 await page.screenshot({path:'test-results/directory-map/source-details.png'});
});
test('failed photo has a visible fallback and mobile popup stays inside the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});const calls=await detailFixture(page,{failedPhoto:true});expect(calls).toHaveLength(0);
 await page.evaluate(()=>window.__directoryFixtureMap.jumpTo({center:[106.82,-6.21],zoom:15}));
 await page.getByRole('button',{name:'Warung Foto, Unknown',exact:true}).click();const card=page.locator('.map-popup-card');await expect(card.getByText('Foto sumber belum tersedia.')).toBeVisible();await expect(card.locator('img')).toHaveCount(0);
 const box=await card.boundingBox(),mapBox=await page.locator('.maplibre-canvas').boundingBox();expect(box.width).toBeLessThanOrEqual(366);expect(box.y).toBeGreaterThanOrEqual(mapBox.y);expect(box.y+box.height).toBeLessThanOrEqual(mapBox.y+mapBox.height);
 await expect(card.getByRole('link',{name:'Buka di Google Maps'})).toHaveAttribute('target','_blank');
 await page.screenshot({path:'test-results/directory-map/mobile-source-details.png'});
});
test('reference points fetch the reference endpoint only after the canvas point is opened',async({page})=>{
 const calls=await detailFixture(page);expect(calls).toHaveLength(0);
 await expect.poll(()=>page.evaluate(()=>window.__directoryFixtureMap?.isSourceLoaded('nyales-directory-points'))).toBe(true);
 const position=await page.evaluate(()=>{const map=window.__directoryFixtureMap,p=map.project([106.825,-6.215]),r=map.getCanvas().getBoundingClientRect();return{x:r.x+p.x,y:r.y+p.y}});await page.mouse.click(position.x,position.y);
 await expect(page.locator('.map-popup-card').getByText('Jalan Contoh 12, Bekasi')).toBeVisible();expect(calls).toEqual(['/api/point-directory/detail-dataset/details/source-reference']);
});

test('master data requests duplicate analysis only on its review tab',async({page})=>{
 const paths=[];await page.route('**/api/**',async route=>{paths.push(new URL(route.request().url()).pathname);await route.fulfill({json:{data:[],meta:{has_more:false}}})});
 await page.goto(origin+'/?data-tools=1');await expect(page.getByText('Belum ada batch import.',{exact:false})).toBeVisible();expect(paths.sort()).toEqual(['/api/areas','/api/master-imports']);
 await page.getByRole('tab',{name:'Review duplikat',exact:true}).click();await expect(page.getByText('Tidak ada kandidat yang terdeteksi.',{exact:false})).toBeVisible();expect(paths.filter(p=>p==='/api/customer-duplicates')).toHaveLength(1);
 await page.getByRole('tab',{name:'Produk',exact:true}).click();await expect(page.getByText('Belum ada produk.',{exact:false})).toBeVisible();expect(paths.filter(p=>p==='/api/customer-duplicates')).toHaveLength(1);
});

test('popup actions remain visible above long content on a short map',async({page})=>{
 await page.setViewportSize({width:390,height:844});await detailFixture(page);
 await page.addStyleTag({content:'.maplibre-canvas{height:300px!important}'});await page.evaluate(()=>window.__directoryFixtureMap.jumpTo({center:[106.82,-6.21],zoom:15}));
 await page.getByRole('button',{name:'Warung Foto, Unknown',exact:true}).click();
 const card=page.locator('.map-popup-card'),body=card.locator('.map-popup-body');await expect(card.locator('img')).toHaveCount(1);
 await body.evaluate(el=>el.scrollTop=el.scrollHeight);
 const bounds=await card.boundingBox();
 for(const action of await card.locator('.map-popup-action').all()){
  const r=await action.boundingBox();expect(r.height).toBeGreaterThanOrEqual(44);expect(r.y).toBeGreaterThanOrEqual(bounds.y);expect(r.y+r.height).toBeLessThanOrEqual(bounds.y+bounds.height);
 }
 await expect(card.getByRole('link',{name:'Buka di Google Maps'})).toHaveAttribute('rel','noopener noreferrer');
});
