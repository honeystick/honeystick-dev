import { honeystick } from '@honeystick/next';

import { publish } from '@/lib/events/bus';

/**
 * Where Honeystick tells the store a payment settled.
 *
 * The far end of the round trip the SDK sets up: `notifyUrl` on the client
 * travels into the checkout as `notify_url`, Honeystick stamps it into PayFast's
 * `custom_str5`, PayFast hands it back untouched on the ITN, and Honeystick
 * posts here. Nothing is stored against the payment and nothing polls.
 *
 * Deliberately outside `/api/billing`. That route is the proxy *to* Honeystick
 * and everything under it is forwarded there with the key attached; this is
 * traffic coming the other way, and forwarding it would send Honeystick's own
 * notification back to Honeystick.
 *
 * What this event means is worth being precise about, because it is the only one
 * in the system that means it: a customer returning from the payment page is not
 * evidence of anything - they may have closed the tab, and the return url fires
 * either way. This is the first moment a payment is known to have cleared.
 *
 * **On a serverless host this often publishes to nobody, and that is fine.**
 * The subscriber set is per instance, so an open stream is usually somewhere
 * else - which is why `/api/events` watches the plan itself rather than relying
 * on this. Keeping the route is still right: on a Node deployment it is the
 * instant path, it is the address Honeystick was given and will keep calling,
 * and it is where anything that must happen exactly once per settled payment -
 * a receipt, a fulfilment write - belongs. A poll inside a stream is the wrong
 * place for side effects, because there is one per viewer and none when nobody
 * is looking.
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
 * There is no signature, and that is a decision rather than an omission - see
 * the README at the repo root. So this does not trust the body. It takes the
 * plan id as a hint, re-reads that plan through the SDK with the store's own
 * key, and announces only what the read says.
 *
 * A forged post can therefore cause a wasted lookup and nothing else: it cannot
 * invent a settled payment, because the announcement is built from Honeystick's
 * answer rather than from the caller's claim.
 */

/**
 * What is being looked up, and what was looked up recently.
 *
 * The endpoint is unauthenticated and its address is not secret, so without
 * this a loop of posts becomes a loop of API calls. Two structures rather than
 * one, because a window alone does not actually bound anything:
 *
 * `inFlight` is the half that matters and the half a timestamp cannot do. The
 * read takes seconds against a real API - measured at four to six here - so a
 * check that only asks "when did one last *start*" lets every retry that
 * arrives during a read start another one. That is the exact case the limiter
 * exists for, and it was the case it missed.
 *
 * `lastLookup` is stamped on *completion*, so the window is time since the last
 * answer rather than time since the last attempt. Fifteen seconds because it
 * has to comfortably exceed the read it is protecting; a window shorter than
 * the work it guards is decoration.
 *
 * Both on `globalThis`, for the same reason the subscriber set is: a
 * module-level Map is not guaranteed to survive a dev-server hot reload, and a
 * rate limiter that quietly resets is not one.
 */
const globalForNotify = globalThis as unknown as {
  __depotNotifyLookups?: Map<number, number>;
  __depotNotifyInFlight?: Set<number>;
};
const lastLookup = (globalForNotify.__depotNotifyLookups ??= new Map<
  number,
  number
>());
const inFlight = (globalForNotify.__depotNotifyInFlight ??= new Set<number>());
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

/**
 * Node rather than edge, and dynamic rather than prerendered.
 *
 * The bus this publishes to is an in-process Set, so this handler has to run in
 * the same process as the stream that reads it. Prerendering would additionally
 * try to execute it at build time, where there is no organization to ask.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => ({}))) as NotifyPayload;
  const planId = Number(payload.plan_id);

  if (!Number.isFinite(planId) || planId <= 0) {
    console.warn({ HONEYSTICK_NOTIFY_IGNORED: 'no usable plan_id' });
    return Response.json({ ok: true }, { status: 202 });
  }

  if (inFlight.has(planId)) {
    return Response.json({ ok: true }, { status: 202 });
  }
  if (Date.now() - (lastLookup.get(planId) ?? 0) < LOOKUP_WINDOW_MS) {
    return Response.json({ ok: true }, { status: 202 });
  }

  // Nothing to verify against without a key, and nothing worth announcing
  // either - a store running on sample data has no live plan to settle.
  if (!process.env.HONEYSTICK_SECRET_KEY) {
    return Response.json({ ok: true }, { status: 202 });
  }

  /**
   * The read happens before the response, unlike the Express version.
   *
   * There, `res.status(202).json()` can be sent and the work continued, because
   * the process outlives the response. A serverless invocation does not: work
   * started after the response has been returned is work that may simply not
   * run, and the failure mode is a payment that silently never announces.
   *
   * The cost is that a sender waiting on this waits for one API call. Honeystick
   * retries on timeout, and a retry inside the window above is dropped before
   * the read, so the retry is cheap even when the wait was too long.
   */
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
      console.warn({ HONEYSTICK_NOTIFY_UNCONFIRMED: { planId, status } });
      return Response.json({ ok: true }, { status: 202 });
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

  return Response.json({ ok: true }, { status: 202 });
}
