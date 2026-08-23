import { API_URL } from './config';
import { zStorefrontSchema, type Storefront } from './types';

/**
 * The store's own endpoints, as opposed to Honeystick's.
 *
 * Worth being clear about the division, because both go to the same host. The
 * Honeystick SDK talks to `/billing` and is the thing under test; these are the
 * store's own routes on the Express app - the shop window, and the two calls
 * that move money. They exist because pricing a basket and choosing what a
 * product looks like are the store's business, and neither belongs in a billing
 * API.
 *
 * This app never calls Honeystick directly. The secret key is what
 * authenticates those calls, and it lives on the Express server - so anything
 * needing it happens behind these routes, or behind /billing, and never in this
 * bundle.
 *
 * These are plain `fetch` calls rather than SDK calls on purpose. The SDK is for
 * Honeystick; pricing a basket and choosing what a product looks like are the
 * store's own business, and mixing the two would suggest a billing SDK is where
 * a shop window comes from.
 */

export type CheckoutResult =
  | { ok: true; redirect_url: string; order_id: string }
  | { ok: false; error: string };

export type SubscriptionResult =
  | {
      ok: true;
      redirect_url: string;
      reference: string;
      /**
       * The plan that was just created, and the customer it belongs to.
       *
       * The account screen is built on this. It cannot go looking for it
       * instead: `GET /customer-plans` answers newest-first for the whole
       * organization, so "my subscription" is only mine while nobody else has
       * subscribed since.
       *
       * Null on the server's sample-data path, where no plan was created.
       */
      plan_id: number | null;
      customer_id: number | null;
    }
  | { ok: false; error: string };

/**
 * A fetch that fails loudly.
 *
 * On native a failed request is almost always one of two things - the wrong
 * host for the platform, or the server not running - and the default
 * "Network request failed" says neither. Naming the URL turns ten minutes of
 * confusion into a glance, and it is the single most useful line in this file
 * for anyone running the app on a device for the first time.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch (cause) {
    throw new Error(
      `Could not reach the store API at ${url}. Is it running, and does it allow this origin? See src/config.ts.`,
      { cause },
    );
  }

  const body = (await response.json().catch(() => null)) as T | null;

  // The store's own routes answer with the result either way - a refused
  // checkout is a 400 carrying `{ ok: false, error }`, which the caller renders.
  // Only a response with no body at all is beyond saving.
  if (body === null) {
    throw new Error(`${url} answered ${response.status} with no body.`);
  }

  return body;
}

export const getStorefront = async (): Promise<Storefront> =>
  zStorefrontSchema.parse(await request<unknown>('/api/storefront'));

export const startCheckout = (input: {
  email: string;
  name?: string;
  items: { ext_id: string; quantity: number }[];
}) =>
  request<CheckoutResult>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/**
 * No `scheme`, unlike the native stores, and that absence is what selects the
 * return route.
 *
 * The native apps send one because PayFast will not accept a custom scheme as a
 * return url, so their payment has to land on the API's own `/return` page and
 * hop to `demostore://` from there. A browser needs none of that - it can be
 * sent straight back to a web page - so the server reads the missing `scheme`
 * as "this is a web client" and returns to WEB_STORE_URL instead.
 *
 * Worth noting what is *not* sent: a return url. Accepting one from a client
 * would hand PayFast an address a caller chose, which is an open redirect with
 * a payment attached to it.
 */
export const startSubscription = (input: {
  ext_id: string;
  email: string;
  name?: string;
}) =>
  request<SubscriptionResult>('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const resetDemo = () =>
  request<{ ok: true; counters: number }>('/api/demo/reset', {
    method: 'POST',
  });
