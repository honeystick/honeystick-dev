import { honeystick } from '@honeystick/next';

import { subscribe, type StoreEvent } from '@/lib/events/bus';

/**
 * The event stream.
 *
 * Server-sent events rather than a websocket, because the traffic only ever
 * goes one way: the browser already has a perfectly good way to talk to this
 * server, and everything it would say is a normal request. SSE is also plain
 * HTTP, so it survives the same proxies and needs no second protocol - and on
 * the web it needs no library at all, because `EventSource` is built in.
 *
 * A `ReadableStream` rather than Express's `res.write`, which is the whole
 * difference between this file and the Express app's `/events`. A Next route
 * handler returns a Response, so the stream is the body and cancellation
 * arrives as `request.signal` rather than as a `close` event on a socket.
 *
 * ## Why this watches as well as listens
 *
 * The Express app can rely on its subscriber set alone, because it is one
 * process: the notification and the open stream are always in the same place.
 * This app is not. On Vercel and on Cloudflare Workers a request is served by
 * whichever instance is free, so `POST /api/honeystick/notify` and this stream
 * routinely land in different ones - and an in-memory fan-out then reaches
 * nobody, with no error, because the stream stays open and silent.
 *
 * Rather than requiring a shared hub (a Durable Object on Workers, Redis on
 * Vercel) this asks Honeystick directly, for the one plan the client says it is
 * waiting on. Two things follow from that and both are worth having:
 *
 *  - **it works the same everywhere** - dev, `next start`, Vercel, Workers -
 *    so the deployment target stops being a correctness question
 *  - **it cannot miss the event.** A push-only stream that reconnects has a
 *    hole: anything that happened while it was disconnected is gone, because
 *    nothing holds a backlog. This reads the plan on connect, so a payment that
 *    settled during the gap is reported immediately rather than never.
 *
 * The subscriber set is kept as a free fast path. Where the notification does
 * land on this instance the client hears in milliseconds instead of at the next
 * poll, and where it does not, nothing is lost.
 *
 * ## What it costs
 *
 * One `GET /customer-plans/:id` every few seconds, per client, and only while
 * that client has the account page open on a plan that has not settled yet. It
 * stops the moment the plan settles. That is a real cost and a deliberate
 * reversal of the note on the `ready` frame below, which argues against reading
 * state per connection - the difference is that this is one plan the caller has
 * explicitly asked to be told about, not the whole catalogue on every screen.
 *
 * Without `planId` none of this happens and the stream is subscriber-only,
 * which is the right behaviour for any consumer that is not waiting on a
 * specific payment.
 */

/**
 * Node, not edge, and never prerendered.
 *
 * `force-dynamic` because a stream is not something to attempt at build time -
 * without it the build hangs trying to collect a response that by design never
 * ends.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Just under Vercel's Hobby ceiling, which is also its maximum.
 *
 * Streamed responses count against it, so the platform will terminate this
 * connection whatever we ask for. Saying so explicitly is what lets the stream
 * end itself tidily before that happens - see STREAM_TTL_MS.
 */
export const maxDuration = 300;

/** how often to prove the connection is alive - see the comment on the timer */
const HEARTBEAT_MS = 25_000;

/** how often to ask Honeystick whether the plan has settled yet */
const POLL_MS = 3000;

/**
 * When to hang up, deliberately short of the platform's own limit.
 *
 * Vercel kills a function at 300s and the client sees a truncated response;
 * ending at four minutes makes it a clean close instead, which `EventSource`
 * treats as a normal disconnect and reconnects from. The reconnect re-reads the
 * plan on the way in, so nothing is missed across the seam.
 *
 * Cloudflare Workers have no equivalent wall-clock limit, so there the only
 * effect is a reconnect every four minutes, which costs one read.
 */
const STREAM_TTL_MS = 240_000;

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

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const planId = new URL(request.url).searchParams.get('planId');
  const watching = planId && /^\d+$/.test(planId) ? Number(planId) : null;

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let expiry: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      /** so the fast path and the poll cannot both announce the same payment */
      let announced = false;

      /**
       * Every write goes through here, and every write can lose the race.
       *
       * The client can disconnect between the check and the enqueue, and
       * enqueueing on a closed controller throws. Left unguarded that throw
       * escapes a `setInterval` callback or a bus publish - killing the
       * heartbeat for this stream in the first case, and in the second reaching
       * `publish`'s catch, where it would be logged as though the *event* had
       * failed rather than one dead listener.
       */
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: StoreEvent) => {
        if (event.type === 'payment.settled') {
          // A stream watching one plan must not report another's. The bus is
          // org-wide, so without this every open account page announces every
          // shopper's payment as though it were their own.
          if (watching !== null && event.planId !== watching) return;
          if (announced) return;
          announced = true;
          stopPolling();
        }
        // the blank line is the frame terminator - without it the client sees
        // one event that never ends
        write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      const stopPolling = () => {
        if (poll) clearInterval(poll);
        poll = null;
      };

      const teardown = () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (expiry) clearTimeout(expiry);
        stopPolling();
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed by the runtime tearing the request down
        }
      };

      unsubscribe = subscribe(send);

      /**
       * Confirms the stream is open, and carries nothing.
       *
       * It only says "you are listening now". What the client should believe
       * about the plan comes from the SDK read it does on mount, and - when it
       * named a planId - from the check below.
       */
      send({ type: 'ready' });

      /**
       * A comment every 25 seconds.
       *
       * Lines starting with ':' are ignored by every SSE client, which makes
       * them the standard way to keep a connection from being reaped. Proxies
       * drop idle sockets at around 30-60s, and a billing demo can easily be
       * quiet for minutes - so without this the stream dies silently and the
       * page looks live while receiving nothing.
       */
      heartbeat = setInterval(() => write(': keep-alive\n\n'), HEARTBEAT_MS);

      expiry = setTimeout(teardown, STREAM_TTL_MS);

      if (request.signal.aborted) teardown();
      else request.signal.addEventListener('abort', teardown, { once: true });

      if (watching === null) return;

      /**
       * Ask Honeystick whether this plan has settled, and say so if it has.
       *
       * The answer is built from the read, never from anything a caller sent -
       * the same rule the notify route follows, for the same reason: the read
       * is the only authority on whether money moved.
       *
       * A failure is swallowed rather than reported. The API being briefly
       * unreachable is not news the shopper can act on, and pushing an error
       * frame would make a transient blip look like a failed payment.
       */
      const check = async () => {
        if (closed || announced) return;
        try {
          const plan = (await honeystick().customerPlans.get(watching)) as {
            ext_id?: string;
            latest_status?: string;
          } | null;

          const status = plan?.latest_status ?? null;
          if (!status || !SETTLED.has(status)) return;

          send({
            type: 'payment.settled',
            planId: watching,
            reference: plan?.ext_id ?? null,
            status,
          });
        } catch (error) {
          console.error({ EVENTS_POLL_ERROR: String(error) });
        }
      };

      // Immediately, then on an interval. The immediate read is what closes the
      // gap a reconnect would otherwise leave: a payment that settled while the
      // client was between connections is reported on the way back in.
      void check();
      poll = setInterval(() => void check(), POLL_MS);
    },

    /**
     * Also cleans up, and is not redundant with the abort handler.
     *
     * `cancel` fires when the *consumer* lets go of the stream, which is not
     * always accompanied by the request signal aborting. Both paths have to
     * release the subscription and stop the timers, or a closed tab leaves a
     * closure in the set and an interval calling Honeystick forever.
     */
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (poll) clearInterval(poll);
      if (expiry) clearTimeout(expiry);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // `no-transform` matters as much as `no-cache`: a proxy that compresses
      // the body will buffer it to do so, which turns a live feed into a burst
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // says the same thing again to nginx specifically, which is the proxy
      // most likely to sit in front of this and the one that ignores the others
      'X-Accel-Buffering': 'no',
    },
  });
}
