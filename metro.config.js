const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Mock native modules that shouldn't be bundled in the frontend (Web/Android/iOS)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'sharp': require.resolve('./utils/mocks/sharp.js'),
};

module.exports = withRorkMetro(config);
