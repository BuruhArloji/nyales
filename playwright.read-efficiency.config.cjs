const{defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser',testMatch:'read-efficiency.spec.cjs',workers:1,fullyParallel:false,
 timeout:120000,expect:{timeout:20000},outputDir:'test-results/read-frontend/artifacts',
 reporter:[['list'],['json',{outputFile:'test-results/read-frontend/browser-results.json'}]],
 webServer:{command:'npm run ui:prototype',url:'http://127.0.0.1:5190/',reuseExistingServer:true,timeout:180000},
 use:{baseURL:'http://127.0.0.1:5190',browserName:'chromium',channel:'chrome',actionTimeout:15000,viewport:{width:1440,height:1000},reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
});
