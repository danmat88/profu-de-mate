module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  plugins: [
    ...config.plugins,
    'expo-splash-screen',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-firebase/app-check',
    '@react-native-firebase/crashlytics',
  ],
});
