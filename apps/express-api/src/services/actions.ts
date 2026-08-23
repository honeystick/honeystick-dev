import type { Honeystick } from 'honeystick';

import { honeystick, isConfigured } from '../honeystick';
import { findService } from '../catalogue/catalogue';
import { takeSeat } from '../demo/store';

import type { zServiceType } from '../types/service';

export type SubscriptionResult =
  | {
      ok: true;
      redirect_url: string;
      reference: string;
      /**
       * The plan that was just created, and the customer it belongs to.
       *
       * Handed back rather than left for the client to go looking for, because
       * the client cannot: `GET /customer-plans` answers newest-first for the
       * whole organization, so a shopper's "my subscription" is only their own
       * while nobody else has subscribed since. The id is the one unambiguous
       * handle on what this person just bought, and the account page is built
       * on it.
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
  /** where Honeystick should report the payment clearing - see checkout */
  notifyUrl?: string | null;
  /**
   * Where the provider sends the shopper afterwards.
   *
   * Passed in rather than derived here because the two clients want different
   * answers: the web store wants its own /account page, and a native app wants
   * a page that tells it to close the browser. Both are the caller's business.
   */
  returnUrl: string;
  cancelUrl: string;
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
      rule_type_config: {
        usage_limit: meter.limit,
        interval: meter.interval,
      },
    });
  }

  return { featureIds, rules };
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
   * that needs an organization.
   */
  if (!isConfigured()) {
    /**
     * Taking the seat before handing back a redirect.
     *
     * Plain demo inventory, not Honeystick usage - the seat count is a fixture
     * this store keeps so the shop floor has something that can run out, and
     * the reset endpoint is what puts it back.
     *
     * There is no live equivalent below on purpose. With real keys a
     * subscription's capacity is the organization's business, and inventing a
     * write against someone's billing record to make a sample look tidy is not
     * something a sample should do.
     */
    if (!takeSeat(service.ext_id)) {
      return { ok: false, error: 'That subscription is fully booked.' };
    }

    const params = new URLSearchParams({
      order: reference,
      total: service.price.toFixed(2),
      plan: service.title,
      frequency: service.frequency,
      demo: '1',
    });
    return {
      ok: true,
      reference,
      plan_id: null,
      customer_id: null,
      redirect_url: `/complete?${params.toString()}`,
    };
  }

  try {
    // notifyUrl is the third of the family and the only one that reports a
    // payment actually clearing - see the README at the repo root
    const hs = honeystick({ notifyUrl: input.notifyUrl ?? undefined });
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
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
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
