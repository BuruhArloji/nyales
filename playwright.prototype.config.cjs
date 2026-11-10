const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/browser',testMatch:'planning-navigation.spec.cjs',workers:1,timeout:120000,
 expect:{timeout:20000},outputDir:'test-results/prototype-planning',
 webServer:{command:'npm run ui:prototype',url:'http://127.0.0.1:5191/api/health',reuseExistingServer:true,timeout:180000},
 use:{baseURL:'http://127.0.0.1:5190',browserName:'chromium',viewport:{width:1440,height:1100},reducedMotion:'reduce',screenshot:'only-on-failure',trace:'retain-on-failure'}
});
