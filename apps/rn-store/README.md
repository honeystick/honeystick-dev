# Honeystick Example App, on bare React Native

The same store as `apps/next-store` and `apps/expo-store`, built on
`@honeystick/react-native` with **no Expo anywhere** — no Expo SDK, no
expo-router, no Expo CLI. It exists to answer one question honestly: does
Honeystick work in a plain React Native project, or only in the one that comes
with batteries?

It talks to `apps/express-api`, exactly as the Expo store does.

## Running it

```bash
# 1. the backend, from the repo root
npm run -w @honeystick/express-api dev

# 2. point this app at it
#    src/config.ts — localhost only works in the iOS simulator
#    a device or the Android emulator needs the machine's LAN address

# 3. Metro
npm run -w @honeystick/rn-store start

# 4. and the app
npm run -w @honeystick/rn-store ios      # needs `npm run -w @honeystick/rn-store pods` first
npm run -w @honeystick/rn-store android
```

## What is worth reading

| File                               | Why                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/App.tsx`                      | the provider, and the only thing the SDK asks of a native app                                   |
| `src/components/service-sheet.tsx` | subscribing: one call, identified by email                                                      |
| `src/screens/account-screen.tsx`   | usage, card update, cancel — all SDK, no store endpoint                                         |
| `src/navigation.ts`                | how `depotstore://` becomes the account screen                                                  |
| `src/hooks/use-store-events.tsx`   | the SSE stream, and the four things `react-native-fast-sse` does differently from `EventSource` |
| `metro.config.js`                  | the four settings a monorepo needs                                                              |

## The subscription flow

1. **Subscribe** from the services counter. The sheet asks for a name and an
   email and sends neither a price nor a customer id.
2. The server calls `POST /customer-plans/checkout` once. `customers: [{ email }]`
   is the whole identity: Honeystick matches an existing customer on the address
   or registers a new one, and answers with the plan id and the PayFast page.
3. **Pay** in the real browser — `Linking.openURL`, never a WebView. The shopper
   can see whose address bar they are typing into, and the app cannot read the
   page.
4. PayFast returns to the API's `/return` page, which hops to
   `depotstore://account`. That hop exists because PayFast will not accept a
   custom scheme as a return url.
5. **Manage** on the account screen: live usage meters, a card update, a cancel.
6. **Payment received** appears on its own when Honeystick posts to the API's
   `/honeystick/notify`, which re-reads the plan and pushes `payment.settled`
   down `/events`. Nothing on the screen polls for it. Coming back from PayFast
   only proves the shopper came back; this is the first thing that means the
   money moved.
7. **Back** cancels the subscription. See below.

### The back button cancels

Deliberately, and no real store should copy it. A demo has the opposite problem
to a real store: every visitor who tries this flow leaves a live recurring plan
on somebody's actual billing account, and by next week there are two hundred of
them still billing. Tying the teardown to the one action that always happens is
the only version that reliably cleans up.

The header chevron is turned off on that screen for the same reason — a second
exit that quietly does not cancel is worse than no second exit.

## What being Expo-free actually costs

Less than it sounds, and it is worth being precise because this is the question
the app was built to answer.

**Nothing on the Honeystick side.** `@honeystick/expo` is a re-export of
`@honeystick/react-native`; the provider, the hooks and every call they make are
identical. Diff `src/screens/account-screen.tsx` against the Expo store's
`app/account.tsx` and the only differences are the two below.

**Three small things elsewhere:**

- **No `WebBrowser.openAuthSessionAsync`.** `Linking.openURL` hands off to the
  browser but resolves immediately, so it cannot tell you when the shopper came
  back. This app finds out three other ways instead: the deep link
  (`src/navigation.ts`), the AppState listener inside `StoreEventsProvider`, and
  — the one that actually matters — the `payment.settled` event pushed down the
  SSE stream, which is the only thing that knows the payment cleared at all.
- **No `expo-image`, so no SVG.** The store serves its artwork as SVG and React
  Native's own `Image` cannot render it. Matching the Expo store would mean
  `react-native-svg` — a native dependency and a pod install — so that a T-shirt
  has a picture. The cards use an initial instead.
- **No `EXPO_PUBLIC_*`.** Bare React Native has no build-time env inlining
  without another library, so the API address is a constant in `src/config.ts`.

**One native dependency the Expo store also needs:**
`react-native-fast-sse` (plus `react-native-nitro-modules`) for the event
stream. There is no `EventSource` on React Native and the global `fetch` cannot
read a stream, so this is not a preference — it is the only way to consume SSE
here. It is a Nitro module, so it needs the New Architecture (default on 0.87)
and a `pod install` before the first iOS build.

**One thing that bites and has nothing to do with Honeystick:**
`babel.config.js` has to add `@babel/plugin-transform-export-namespace-from`,
which Expo's preset includes and the bare preset does not. Without it zod fails
to parse and the error names a plugin rather than anything you wrote. "Works in
Expo, fails in bare React Native" is almost always a preset difference like this
one.

## Before you ship anything from here

- **The bundle id is `com.depotstore`** on both platforms, which is the React
  Native CLI's default and not a domain anybody owns. Replace it with your own
  reverse-DNS before publishing.
- **`src/config.ts` holds an address and must never hold a key.** An app bundle
  is readable by anyone who has the app, so a secret key compiled into one is a
  published key. This app needs none: the Express server holds it and attaches
  it as calls pass through `/billing`.
- **The account screen trusts a stored plan id to decide _which_ plan to ask
  about.** That is fine, because the server decides whether the asking is
  allowed. It is not an identity model — in an app with accounts the plan comes
  from the session, via the handler's `identify`.
