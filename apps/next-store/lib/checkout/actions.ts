'use server';

import { honeystick } from '@honeystick/next';

import { DUMMY_PLANS } from '@/lib/catalogue/plans';

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
};

/**
 * Buying a basket.
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
   * stops short of the one call that needs an organization. The shopper lands
   * on the same completion page a real payment returns to.
   */
  if (!process.env.HONEYSTICK_SECRET_KEY) {
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
    const origin = process.env.NEXT_PUBLIC_STORE_URL || 'http://localhost:3000';
    const hs = honeystick({
      returnUrl: `${origin}/checkout/complete?order=${orderId}`,
      cancelUrl: `${origin}/checkout?cancelled=${orderId}`,
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
      description: `${order.item_count} item${order.item_count === 1 ? '' : 's'} from Honeystick Example App`,
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
