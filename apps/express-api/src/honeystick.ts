import { createHoneystick, type ClientOptions, type Honeystick } from 'honeystick';

/**
 * The server-side client, for the store's own route handlers.
 *
 * This is what `@honeystick/next` gives a Next app as `honeystick()`; on Express
 * there is no framework wrapper to provide it, so the store makes its own - and
 * it is one line, because there is nothing framework-specific about holding a
 * secret key and calling an API.
 *
 * Built per call rather than once at module scope. A module-level client reads
 * the environment at import time, which on a server started before its `.env`
 * is loaded means a client with no key that never recovers. Per call it is
 * always current, and constructing one is cheap.
 */
export function honeystick(options: ClientOptions = {}): Honeystick {
  return createHoneystick(options);
}

/**
 * Whether the store is configured to reach Honeystick at all.
 *
 * The one switch between sample data and a live catalogue, read in the same
 * place by every route so they cannot disagree about which mode the store is in.
 */
export const isConfigured = (): boolean =>
  !!process.env.HONEYSTICK_SECRET_KEY;

/** the shape of a request this needs - not Express's, so nothing here imports it */
type AddressableRequest = {
  protocol: string;
  get: (header: string) => string | undefined;
};

/**
 * Where Honeystick should post back to, worked out from the request itself.
 *
 * Deliberately not an environment variable. The secret key is the one thing a
 * caller should have to set, and every extra variable is another way to have a
 * working server that quietly cannot be told anything - a stale `PUBLIC_URL`
 * fails by pointing the callback at the wrong host, which is invisible until a
 * payment does not arrive.
 *
 * The request already knows the answer. Whatever host reached this server is a
 * host that resolves to this server, so it is the right thing to hand out - and
 * that holds for cases a fixed value gets wrong: behind a tunnel the tunnel's
 * hostname is in the request, so a developer pointing the app at an ngrok URL
 * gets a reachable callback without configuring anything.
 *
 * `trust proxy` is what makes this honest behind a load balancer - see index.ts.
 * Without it `protocol` is the internal http hop rather than the https the world
 * used, and the callback would be advertised on a scheme that is not served.
 *
 * Null when there is no host header at all, in which case no `notify_url` is
 * sent and the checkout is exactly as it was.
 */
export function notifyUrlFrom(req: AddressableRequest): string | null {
  const host = req.get('host')?.trim();
  if (!host) return null;
  return `${req.protocol}://${host}/honeystick/notify`;
}
