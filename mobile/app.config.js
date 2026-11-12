const fs = require('node:fs');
const path = require('node:path');
const base = require('./app.json').expo;

// Firebase native configuration is opt-in for each build environment. Do not
// point a development APK at production without an explicit configuration.
module.exports = () => {
  const configPath = process.env.NYALES_GOOGLE_SERVICES_FILE;
  if (!configPath) return base;
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) throw new Error('NYALES_GOOGLE_SERVICES_FILE does not exist');
  return {
    ...base,
    android: { ...base.android, googleServicesFile: resolved },
    plugins: [...(base.plugins || []), '@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-google-signin/google-signin'],
  };
};
