'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Keeps the page's copy of Honeystick honest, without polling from the browser.
 *
 * The server is told a payment settled and pushes; this listens and
 * invalidates. What arrives is only ever a nudge - the frame says something
 * changed, and react-query goes and re-reads it through the SDK. That is
 * deliberate: the SDK stays the single way data is fetched, so there is no
 * second code path where a pushed payload could disagree with a fetched one.
 *
 * "Without polling from the browser" is the load-bearing half. The server does
 * watch the plan on this client's behalf where it has to - see the route - but
 * that is one connection doing it, not a `setInterval` in every open tab, and
 * it stops the moment the payment lands.
 *
 * `EventSource` rather than a library, because on the web there is nothing to
 * add. It handles the framing, the named events and - unlike every native
 * option - reconnection with backoff on its own. The native stores need
 * `react-native-fast-sse` for exactly the reasons this file does not need
 * anything: there is no `EventSource` on React Native, and the global `fetch`
 * there cannot read a stream.
 */

export type EventsStatus = 'connecting' | 'live' | 'offline';

/**
 * The last thing the server said, for a page that wants to show it.
 *
 * Kept separate from the invalidation on purpose. Every frame nudges the cache
 * whether or not anything renders it, so a page that wants to announce a
 * settled payment can, and one that does not is unaffected. `at` is here
 * because two identical events in a row are still two events - without it the
 * second one would not change the object and nothing would re-render.
 */
export type LastEvent = { name: string; data: unknown; at: number };

export function useStoreEvents({
  /**
   * The plan this page is waiting on, if any.
   *
   * Naming it is what makes the stream work on a serverless host. The server's
   * in-memory fan-out only reaches a client that happens to share an instance
   * with the notification; given a plan id it watches that plan directly
   * instead, so the answer is the same on Vercel, on Workers and in dev.
   *
   * It is also what scopes the stream. Without it a client hears every
   * settlement on the organization, which on an account page is somebody else's
   * payment announced as yours.
   */
  planId,
}: { planId?: number | string | null } = {}): {
  status: EventsStatus;
  lastEvent: LastEvent | null;
} {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EventsStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);

  useEffect(() => {
    const url = planId
      ? `/api/events?planId=${encodeURIComponent(String(planId))}`
      : '/api/events';
    const source = new EventSource(url);

    /**
     * The handshake, and the only frame that is not a nudge.
     *
     * It is the one moment "live" can honestly be claimed: `onopen` fires when
     * the response headers arrive, which a proxy can produce for a stream that
     * never delivers a byte.
     */
    source.addEventListener('ready', () => setStatus('live'));

    /**
     * Anything that is not the handshake means something was written.
     *
     * `payment.settled` is named explicitly rather than matched generically
     * because `EventSource` dispatches by name - a listener on 'message' would
     * never see it, which is the single most common way an SSE integration
     * looks connected and receives nothing.
     */
    source.addEventListener('payment.settled', (event) => {
      void queryClient.invalidateQueries({ queryKey: ['honeystick'] });
      setStatus('live');

      let data: unknown = null;
      try {
        data = JSON.parse((event as MessageEvent).data);
      } catch {
        data = (event as MessageEvent).data;
      }
      setLastEvent({ name: 'payment.settled', data, at: Date.now() });
    });

    /**
     * No reconnection logic, on purpose.
     *
     * `EventSource` reconnects by itself with its own backoff, and an error is
     * how it reports that it is between attempts. Closing the source here to
     * "handle" the error is the classic mistake: it turns a self-healing
     * connection into a permanently dead one.
     */
    source.onerror = () => setStatus('offline');

    return () => source.close();
  }, [queryClient, planId]);

  return { status, lastEvent };
}
