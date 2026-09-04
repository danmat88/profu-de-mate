const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  globalIgnores([
    'artifacts/**',
    'dist/**',
    'functions/lib/**',
    'hosting/public/**',
    'previews/**',
  ]),
  expoConfig,
  {
    rules: {
      // React Native Animated deliberately keeps native animation nodes in
      // refs and consumes them while describing Animated component styles.
      // The generic React Compiler rule treats this documented RN pattern as
      // a render-time ref read, although no mutable application data is read.
      'react-hooks/refs': 'off',
      // Several modal and navigation transitions intentionally reset their
      // local visual state when a route/prop changes. These are synchronization
      // effects, not derived data that belongs in render.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
