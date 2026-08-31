# honeystick

The core JavaScript client for [Honeystick](https://honeystick.co.za) billing.
Works on a server with a secret key, or in a browser or app with no credential
at all.

```sh
npm i honeystick
```

## On a server

```ts
import { createHoneystick } from 'honeystick';

const hs = createHoneystick({ secretKey: process.env.HONEYSTICK_SECRET_KEY });

// one call: the shopper is named by email, matched or registered
const checkout = await hs.customerPlans.checkout({
  customers: [{ email: 'shopper@example.com', name: 'A Shopper' }],
  provider: 'payfast',
  plan_type: 'subscription',
  plan_type_data: { price: 99, price_plan: 'fixed', plan_frequency: 'month' },
  return_url: 'https://yourapp.com/account',
  cancel_url: 'https://yourapp.com/',
});
// → { org_customer_ids, org_customer_plan_ids, redirect_url }
```

No `orgId` anywhere: the secret key already carries the claim of which
organization it belongs to.

## In a browser or an app

```ts
import { createHoneystickClient } from 'honeystick';

const hs = createHoneystickClient({ pathPrefix: '/billing' });
const plans = await hs.plans.list();
```

This holds no key. It calls the Honeystick handler mounted on your own server,
which is the only place the key exists.

## Mounting the handler

```ts
import { createCoreHandler } from 'honeystick/backend';
```

A separate entry point on purpose — importing the handler never drags client
code into a server bundle. If you are on Express, Hono or Next, use
`@honeystick/express`, `@honeystick/hono` or `@honeystick/next` instead; each
wraps this in a few lines.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-dev](https://github.com/honeystick/honeystick-dev).

MIT © Honeystick
