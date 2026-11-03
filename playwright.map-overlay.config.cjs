const{defineConfig}=require('@playwright/test');
const path=require('node:path');
module.exports=defineConfig({
 testDir:'./tests/browser',testMatch:'map-overlay.spec.cjs',workers:1,timeout:120000,
 expect:{timeout:20000},outputDir:'test-results/map-overlay/artifacts',reporter:[['list'],['json',{outputFile:'test-results/map-overlay/results.json'}]],
 webServer:{command:'npm run ui:prototype',env:{NYALES_DEMO_TERRITORY_PMTILES:path.resolve('.nyales-agent/map-overlay-fixture/territories-demo.pmtiles')},url:'http://127.0.0.1:5190/',reuseExistingServer:true,timeout:180000},
 use:{baseURL:'http://127.0.0.1:5190',browserName:'chromium',channel:'chrome',actionTimeout:15000,reducedMotion:'reduce',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
});
