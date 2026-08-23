/**
 * Who is listening, and how they are told.
 *
 * One process, one in-memory set. A long-lived Node process can hold a
 * subscriber list, which is what makes this the easy case: this server is
 * always the same server, so the stream and the notification that matters are
 * never in different places.
 *
 * The Next store now has its own copy of this (`lib/events/bus.ts`) and the
 * same code is a harder proposition there, which is worth knowing if you read
 * the two side by side. It deploys to Cloudflare Workers, where an SSE stream
 * would be open on one isolate while the notification arrived on another and
 * the fan-out would silently reach nobody - correct under `next dev` and on a
 * Node host, and in need of a Durable Object anywhere else. Nothing about that
 * applies here.
 *
 * Nothing here asks Honeystick anything, and nothing runs on a timer. Events are
 * published from the write path: this server performs every mutation the app
 * makes, so it already knows when something changed and does not have to go
 * looking. A quiet server makes zero API calls, and adding a hundred more
 * clients adds none - which is the property that matters once callers are rate
 * limited.
 */

export type StoreEvent =
  /** the stream is open - carries nothing, and costs nothing to produce */
  | { type: 'ready' }
  /**
   * Something was written through /billing. The path is enough for a client to
   * decide whether it cares; the payload is deliberately not the changed record,
   * because clients re-read through the SDK rather than trusting a pushed copy.
   */
  | { type: 'billing.changed'; method: string; path: string; planId: number | null }
  | { type: 'order.placed'; orderId: string }
  | { type: 'subscription.started'; reference: string }
  /**
   * A payment actually cleared, reported by Honeystick rather than inferred.
   *
   * The only event here this server does not cause itself - it arrives because
   * the SDK's `notifyUrl` travelled all the way to PayFast and back. Also the
   * only one that can be trusted to mean a payment succeeded.
   */
  | {
      type: 'payment.settled';
      planId: number | null;
      reference: string | null;
      status: string | null;
    }
  | { type: 'demo.reset' };

type Subscriber = (event: StoreEvent) => void;

const subscribers = new Set<Subscriber>();

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

export { announceBillingWrites } from './billing-writes';
