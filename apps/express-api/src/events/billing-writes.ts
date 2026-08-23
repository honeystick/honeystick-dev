import type { NextFunction, Request, Response } from 'express';

import { publish } from './bus';

/**
 * Turning writes into events, without asking anyone anything.
 *
 * Every mutation the app makes reaches Honeystick through this server - that is
 * the entire point of the /billing mount, and it means the server is present at
 * the moment each change happens. So it announces them. Nothing polls, nothing
 * is scheduled, and a server nobody is using makes no calls at all.
 *
 * The alternative was watching Honeystick on an interval, which is the wrong
 * shape twice over: it spends API calls at a rate set by a timer rather than by
 * activity, and it spends them whether anything changed or not. Under a rate
 * limit that is a budget burnt on discovering that nothing happened.
 *
 * Sits in front of the handler and listens for the response to finish, rather
 * than wrapping it. `finish` fires once the response is actually written, so the
 * status code is known and a refused write - a 403 from a usage limit, say -
 * never announces a change that did not happen.
 */

/** the plan a path is about, when it names one */
function planIdFrom(path: string): number | null {
  const match = path.match(/\/customer-plans\/(\d+)/);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function announceBillingWrites() {
  return (req: Request, res: Response, next: NextFunction) => {
    // A read changes nothing, and telling every open client that somebody
    // looked at something would be pure noise - the shop floor alone issues
    // several GETs per screen.
    if (req.method === 'GET') return next();

    res.on('finish', () => {
      // 4xx and 5xx are the call not happening. A 403 from a feature at its
      // limit is the clearest case: the counter is untouched, so there is
      // nothing for anyone to re-read.
      if (res.statusCode >= 400) return;

      // `originalUrl` because app.use('/billing', ...) strips the mount point
      // from req.url, and the path is what makes the event legible
      const path = (req.originalUrl ?? req.url).split('?')[0] ?? '';

      publish({
        type: 'billing.changed',
        method: req.method,
        path,
        planId: planIdFrom(path),
      });
    });

    next();
  };
}
