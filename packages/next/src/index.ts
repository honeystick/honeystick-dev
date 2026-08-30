import {
  createCoreHandler,
  type CoreHandlerOptions,
  type Identity,
} from 'honeystick/backend';
import { createHoneystick, type ClientOptions, type Honeystick } from 'honeystick';
import {
  HoneystickWebhookError,
  verifyWebhook,
  type HoneystickWebhookEvent,
} from 'honeystick/webhooks';

export type { Identity } from 'honeystick/backend';
export {
  HONEYSTICK_WEBHOOK_EVENTS,
  HoneystickWebhookError,
  isKnownWebhookEvent,
  verifyWebhook,
  type HoneystickWebhookEvent,
  type HoneystickWebhookEventName,
} from 'honeystick/webhooks';

/**
 * A Next request, described structurally rather than imported.
 *
 * Typing this against `NextRequest` would make `next` a real dependency of a
 * package that only ever reads three properties off the request. Anything
 * matching this shape works, which includes the plain `Request` the App
 * Router actually hands a route handler.
 */
type RouteRequest = {
  method: string;
  url: string;
  json: () => Promise<unknown>;
};

export type NextHandlerOptions = Omit<CoreHandlerOptions, 'identify'> & {
  /**
   * Who is calling, decided by your own auth - never trust the browser for it.
   * Receives the request, so a session cookie or an Authorization header can
   * be read straight off it.
   */
  identify?: (request: RouteRequest) => Identity | Promise<Identity>;
};

export type NextRouteHandlers = {
  GET: (request: RouteRequest) => Promise<Response>;
  POST: (request: RouteRequest) => Promise<Response>;
};

/**
 * Mounts Honeystick on one catch-all route of your Next app.
 *
 * ```ts
 * // app/api/billing/[...honeystick]/route.ts
 * import { honeystickHandler } from '@honeystick/next';
 * import { auth } from '@/lib/auth';
 *
 * export const { GET, POST } = honeystickHandler({
 *   secretKey: process.env.HONEYSTICK_SECRET_KEY,
 *   orgId: process.env.HONEYSTICK_ORG_ID,
 *   pathPrefix: '/api/billing',
 *   identify: async () => {
 *     const session = await auth();
 *     return session ? { customerId: session.user.id } : null;
 *   },
 * });
 * ```
 *
 * Everything under the mount point is forwarded to Honeystick with your secret
 * key attached. The browser calls your own origin, so the key stays on the
 * server - which in Next matters more than usual, because anything reachable
 * from a client component is bundled and shipped.
 *
 * Note the `pathPrefix`: unlike Express, a Next route handler receives the
 * full pathname with nothing stripped, so it has to match where the route
 * actually lives rather than the default '/billing'.
 */
export function honeystickHandler(
  options: NextHandlerOptions,
): NextRouteHandlers {
  const handle = createCoreHandler({
    ...options,
    identify: options.identify
      ? (raw) => options.identify!(raw as RouteRequest)
      : undefined,
  });

  const run = async (request: RouteRequest): Promise<Response> => {
    const url = new URL(request.url);

    let body: unknown = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
      // an empty body is normal for a POST that only names a path
      try {
        body = await request.json();
      } catch {
        body = null;
      }
    }

    const result = await handle({
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      raw: request,
    });

    return Response.json(result.body, { status: result.status });
  };

  return { GET: run, POST: run };
}

/**
 * The server-side client, for server components, route handlers and server
 * actions - anywhere the secret key is safe.
 *
 * ```ts
 * import { honeystick } from '@honeystick/next';
 *
 * export default async function Page() {
 *   const plans = await honeystick().plans.list();
 * }
 * ```
 *
 * Built per call rather than at module scope: a module-level client would be
 * constructed while the route is being collected at build time, where the
 * environment it needs is not necessarily set yet.
 */
export function honeystick(options: ClientOptions = {}): Honeystick {
  return createHoneystick(options);
}

export {
  API_URLS,
  DEFAULT_PATH_PREFIX,
  DEV_API_URLS,
  HoneystickError,
  apiOrigin,
  createHoneystick,
  type ClientOptions,
  type Deployment,
  type Environment,
  type Honeystick,
} from 'honeystick';

/**
 * Receiving Honeystick's webhooks, on one route of your Next app.
 *
 * The other direction to `honeystickHandler`: that forwards your browser's
 * calls *to* Honeystick, this accepts the calls Honeystick makes *to you* for
 * an endpoint you registered in the dashboard.
 *
 * ```ts
 * // app/api/honeystick/webhook/route.ts
 * import { honeystickWebhook } from '@honeystick/next';
 *
 * export const { POST } = honeystickWebhook({
 *   secret: process.env.HONEYSTICK_WEBHOOK_SECRET!,
 *   on: async (event) => {
 *     switch (event.event) {
 *       case 'usage.limit_reached':
 *         await warnTheCustomer(event.data);
 *         break;
 *     }
 *   },
 * });
 * ```
 *
 * `request.text()` is what makes this correct, and it is the whole reason this
 * wrapper exists rather than a paragraph of documentation. The signature covers
 * the bytes that were sent; `await request.json()` would hand you an object
 * whose re-serialisation is *not* guaranteed to be those bytes, and the failure
 * is a signature mismatch on a delivery that was perfectly genuine.
 *
 * ## What it answers, and why it matters
 *
 * - **200** once your handler resolves.
 * - **400** if verification fails. Honeystick treats 4xx as final and will not
 *   retry, which is right: a bad signature will still be bad in ten minutes.
 * - **500** if your handler throws - which *is* retried, with backoff, up to
 *   four times. So throwing is the correct way to say "I could not deal with
 *   this yet"; swallowing an error tells Honeystick it landed.
 *
 * Your handler is awaited before the response. Honeystick's delivery timeout is
 * ten seconds, so anything slower than that belongs on your own queue - take
 * the delivery, write it down, answer, and work afterwards.
 */
export function honeystickWebhook(options: {
  /** the endpoint's signing secret from the dashboard, `whsec_...` */
  secret: string;
  on: (event: HoneystickWebhookEvent) => void | Promise<void>;
  /** how old a delivery may be, in seconds. Default 300. */
  toleranceSeconds?: number;
}): { POST: (request: Request) => Promise<Response> } {
  const POST = async (request: Request): Promise<Response> => {
    let event: HoneystickWebhookEvent;
    try {
      event = await verifyWebhook({
        body: await request.text(),
        headers: request.headers,
        secret: options.secret,
        toleranceSeconds: options.toleranceSeconds,
      });
    } catch (error) {
      const reason =
        error instanceof HoneystickWebhookError ? error.reason : 'invalid';
      return Response.json(
        { ok: false, error: (error as Error).message, reason },
        { status: 400 },
      );
    }

    // Deliberately outside the try above. A throw from here is the caller's
    // code failing, not a forged delivery, and the two must not answer alike:
    // one should be retried and the other never should.
    await options.on(event);

    return Response.json({ ok: true, received: event.id }, { status: 200 });
  };

  return { POST };
}
