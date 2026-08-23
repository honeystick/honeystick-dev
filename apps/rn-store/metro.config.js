const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro, taught about the monorepo.
 *
 * The same four settings the Expo store needs, for the same four reasons - the
 * only difference is that this starts from `@react-native/metro-config` rather
 * than Expo's wrapper around it. That is the whole extent of the difference
 * between the two apps at the bundler level, which is the point worth making:
 * nothing about reaching the Honeystick SDK from a bare React Native project is
 * special.
 *
 * `watchFolders` adds the repository root, because the SDK packages this app
 * imports live at ../../packages and Metro only watches the project directory by
 * default. Without it an edit to @honeystick/react-native is invisible until a
 * restart, and a cold start cannot resolve it at all.
 *
 * `nodeModulesPaths` lists both the app's own node_modules and the root's,
 * because npm workspaces hoists most dependencies to the root and leaves the
 * rest local. Metro's default resolver walks up from the project folder, which
 * finds the root by accident - naming both is what makes it deliberate.
 *
 * `disableHierarchicalLookup` keeps that to one copy of React. Hoisting means
 * the app and a workspace package can each resolve their own, and two Reacts in
 * one bundle is the "invalid hook call" that looks like a bug in the hooks.
 *
 * Worth knowing: the @honeystick/* packages export TypeScript source rather than
 * compiled output, so Metro transpiles them like any other file in this repo.
 * That is why there is no build step to run before starting the app, and why a
 * type error in the SDK surfaces here rather than in a stale .d.ts.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
  },
});
