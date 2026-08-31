import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { API_URL } from '../config';

/**
 * Keeps the page's copy of Honeystick honest, without polling from the browser.
 *
 * Honeystick posts to the Express server's `/honeystick/notify` when a payment
 * settles; that route re-reads the plan with its own key and publishes on
 * `/events`. This listens and invalidates. What arrives is only ever a nudge -
 * the frame says something changed and react-query re-reads it through the SDK,
 * so there is no second code path where a pushed payload could disagree with a
 * fetched one.
 *
 * `EventSource` and nothing else, because on the web there is nothing to add: it
 * handles the framing, the named events and reconnection with backoff by itself.
 * The native stores need `react-native-fast-sse` for exactly the reasons this
 * file needs no dependency at all.
 *
 * No plan-scoped polling here, unlike the Next store's version. That exists
 * because Vercel and Workers put the notification and the stream in different
 * instances; the Express server is one long-lived process, so the push always
 * reaches the subscriber and the fallback would be redundant.
 */
export type EventsStatus = 'connecting' | 'live' | 'offline';

export type LastEvent = { name: string; data: unknown; at: number };

export function useStoreEvents(): {
  status: EventsStatus;
  lastEvent: LastEvent | null;
} {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EventsStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);

  useEffect(() => {
    // cross-origin: the API is on another port, and the SDK client sends
    // cookies, so the server answers with credentials enabled
    const source = new EventSource(`${API_URL}/events`, {
      withCredentials: true,
    });

    /**
     * The handshake is the only moment "live" can honestly be claimed. `onopen`
     * fires when response headers arrive, which a proxy can produce for a
     * stream that never delivers a byte.
     */
    source.addEventListener('ready', () => setStatus('live'));

    /**
     * Every other frame means something was written.
     *
     * `EventSource` dispatches by name, so each one has to be registered -
     * a listener on 'message' would never see any of them, which is the single
     * most common way an SSE integration looks connected and receives nothing.
     */
    for (const name of [
      'payment.settled',
      'billing.changed',
      'order.placed',
      'subscription.started',
      'demo.reset',
      /**
       * Every registered webhook Honeystick delivers, on one frame name.
       *
       * The server sends all sixteen events under `honeystick` rather than
       * under their own names, and that is what keeps this list from needing a
       * new entry each time Honeystick adds an event - which matters here more
       * than anywhere else in this repo, because a missing entry is not an
       * error. `EventSource` dispatches by name, so an unregistered frame is
       * received, matched against nothing, and dropped in silence.
       */
      'honeystick',
    ]) {
      source.addEventListener(name, (event) => {
        setStatus('live');
        void queryClient.invalidateQueries({
          queryKey: ['honeystick'],
          // 'all', not the default 'active': a page behind a sheet or a
          // backgrounded tab is exactly the reader a pushed frame exists
          // for, and the default marks it stale and leaves it showing the
          // old figure until it remounts.
          refetchType: 'all',
        });
        let data: unknown = null;
        try {
          data = JSON.parse((event as MessageEvent).data);
        } catch {
          data = (event as MessageEvent).data;
        }
        setLastEvent({ name, data, at: Date.now() });
      });
    }

    /**
     * No reconnection logic, on purpose. `EventSource` reconnects by itself
     * with its own backoff, and an error is how it reports being between
     * attempts - closing the source to "handle" it turns a self-healing
     * connection into a permanently dead one.
     */
    source.onerror = () => setStatus('offline');

    return () => source.close();
  }, [queryClient]);

  return { status, lastEvent };
}
