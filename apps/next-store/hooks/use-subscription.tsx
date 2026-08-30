'use client';

import { useCallback, useMemo } from 'react';

import { useLocalStorage } from './use-local-storage';

/**
 * Which subscription this browser just bought.
 *
 * The one piece of state that has to survive leaving the origin. Subscribing
 * hands the shopper to PayFast and PayFast hands them back, and everything the
 * page was holding in memory is gone by then - so the plan id goes to
 * localStorage before the redirect and /account reads it on the way back.
 *
 * It is worth being clear that this is a demo's answer to identity and not a
 * real one. Honeystick Example App has no accounts: nobody signs in, so there is nothing on
 * the server that knows this browser from any other. In an app with accounts
 * the plan would be found from the session - `identify` on the mounted handler
 * already exists for exactly that - and none of this would be needed.
 *
 * What it must not be is a substitute for authorization. The id here decides
 * *which* plan the page asks about, and the server is what decides whether the
 * asking is allowed. Storing it in a place the shopper can edit is fine on that
 * understanding, and would not be on any other.
 */
export type StoredSubscription = {
  /** the org_customer_plan_id, as checkout answered with it */
  planId: number;
  /** the customer Honeystick resolved the email to */
  customerId: number | null;
  /** the store's own reference, and the plan's ext_id */
  reference: string;
  /** what they subscribed to, so the page has something to say before it loads */
  planName: string;
  email: string;
  /** when it was bought, so a stale handle can be recognised as one */
  at: number;
};

const KEY = 'depot-subscription';

/**
 * Anything in storage that is not this shape is discarded rather than rendered.
 *
 * The value has been sitting in a browser since whenever it was written, which
 * may be before the shape last changed - and an account page built on a partly
 * missing plan id fails as a confusing 404 rather than as "no subscription".
 */
const revive = (raw: unknown): StoredSubscription | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<StoredSubscription>;
  if (typeof value.planId !== 'number' || !Number.isFinite(value.planId)) {
    return null;
  }
  return {
    planId: value.planId,
    customerId:
      typeof value.customerId === 'number' ? value.customerId : null,
    reference: typeof value.reference === 'string' ? value.reference : '',
    planName: typeof value.planName === 'string' ? value.planName : 'Your plan',
    email: typeof value.email === 'string' ? value.email : '',
    at: typeof value.at === 'number' ? value.at : 0,
  };
};

export function useSubscription() {
  const [subscription, setSubscription] =
    useLocalStorage<StoredSubscription | null>(KEY, null, revive);

  const remember = useCallback(
    (next: Omit<StoredSubscription, 'at'>) =>
      setSubscription({ ...next, at: Date.now() }),
    [setSubscription],
  );

  /**
   * Forgets the handle. Not a cancellation - cancelling is a call to
   * Honeystick, and this only stops the browser pointing at the plan
   * afterwards. Doing this without the other leaves a live subscription nobody
   * can see, which is why /account always does them in that order.
   */
  const forget = useCallback(() => setSubscription(null), [setSubscription]);

  return useMemo(
    () => ({ subscription, remember, forget }),
    [subscription, remember, forget],
  );
}
