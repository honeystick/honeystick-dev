import {
  createCoreHandler,
  type CoreHandlerOptions,
  type Identity,
} from '@honeystick/js/backend';

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
