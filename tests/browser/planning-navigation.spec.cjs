const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');

test('daily planning is primary; experimental tabs read only their required sources',async({page,request},info)=>{
 const health=await (await request.get('http://127.0.0.1:5191/api/health')).json();
 expect(health.name).toBe('NYALES');expect(health.environment).toBe('local');
 const reads=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Exercise the current production bundle against the approved synthetic prototype,
 // without depending on the dev server's dependency pre-bundling cache.
 const root=path.resolve('dist/client');
 await page.route('http://127.0.0.1:5190/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/')){
   if(route.request().method()==='GET')reads.push(url.pathname);
   return route.fulfill({response:await route.fetch({url:'http://127.0.0.1:5191'+url.pathname+url.search,headers:{...route.request().headers(),origin:'http://127.0.0.1:5191'}})});
  }
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
  return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 await page.addInitScript(()=>sessionStorage.setItem('nyales-demo','1'));
 await page.goto('/#page=settings&settings_section=planning');
 await expect(page.getByRole('heading',{name:'Generator kunjungan harian',exact:true})).toBeVisible();
 const planner=page.getByRole('region',{name:'Perencanaan kunjungan',exact:true});
 const legacy=['/api/visit-generator/policies','/api/visit-generator/graphs','/api/visit-generator/preflights'];
 expect(reads.filter(p=>legacy.includes(p))).toEqual([]);
 await expect(page.getByRole('button',{name:'Komputer penghitung',exact:true})).toHaveCount(0);
 await expect(planner.getByRole('button',{name:'Kebijakan lama',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Target visit / hari',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('planning-default-desktop.png')});
 await page.getByRole('button',{name:'Eksperimental',exact:true}).click();
 await expect(page.getByRole('button',{name:'Risiko pelanggan lama',exact:true})).toBeVisible();
 reads.length=0;await planner.getByRole('button',{name:'Kebijakan lama',exact:true}).click();
 await expect(planner.getByRole('button',{name:'Tambah kebijakan kunjungan',exact:true})).toBeVisible();
 await expect.poll(()=>reads.filter(p=>legacy.includes(p))).toEqual(['/api/visit-generator/policies']);
 reads.length=0;await planner.getByRole('button',{name:'Graph jalan',exact:true}).click();
 await expect(planner.getByRole('button',{name:'Tambah deklarasi graph',exact:true})).toBeVisible();
 await expect.poll(()=>reads.filter(p=>legacy.includes(p))).toEqual(['/api/visit-generator/graphs']);
 await page.getByRole('button',{name:'Eksperimental',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Generator kunjungan harian',exact:true})).toBeVisible();
 await expect(planner.getByRole('button',{name:'Kebijakan lama',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Target visit / hari',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('planning-default-mobile.png')});
 reads.length=0;await page.goto('/#page=segmentation');
 await expect(page.getByRole('heading',{name:'Status pelanggan',exact:true})).toBeVisible();
 await expect.poll(()=>reads.includes('/api/customer-segmentation')).toBe(true);
 expect(reads.includes('/api/customers')).toBe(false);
 expect(errors).toEqual([]);
});
