const { validateClientEnvironment } = require('./scripts/validate-client-env.cjs');

const PROFILE_ENVIRONMENT = {
  development: 'development',
  preview: 'preview',
  'production-apk': 'production',
  production: 'production',
};

const PROFILE_APP_CHECK = {
  development: 'debug',
  preview: 'debug',
  // This public APK exists before Play Console is available. It never embeds
  // a reusable App Check debug credential; the server's authenticated quotas
  // and cost controls protect this temporary release channel.
  'production-apk': 'none',
  production: 'playIntegrity',
};

module.exports = ({ config }) => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  if (buildProfile) {
    const environment = PROFILE_ENVIRONMENT[buildProfile];
    if (!environment) throw new Error(`Profil EAS necunoscut: ${buildProfile}`);
    validateClientEnvironment(environment, { expectedAppCheckProvider: PROFILE_APP_CHECK[buildProfile] });
  }

  return ({
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    plugins: [
      ...config.plugins,
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          usesCleartextTraffic: false,
          networkInspector: false,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#171337',
        // Android still generates a real native splash resource, but the artwork
        // stays invisible so the React scene can begin on the exact same color.
        image: './assets/brand/splash-transparent.png',
        imageWidth: 1,
        resizeMode: 'contain',
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/app-check',
    '@react-native-firebase/crashlytics',
    'react-native-nitro-google-signin',
    'expo-asset',
    'expo-secure-store',
    ],
  });
};
