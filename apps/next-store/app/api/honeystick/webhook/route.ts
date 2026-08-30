import { honeystickWebhook } from '@honeystick/next';

import { publish } from '@/lib/events/bus';

/**
 * Every event this store subscribed to, arriving from Honeystick.
 *
 * The counterpart to `../notify`, and the two are worth telling apart because
 * they look similar and are not:
 *
 *   - `/notify` is the per-checkout nudge. It carries one thing - a payment
 *     settled - it is unsigned, it is not retried, and it exists because the
 *     address travelled out with the payment in PayFast's `custom_str5`.
 *   - **this** is a registered webhook endpoint. It carries any of the sixteen
 *     events the store subscribed to in Settings → Integrations → Webhooks, it
 *     is HMAC-signed, and Honeystick retries it four times with backoff.
 *
 * So this is the one that can tell the store a usage limit was hit, a card
 * update was asked for, or a subscription was cancelled from the dashboard -
 * none of which a payment notification could ever have carried.
 *
 * The body is trusted here, unlike in `/notify`. That is not inconsistency: a
 * verified signature means the bytes came from Honeystick and were not altered,
 * which is exactly the guarantee the nudge lacks and the reason it has to
 * re-read the plan before believing anything.
 */

/**
 * Node, and never prerendered - the same reasons as the notify route. The bus
 * is an in-process Set, so this has to run where the stream is, and there is
 * nothing to execute at build time.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const secret = process.env.HONEYSTICK_WEBHOOK_SECRET;

/**
 * Unset is a supported state, exactly as an unset secret key is.
 *
 * A fresh clone has no organization and no endpoint registered, so there is
 * nothing to verify against - and mounting a route that accepts unverified
 * posts because it has no secret would be worse than not mounting one. 503
 * says "not configured here" rather than pretending to be a real endpoint that
 * is merely rejecting you.
 */
const unconfigured = async () =>
  Response.json(
    {
      ok: false,
      error:
        'This store has no HONEYSTICK_WEBHOOK_SECRET set, so it cannot verify a delivery. Register an endpoint in Settings → Integrations → Webhooks and set its signing secret.',
    },
    { status: 503 },
  );

const live = secret
  ? honeystickWebhook({
      secret,
      on: (event) => {
        /**
         * Straight onto the bus, with no interpretation.
         *
         * The temptation is to branch here and turn each event into something
         * store-shaped, and it is worth resisting: this route's job is to prove
         * the delivery is genuine and hand it on. A client that wants to react
         * to `usage.limit_reached` can - it has the name and the data - and one
         * that does not can ignore it, without this file having an opinion
         * about which events matter.
         *
         * Publishing is synchronous and in-process, so the handler returns
         * immediately and Honeystick's ten-second delivery timeout is never in
         * play. Anything slower than that would belong on a queue instead.
         */
        publish({
          type: 'honeystick',
          event: event.event,
          deliveryId: event.id,
          at: event.created_at,
          environment: event.environment,
          data: event.data,
        });

        console.log({
          HONEYSTICK_WEBHOOK: {
            event: event.event,
            delivery: event.id,
            org: event.org_id,
          },
        });
      },
    })
  : null;

export const POST = live ? live.POST : unconfigured;
