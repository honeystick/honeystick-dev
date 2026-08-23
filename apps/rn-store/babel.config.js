/**
 * Babel, with one plugin the bare React Native preset does not carry.
 *
 * `@babel/plugin-transform-export-namespace-from` handles `export * as ns from
 * '...'`, which zod v4 uses throughout. Expo's preset bundles it, so the Expo
 * store needs no equivalent of this file - which makes the omission easy to
 * miss and confusing when it lands: the failure is a SyntaxError deep inside
 * node_modules/zod naming a plugin rather than a mistake in this app.
 *
 * Worth knowing generally. Anything published as modern ESM can hit this, and
 * "works in Expo, fails in bare React Native" is almost always a preset
 * difference rather than a difference in React Native itself.
 */
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
