# @honeystick/express

Mounts [Honeystick](https://honeystick.co.za) on one route of your Express
server.

```sh
npm i @honeystick/express honeystick
```

```ts
import express from 'express';
import { honeystickHandler } from '@honeystick/express';

app.use(
  '/billing',
  express.json(),
  honeystickHandler({
    secretKey: process.env.HONEYSTICK_SECRET_KEY,
    identify: (req) => ({ customerId: req.user.id }),
  }),
);
```

Everything under `/billing` is forwarded to Honeystick with your secret key
attached, so the browser or app calls your own origin and the key never leaves
the server. `/billing` is the SDK's default prefix, so the client needs no
configuration to match it.

`express.json()` before the handler: the body has to be parsed by the time it
arrives. `identify` is your auth, not ours — returning null answers 401 without
reaching Honeystick.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-dev](https://github.com/honeystick/honeystick-dev).

MIT © Honeystick
