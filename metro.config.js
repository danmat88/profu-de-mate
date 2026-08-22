const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);
const functionsDirectory = path.resolve(__dirname, 'functions');
const escapedFunctionsDirectory = functionsDirectory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const separatorPattern = path.sep === '\\' ? '\\\\' : '/';

config.resolver.blockList = exclusionList([
  new RegExp(`^${escapedFunctionsDirectory}${separatorPattern}.*`),
]);

module.exports = config;
