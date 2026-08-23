import { honeystick, isConfigured } from '../honeystick';
import { DUMMY_PLANS } from '../catalogue/plans';

import type { CartLine } from './constants';
import { newOrderId, priceOrder, snapshotFor } from './order';

export type CheckoutResult =
  | { ok: true; redirect_url: string; order_id: string }
  | { ok: false; error: string };

export type CheckoutInput = {
  email: string;
  name?: string;
  /** ext_id and quantity only - the price is ours to decide */
  items: CartLine[];
  /**
   * Where Honeystick should report the payment clearing.
   *
   * Passed in rather than read here, because it is derived from the request that
   * reached the server and this function has no request. Keeping it a parameter
   * is what lets this stay a plain function that can be called from anywhere -
   * a route, a test, a script - without one of them having to fake an Express
   * object to get a URL.
   */
  notifyUrl?: string | null;
};

/**
 * Buying a basket.
 *
 * The Next store's `lib/checkout/actions.ts`, unchanged in substance. It was a
 * server action there and is a plain function here, which is the whole
 * difference: a server action arrives with typed arguments, an HTTP endpoint
 * arrives with whatever was posted, so the parsing lives at the route in
 * index.ts and this still receives a `CheckoutInput`.
 *
 * A one-time-payment plan is created for this purchase and nothing else. It is
 * not attached to a catalogue plan, because a customer plan in Honeystick is a
 * static copy that carries its own terms - `POST /customer-plans` says what the
 * customer is getting in full, and naming a template would only pin the terms
 * to whatever the template happened to say. A basket has a total that exists
 * nowhere in a catalogue, so creating the plan on the fly is the intended path
 * rather than a way around one.
 *
 * Two calls, in order:
 *
 *   1. the customer, so there is someone to bill
 *   2. checkout, which creates the plan carrying the total and a snapshot of
 *      the basket, and answers with the provider's payment page
 *
 * The order is not a formality - the plan needs a customer id.
 */
export async function startCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const email = input.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: 'An email address is required.' };
  if (!input.items?.length) return { ok: false, error: 'Your cart is empty.' };

  const orderId = newOrderId();

  // priced from the catalogue, never from the browser
  const catalogue = DUMMY_PLANS.map((plan) => ({
    ext_id: plan.ext_id,
    name: plan.name,
    price: plan.plan_type_data.price ?? 0,
  }));
  const order = priceOrder(input.items, catalogue, orderId);

  if (!order.lines.length) {
    return { ok: false, error: 'Nothing in your cart is still available.' };
  }

  /**
   * Without keys the store still has to demonstrate the flow, so it goes
   * through everything above - pricing, the snapshot, the order id - and then
   * stops short of the one call that needs an organization. The caller gets the
   * same shape of result either way, so the app needs no branch.
   *
   * The completion path is returned as a relative URL, exactly as the Next store
   * does. The Expo app treats a leading slash as "a screen of mine" and a full
   * URL as "open this in a browser", which is the same decision the web store
   * makes with `router.push` versus `window.location`.
   */
  if (!isConfigured()) {
    const params = new URLSearchParams({
      order: orderId,
      total: order.total.toFixed(2),
      demo: '1',
    });
    return {
      ok: true,
      order_id: orderId,
      redirect_url: `/checkout/complete?${params.toString()}`,
    };
  }

  try {
    // the two pages the shopper comes back to, given to the client once - the
    // order id is in them, which is why the client is built per checkout
    const origin = process.env.STORE_URL || 'http://localhost:3000';
    const hs = honeystick({
      returnUrl: `${origin}/checkout/complete?order=${orderId}`,
      cancelUrl: `${origin}/checkout?cancelled=${orderId}`,
      /**
       * Where the shopper lands, and where we are told - two different things.
       *
       * The return url above fires when they come back, which is not evidence of
       * payment: they may have closed the page. This one fires when the payment
       * actually clears, and is what reaches the app over the event stream.
       *
       * Absent when the request carried no host to derive one from, and then it
       * is simply not sent - the same checkout, minus the callback.
       */
      notifyUrl: input.notifyUrl ?? undefined,
    });

    const customer = await hs.customers.create({
      email,
      name: input.name?.trim() || email,
      // the store's own handle for this shopper; with real accounts this would
      // be the user id rather than the address
      external_id: email,
    });
    const customerId = (customer as { id?: number })?.id;
    if (!customerId) {
      return { ok: false, error: 'Could not open a customer record.' };
    }

    const checkout = await hs.customerPlans.checkout({
      org_customer_ids: [customerId],
      provider: 'payfast',
      // one value doing double duty: the plan's identifier and the store's
      // order reference, so a payment can always be traced back to a basket
      ext_id: orderId,
      name: `Depot order ${orderId}`,
      description: `${order.item_count} item${order.item_count === 1 ? '' : 's'} from The Depot`,
      plan_model: 'paid',
      plan_type: 'one-time-payment',
      plan_type_data: { price: order.total },
      product: snapshotFor(order),
      immediately_available: true,
      credit_card_required: true,
    });

    // where the shopper comes back to is the store's own business, so both
    // urls are set here in full rather than left to the client to invent
    const redirectUrl = checkout?.redirect_url;
    if (!redirectUrl) {
      return { ok: false, error: 'The payment provider returned no checkout.' };
    }

    return { ok: true, order_id: orderId, redirect_url: redirectUrl };
  } catch (error) {
    console.error({ DEPOT_CHECKOUT_ERROR: String(error) });
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Checkout could not be started.',
    };
  }
}
