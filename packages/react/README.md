# @honeystick/react

React provider and hooks for [Honeystick](https://honeystick.co.za) billing.

```sh
npm i @honeystick/react honeystick
```

```tsx
import { HoneystickProvider, useCustomer } from '@honeystick/react';

<HoneystickProvider pathPrefix="/billing" includeCredentials>
  <App />
</HoneystickProvider>;

function Account({ planId }: { planId: number }) {
  const { data: plan, check, track, cancel, updateCard } = useCustomer({ planId });

  const gate = check({ featureId: 'deliveries' });
  if (!gate.allowed) return <Upgrade />;

  return <button onClick={() => track({ featureId: 'deliveries' })}>Use one</button>;
}
```

The provider carries no key — it builds the SDK's proxy client, which calls the
handler mounted on your own server.

## Hooks

| Hook | What it answers |
| --- | --- |
| `useCustomer({ planId })` | one plan, its usage counters, and `check` / `track` / `activate` / `cancel` / `updateCard` |
| `useListPlans()` | the plans on offer — what a pricing table renders from |
| `useListFeatures()` | the features plans can meter |

**Name the plan.** Without `planId` the hook takes the newest subscription on
the whole organization, which on any shared organization hands whoever opens
the page somebody else's subscription.

`check` is answered from the plan already loaded, so a feature gate costs no
request and is free to call while rendering. `track` goes to the server, and a
capped feature answers 403 with the counter untouched — catch it and read
`HoneystickError.isLimitReached`, which is a branch to handle rather than a
fault.

Also exports `HoneystickFab`, the way back to Honeystick from anywhere in an
integration.

## The rule this SDK is built around

**A secret key never reaches a browser or an app bundle.** That is why there are
two clients: `createHoneystick()` holds the key and runs on a server, and
`createHoneystickClient()` holds nothing and calls a handler mounted on *your*
server, which attaches the key on the way through.

ESM only, with type declarations. Requires Node 18+.

Full documentation, and five sample stores using it, at
[github.com/honeystick/honeystick-dev](https://github.com/honeystick/honeystick-dev).

MIT © Honeystick
