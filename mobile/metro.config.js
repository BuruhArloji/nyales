const {getDefaultConfig}=require('expo/metro-config');
const path=require('path');
const projectRoot=__dirname;
const config=getDefaultConfig(projectRoot);
// Shared web/mobile logic lives outside Expo's project root.
config.watchFolders=[...new Set([...(config.watchFolders||[]),path.resolve(projectRoot,'../src/shared')])];
module.exports=config;
