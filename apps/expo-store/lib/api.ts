import { API_URL } from './config';

import type { zProductType } from '@/types/product';
import type { zServiceType } from '@/types/service';

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
 * The app never calls Honeystick directly. The secret key is what authenticates
 * those calls, and it lives on the Express server - so anything needing it
 * happens behind these routes, or behind /billing, and never in this bundle.
 */

export type Storefront = {
  products: zProductType[];
  services: zServiceType[];
};

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
 * On native a failed request is almost always one of two things - the wrong host
 * for the platform, or the server not running - and the default
 * "Network request failed" says neither. Naming the URL turns ten minutes of
 * confusion into a glance.
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
      `Could not reach the store API at ${url}. Is it running, and is EXPO_PUBLIC_API_URL reachable from this device?`,
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

export const getStorefront = () => request<Storefront>('/api/storefront');

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
 * `scheme` is how the payment page finds its way back here.
 *
 * PayFast is handed an http(s) return url and will not take a custom scheme, so
 * the return lands on the API's own /return page, which then hops to
 * `demostore://`. The app names its scheme rather than the server assuming one,
 * because the same API serves more than one of these stores.
 */
export const startSubscription = (input: {
  ext_id: string;
  email: string;
  name?: string;
}) =>
  request<SubscriptionResult>('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({ ...input, scheme: 'demostore' }),
  });

export const resetDemo = () =>
  request<{ ok: true; counters: number }>('/api/demo/reset', {
    method: 'POST',
  });
