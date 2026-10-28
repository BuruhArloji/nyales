const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser',testMatch:'directory-map.spec.cjs',workers:1,timeout:60000,reporter:[['list']],outputDir:'test-results/directory-map/artifacts',use:{browserName:'chromium',channel:'chrome',viewport:{width:1280,height:900},reducedMotion:'reduce',screenshot:'only-on-failure'}});
