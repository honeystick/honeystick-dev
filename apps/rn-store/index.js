/**
 * The entry point, as bare React Native defines it.
 *
 * No file-system router here - `AppRegistry.registerComponent` is the whole
 * bootstrap, and `App.tsx` decides everything after it. That is the one
 * structural difference from the Expo store worth noticing, and it is a
 * difference in the app rather than in the SDK: the provider, the hooks and the
 * calls they make are identical on both sides.
 *
 * @format
 */
import { AppRegistry } from 'react-native';

import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
