# Honeystick SDK

[Honeystick](https://honeystick.co.za) - Billing Infrastructure ZA —
The billing layer for the modern AI era

| [`honeystick`](packages/js/README.md) | The core client. `createHoneystick()` holds a secret key and calls the API; `createHoneystickClient()` holds nothing and calls a handler on your own server. `honeystick/backend` is the handler both adapters wrap. |
| [`@honeystick/react`](packages/react/README.md) | Provider and hooks for the web — `useCustomer`, `useListPlans`, `useListFeatures`, and `HoneystickFab`. |
| [`@honeystick/react-native`](packages/react-native/README.md) | The same hooks for native. One difference: `backendUrl` is required. |
| [`@honeystick/expo`](packages/expo/README.md) | A re-export of `@honeystick/react-native`. There is nothing Expo-specific in it; the name exists because that is what an Expo app looks for. |
| [`@honeystick/next`](packages/next/README.md) | Mounts the handler on a catch-all route, plus a server client. `@honeystick/next/client` is the client half, kept behind its own `'use client'`. |
| [`@honeystick/hono`](packages/hono/README.md), [`@honeystick/express`](packages/express/README.md) | The same handler for those frameworks. A few lines each — nothing about holding a key and calling an API is framework-specific. |

### Installing

```sh
npm i honeystick                    # server or client, no framework
npm i @honeystick/next              # + honeystick, @honeystick/react
npm i @honeystick/react-native      # + honeystick, @honeystick/react
npm i @honeystick/express           # + honeystick
```
