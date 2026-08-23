# The Depot API

The same store logic as `apps/next-store`, on Express, and the backend the Expo
app talks to.

```sh
cp .env.example .env      # optional - it runs without a key
npm run dev --workspace @honeystick/express-api
```

## Why this exists separately from the Next store

The Next store is its own backend: a route handler at `/api/billing` holds the
secret key, and the browser calls the origin it was served from. A native app
has no such origin, so it needs a server to point at — this one. That is the
only structural difference between the two, and it is the reason
`HoneystickProvider` takes a required `backendUrl` on Expo and an optional one
on web.

## Routes

| Route | What it is |
| --- | --- |
| `ALL /billing/*` | The Honeystick handler. Everything under it is forwarded to Honeystick with the secret key attached. |
| `GET /api/storefront` | `{ products, services }` — one catalogue read, split on plan type. |
| `POST /api/checkout` | Prices the basket server-side and returns the provider's payment page. |
| `POST /api/subscribe` | The same, for a subscription — one `POST /customer-plans/checkout` call, with the shopper named by email. Answers with `plan_id`, which is what the account screen is built on. |
| `POST /api/demo/reset` | Puts the in-memory stock and seats back to their defaults. |
| `GET /products/*.svg` | Product artwork, so the app can render the catalogue's image paths. |
| `GET /return` | Where PayFast sends a native shopper. Hops to the app's URL scheme so the system browser closes itself. |
| `GET /healthz` | Whether a key is set. |

`/billing` is the SDK's default prefix, so neither the mount here nor the
provider in the app has to name it. The Next store mounts at `/api/billing` to
sit alongside its other routes, and therefore has to say so in both places.

## What was copied and what changed

`src/catalogue`, `src/checkout`, `src/demo` and `src/types` are the Next store's
`lib/` and `types/` directories, carried over intact. Three deliberate
differences:

- **`src/honeystick.ts`** replaces `@honeystick/next`'s `honeystick()`. There is
  no Express equivalent in the SDK because there is nothing framework-specific
  about holding a key and calling an API — it is one function.
- **Request bodies are parsed.** A server action arrives with typed arguments; an
  HTTP endpoint arrives with whatever was posted. `zCheckoutBody` in `index.ts`
  buys back the guarantee TypeScript gave the Next store for free — and notably
  has no `price` field, because the only things worth trusting from a client are
  which product and how many.
- **`demo/store.ts` drops `server-only`.** That guard keeps a module out of a
  client bundle, and there is no client bundle here.

The demo inventory also behaves differently in a way worth knowing rather than
discovering: a long-lived Express process keeps its counters for as long as it
runs, where a Worker isolate discards them on its own. Here the reset endpoint
is the only thing that puts them back.

## Return URLs and native apps

Two different answers, because a basket and a subscription end in different
places.

**A basket** returns to `STORE_URL` — the *store's* address rather than this
API's, pointed at the Next store so a real payment lands somewhere that renders.

**A subscription** returns to this API's own `GET /return`, which navigates to
the app's URL scheme (`demostore://` for the Expo store, `depotstore://` for the
bare React Native one) and thereby closes the system browser. Two reasons it
cannot go straight to the app:

- PayFast is handed an http(s) return url and will not accept a custom scheme.
- A system browser has to be told to close by something running inside it. A
  302 to an unregistered scheme is a network error with nothing to read; a page
  that tries and then explains leaves the shopper somewhere they understand.

The scheme is sent by the client on `POST /api/subscribe`, not assumed here —
the same API serves both native stores. It is validated as a bare scheme before
being put in a link, because it arrives in a query string PayFast has
round-tripped, and treating that as somewhere to navigate is an open redirect
with extra steps.

## The subscription flow

Worth reading the README at the repo root. In short: one checkout call
identified by email, a return through `/return`, and an account screen in each
app that reads usage, updates the card and cancels — entirely through the SDK,
with no store endpoint behind any of it.

## Not deployed

There is no Cloudflare project for this app and the deploy workflow's `paths`
filter does not mention it. Only `apps/next-store` reaches Cloudflare.
