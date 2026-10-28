// Expo's default Metro config already handles npm workspaces.
// We only add .txt so the word list can be bundled as an asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('txt');

module.exports = config;
