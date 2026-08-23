# @honeystick/hono

Mounts [Honeystick](https://honeystick.co.za) on one route of your Hono server.

```sh
npm i @honeystick/hono honeystick
```

```ts
import { honeystickHandler } from '@honeystick/hono';

app.use(
  '/billing/*',
  honeystickHandler({
    secretKey: process.env.HONEYSTICK_SECRET_KEY,
    identify: (c) => ({ customerId: c.get('userId') }),
  }),
);
```

Everything under `/billing` is forwarded to Honeystick with your secret key
attached, so the browser or app calls your own origin and the key never leaves
the server. `/billing` is the SDK's default prefix, so the client needs no
configuration to match it.

`identify` is your auth, not ours — a customer id is never taken from the
request body. Returning null answers 401 without reaching Honeystick.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-js](https://github.com/honeystick/honeystick-js).

MIT © Honeystick
