const {defineConfig}=require('@playwright/test');
if(process.env.NYALES_UAT_URL){const url=new URL(process.env.NYALES_UAT_URL);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('WEB-059 mutation suite requires a local loopback fixture');}
module.exports=defineConfig({
 testDir:'./tests/browser',testMatch:'web059.spec.cjs',timeout:120000,expect:{timeout:15000},workers:1,fullyParallel:false,
 outputDir:'test-results/web059/artifacts',
 reporter:[['list'],['json',{outputFile:'test-results/web059/results.json'}]],
 webServer:process.env.NYALES_UAT_URL?undefined:{command:'node scripts/uat-local.cjs',url:'http://127.0.0.1:5182/api/health',reuseExistingServer:false,timeout:600000},
 use:{actionTimeout:15000,baseURL:process.env.NYALES_UAT_URL||'http://127.0.0.1:5182',viewport:{width:1440,height:1100},timezoneId:'Asia/Jakarta',reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'chrome',use:{browserName:'chromium',channel:'chrome'}},{name:'edge',grep:/smoke/,use:{browserName:'chromium',channel:'msedge'}}]
});
