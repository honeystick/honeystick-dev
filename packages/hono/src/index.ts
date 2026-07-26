import {
  createCoreHandler,
  type CoreHandlerOptions,
  type Identity,
} from '@honeystick/js/backend';

export type HonoHandlerOptions<ContextType = any> = Omit<
  CoreHandlerOptions,
  'identify'
> & {
  /** who is calling, decided by your own auth - never trust the browser for it */
  identify?: (c: ContextType) => Identity | Promise<Identity>;
};

/**
 * Mounts Honeystick on one route of your Hono server:
 *
 * ```ts
 * app.use(
 *   '/billing/*',
 *   honeystickHandler({
 *     secretKey: process.env.HONEYSTICK_SECRET_KEY,
 *     orgId: process.env.HONEYSTICK_ORG_ID,
 *     identify: (c) => ({ customerId: c.get('userId') }),
 *   }),
 * );
 * ```
 *
 * Everything under /billing is forwarded to Honeystick with your secret key.
 * The browser calls your own origin, so the key never leaves the server.
 */
export function honeystickHandler<ContextType = any>(
  options: HonoHandlerOptions<ContextType>,
) {
  const handle = createCoreHandler({
    ...options,
    identify: options.identify
      ? (raw) => options.identify!(raw as ContextType)
      : undefined,
  });

  return async (c: any, next: () => Promise<void>) => {
    const url = new URL(c.req.url);

    let body: unknown = null;
    if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      try {
        body = await c.req.json();
      } catch {
        body = null;
      }
    }

    const result = await handle({
      method: c.req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      raw: c,
    });

    // not one of ours - let the rest of the app have it
    if (
      result.status === 404 &&
      (result.body as { code?: string })?.code === 'not_found'
    ) {
      return next();
    }

    return c.json(result.body, result.status);
  };
}
