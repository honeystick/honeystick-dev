const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro, taught about the monorepo.
 *
 * Two settings, and the app will not bundle without either of them.
 *
 * `watchFolders` adds the repository root, because the SDK packages this app
 * imports live at ../../packages and Metro only watches the project directory by
 * default. Without it an edit to @honeystick/react is invisible until a restart,
 * and a cold start cannot resolve it at all.
 *
 * `nodeModulesPaths` lists both the app's own node_modules and the root's,
 * because npm workspaces hoists most dependencies to the root and leaves the
 * rest local. Metro's default resolver walks up from the project folder, which
 * finds the root by accident - naming both is what makes it deliberate, and what
 * keeps the app's own copy of a package winning when there are two.
 *
 * Worth knowing: the @honeystick/* packages export TypeScript source rather than
 * compiled output, so Metro transpiles them like any other file in this repo.
 * That is why there is no build step to run before starting the app, and why a
 * type error in the SDK surfaces here rather than in a stale .d.ts.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// One copy of React, whichever path reached it. Hoisting means the app and a
// workspace package can each resolve their own, and two Reacts in one bundle is
// the "invalid hook call" that looks like a bug in the hooks.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
