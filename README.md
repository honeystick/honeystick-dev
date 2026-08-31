# Welcome to the Honeystick SDK

The JavaScript SDK is for [Honeystick](https://honeystick.co.za) billing
infrastructure. Seven packages on npm, and five sample stores that use them —
the same shop, built five ways, so you can read the one closest to your stack.

Start with [Installing](#installing). If you want to see it running before you
install anything, [demo.honeystick.co.za](https://demo.honeystick.co.za) is
`apps/next-store` deployed.

## Packages

| Package                                   | What it is                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `honeystick`                              | The core client. `createHoneystick()` holds a secret key and calls the API; `createHoneystickClient()` holds nothing and calls a handler on your own server. `honeystick/backend` is the handler both adapters wrap. |
| `@honeystick/react`                       | Provider and hooks for the web — `useCustomer`, `useListPlans`, `useListFeatures`, and `HoneystickFab`.                                                                                                              |
| `@honeystick/react-native`                | The same hooks for native. One difference: `backendUrl` is required.                                                                                                                                                 |
| `@honeystick/expo`                        | A re-export of `@honeystick/react-native`. There is nothing Expo-specific in it; the name exists because that is what an Expo app looks for.                                                                         |
| `@honeystick/next`                        | Mounts the handler on a catch-all route, plus a server client. `@honeystick/next/client` is the client half, kept behind its own `'use client'`.                                                                     |
| `@honeystick/hono`, `@honeystick/express` | The same handler for those frameworks. A few lines each — nothing about holding a key and calling an API is framework-specific.                                                                                      |

### Installing

```sh
npm i honeystick                    # server or client, no framework
npm i @honeystick/next              # + honeystick, @honeystick/react
npm i @honeystick/react-native      # + honeystick, @honeystick/react
npm i @honeystick/express           # + honeystick
```

Each ships compiled ESM with type declarations, and `src` alongside it so
declaration maps work — go-to-definition in your editor lands on the real
source rather than on a `.d.ts`.

They are ESM only (`"type": "module"`), and the emitted imports carry `.js`
extensions, so plain `node` resolves them with no bundler involved. That matters
for `honeystick/backend`, `@honeystick/express` and `@honeystick/hono`, which
are imported by ordinary Node servers.

Subpath exports are real exports, not deep file paths:

```ts
import { createHoneystick } from 'honeystick';
import { createCoreHandler } from 'honeystick/backend'; // server only
import { useCustomer } from '@honeystick/react/hooks';
import { HoneystickProvider } from '@honeystick/next/client';
```

`honeystick/backend` is deliberately a separate entry: importing the handler
never drags React context into a server bundle, and a page that only renders a
price does not pull in a query client it has no use for.

## Sample stores

All four are "Honeystick Example App", selling the same goods and the same subscriptions.

| App                | Stack                                  | Backend                            | Deployed        |
| ------------------ | -------------------------------------- | ---------------------------------- | --------------- |
| `apps/next-store`  | Next.js, App Router                    | itself — handler at `/api/billing` | yes, Cloudflare |
| `apps/express-api` | Express                                | itself — handler at `/billing`     | no              |
| `apps/react-store` | React SPA on Vite, no framework server | `express-api`                      | no              |
| `apps/expo-store`  | Expo + expo-router                     | `express-api`                      | no              |
| `apps/rn-store`    | Bare React Native, no Expo at all      | `express-api`                      | no              |

Three of them share one backend on purpose. `express-api` is the server, and the
React SPA, the Expo app and the bare React Native app are three different
clients against it — so you can see what changes between a browser and a phone,
and what does not.

`react-store` is the one to read if you have a SPA and no server of your own: it
is the case where `backendUrl` and `includeCredentials` stop being optional,
because the page is served from one origin and the handler is mounted on
another.

`rn-store` answers a different question: does this work in a plain React Native
project, or only in the one with batteries? Its README lists exactly what being
Expo-free costs.

## Running it

```sh
npm install

# the web store, self-contained
npm run dev -w @honeystick/next-store          # localhost:3000

# or the API plus any of its three clients
npm run dev -w @honeystick/express-api         # localhost:4000
npm run dev -w @honeystick/react-store         # localhost:5173
npm run start -w @honeystick/expo-store
npm run start -w @honeystick/rn-store
```

No keys needed. Without `HONEYSTICK_SECRET_KEY` every store serves a sample
catalogue and both checkout and subscribe walk the whole flow, stopping short of
the one call that needs an organization. Copy `.env.example` to `.env` (or
`.env.local`) and add a **sandbox** key to go live.

## The one rule the whole design rests on

**A secret key never reaches a browser or an app bundle.**

That is why there are two clients rather than one. `createHoneystick()` holds
the key and only ever runs on a server. `createHoneystickClient()` holds nothing
and calls a route on _your_ server, where the handler attaches the key on the
way through. On native this is not a nicety: an app bundle is readable by anyone
who has the app, so a key compiled into one is a published key.

Everything else — the adapters, `backendUrl`, `pathPrefix` — is machinery for
keeping that true.

## Buying a subscription

One call. The shopper is named by email, not by an id you had to fetch first:

```ts
const checkout = await hs.customerPlans.checkout({
  customers: [{ email, name }], // matched, or registered from the email
  provider: 'payfast',
  plan_type: 'subscription',
  plan_type_data: { price, price_plan: 'fixed', plan_frequency: 'month' },
  feature_ids,
  rules, // usage-limit rules — the account page's meters
  return_url,
  cancel_url,
});
// → { org_customer_ids, org_customer_plan_ids, redirect_url }
```

`id`, `ext_id` or `email`, tried in that order of confidence. An email matching
nobody registers a customer; an email matching someone _is_ that person.

This matters more than it looks. The obvious alternative — `POST /customers`
then create the plan — writes a customer unconditionally, so a shopper who
subscribed last month becomes a second customer this month and their plans end
up spread across both records.

### The account page

Each store has one, and everything on it is the SDK talking to Honeystick
through the store's own mounted handler — usage meters, a card update, a cancel,
with no store-specific endpoint behind any of it.

Two things worth knowing if you copy it:

- **Name the plan.** `useCustomer({ planId })` reads one specific plan.
  Without it the hook takes the newest subscription on the whole organization,
  which on any shared org hands whoever opens the page the last person's
  subscription with a cancel button under it.
- **`removed` is not a detail.** Cancelling a plan that never started _deletes_
  it rather than cancelling it, so the id stops resolving and a screen that
  re-reads to confirm lands on a 404 looking like a failure. `cancel()` reports
  it.

In the samples the back button also hard-cancels the subscription. No real store
should copy that — a demo has the opposite problem to a real one: every visitor
who tries the flow otherwise leaves a live recurring plan on somebody's actual
billing account.

## Telling an app that a payment cleared

`return_url` fires when the customer's browser comes back. That is not evidence
of anything — they may have closed the payment page, and the redirect happens
either way. The only thing that knows a payment cleared is the provider's
notification, and that lands on Honeystick rather than on you.

So `notifyUrl` joins `returnUrl` and `cancelUrl` as a client option:

```
your server                Honeystick               PayFast
  |-- checkout ------------->|                        |
  |   notify_url: mine       |-- custom_str5: mine -->|
  |                                                   |
  |   (customer pays) ------------------------------->|
  |                          |<-- ITN, custom_str5 ---|
  |<-- POST /honeystick/notify (a nudge, unsigned)    |
  |== SSE ==> browser / phone
```

`custom_str5` is the trick: PayFast hands custom fields back untouched, so your
callback address travels out with the payment and comes home with it. No table
of callbacks anywhere. A checkout created without a `notify_url` carries none,
and that absence means "this caller does not want to be told" rather than
something missing.

**The post is a nudge with no authority.** It is not signed, so every receiver
takes the plan id as a hint, re-reads the plan through the SDK with its own key,
and announces only what the read says. A forged post costs a wasted lookup and
nothing else — it cannot invent a settled payment.

## Things to know before you ship

**A callback URL cannot be a private host.** Honeystick fetches the `notifyUrl`
you supply, so it refuses private and loopback addresses — without that check it
would be a request-forgery primitive. In local development your callback is
`http://localhost:3000/…`, which is refused every time. Run behind a tunnel and
a reachable address falls out on its own.

**An in-process fan-out does not survive serverless.** If you take a
notification on one route and push it to an open SSE stream from another, the two
land in different instances on Vercel and on Cloudflare Workers, so the publish
reaches nobody — silently, because the stream stays open. Either run one process,
or have the stream watch the plan directly rather than wait to be told.

**Bare React Native needs a babel plugin Expo bundles for you.** Add
`@babel/plugin-transform-export-namespace-from`, or `zod` fails to parse and the
error names a plugin rather than anything you wrote. "Works in Expo, fails in
bare React Native" is usually a preset difference like this one.

## Security

**A secret key never reaches a browser or an app bundle** — see
[the one rule](#the-one-rule-the-whole-design-rests-on). The rest of this section
is what the handler does *not* do for you.

**The handler authenticates, it does not authorize.** `identify()` establishes
_who is calling_. Nothing downstream checks that answer against _what they asked
for_, and a plan id is a guessable integer — so on its own, the handler will let
a browser read or cancel any plan whose id it can guess.

Before real customers exist, join `identify` to a check that the plan belongs to
whoever it returned. This is the one piece of the integration you have to write
yourself.

The collection endpoints are already closed: `/customers`, `/customers/:id` and
the `/customer-plans` collection are denied through a mounted handler, because
they answer with every customer in the organization and their email addresses.
`allowOrgWideReads` re-enables them and is named as a warning — turning it on is
a statement that you have put your own authorization in front of the handler.

## Contributing

Building the packages, what has and has not been exercised against a live API,
and how releases and the demo deploy are cut: [CONTRIBUTING.md](CONTRIBUTING.md).

MIT © Honeystick
