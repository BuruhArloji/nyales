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
  const googleConfig = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const client = googleConfig.client?.find(item => item.client_info?.android_client_info?.package_name === base.android.package);
  const webClientId = client?.oauth_client?.find(item => item.client_type === 3)?.client_id;
  if (!webClientId) throw new Error('Firebase configuration must include a web OAuth client for this Android package');
  return {
    ...base,
    extra: { ...base.extra, googleWebClientId: webClientId, apiOrigin: 'https://nyales-staging.azaracourse.workers.dev' },
    android: { ...base.android, googleServicesFile: resolved },
    plugins: [...(base.plugins || []), '@react-native-firebase/app', '@react-native-firebase/auth', '@react-native-google-signin/google-signin'],
  };
};
