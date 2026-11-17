const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);
const separatorPattern = path.sep === '\\' ? '\\\\' : '/';

config.resolver.blockList = exclusionList([
  // Native validation copies contain their own dependencies and emulator disk
  // images. None of these generated files belong in the app's module graph.
  ...['functions', 'artifacts', 'previews'].map((directory) => {
    const absolute = path.resolve(__dirname, directory);
    const escaped = absolute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}${separatorPattern}.*`);
  }),
]);

module.exports = config;
