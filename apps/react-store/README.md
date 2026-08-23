# The Depot, as a React SPA

The same store as the other four, built on `@honeystick/react` with **no
framework server of its own** — Vite, React Router, and nothing rendering on a
server anywhere in this app.

It talks to `apps/express-api`, exactly as the Expo and React Native stores do.
Three clients, one backend, so you can diff them.

## Running it

```bash
# 1. the backend
npm run dev -w @honeystick/express-api     # localhost:4000

# 2. this app
npm run dev -w @honeystick/react-store     # localhost:5173
```

Point it somewhere else with `VITE_API_URL`. No keys here — the Express server
holds the only one.

## Why this app exists

The Next store hides the interesting part. It mounts the handler on its own
origin, so `HoneystickProvider` needs no `backendUrl` and the browser's cookies
are same-origin by default. Most of the awkwardness of a real integration is
absorbed by the fact that the page and the API are the same deployment.

A SPA has no such luck, and that is what this sample is for:

- **`backendUrl` is required in practice.** The page is served from `:5173` and
  the handler is mounted on `:4000`. There is no relative `/billing` to resolve.
  This is the same asymmetry that makes it a *type-level* requirement in
  `@honeystick/react-native` — an app was not served from anywhere either.
- **`includeCredentials` is required.** `fetch` drops cookies cross-origin
  unless asked, and the handler's `identify` is expected to read a session. The
  Express app answers with `cors({ credentials: true })` for exactly this; a
  wildcard origin would make the browser refuse the response.
- **There is no server to hide a key on.** Which is the point — there is no key.
  A Vite bundle is served to every visitor, so the same rule as `NEXT_PUBLIC_`
  and `EXPO_PUBLIC_` applies to `VITE_`: an address, never a secret.

There is deliberately **no dev proxy** in `vite.config.ts`. A proxy would make
the cross-origin problem disappear in development and reappear in production,
which is the worst possible place for it to appear.

## What is worth reading

| File | Why |
| --- | --- |
| `src/main.tsx` | the provider, and the two props a SPA cannot omit |
| `src/components/service-sheet.tsx` | subscribing: one call, identified by email |
| `src/pages/account.tsx` | usage, card update, cancel — all SDK, no store endpoint |
| `src/hooks/use-store-events.tsx` | `EventSource` against the API, and why it needs no library |

## The subscription flow

1. **Subscribe** from the subscriptions counter. The sheet asks for a name and
   an email and sends neither a price nor a customer id.
2. The server calls `POST /customer-plans/checkout` once. `customers: [{ email }]`
   is the whole identity — Honeystick matches an existing customer or registers
   a new one — and answers with the plan id and the PayFast page.
3. **Pay** at PayFast.
4. **Come back** to `/account`. Unlike the native stores there is no `/return`
   bridge and no deep link: a browser can be sent straight to a page, so this
   client sends no `scheme` and the server reads that absence as "web" and
   returns to `WEB_STORE_URL`.
5. **Manage**: live usage meters, a card update, a cancel.
6. **Payment received** appears on its own over SSE when Honeystick posts to the
   API's `/honeystick/notify`. Nothing on the page polls for it.
7. **Back** cancels the subscription — see below.

### Why the back button cancels

Deliberately, and no real store should copy it. A demo has the opposite problem
to a real store: every visitor who tries this flow leaves a live recurring plan
on somebody's actual billing account, and by next week there are two hundred of
them still billing.

Cancelled first, forgotten second — the other order leaves a live subscription
that nothing points at any more.

### One difference from the Next store's account page

`useStoreEvents` here is a plain `EventSource` with no polling fallback. The Next
store adds one because Vercel and Cloudflare Workers put the notification and
the open stream in different instances; the Express server is a single
long-lived process, so its push always reaches the subscriber and a fallback
would be dead code.

## Not deployed

There is no hosting for this app and the deploy workflow does not reference it.
Only `apps/next-store` reaches Cloudflare.
