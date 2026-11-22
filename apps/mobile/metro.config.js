// Expo SDK 52+ configures Metro for monorepos automatically (watch folders and
// node_modules lookup across the pnpm workspace), so the default config is enough
// for workspace packages such as @taxgabay/tax-engine, which ships TypeScript source.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
