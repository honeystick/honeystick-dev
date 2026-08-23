import type { Request, Response } from 'express';

import { honeystick, isConfigured } from '../honeystick';

import { publish } from './bus';

/**
 * Where Honeystick tells us a payment settled.
 *
 * The far end of the round trip the SDK sets up: `notifyUrl` on the client
 * travels into the checkout as `notify_url`, Honeystick stamps it into PayFast's
 * `custom_str5`, PayFast hands it back untouched on the ITN, and Honeystick posts
 * here. Nothing is stored against the payment and nothing polls.
 *
 * What this event means is worth being precise about, because it is the only one
 * in the system that means it: a customer returning from the payment page is not
 * evidence of anything - they may have closed the tab, and the return url fires
 * either way. This is the first moment a payment is known to have cleared.
 */

export type NotifyPayload = {
  /** the org_customer_plan_id, which is PayFast's m_payment_id */
  plan_id?: number | string;
  ext_id?: string;
  status?: string;
  event?: string;
};

/**
 * The post is a nudge, not a fact.
 *
 * There is no signature, and that is a decision rather than an omission. The
 * obvious key to sign with is the organization's own secret - both ends already
 * hold it - but the ITN handler that would do the signing has no access to it,
 * and anything else means a second credential for the caller to configure. The
 * secret key is meant to be the only thing anyone sets.
 *
 * So this does not trust the body. It takes the plan id as a hint, re-reads that
 * plan through the SDK - authenticated, with our own key - and announces only
 * what the read says. A forged post can therefore cause a wasted lookup and
 * nothing else: it cannot invent a settled payment, because the announcement is
 * built from Honeystick's answer rather than from the caller's claim.
 *
 * It is also the same rule the rest of the system already follows. Events are
 * nudges and the SDK does the reading, which is why there is no second code path
 * where a pushed payload could disagree with a fetched one.
 */

/**
 * What is being looked up, and what was looked up recently.
 *
 * The endpoint is unauthenticated and its address is not secret, so without
 * this a loop of posts becomes a loop of API calls. Two structures rather than
 * one, because a window alone does not actually bound anything:
 *
 * `inFlight` is the half that matters, and the half a timestamp cannot do. The
 * read takes seconds against a real API - measured at four to six - and this
 * route answers 202 before it starts, so retries arrive *during* the read. A
 * check that only asks "when did one last start" lets every one of them start
 * another. That is precisely the case the limiter exists for, and it was the
 * case it missed.
 *
 * `lastLookup` is stamped on completion, so the window is time since the last
 * answer rather than time since the last attempt. Fifteen seconds because it
 * has to comfortably exceed the read it is protecting; a window shorter than
 * the work it guards is decoration.
 */
const lastLookup = new Map<number, number>();
const inFlight = new Set<number>();
const LOOKUP_WINDOW_MS = 15_000;

/**
 * The statuses that mean the money actually arrived.
 *
 * One value, and it is worth writing down where it comes from rather than
 * guessing: PayFast's ITN carries `payment_status`, and Honeystick maps it
 * through `PAYFAST_TO_SUBSCRIPTION_STATUS` / `PAYFAST_TO_ONE_TIME_PAYMENT_STATUS`
 * in `types/constants.ts`. `COMPLETE` is the only entry that resolves to
 * `active`; everything else lands on `payment-pending`, `payment-required` or
 * `disabled`.
 *
 * This used to also list 'complete' and 'completed', which are not in
 * SUBSCRIPTION_STATUS or ONE_TIME_PAYMENT_STATUS and could never have matched.
 * Harmless, but they made this look like it had been checked against the
 * contract when it had not - so the provenance is written down now.
 *
 * `payment-pending` is deliberately absent. PayFast sends PENDING for a
 * subscription whose first collection has not cleared, and announcing that as a
 * settled payment is the exact mistake this whole round trip exists to avoid.
 */
const SETTLED = new Set(['active']);

export async function handleNotify(req: Request, res: Response): Promise<void> {
  const payload = (req.body ?? {}) as NotifyPayload;
  const planId = Number(payload.plan_id);

  /**
   * Answered before the read, not after.
   *
   * A notification sender treats a timeout as a failure and retries, so the
   * shape has to be: acknowledge, then work. `202` says received rather than
   * acted upon, which is exactly what is true at this point.
   */
  res.status(202).json({ ok: true });

  if (!Number.isFinite(planId) || planId <= 0) {
    console.warn({ HONEYSTICK_NOTIFY_IGNORED: 'no usable plan_id' });
    return;
  }

  if (inFlight.has(planId)) return;
  if (Date.now() - (lastLookup.get(planId) ?? 0) < LOOKUP_WINDOW_MS) return;

  // Nothing to verify against without a key, and nothing worth announcing
  // either - a store running on sample data has no live plan to settle.
  if (!isConfigured()) return;

  inFlight.add(planId);
  try {
    const plan = (await honeystick().customerPlans.get(planId)) as {
      id?: number;
      ext_id?: string;
      latest_status?: string;
    } | null;

    const status = plan?.latest_status ?? null;

    // The read is the authority. A notification for a plan that is not settled
    // is not an error - it is a race, or a stale retry, or someone poking the
    // endpoint - and in every one of those cases the right move is to say
    // nothing rather than to announce a payment that has not happened.
    if (!status || !SETTLED.has(status)) {
      console.warn({
        HONEYSTICK_NOTIFY_UNCONFIRMED: { planId, status },
      });
      return;
    }

    publish({
      type: 'payment.settled',
      planId,
      reference: plan?.ext_id ?? payload.ext_id ?? null,
      status,
    });
  } catch (error) {
    console.error({ HONEYSTICK_NOTIFY_LOOKUP_ERROR: String(error) });
  } finally {
    // stamped on the way out, and cleared whatever happened - a read that threw
    // still cost an API call, and leaving the plan marked in-flight would wedge
    // it out of every future notification
    lastLookup.set(planId, Date.now());
    inFlight.delete(planId);
  }
}
