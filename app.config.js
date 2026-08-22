module.exports = ({ config }) => ({
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
        image: './assets/brand/splash-mark-v2.png',
        imageWidth: 220,
        resizeMode: 'contain',
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/app-check',
    '@react-native-firebase/crashlytics',
  ],
});
