import {
  createCoreHandler,
  type CoreHandlerOptions,
  type Identity,
} from 'honeystick/backend';
import { createHoneystick, type ClientOptions, type Honeystick } from 'honeystick';

export type { Identity } from 'honeystick/backend';

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
  HoneystickError,
  createHoneystick,
  type ClientOptions,
  type Environment,
  type Honeystick,
} from 'honeystick';
