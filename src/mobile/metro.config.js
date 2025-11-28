// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for additional file extensions if needed
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Configure asset extensions
config.resolver.assetExts = [...config.resolver.assetExts, 'db', 'sqlite'];

// Enable symlink support for monorepo setups
config.resolver.unstable_enableSymlinks = true;

// Web platform support
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
