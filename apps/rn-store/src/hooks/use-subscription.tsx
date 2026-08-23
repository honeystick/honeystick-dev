import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Which subscription this device just bought.
 *
 * Byte for byte the Expo store's, which is the point: persisting a plan id is
 * the app's problem and not the SDK's, and it is the same problem whichever
 * React Native you are running.
 *
 * It exists for a sharper version of the web store's reason. On the web the
 * plan id has to survive leaving the origin for PayFast; here it has to survive
 * the payment happening in a *different application* - the system browser -
 * which the app cannot see into and is not guaranteed to be running behind.
 *
 * It is worth being clear that this is a demo's answer to identity and not a
 * real one. The Depot has no accounts: nobody signs in, so there is nothing on
 * the server that knows this device from any other. In an app with accounts the
 * plan would be found from the session - `identify` on the mounted handler
 * already exists for exactly that - and none of this would be needed.
 *
 * What it must not be is a substitute for authorization. The id here decides
 * *which* plan the screen asks about, and the server is what decides whether
 * the asking is allowed. Storing it somewhere the device owner can reach is
 * fine on that understanding, and would not be on any other.
 */
export type StoredSubscription = {
  /** the org_customer_plan_id, as checkout answered with it */
  planId: number;
  /** the customer Honeystick resolved the email to */
  customerId: number | null;
  /** the store's own reference, and the plan's ext_id */
  reference: string;
  /** what they subscribed to, so the screen has something to say before it loads */
  planName: string;
  email: string;
  at: number;
};

const STORAGE_KEY = 'depot-subscription';

/**
 * Anything in storage that is not this shape is discarded rather than rendered.
 *
 * The value has been on the device since whenever it was written, which may be
 * before the shape last changed - and an account screen built on a partly
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
    customerId: typeof value.customerId === 'number' ? value.customerId : null,
    reference: typeof value.reference === 'string' ? value.reference : '',
    planName: typeof value.planName === 'string' ? value.planName : 'Your plan',
    email: typeof value.email === 'string' ? value.email : '',
    at: typeof value.at === 'number' ? value.at : 0,
  };
};

/**
 * Read on mount, written on change.
 *
 * Not a context, unlike the cart. Two screens read this - the sheet that writes
 * it and the account screen that consumes it - and they are never mounted at
 * the same moment in a way that matters, so a provider would be ceremony around
 * one string. Each mount re-reads storage, which is also what makes the account
 * screen correct after the app has been backgrounded through a payment.
 */
export function useSubscription() {
  const [subscription, setSubscription] = useState<StoredSubscription | null>(
    null,
  );
  /** false until storage has answered, so a screen can avoid flashing "none" */
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        setSubscription(raw ? revive(JSON.parse(raw)) : null);
      } catch {
        // unreadable storage is the same answer as empty storage, and a store
        // that will not open because of it is worse than one with no plan
        if (!cancelled) setSubscription(null);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback(
    async (next: Omit<StoredSubscription, 'at'>) => {
      const value: StoredSubscription = { ...next, at: Date.now() };
      setSubscription(value);
      // Awaited rather than fired and forgotten: the very next thing the caller
      // does is hand the shopper to a system browser, and on iOS the app may be
      // suspended before an unawaited write has landed.
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    },
    [],
  );

  /**
   * Forgets the handle. Not a cancellation - cancelling is a call to
   * Honeystick, and this only stops the app pointing at the plan afterwards.
   * Doing this without the other leaves a live subscription nobody can see,
   * which is why the account screen always does them in that order.
   */
  const forget = useCallback(async () => {
    setSubscription(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return useMemo(
    () => ({ subscription, isLoaded, remember, forget }),
    [subscription, isLoaded, remember, forget],
  );
}
