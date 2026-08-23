import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import { z } from 'zod';

import { honeystickHandler } from '@honeystick/express';

import { getStorefront } from './catalogue/catalogue';
import { DUMMY_PLANS } from './catalogue/plans';
import { startCheckout } from './checkout/actions';
import { startSubscription } from './services/actions';
import { counterCount, reset } from './demo/store';
import {
  announceBillingWrites,
  publish,
  subscribe,
  subscriberCount,
} from './events/bus';
import { handleNotify } from './events/notify';
import { isConfigured, notifyUrlFrom } from './honeystick';

const here = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

/**
 * Where a browser-based store lives, for the return leg of a subscription.
 *
 * Only the React SPA needs it: the Next store is its own server and handles its
 * own returns, and the two native apps come back through /return instead. Set
 * on this server rather than sent by the client, because a return url a caller
 * chooses is an open redirect that PayFast will happily follow.
 */
const WEB_STORE_URL = (process.env.WEB_STORE_URL ?? 'http://localhost:5173')
  .replace(/\/+$/, '');

/**
 * Believe the proxy about how the world reached us.
 *
 * The callback url handed to Honeystick is derived from the request, so this is
 * what makes it right behind a load balancer or a tunnel: without it `protocol`
 * is the internal http hop rather than the https everyone else used, and the
 * callback would be advertised on a scheme that is not served.
 */
app.set('trust proxy', true);

/**
 * Cross-origin, because the client is not served from here.
 *
 * A native app sends no `Origin` header at all, so CORS is not what gates it -
 * this is for the Expo web target and for a browser poking at the API during
 * development. `origin: true` reflects whatever asked, which is right for a
 * sample and wrong for production: the moment this serves a real app, name the
 * origins.
 *
 * `credentials: true` matters more than it looks. The Honeystick client sends
 * cookies when `includeCredentials` is set, and a wildcard origin makes the
 * browser refuse a credentialed response - so `*` here would break the very
 * thing the handler's `identify` needs.
 */
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());

/**
 * Product artwork, served by the store.
 *
 * The catalogue returns image paths like `/products/backpack.svg`, exactly as
 * the Next store's do - the store's shop window is its own, and a billing system
 * has no business holding a photograph. The Expo app joins these onto its API
 * URL, which is the one adjustment a native client has to make: a page can
 * resolve a relative path against the origin it was served from, and an app was
 * not served from anywhere.
 */
app.use(express.static(path.join(here, '..', 'public')));

/**
 * Honeystick, mounted on the store's own origin.
 *
 * Everything under /billing is forwarded to Honeystick with the secret key
 * attached, so the app talks to this server and never to Honeystick directly.
 * That is the whole reason a native client can use the SDK at all: an app bundle
 * is readable, so a key shipped inside one is a published key.
 *
 * `/billing` is the SDK's default prefix, so neither this mount nor the app's
 * provider has to name it - unlike the Next store, which mounts at
 * /api/billing to sit alongside its other routes and therefore has to say so
 * twice.
 */
if (isConfigured()) {
  app.use(
    '/billing',
    // in front of the handler, so every successful write through it becomes an
    // event on the stream - see events/billing-writes.ts
    announceBillingWrites(),
    honeystickHandler({
      // No orgId: the secret key already carries the claim of which
      // organization it belongs to.
      secretKey: process.env.HONEYSTICK_SECRET_KEY,
      // Whoever this server considers signed in. The Depot has no accounts, so
      // every caller is the same guest - replace this with a real session
      // lookup and nothing else about the integration changes.
      identify: () => ({ customerId: 'guest' }),
    }),
  );
} else {
  /**
   * Without a key the store still has to run - someone who has just cloned this
   * has no organization yet. The fixtures are served in the same envelope the
   * handler uses, so client code cannot tell the difference and nothing has to
   * be rewritten when a real key arrives.
   */
  app.use('/billing', (req, res) => {
    if (req.path === '/plans') {
      res
        .status(200)
        .json({ ok: true, status: 200, body: { data: DUMMY_PLANS } });
      return;
    }
    res.status(501).json({
      ok: false,
      status: 501,
      error:
        'This store is running on sample data. Set HONEYSTICK_SECRET_KEY to reach Honeystick.',
    });
  });
}

/** the shop window - one read, split into goods and services on plan type */
app.get('/api/storefront', async (_req, res) => {
  try {
    res.json(await getStorefront());
  } catch (error) {
    console.error({ DEPOT_STOREFRONT_ERROR: String(error) });
    res.status(500).json({ error: 'Could not load the catalogue.' });
  }
});

/**
 * What the client is allowed to tell us about a basket.
 *
 * The Next store gets this for free: a server action receives typed arguments
 * and TypeScript has already had its say. An HTTP endpoint receives whatever was
 * posted, so the same guarantee has to be bought here - and `price` is
 * deliberately absent from the schema rather than merely ignored, because the
 * only things worth trusting from a client are which product and how many.
 */
const zCheckoutBody = z.object({
  email: z.string(),
  name: z.string().optional(),
  items: z
    .array(z.object({ ext_id: z.string(), quantity: z.number() }))
    .min(1, 'Your cart is empty.'),
});

app.post('/api/checkout', async (req, res) => {
  const parsed = zCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Bad request.' });
    return;
  }

  // derived from this request rather than configured, so the only environment
  // variable anyone has to set is the secret key
  const result = await startCheckout({
    ...parsed.data,
    notifyUrl: notifyUrlFrom(req),
  });

  // A basket that became an order is a change every open client should see -
  // and this route creates the plan itself rather than proxying it, so nothing
  // downstream would otherwise notice.
  if (result.ok) publish({ type: 'order.placed', orderId: result.order_id });

  res.status(result.ok ? 200 : 400).json(result);
});

const zSubscribeBody = z.object({
  ext_id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  /**
   * The app's own URL scheme, so the payment page knows how to get back to it.
   *
   * Sent by the client because the server has several of them: the Expo store
   * and the bare React Native store are two different apps against this one
   * API, and each is reachable only by its own scheme. Optional - a caller that
   * sends none gets a plain page telling them to return to the app, which is
   * the honest fallback on a device where the scheme is not registered.
   */
  scheme: z.string().optional(),
});

app.post('/api/subscribe', async (req, res) => {
  const parsed = zSubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Bad request.' });
    return;
  }

  /**
   * Where PayFast sends the shopper when they are done.
   *
   * Not the app directly. PayFast is given an http(s) address and will not take
   * a custom scheme, so the return lands here first and this server bounces it
   * on - see GET /return. The other reason it lands here is that a system
   * browser has to be *told* to close, and only a page inside it can do that.
   *
   * Deliberately carries no plan id. The id is not known until checkout has
   * answered, which is after these urls have already been sent - so the client
   * keeps the id from the response it got, and this only has to say how it
   * went.
   */
  /**
   * A missing `scheme` is what marks a web client, and that decides where the
   * shopper lands.
   *
   * A native app has to come back through this server's own /return page,
   * because PayFast will not accept a custom scheme as a return url and a
   * system browser has to be told to close by something inside it. A browser
   * needs none of that and can be sent straight to a page.
   *
   * Neither client sends a return url. Accepting one would hand PayFast an
   * address the caller chose, which is an open redirect with a payment attached
   * - so the web destination is WEB_STORE_URL, set on this server.
   */
  const { scheme } = parsed.data;
  const origin = `${req.protocol}://${req.get('host')}`;
  const bridge = (status: string) => {
    const params = new URLSearchParams({ status });
    if (scheme) params.set('scheme', scheme);
    return `${origin}/return?${params.toString()}`;
  };
  const web = (path: string) => `${WEB_STORE_URL}${path}`;

  const result = await startSubscription({
    ...parsed.data,
    notifyUrl: notifyUrlFrom(req),
    returnUrl: scheme ? bridge('complete') : web('/account'),
    cancelUrl: scheme ? bridge('cancelled') : web('/?subscription_cancelled=1'),
  });

  // a seat taken and a subscription started - the shop floor's "seats left" is
  // now wrong on every other device
  if (result.ok) {
    publish({ type: 'subscription.started', reference: result.reference });
  }

  res.status(result.ok ? 200 : 400).json(result);
});

/**
 * The way back from the payment page into a native app.
 *
 * PayFast is handed an http(s) return url and will not take a custom scheme, so
 * the shopper lands here rather than in the app. This page's whole job is one
 * hop: navigate to `demostore://...` (or whatever scheme the client named),
 * which the system browser recognises as leaving the web and closes itself for.
 *
 * The redirect is written in the page rather than sent as a 302 on purpose. A
 * 302 to an unregistered scheme is a network error in the browser's own chrome
 * with nothing to read; a page that tries and then says what happened leaves
 * the shopper somewhere they can understand, and leaves a link to try again.
 *
 * It claims nothing about the payment. `status` here is which url PayFast used,
 * and coming back is only evidence the shopper came back - the notification is
 * the only thing that says money moved. See the README at the repo root.
 */
app.get('/return', (req, res) => {
  const status = String(req.query.status ?? 'complete');
  const scheme = String(req.query.scheme ?? '').trim();

  // Only a bare scheme, never a whole url. This value arrives in a query string
  // that PayFast has round-tripped, so treating it as somewhere to navigate is
  // an open redirect with extra steps.
  const safeScheme = /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme : null;
  const deepLink = safeScheme
    ? `${safeScheme}://account?status=${encodeURIComponent(status)}`
    : null;

  const heading =
    status === 'cancelled' ? 'Payment cancelled' : 'Payment page closed';
  const note =
    status === 'cancelled'
      ? 'Nothing was charged. You can return to the app and try again.'
      : 'We are confirming this with the payment provider. Your subscription updates on its own once that lands.';

  res.status(200).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
             background: #faf7ff; color: #2b2440; padding: 24px; }
      main { max-width: 22rem; text-align: center; }
      h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
      p { font-size: .9rem; line-height: 1.5; color: #4b3f9e; margin: 0 0 1.25rem; }
      a { display: inline-block; background: #241b3a; color: #fff; text-decoration: none;
          padding: .75rem 1.5rem; border-radius: 999px; font-weight: 600; font-size: .9rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${heading}</h1>
      <p>${note}</p>
      ${deepLink ? `<a href="${deepLink}">Return to the app</a>` : '<p>You can close this page.</p>'}
    </main>
    ${deepLink ? `<script>location.replace(${JSON.stringify(deepLink)})</script>` : ''}
  </body>
</html>`);
});

/**
 * Putting the demo back to its defaults.
 *
 * Deliberately outside /billing. That route is the Honeystick handler and
 * everything under it is forwarded to the real API when a key is set; a reset is
 * this store's own idea and has no business being proxied anywhere.
 *
 * It only touches the in-memory fixtures, and has no live path: with real keys
 * the numbers that matter are someone's actual billing record.
 */
app.post('/api/demo/reset', (_req, res) => {
  reset();
  // told rather than discovered: the fixtures are this server's own state, so
  // nothing is polling for the change and every open client would otherwise
  // keep rendering the shelves it last saw
  publish({ type: 'demo.reset' });
  res.json({ ok: true, counters: counterCount() });
});

/**
 * The event stream.
 *
 * Server-sent events rather than a websocket, because the traffic only ever goes
 * one way: the client already has a perfectly good way to talk to the server,
 * and everything it would say is a normal request. SSE is also plain HTTP, which
 * means it survives the same proxies and needs no second protocol.
 *
 * Three headers do real work here. `text/event-stream` is what makes it a
 * stream; `no-cache` stops anything in the path from holding frames back to
 * batch them, which turns a live feed into a burst every thirty seconds; and
 * `X-Accel-Buffering: no` says the same thing again to nginx specifically,
 * which is the proxy most likely to sit in front of this and the one that
 * ignores the first two.
 */
app.get('/events', async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: { type: string } & Record<string, unknown>) => {
    // the blank line is the frame terminator - without it the client sees one
    // event that never ends
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = subscribe(send);

  /**
   * Confirms the stream is open, and carries nothing.
   *
   * It is tempting to send the current state here so a connecting client starts
   * up to date - but that would make every connection cost a call to Honeystick,
   * which is the same bill as polling with extra steps and paid at whatever rate
   * clients reconnect. The client already fetches through the SDK on mount, and
   * that read is the one it should trust. This frame only says "you are
   * listening now".
   */
  send({ type: 'ready' });

  /**
   * A comment every 25 seconds.
   *
   * Lines starting with ':' are ignored by every SSE client, which makes them
   * the standard way to keep a connection from being reaped. Proxies and mobile
   * networks drop idle sockets at around 30-60s, and a billing demo can easily
   * be quiet for minutes - so without this the stream dies silently and the app
   * looks live while receiving nothing.
   */
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

/**
 * Honeystick reporting that a payment settled.
 *
 * Outside /billing on purpose. That route is the proxy *to* Honeystick and
 * everything under it is forwarded there with the key attached; this is traffic
 * coming the other way, and forwarding it would send Honeystick's own
 * notification back to Honeystick.
 */
app.post('/honeystick/notify', handleNotify);

app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    configured: isConfigured(),
    listeners: subscriberCount(),
    // shown so a misconfigured proxy is visible here rather than only as a
    // payment notification that never arrives
    notify_url: notifyUrlFrom(req),
  });
});

/**
 * Bound to every interface, not just loopback.
 *
 * A phone on the same wifi has to reach this, and the default binding does not
 * let it: `localhost` is the machine talking to itself. Stated explicitly rather
 * than left to Node's default so that the reason is written down next to the
 * decision - this is the difference between the Expo app working in a simulator
 * and working on a device.
 */
const HOST = process.env.HOST ?? '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`The Depot API on http://localhost:${PORT}`);
  console.log(
    isConfigured()
      ? '  Honeystick: live (HONEYSTICK_SECRET_KEY is set)'
      : '  Honeystick: sample data (set HONEYSTICK_SECRET_KEY to go live)',
  );
  console.log(
    `  Reachable on the LAN too - point the Expo app at it with EXPO_PUBLIC_API_URL`,
  );
});
