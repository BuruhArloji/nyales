const {test,expect}=require('@playwright/test');
const {build}=require('esbuild');
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const {resolve}=require('node:path');
let server,origin;
test.beforeAll(async()=>{
 await mkdir('test-results/auth-setup',{recursive:true});
 await build({entryPoints:['tests/fixtures/auth-setup.tsx'],bundle:true,outfile:'test-results/auth-setup/fixture.js',jsx:'automatic',platform:'browser',alias:{'firebase/auth':resolve('tests/fixtures/firebase-auth.ts'),'firebase/app':resolve('tests/fixtures/firebase-auth.ts')},define:{'import.meta.env.VITE_FIREBASE_API_KEY':'"fixture-key"','import.meta.env.VITE_FIREBASE_PROJECT_ID':'"fixture-project"','import.meta.env.VITE_FIREBASE_AUTH_DOMAIN':'"fixture.invalid"'}});
 server=createServer(async(req,res)=>{try{
  const files={'/fixture.js':['test-results/auth-setup/fixture.js','text/javascript'],'/styles.css':['src/client/styles.css','text/css'],'/theme.css':['src/client/theme.css','text/css'],'/brand/nyales-mark.svg':['public/brand/nyales-mark.svg','image/svg+xml']};
  if(files[req.url]){const [file,type]=files[req.url];res.writeHead(200,{'Content-Type':type});res.end(await readFile(file));return}
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/theme.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
 }catch{res.writeHead(500);res.end('Fixture error')}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{await new Promise(r=>server.close(r))});
async function routes(page,firstAdmin=true){let mapped=false;await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname,token=route.request().headers().authorization;
 const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(path==='/api/auth/config')return reply(200,{mode:'firebase',configured:true});
 if(path==='/api/auth/first-admin'){if(!firstAdmin)return reply(404,{code:'NOT_FOUND'});if(token!=='Bearer fixture-mfa')return reply(403,{code:'MFA_REQUIRED'});mapped=true;return reply(201,{data:{id:'fixture-admin'}})}
 if(path==='/api/device-sessions'){if(!mapped)return reply(403,{code:'USER_NOT_PROVISIONED_OR_INACTIVE'});return reply(201,{data:{id:'fixture-session',session_token:'a'.repeat(64),version:1}})}
 if(path==='/api/me')return reply(200,{data:{id:'fixture-admin',name:'Owner',organization_id:'fixture-org',role:'MANAGEMENT',capabilities:[],area_ids:[],scope:'organization'}});
 if(path.endsWith('/revoke'))return reply(200,{data:{}});
 return reply(404,{code:'NOT_FOUND'});
 });await page.goto(origin);
}
test('First-admin login enrolls a local QR, requires fresh sign-in and rejects wrong OTP before revealing data',async({page})=>{
 await routes(page);await page.getByRole('button',{name:'Masuk dengan Google'}).click();await expect(page.getByRole('heading',{name:'Amankan akun admin.'})).toBeVisible();await expect(page.getByText('Contoh data terlindungi')).toHaveCount(0);
 await page.getByRole('button',{name:'Siapkan Authenticator'}).click();await expect(page.getByAltText('QR untuk menambahkan NYALES ke Authenticator')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByLabel('Kode Authenticator').fill('111111');await page.getByRole('button',{name:'Aktifkan Authenticator'}).click();await expect(page.getByText(/Authenticator ditambahkan/)).toBeVisible();
 await page.getByRole('button',{name:'Masuk dengan Google'}).click();await expect(page.getByRole('heading',{name:'Verifikasi masuk.'})).toBeVisible();await page.getByLabel('Kode Authenticator').fill('012345');await page.getByRole('button',{name:'Verifikasi dan masuk'}).click();await expect(page.getByRole('alert')).toContainText('Kode Authenticator tidak sesuai');await expect(page.getByText('Contoh data terlindungi')).toHaveCount(0);
 await page.getByLabel('Kode Authenticator').fill('111111');await page.getByRole('button',{name:'Verifikasi dan masuk'}).click();await expect(page.getByRole('heading',{name:'Contoh data terlindungi'})).toBeVisible();
 await page.getByRole('button',{name:'Keluar dari aplikasi'}).click();await expect(page.getByRole('button',{name:'Masuk dengan Google'})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('nyales-device-session'))).toBeNull();
});
test('Cancel clears enrollment secrets, disabled provider stays closed, and an unmapped account can switch accounts',async({page})=>{
 await routes(page);await page.getByRole('button',{name:'Masuk dengan Google'}).click();await page.getByRole('button',{name:'Siapkan Authenticator'}).click();await expect(page.getByAltText('QR untuk menambahkan NYALES ke Authenticator')).toBeVisible();await page.getByRole('button',{name:'Keluar',exact:true}).click();await expect(page.getByAltText('QR untuk menambahkan NYALES ke Authenticator')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('JBSWY3DPEHPK3PXP'))).toBeFalsy();
 await page.evaluate(()=>window.__authFixture.disabled=true);await page.getByRole('button',{name:'Masuk dengan Google'}).click();await page.getByRole('button',{name:'Siapkan Authenticator'}).click();await expect(page.getByRole('alert')).toContainText('belum diaktifkan');await expect(page.getByText('Contoh data terlindungi')).toHaveCount(0);
 await page.getByRole('button',{name:'Keluar',exact:true}).click();await page.unroute('**/api/**');await routes(page,false);await page.getByRole('button',{name:'Masuk dengan Google'}).click();await expect(page.getByRole('heading',{name:'Akun menunggu aktivasi.'})).toBeVisible();await expect(page.getByLabel('ID akun')).toHaveValue('fixture-owner');await page.getByRole('button',{name:'Gunakan akun lain'}).click();await expect(page.getByRole('button',{name:'Masuk dengan Google'})).toBeVisible();
});
test('Unsupported second factors do not trigger SMS or disclose protected data',async({page})=>{
 await routes(page);await page.evaluate(()=>{window.__authFixture.enrolled=true;window.__authFixture.unsupported=true});await page.getByRole('button',{name:'Masuk dengan Google'}).click();await expect(page.getByRole('alert')).toContainText('belum didukung');await expect(page.getByLabel('Kode Authenticator')).toHaveCount(0);await expect(page.getByText('Contoh data terlindungi')).toHaveCount(0);await page.getByRole('button',{name:'Batalkan masuk'}).click();await expect(page.getByRole('button',{name:'Masuk dengan Google'})).toBeVisible();
});
