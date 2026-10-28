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
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/map.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
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
