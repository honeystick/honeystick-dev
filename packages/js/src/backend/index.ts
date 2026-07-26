import {
  DEFAULT_PATH_PREFIX,
  resolveConfig,
  type ClientOptions,
} from '../config';
import { HoneystickError } from '../errors';
import { directTransport, type RequestArgs } from '../transport';

/**
 * The handler every framework adapter wraps.
 *
 * A caller mounts it on one route of their own server - /billing by default -
 * and everything under it is forwarded to Honeystick with their secret key
 * attached. The browser or app never sees the key; it calls /billing/... on its
 * own origin and this turns that into an API call.
 *
 * Nothing here is framework-aware. An adapter's whole job is to turn its own
 * request object into `UnifiedRequest` and this result back into a response,
 * which is why hono.ts and express.ts are a few lines each.
 */
export type UnifiedRequest = {
  method: string;
  /** the full path as received, prefix included */
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** the framework's own request/context, handed to `identify` untouched */
  raw?: unknown;
};

export type UnifiedResponse = {
  status: number;
  body: unknown;
};

/**
 * Who is calling, decided by the caller's own auth - we never take a customer
 * id from the browser. Returning null means "not signed in", which answers 401
 * without reaching Honeystick.
 */
export type Identity = { customerId: string | number } | null;

export type CoreHandlerOptions = ClientOptions & {
  identify?: (raw: unknown) => Identity | Promise<Identity>;
  pathPrefix?: string;
  /**
   * Methods a browser may reach through the proxy. Reads are safe; anything
   * that moves money or changes a plan should be initiated by the caller's own
   * server code, not by whatever is running in a page.
   */
  allowedMethods?: string[];
};

const DEFAULT_ALLOWED = ['GET', 'POST'];

/** paths a proxied caller may never reach, whatever method they use */
const BLOCKED_PATHS = [
  /^\/?organizations/,
  /^\/?account/,
  /^\/?settings/,
  /^\/?support/,
];

export function createCoreHandler(options: CoreHandlerOptions) {
  const prefix = options.pathPrefix ?? DEFAULT_PATH_PREFIX;
  const allowed = options.allowedMethods ?? DEFAULT_ALLOWED;
  const transport = directTransport(options);
  const config = resolveConfig(options);

  return async function handle(
    request: UnifiedRequest,
  ): Promise<UnifiedResponse> {
    if (config.keyKind !== 'secret' || !config.key) {
      return {
        status: 500,
        body: {
          ok: false,
          status: 500,
          error:
            'A Honeystick secret key is required to mount this handler. Set HONEYSTICK_SECRET_KEY or pass secretKey.',
        },
      };
    }

    const path = stripPrefix(request.path, prefix);
    // not ours - the adapter passes it on to the next route
    if (path === null) {
      return { status: 404, body: { ok: false, status: 404, code: 'not_found' } };
    }

    if (!allowed.includes(request.method.toUpperCase())) {
      return {
        status: 405,
        body: {
          ok: false,
          status: 405,
          error: `${request.method} is not allowed through this handler.`,
        },
      };
    }

    if (BLOCKED_PATHS.some((blocked) => blocked.test(path))) {
      return {
        status: 403,
        body: {
          ok: false,
          status: 403,
          error:
            'That endpoint is not reachable through a mounted handler. Call it from your server with the secret key.',
        },
      };
    }

    if (options.identify) {
      const identity = await options.identify(request.raw);
      if (!identity) {
        return {
          status: 401,
          body: { ok: false, status: 401, error: 'Not signed in.' },
        };
      }
    }

    try {
      const body = await transport.request<unknown>({
        method: request.method.toUpperCase() as RequestArgs['method'],
        path,
        query: request.query,
        body: request.body ?? undefined,
      });
      return { status: 200, body: { ok: true, status: 200, body } };
    } catch (error) {
      if (error instanceof HoneystickError) {
        return {
          status: error.status,
          body: {
            ok: false,
            status: error.status,
            body: error.body,
            error: error.message,
          },
        };
      }
      return {
        status: 500,
        body: {
          ok: false,
          status: 500,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  };
}

/** null when the path is not under the mount point at all */
function stripPrefix(path: string, prefix: string): string | null {
  const normalizedPrefix = `/${prefix.replace(/^\/+|\/+$/g, '')}`;
  const normalizedPath = `/${path.replace(/^\/+/, '')}`;
  if (normalizedPath === normalizedPrefix) return '/';
  if (!normalizedPath.startsWith(`${normalizedPrefix}/`)) return null;
  return normalizedPath.slice(normalizedPrefix.length) || '/';
}

export type CoreHandler = ReturnType<typeof createCoreHandler>;
