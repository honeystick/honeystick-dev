# @honeystick/next

[Honeystick](https://honeystick.co.za) billing for Next.js — the handler, the
server client, and the client hooks.

```sh
npm i @honeystick/next @honeystick/react honeystick
```

## Mount the handler

```ts
// app/api/billing/[...honeystick]/route.ts
import { honeystickHandler } from '@honeystick/next';

export const { GET, POST } = honeystickHandler({
  secretKey: process.env.HONEYSTICK_SECRET_KEY,
  pathPrefix: '/api/billing',
  identify: async () => {
    const session = await auth();
    return session ? { customerId: session.user.id } : null;
  },
});
```

**`pathPrefix` has to name where the route actually lives.** A Next route
handler receives the full pathname with nothing stripped, unlike Express, so the
default `/billing` would not match.

## Server components and actions

```ts
import { honeystick } from '@honeystick/next';

export default async function Page() {
  const plans = await honeystick().plans.list();
}
```

## Client components

```tsx
import { HoneystickProvider, useCustomer } from '@honeystick/next/client';
```

A separate entry point with its own `'use client'`, so importing the handler or
the server client never drags React context into a server component — and a page
that only renders a price does not pull in a query client it has no use for.

In Next this matters more than usual: anything a client component can import is
bundled and served, so a key used in the browser is a published key.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-js](https://github.com/honeystick/honeystick-js).

MIT © Honeystick
