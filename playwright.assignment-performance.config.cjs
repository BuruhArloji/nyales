const{defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser',testMatch:'assignment-performance.spec.cjs',workers:1,timeout:90000,expect:{timeout:15000},
 outputDir:'test-results/assignment-performance/artifacts',reporter:[['list'],['json',{outputFile:'test-results/assignment-performance/results.json'}]],
 webServer:{command:'npm run ui:prototype',url:'http://127.0.0.1:5190/',reuseExistingServer:true,timeout:180000},
 use:{baseURL:'http://127.0.0.1:5190',browserName:'chromium',channel:'chrome',viewport:{width:1440,height:1000},actionTimeout:15000,reducedMotion:'reduce',trace:'retain-on-failure',screenshot:'only-on-failure'},
});
