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

export type ExpressHandlerOptions<RequestType = any> = Omit<
  CoreHandlerOptions,
  'identify'
> & {
  /** who is calling, decided by your own auth - never trust the browser for it */
  identify?: (req: RequestType) => Identity | Promise<Identity>;
};

/**
 * Mounts Honeystick on one route of your Express server:
 *
 * ```ts
 * app.use(
 *   '/billing',
 *   express.json(),
 *   honeystickHandler({
 *     secretKey: process.env.HONEYSTICK_SECRET_KEY,
 *     orgId: process.env.HONEYSTICK_ORG_ID,
 *     identify: (req) => ({ customerId: req.user.id }),
 *   }),
 * );
 * ```
 *
 * Everything under /billing is forwarded to Honeystick with your secret key.
 * The browser calls your own origin, so the key never leaves the server.
 */
export function honeystickHandler<RequestType = any>(
  options: ExpressHandlerOptions<RequestType>,
) {
  const handle = createCoreHandler({
    ...options,
    identify: options.identify
      ? (raw) => options.identify!(raw as RequestType)
      : undefined,
  });

  return async (req: any, res: any, next: (error?: unknown) => void) => {
    try {
      // app.use('/billing', ...) strips the mount point from req.url, so the
      // original path has to be reassembled before the handler can match it
      const path = req.originalUrl?.split('?')[0] ?? req.path ?? req.url;

      const result = await handle({
        method: req.method,
        path,
        query: req.query as Record<string, string | undefined>,
        // express.json() has already parsed it, if the caller mounted it
        body: req.body ?? null,
        raw: req,
      });

      if (
        result.status === 404 &&
        (result.body as { code?: string })?.code === 'not_found'
      ) {
        return next();
      }

      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Receiving Honeystick's webhooks, on one route of your Express server.
 *
 * ```ts
 * app.post(
 *   '/honeystick/webhook',
 *   express.raw({ type: 'application/json' }),   // <- required, see below
 *   honeystickWebhook({
 *     secret: process.env.HONEYSTICK_WEBHOOK_SECRET,
 *     on: async (event) => { ... },
 *   }),
 * );
 * ```
 *
 * ## `express.raw` is not optional, and neither is where you put it
 *
 * This is the one adapter where the framework actively works against you. A
 * signature covers the exact bytes Honeystick sent, and `express.json()`
 * consumes the stream and leaves you a parsed object - at which point the bytes
 * are gone and cannot be reconstructed, because re-serialising an object is not
 * guaranteed to reproduce the whitespace, the unicode escaping, or a number
 * that arrived as `1.0`.
 *
 * So this route needs `express.raw`, and it needs it *instead of* the global
 * `express.json()` rather than after it. An `app.use(express.json())` mounted
 * above this route has already eaten the body by the time the route runs. Two
 * ways out, and the second is the one to prefer:
 *
 *   - mount `express.json()` after this route, or
 *   - scope it: `app.use(/^(?!\/honeystick\/webhook)/, express.json())`
 *
 * If the body does arrive parsed, this answers 500 and says so by name rather
 * than failing as a mismatched signature - which would send you hunting for a
 * wrong secret that was right all along.
 */
export function honeystickWebhook(options: {
  /** the endpoint's signing secret from the dashboard, `whsec_...` */
  secret: string;
  on: (event: HoneystickWebhookEvent) => void | Promise<void>;
  /** how old a delivery may be, in seconds. Default 300. */
  toleranceSeconds?: number;
}) {
  return async (req: any, res: any, next: (error?: unknown) => void) => {
    const raw = req.body;

    /**
     * A Buffer is `express.raw` having done its job. A string is a caller who
     * captured the body themselves with a `verify` hook, which is also fine.
     * Anything else - an object, or nothing at all - means the bytes are gone.
     */
    let body: string;
    if (Buffer.isBuffer(raw)) {
      body = raw.toString('utf8');
    } else if (typeof raw === 'string') {
      body = raw;
    } else {
      res.status(500).json({
        ok: false,
        error:
          'The raw request body was not available. Mount express.raw({ type: "application/json" }) on this route, and make sure express.json() does not run before it.',
      });
      return;
    }

    let event: HoneystickWebhookEvent;
    try {
      event = await verifyWebhook({
        body,
        headers: req.headers,
        secret: options.secret,
        toleranceSeconds: options.toleranceSeconds,
      });
    } catch (error) {
      // 400, and never a retry: a signature that did not verify will not
      // verify on the second attempt either
      res.status(400).json({
        ok: false,
        error: (error as Error).message,
        reason:
          error instanceof HoneystickWebhookError ? error.reason : 'invalid',
      });
      return;
    }

    try {
      await options.on(event);
    } catch (error) {
      // Handed to the error middleware, which answers 5xx - and a 5xx is what
      // tells Honeystick to try again. Failing loudly here is how a delivery
      // your code could not process gets another chance.
      next(error);
      return;
    }

    res.status(200).json({ ok: true, received: event.id });
  };
}
