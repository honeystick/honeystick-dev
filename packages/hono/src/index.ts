import {
  createCoreHandler,
  type CoreHandlerOptions,
  type Identity,
} from 'honeystick/backend';
import {
  HoneystickWebhookError,
  verifyWebhook,
  type HoneystickWebhookEvent,
} from 'honeystick/webhooks';

export {
  HONEYSTICK_WEBHOOK_EVENTS,
  HoneystickWebhookError,
  isKnownWebhookEvent,
  verifyWebhook,
  type HoneystickWebhookEvent,
  type HoneystickWebhookEventName,
} from 'honeystick/webhooks';

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

/**
 * Receiving Honeystick's webhooks, on one route of your Hono server.
 *
 * ```ts
 * app.post(
 *   '/honeystick/webhook',
 *   honeystickWebhook({
 *     secret: c.env.HONEYSTICK_WEBHOOK_SECRET,
 *     on: async (event) => { ... },
 *   }),
 * );
 * ```
 *
 * The easiest of the three adapters, because Hono does not parse a body until
 * something asks it to - so `c.req.text()` is the bytes as sent, which is what
 * the signature covers. Do not call `c.req.json()` first: the body can only be
 * read once, and the parsed object cannot be turned back into the exact bytes.
 *
 * 400 for a delivery that does not verify (Honeystick treats 4xx as final),
 * and a throw from your handler propagates so the framework answers 5xx - which
 * is what earns the retry.
 */
export function honeystickWebhook(options: {
  /** the endpoint's signing secret from the dashboard, `whsec_...` */
  secret: string;
  on: (event: HoneystickWebhookEvent) => void | Promise<void>;
  /** how old a delivery may be, in seconds. Default 300. */
  toleranceSeconds?: number;
}) {
  return async (c: any) => {
    let event: HoneystickWebhookEvent;
    try {
      event = await verifyWebhook({
        body: await c.req.text(),
        headers: c.req.raw.headers,
        secret: options.secret,
        toleranceSeconds: options.toleranceSeconds,
      });
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: (error as Error).message,
          reason:
            error instanceof HoneystickWebhookError ? error.reason : 'invalid',
        },
        400,
      );
    }

    // Outside the try on purpose: a handler that throws must reach Hono's error
    // handling and become a 5xx, because that is the answer Honeystick retries.
    await options.on(event);

    return c.json({ ok: true, received: event.id }, 200);
  };
}
