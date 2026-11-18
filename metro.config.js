const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);
const separatorPattern = path.sep === '\\' ? '\\\\' : '/';

config.resolver.blockList = exclusionList([
  // Backend dependencies and generated workspaces are outside the app graph.
  ...['functions', '.local'].map((directory) => {
    const absolute = path.resolve(__dirname, directory);
    const escaped = absolute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}${separatorPattern}.*`);
  }),
]);

module.exports = config;
