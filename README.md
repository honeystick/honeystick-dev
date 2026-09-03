# Honeystick SDK

[Honeystick](https://honeystick.co.za) - Billing Infrastructure ZA —
The billing layer for the modern AI era

[`honeystick`](packages/js/README.md). The core client. `createHoneystick()` holds a secret key and calls the API; `createHoneystickClient()` holds nothing and calls a handler on your own server. `honeystick/backend` is the handler both adapters wrap.

[`@honeystick/react`](packages/react/README.md)

[`@honeystick/react-native`](packages/react-native/README.md)

[`@honeystick/expo`](packages/expo/README.md)

[`@honeystick/next`](packages/next/README.md)

[`@honeystick/hono`](packages/hono/README.md)

[`@honeystick/express`](packages/express/README.md)

### Installing

```sh
npm i honeystick                    # server or client, no framework
npm i @honeystick/react             # + honeystick
npm i @honeystick/react-native      # + honeystick, @honeystick/react
npm i @honeystick/expo              # + honeystick, @honeystick/react, @honeystick/react-native
npm i @honeystick/next              # + honeystick, @honeystick/react
npm i @honeystick/hono              # + honeystick
npm i @honeystick/express           # + honeystick
```
