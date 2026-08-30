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
 * It is a demo's answer to identity and not a real one. Honeystick Example App has no
 * accounts: nobody signs in, so nothing on the server knows this browser from
 * any other. In an app with accounts the plan would be found from the session -
 * `identify` on the mounted handler exists for exactly that - and none of this
 * would be needed.
 *
 * What it must not be is a substitute for authorization. The id decides *which*
 * plan the page asks about; the server decides whether the asking is allowed.
 */
export type StoredSubscription = {
  /** the org_customer_plan_id, as checkout answered with it */
  planId: number;
  customerId: number | null;
  reference: string;
  planName: string;
  email: string;
  at: number;
};

const KEY = 'depot-subscription';

const revive = (raw: unknown): StoredSubscription | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<StoredSubscription>;
  if (typeof value.planId !== 'number' || !Number.isFinite(value.planId)) {
    return null;
  }
  return {
    planId: value.planId,
    customerId: typeof value.customerId === 'number' ? value.customerId : null,
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
