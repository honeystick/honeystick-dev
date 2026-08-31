# @honeystick/expo

[Honeystick](https://honeystick.co.za) billing for Expo.

```sh
npx expo install @honeystick/expo @honeystick/react-native @honeystick/react honeystick
```

```tsx
import { HoneystickProvider } from '@honeystick/expo';

<HoneystickProvider backendUrl="https://api.yourapp.com" includeCredentials>
  <App />
</HoneystickProvider>;
```

This package is a re-export of
[`@honeystick/react-native`](https://www.npmjs.com/package/@honeystick/react-native)
and nothing else. There is no Expo-specific code in it — the provider needs a
`backendUrl` because an app has no origin, which is as true in a bare React
Native project as it is here.

It exists because `@honeystick/expo` is the name an Expo app looks for, and a
name that resolves to nothing is a worse answer than a file that re-exports.
Two packages, one implementation, so the native behaviour has one place to be
right.

One Expo-only note: the global `fetch` on native is backed by XMLHttpRequest and
quietly lacks a readable response body. An app that needs streaming passes
Expo's `expo/fetch` to the provider's `fetch` prop rather than reaching past the
SDK for it.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-dev](https://github.com/honeystick/honeystick-dev).

MIT © Honeystick
