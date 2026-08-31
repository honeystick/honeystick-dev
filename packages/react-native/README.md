# @honeystick/react-native

[Honeystick](https://honeystick.co.za) billing for React Native. The same hooks
as `@honeystick/react`, with the one difference native needs.

```sh
npm i @honeystick/react-native @honeystick/react honeystick
```

```tsx
import { HoneystickProvider, useCustomer } from '@honeystick/react-native';

<HoneystickProvider backendUrl="https://api.yourapp.com" includeCredentials>
  <App />
</HoneystickProvider>;
```

**`backendUrl` is required here**, where it is optional on the web. A page can
call `/billing` on the origin it was served from; an app was not served from
anywhere. Leaving it out would resolve every call against nothing and fail at
runtime, so it is asked for at the type level instead.

`includeCredentials` because a native app is always cross-origin, and `fetch`
drops cookies cross-origin unless asked.

There is no key in your bundle, and that is not a nicety: an app bundle is
readable by anyone who has the app, so a key compiled into one is a published
key. The client this builds calls your server's `/billing` route, and the key
lives there.

Also exports `HoneystickFab` — views pinned to a parent rather than an anchor,
because React Native has no `position: fixed`.

Using Expo? `@honeystick/expo` re-exports this package unchanged.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-dev](https://github.com/honeystick/honeystick-dev).

MIT © Honeystick
