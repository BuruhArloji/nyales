const{defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests/browser',testMatch:'navigation-motion.spec.cjs',workers:1,timeout:45000,reporter:'list',outputDir:'test-results/navigation/artifacts',use:{browserName:'chromium',channel:'chrome',viewport:{width:1280,height:900},reducedMotion:'no-preference',screenshot:'only-on-failure'}});
