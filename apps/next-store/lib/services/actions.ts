'use server';

import { headers } from 'next/headers';

import type { Honeystick } from 'honeystick';
import { honeystick } from '@honeystick/next';

import { findService } from '@/lib/catalogue/catalogue';
import { takeSeat } from '@/lib/demo/store';

import type { zServiceType } from '@/types/schema/service';

export type SubscriptionResult =
  | {
      ok: true;
      redirect_url: string;
      reference: string;
      /**
       * The plan that was just created, and the customer it belongs to.
       *
       * Handed back rather than left for the browser to go looking for, because
       * the browser cannot: `GET /customer-plans` answers newest-first for the
       * whole organization, so a shopper's "my subscription" is only theirs
       * while nobody else has subscribed since. The id is the one unambiguous
       * handle on what this person just bought, and /account is built on it.
       *
       * Null on the sample-data path, where no plan was created.
       */
      plan_id: number | null;
      customer_id: number | null;
    }
  | { ok: false; error: string };

export type SubscriptionInput = {
  /** which service. The price is ours to look up, not the browser's to send */
  ext_id: string;
  email: string;
  name?: string;
};

/** enough to catch a typo, not an attempt at RFC 5322 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The subscription reference, and the customer plan's `ext_id`.
 *
 * Distinguished from an order reference by its prefix so that a payment landing
 * on a webhook can be told apart from a basket at a glance - the two are
 * settled differently, and a recurring plan that gets treated as a one-off sale
 * is a support conversation.
 */
function newSubscriptionRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const noise = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEPOT-SUB-${stamp}-${noise}`;
}

/**
 * The plan's usage meters, resolved against the organization's real features.
 *
 * A subscription with no rules has no counters, and an account page with no
 * counters is a page with nothing on it - so this is what makes the thing worth
 * showing. The store says which features a plan includes and how much of each
 * (see SERVICE_PRESENTATION); Honeystick owns the feature rows and the counting.
 *
 * Resolution is by `ext_id` and a miss is skipped rather than fatal. An
 * organization that has not created its features yet is the normal state early
 * on, and refusing to sell a subscription over a missing meter would be the
 * wrong trade: a plan with fewer counters still bills correctly, and the
 * account page says plainly that there are none.
 *
 * `usage-limit` rather than `usage-alert` on purpose. An alert notifies and
 * lets the unit through; a limit is what makes `track` answer 403 with the
 * counter untouched, which is the branch a metered plan exists to demonstrate.
 */
async function meteredRulesFor(
  hs: Honeystick,
  service: zServiceType,
): Promise<{ featureIds: number[]; rules: Record<string, unknown>[] }> {
  if (!service.metered.length) return { featureIds: [], rules: [] };

  let features: { id?: number; ext_id?: string }[] = [];
  try {
    const page = await hs.features.list({ limit: 100 });
    features = page.data ?? [];
  } catch (error) {
    // A catalogue read failing must not fail a sale. The plan is created
    // without meters and the shopper is still charged the right amount.
    console.error({ DEPOT_FEATURE_LOOKUP_ERROR: String(error) });
    return { featureIds: [], rules: [] };
  }

  const idByExtId = new Map(
    features
      .filter((feature) => feature.ext_id && feature.id)
      .map((feature) => [feature.ext_id as string, Number(feature.id)]),
  );

  const featureIds: number[] = [];
  const rules: Record<string, unknown>[] = [];

  for (const meter of service.metered) {
    const featureId = idByExtId.get(meter.ext_id);
    if (!featureId) continue;
    featureIds.push(featureId);
    rules.push({
      org_feature_id: featureId,
      enabled: true,
      rule_type: 'usage-limit',
      rule_type_config: { usage_limit: meter.limit, interval: meter.interval },
    });
  }

  return { featureIds, rules };
}

/**
 * Where Honeystick should post back to when the payment settles.
 *
 * Derived from the request that reached this action rather than configured,
 * for the same reason the Express app derives it: every extra environment
 * variable is another way to have a working server that quietly cannot be told
 * anything, and a stale one fails by pointing the callback at the wrong host -
 * invisible until a payment does not arrive.
 *
 * `x-forwarded-proto` before anything inferred, because this deploys behind a
 * proxy and the internal hop is http even when the world used https. A callback
 * advertised on a scheme that is not served is a callback that never lands.
 *
 * Undefined when there is no host header at all, in which case no `notify_url`
 * is sent and the checkout is exactly as it was - the SDK omits the field
 * entirely rather than sending it empty, which is what lets Honeystick read its
 * absence as "this caller does not want to be told".
 *
 * Worth knowing in development: Honeystick calls this from the internet, so a
 * derived http://localhost:3000/... is reachable only by this machine. Run the
 * store behind a tunnel and open the tunnel's URL, and the derivation produces
 * a reachable address on its own.
 */
async function notifyUrl(): Promise<string | undefined> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host')?.trim();
  if (!host) return undefined;
  const proto =
    requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}/api/honeystick/notify`;
}

/**
 * Subscribing to a service, in one call.
 *
 * This used to be three - create the customer, create the plan, activate it -
 * and the middle one was the problem. `POST /customers` writes unconditionally,
 * so a shopper who subscribed last month became a second customer this month,
 * and the plans they hold ended up spread across both records. Reading "their"
 * subscription back afterwards then returned whichever copy was newest.
 *
 * `POST /customer-plans/checkout` collapses all three. `customers` names the
 * shopper by email and Honeystick resolves it: an existing customer is matched,
 * a new one is registered from the address, and either way the ids come back in
 * the response. One round trip, one customer per person, and no id read out of
 * one response to be put into the next - which is where a store's checkout is
 * most likely to break.
 *
 * What separates this from a basket is still just two fields: `plan_type` is
 * 'subscription' and `plan_type_data` carries a `plan_frequency`. That is what
 * tells Honeystick to bill again rather than once.
 *
 * The terms travel with the request rather than naming a catalogue plan,
 * because a customer plan in Honeystick is a static copy. Naming a template
 * would pin the shopper to whatever it happened to say on the day - and the
 * price is read here, server-side, precisely so the terms are the store's
 * answer and not the browser's.
 */
export async function startSubscription(
  input: SubscriptionInput,
): Promise<SubscriptionResult> {
  const email = input.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: 'An email address is required.' };
  if (!LOOKS_LIKE_EMAIL.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }

  const service = await findService(input.ext_id);
  if (!service) {
    return { ok: false, error: 'That subscription is no longer offered.' };
  }

  const reference = newSubscriptionRef();

  /**
   * Without keys the store still has to demonstrate the flow, so it validates,
   * prices and references the subscription and then stops short of the one call
   * that needs an organization. The shopper lands on the account page a real
   * payment returns to, which renders from the same sample data.
   */
  if (!process.env.HONEYSTICK_SECRET_KEY) {
    /**
     * Taking the seat before handing back a redirect.
     *
     * Plain demo inventory, not Honeystick usage - the seat count is a fixture
     * this store keeps so the shop floor has something that can run out, and
     * "Reset demo data" is what puts it back.
     *
     * There is no live equivalent below on purpose. With real keys a
     * subscription's capacity is the organization's business, and inventing a
     * write against someone's billing record to make a sample look tidy is not
     * something a sample should do.
     */
    if (!takeSeat(service.ext_id)) {
      return { ok: false, error: 'That subscription is fully booked.' };
    }

    return {
      ok: true,
      reference,
      plan_id: null,
      customer_id: null,
      redirect_url: `/account?demo=1`,
    };
  }

  try {
    const origin = process.env.NEXT_PUBLIC_STORE_URL || 'http://localhost:3000';

    /**
     * Where the shopper lands, and where they land if they back out.
     *
     * Neither carries the plan id, and cannot: the id is not known until
     * checkout answers, which is after these have been sent. The browser keeps
     * it instead - it survives the trip to PayFast and back in localStorage,
     * which is the one piece of state that outlives leaving the origin.
     */
    const hs = honeystick({
      returnUrl: `${origin}/account`,
      cancelUrl: `${origin}/?subscription_cancelled=${reference}`,
      notifyUrl: await notifyUrl(),
    });

    const { featureIds, rules } = await meteredRulesFor(hs, service);

    const checkout = await hs.customerPlans.checkout({
      // Named by email, not by id. This is the whole reason the store does not
      // call POST /customers first, and the reason a returning shopper stays
      // one customer.
      customers: [
        {
          email,
          name: input.name?.trim() || email,
          // the store's own handle for this shopper; with real accounts this
          // would be the user id rather than the address
          ext_id: email,
        },
      ],
      provider: 'payfast',
      ext_id: reference,
      name: service.title,
      description: service.description,
      plan_model: 'paid',
      plan_type: 'subscription',
      plan_type_data: {
        price: service.price,
        price_plan: 'fixed',
        plan_frequency: service.frequency,
      },
      product: {
        subscription_ref: reference,
        service_ref: service.ext_id,
        price: service.price.toFixed(2),
        frequency: service.frequency,
      },
      immediately_available: true,
      credit_card_required: true,
      feature_ids: featureIds,
      rules,
    });

    const redirectUrl = checkout?.redirect_url;
    if (!redirectUrl) {
      return { ok: false, error: 'The payment provider returned no checkout.' };
    }

    return {
      ok: true,
      reference,
      plan_id: checkout.org_customer_plan_ids?.[0] ?? null,
      customer_id: checkout.org_customer_ids?.[0] ?? null,
      redirect_url: redirectUrl,
    };
  } catch (error) {
    console.error({ DEPOT_SUBSCRIPTION_ERROR: String(error) });
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'The subscription could not be started.',
    };
  }
}
