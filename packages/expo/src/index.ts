/**
 * Honeystick for Expo.
 *
 * A re-export of `@honeystick/react-native`, and nothing else. There is no
 * Expo-specific code in it - the provider needs a `backendUrl` because an app
 * has no origin, which is as true in a bare React Native project as it is here,
 * and the hooks are `@honeystick/react`'s unchanged.
 *
 * The package survives its own emptiness for one reason: `@honeystick/expo` is
 * the name an Expo app looks for, and a name that resolves to nothing is a
 * worse answer than a file like this. Two packages, one implementation, so the
 * native behaviour has exactly one place to be right.
 *
 * ```tsx
 * import { HoneystickProvider } from '@honeystick/expo';
 *
 * <HoneystickProvider backendUrl={API_URL} includeCredentials>
 *   <App />
 * </HoneystickProvider>
 * ```
 *
 * One Expo-only note that belongs here rather than in the shared package: the
 * global `fetch` on native is backed by XMLHttpRequest and quietly lacks a
 * readable response body. An app that needs streaming passes Expo's
 * `expo/fetch` to the provider's `fetch` prop rather than reaching past the SDK
 * for it.
 */
export * from '@honeystick/react-native';
