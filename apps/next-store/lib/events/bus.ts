import 'server-only';

/**
 * Who is listening, and how they are told.
 *
 * The Express app's `src/events/bus.ts`, and the reasoning is the same: events
 * are published from the write path, nothing polls, and a quiet server makes no
 * API calls. What is different is where it runs, and that difference is not
 * cosmetic - read the next paragraph before relying on this in production.
 *
 * **One process, one set of subscribers.** That holds under `next dev`, under
 * `next start`, and on any Node host. It does not hold on a serverless one -
 * Vercel or Cloudflare Workers - where an SSE stream is open in one instance
 * while the notification that matters arrives in another, and the fan-out
 * reaches nobody. There is no error when that happens: the stream stays open
 * and silent, which is the worst way for it to fail.
 *
 * So this is deliberately **not** what correctness rests on. It is a fast path.
 * `/api/events` also watches the plan the client named, by asking Honeystick
 * directly, which is what makes the stream behave identically on every host and
 * what closes the gap a reconnect would otherwise leave. Where a notification
 * does land on this instance the client hears in milliseconds rather than at
 * the next poll; where it does not, nothing is lost.
 *
 * That is why there is no Durable Object here and no Redis. Both would work,
 * and both would be infrastructure bought to avoid one read of a plan the
 * caller is already waiting on.
 *
 * Held on `globalThis` rather than in a module-level `const`, because a route
 * handler and a server action are not guaranteed to share a module instance
 * across a dev-server hot reload. Without this the notify route publishes into
 * one Set while the stream reads from another, and the symptom is exactly the
 * Workers failure above - on a laptop, where it is far more confusing.
 */

import type { HoneystickWebhookEventName } from 'honeystick';

export type StoreEvent =
  /** the stream is open - carries nothing, and costs nothing to produce */
  | { type: 'ready' }
  /**
   * A payment actually cleared, reported by Honeystick rather than inferred.
   *
   * The only event this app does not cause itself. It arrives because the SDK's
   * `notifyUrl` travelled into the checkout, out to PayFast, and back - and it
   * is the only thing in the system that means a payment succeeded. A shopper
   * returning from the payment page proves only that they came back.
   */
  | {
      type: 'payment.settled';
      planId: number | null;
      reference: string | null;
      status: string | null;
    }
  /**
   * Anything Honeystick told this store about, over a registered webhook.
   *
   * One variant rather than sixteen, and that is a deliberate trade. The
   * alternative - a named variant per event - would let a client `switch` with
   * the compiler checking every branch, and would also mean that the day
   * Honeystick adds an event, this union stops compiling and the store stops
   * forwarding an event it understood perfectly well. The name travels as data
   * so a new one arrives as data too.
   *
   * `deliveryId` is the webhook's own id and is stable across retries, so a
   * client that reconnects and hears the same thing twice can drop the second.
   * That matters more here than it looks: Honeystick retries a delivery four
   * times, and the fast path and the stream can both carry the same one.
   */
  | {
      type: 'honeystick';
      event: HoneystickWebhookEventName | (string & {});
      deliveryId: string;
      /** when Honeystick raised it, not when this store heard about it */
      at: string;
      environment: 'sandbox' | 'live';
      data: Record<string, unknown>;
    }
;

type Subscriber = (event: StoreEvent) => void;

const globalForBus = globalThis as unknown as {
  __depotSubscribers?: Set<Subscriber>;
};

const subscribers = (globalForBus.__depotSubscribers ??= new Set<Subscriber>());

/**
 * Returns its own unsubscribe rather than taking an id back.
 *
 * A route that forgets to clean up leaks a closure holding an open socket, and
 * the symptom is a server that gets slower over a day of demoing. Handing back
 * the exact function to call makes the cleanup impossible to get wrong.
 */
export function subscribe(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function publish(event: StoreEvent): void {
  for (const subscriber of subscribers) {
    // one broken pipe must not stop the others being told
    try {
      subscriber(event);
    } catch (error) {
      console.error({ SSE_PUBLISH_ERROR: String(error) });
    }
  }
}

export const subscriberCount = () => subscribers.size;
