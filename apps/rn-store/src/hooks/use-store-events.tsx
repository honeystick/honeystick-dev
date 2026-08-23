import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { FastEventSource, ReadyState } from 'react-native-fast-sse';

import { API_URL } from '../config';

/**
 * Keeps the app's copy of Honeystick honest, without polling from the phone.
 *
 * The Express server is told a payment settled - Honeystick posts to
 * `/honeystick/notify`, which re-reads the plan and publishes - and pushes the
 * result down `/events`. This listens and invalidates. What arrives is only ever
 * a nudge: the frame says something changed, and react-query goes and re-reads
 * it through the SDK. That is deliberate, so the SDK stays the single way data
 * is fetched and there is no second code path where a pushed payload could
 * disagree with a fetched one.
 *
 * ## Why react-native-fast-sse
 *
 * There is no `EventSource` on React Native, and the global `fetch` is backed by
 * XMLHttpRequest, so `response.body` is null - which rules out both of the ways
 * a browser would read a stream. On bare React Native there is not even an
 * `expo/fetch` to fall back on, so a library is not a preference here the way it
 * arguably is in the Expo store - it is the only option. This one is a native
 * client (OkHttp on Android, NSURLSession on iOS) piped over JSI, so frames
 * arrive unbuffered.
 *
 * Three things about the library shape the code below, and each one is a bug if
 * you assume otherwise:
 *
 *  1. **Every frame goes to the single `message` listener.** It does not
 *     dispatch by event name the way `EventSource` does - the name arrives as
 *     `event` on the payload. That is lucky rather than obvious: the server
 *     sends named frames, and a browser client has to register a listener per
 *     name or receive nothing.
 *  2. **It never reconnects.** Deliberate on its part - it is built for LLM
 *     streams, where silently resuming loses server context. A dropped socket
 *     is the ordinary case on mobile (wifi to cellular is a drop), so the
 *     backoff below is the normal path, not an error handler.
 *  3. **`close()` also removes every listener.** So a reconnect cannot reuse the
 *     instance; each attempt builds a new one.
 *
 * And one gap worth naming: a *clean* server-side close notifies nothing. The
 * library has `open`, `message` and `error` listeners and no `close`, so a
 * stream the server ended tidily just stops. `readyState` is the only way to
 * see it, which is what the watchdog below is for.
 */

export type EventsStatus = 'connecting' | 'live' | 'offline';

/**
 * The last thing the server said, for a screen that wants to show it.
 *
 * Kept separate from the invalidation on purpose. Every frame nudges the cache
 * whether or not anything renders it, so a screen that wants to announce a
 * settled payment can, and one that does not is unaffected. `at` is here because
 * two identical events in a row are still two events - without it the second one
 * would not change the object and nothing would re-render.
 */
export type LastEvent = { name: string; data: unknown; at: number };

export type StoreEventsValue = {
  status: EventsStatus;
  lastEvent: LastEvent | null;
};

/**
 * One stream for the whole app, shared through context.
 *
 * Not a hook each screen calls on its own, and the reason is a socket. The
 * stream's only job is to invalidate the shared react-query cache, so a second
 * subscriber opens a second connection to do work the first has already done -
 * and on a stack navigator that is the normal case rather than an edge one: the
 * shop floor stays mounted underneath the account screen, so both would be
 * listening at once.
 *
 * It is also what replaced this app's `ForegroundRefresh`. That existed to
 * re-read on foreground, which the provider's own AppState listener now does -
 * app-wide, and alongside a reconnect the standalone version could not do.
 *
 * It is also what replaced this app's `ForegroundRefresh`. That existed to
 * re-read on foreground, which the provider's own AppState listener now does -
 * app-wide, and alongside a reconnect the standalone version could not do.
 *
 * The default value is what a screen sees if the provider is missing. Reported
 * as offline rather than thrown on, because a missing provider should degrade
 * to "you will not hear about payments" and not take the store down.
 */
const StoreEventsContext = createContext<StoreEventsValue>({
  status: 'offline',
  lastEvent: null,
});

/** grows to a ceiling, so a server that is down is not hammered */
const BACKOFF_MS = [1000, 2000, 5000, 10_000, 20_000];

/** how often to ask whether the stream quietly died - see the note above */
const WATCHDOG_MS = 5000;

/** what a screen reads. The connection itself lives in the provider below. */
export const useStoreEvents = (): StoreEventsValue =>
  useContext(StoreEventsContext);

export function StoreEventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EventsStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);

  /**
   * Bumped to force the connect effect to run again.
   *
   * A ref would not do - the effect has to re-run, and only state does that.
   */
  const [attempt, setAttempt] = useState(0);
  const failures = useRef(0);

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const source = new FastEventSource(`${API_URL}/events`, {
      headers: { accept: 'text/event-stream' },
      /**
       * No read timeout, deliberately.
       *
       * This would terminate a connection that has gone quiet, and quiet is the
       * normal state of a billing stream - minutes can pass between events. The
       * server's own keep-alive comment every 25 seconds is what proves the
       * socket is alive, and the watchdog below is what notices when it stops.
       */
      readTimeoutMs: 0,
    });

    /** every attempt gets a fresh instance, because close() strips listeners */
    const giveUp = () => {
      if (cancelled) return;
      setStatus('offline');

      const wait =
        BACKOFF_MS[Math.min(failures.current, BACKOFF_MS.length - 1)] ?? 20_000;
      failures.current += 1;
      retry = setTimeout(() => {
        if (!cancelled) reconnect();
      }, wait);
    };

    source.addEventListener('open', () => {
      if (cancelled) return;
      failures.current = 0;
      setStatus('connecting');
    });

    source.addEventListener('message', (event) => {
      if (cancelled) return;

      // the handshake proves the stream is open, which is the only moment
      // "live" can honestly be claimed - `open` fires on response headers, and
      // a proxy can produce those for a stream that never delivers a byte
      if (event.event === 'ready') {
        failures.current = 0;
        setStatus('live');
        return;
      }

      /**
       * Anything that is not the handshake means something was written.
       *
       * Matching on the frame's name rather than listing the ones we know
       * about, so a new event added on the server nudges existing clients
       * instead of being silently ignored by them. The invalidation is the same
       * either way - the frame is a nudge, and the SDK does the read.
       */
      setStatus('live');
      void queryClient.invalidateQueries({ queryKey: ['honeystick'] });

      let data: unknown = event.data;
      try {
        data = JSON.parse(event.data);
      } catch {
        // a stream that sends something other than JSON is still readable
      }
      setLastEvent({ name: event.event ?? 'message', data, at: Date.now() });
    });

    source.addEventListener('error', () => giveUp());

    source.connect();

    /**
     * The watchdog, for the close nobody is told about.
     *
     * A server that ends the stream cleanly - a deploy, a restart, an idle
     * timeout at a proxy - fires no listener at all, so without this the app
     * sits on a dead socket showing "live" forever. `readyState` is the only
     * public signal that it happened.
     */
    const watchdog = setInterval(() => {
      if (cancelled) return;
      if (source.readyState === ReadyState.CLOSED) giveUp();
    }, WATCHDOG_MS);

    return () => {
      cancelled = true;
      clearInterval(watchdog);
      if (retry) clearTimeout(retry);
      source.close();
    };
  }, [queryClient, attempt, reconnect]);

  /**
   * Foreground: reconnect and re-read.
   *
   * Both halves matter. iOS suspends the process on background, which kills the
   * socket without any event a JS listener can see, so reconnecting is
   * necessary - and reconnecting alone leaves the app showing whatever it had
   * before it was suspended, because the events it missed are gone and the
   * server holds no backlog. Re-reading is what closes that gap.
   */
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active') return;
      void queryClient.invalidateQueries({ queryKey: ['honeystick'] });
      failures.current = 0;
      reconnect();
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [queryClient, reconnect]);

  const value = useMemo<StoreEventsValue>(
    () => ({ status, lastEvent }),
    [status, lastEvent],
  );

  return (
    <StoreEventsContext.Provider value={value}>
      {children}
    </StoreEventsContext.Provider>
  );
}
