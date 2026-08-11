const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Mock native modules that shouldn't be bundled in the frontend (Web/Android/iOS)
const emptyMock = require.resolve('./utils/mocks/sharp.js');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'sharp': emptyMock,
  'fs': emptyMock,
  'path': emptyMock,
  'node:fs': emptyMock,
  'node:path': emptyMock,
};

module.exports = withRorkMetro(config);
