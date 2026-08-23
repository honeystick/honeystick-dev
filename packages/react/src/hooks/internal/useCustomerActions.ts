'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Honeystick } from 'honeystick';

export type CheckParams = { featureId: string };

export type CheckResult = {
  /** whether there is anything left of this feature's allowance */
  allowed: boolean;
  /** what is left, or null when the feature is not metered at all */
  balance: number | null;
  /** the allowance in force, rewards and top-ups included */
  limit: number | null;
  used: number;
  /** null when this plan does not carry the feature */
  featureId: string | null;
};

/**
 * One entry of a customer plan's `usage` array.
 *
 * The feature is identified by the `ext_id` the organization gave it, which is
 * the same name `trackUsage` takes. There is no row id here to key on, and
 * inventing one is how a check silently matches nothing.
 */
type UsageEntry = {
  feature_ext_id: string;
  used?: number;
  limit?: number | null;
};

/**
 * A customer plan as the API answers with it - flat.
 *
 * `id` is the `org_customer_plan_id` every write takes, and `usage` sits
 * directly on the plan. It is worth naming that here because the wrong shape is
 * so easy to write and so quiet when you do: a nested lookup that misses
 * returns undefined, `check` reports the feature as absent, and the gate reads
 * as "no allowance" rather than as a bug.
 */
type CustomerPlan = {
  id?: number | string;
  usage?: UsageEntry[];
};

/**
 * Where the provider sends the customer back to, when the caller says nothing.
 *
 * Written without naming `window` as a type, and defensively about what it
 * holds, because this file is consumed as source by React Native apps in this
 * repo - and both halves of the obvious version are wrong there.
 *
 * `typeof window === 'undefined'` reads as "am I in a browser" and is not:
 * React Native defines a global `window`, so the guard passes and the next
 * property access is the one that fails. What it does not define is
 * `window.location`, so `window.location.href` throws a TypeError from inside
 * `activate` - a crash rather than the 400 that at least says what was missing.
 *
 * Reached through `globalThis` for the same reason `readEnv` in config.ts is:
 * naming `window` as a global would make this package need the DOM lib, which
 * it must not, because it also runs where a tsconfig has no business claiming
 * `window` exists.
 */
const currentUrl = (): string | undefined => {
  const location = (
    globalThis as { location?: { href?: unknown } } | undefined
  )?.location;
  return typeof location?.href === 'string' ? location.href : undefined;
};

/**
 * What a customer can do, alongside what they have.
 *
 * `check` is answered from the plan already in hand - no request - so a feature
 * gate costs nothing to render. Everything that changes money goes to the
 * server and then invalidates the customer, because a tracked unit or a
 * cancellation changes what the next render should say.
 */
export function useCustomerActions({
  client,
  customer,
}: {
  client: Honeystick;
  customer: CustomerPlan | null;
}) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ['honeystick', 'customer'] }),
    [queryClient],
  );

  const check = useCallback(
    ({ featureId }: CheckParams): CheckResult => {
      const entry = (customer?.usage ?? []).find(
        (usage) => usage.feature_ext_id === featureId,
      );

      if (!entry) {
        return {
          allowed: false,
          balance: null,
          limit: null,
          used: 0,
          featureId: null,
        };
      }

      const limit =
        entry.limit === null || entry.limit === undefined
          ? null
          : Number(entry.limit);
      const used = Number(entry.used ?? 0);

      return {
        // an unmetered feature has no ceiling to be under, so it is allowed -
        // "no limit" is not "no allowance"
        allowed: limit === null ? true : used < limit,
        balance: limit === null ? null : Math.max(limit - used, 0),
        limit,
        used,
        featureId,
      };
    },
    [customer],
  );

  /**
   * Records consumption. A plan at its limit answers 403 with the counter
   * untouched, which surfaces as HoneystickError.isLimitReached - a branch to
   * handle (prompt an upgrade), not a fault.
   *
   * `featureId` here is the feature's `ext_id`; it reaches the API as
   * `feature_ext_id`, which is the only name it answers to.
   */
  const track = useCallback(
    async ({
      featureId,
      value = 1,
      planId,
    }: {
      featureId: string;
      value?: number;
      planId?: string | number;
    }) => {
      const activePlanId = planId ?? customer?.id;
      if (!activePlanId) {
        throw new Error(
          'No active plan to track usage against. Pass planId, or wait for useCustomer to resolve.',
        );
      }
      const result = await client.customerPlans.trackUsage(activePlanId, {
        feature_ext_id: featureId,
        value,
      });
      await invalidate();
      return result;
    },
    [client, customer, invalidate],
  );

  /**
   * Starts payment for a plan that is waiting on one. Returns the provider's
   * redirect URL rather than navigating, so the caller decides whether that is
   * a redirect, a new tab or a web view.
   *
   * Both URLs are required by the API, so the current page stands in when the
   * caller names neither - which is almost always what a page wants, and beats
   * a 400 that says only that `return_url` was missing.
   */
  const activate = useCallback(
    async (
      params: {
        planId?: string | number;
        returnUrl?: string;
        cancelUrl?: string;
      } = {},
    ) => {
      const activePlanId = params.planId ?? customer?.id;
      if (!activePlanId) {
        throw new Error('No active plan to activate.');
      }
      const returnUrl = params.returnUrl ?? currentUrl();
      const result = await client.customerPlans.activate({
        org_customer_plan_id: activePlanId,
        return_url: returnUrl,
        cancel_url: params.cancelUrl ?? returnUrl,
      });
      await invalidate();
      return result;
    },
    [client, customer, invalidate],
  );

  /**
   * Ends the subscription.
   *
   * What happens depends on the plan and is not the caller's to choose: one
   * that is running is cancelled at the payment provider and keeps its row,
   * its transactions and its usage ledger; one that never started is deleted,
   * because there is nothing at the provider to stop and no history to keep.
   *
   * That second case is reported as `removed`, and a caller needs it - the id
   * stops resolving, so a screen that re-reads the plan to confirm what it did
   * lands on a 404 and looks like the cancellation failed.
   *
   * `cancelPlan` rather than `cancel`, and that is the whole reason: the bulk
   * endpoint answers with a list of ids and never says which of the two things
   * it did to each. This is about one plan, so it uses the endpoint that
   * answers about one plan.
   *
   * `scheduleAt` books it for a date instead of doing it now, in which case
   * nothing has ended yet - `scheduledAt` is set and `removed` is false.
   */
  const cancel = useCallback(
    async (params: { planId?: string | number; scheduleAt?: string } = {}) => {
      const activePlanId = params.planId ?? customer?.id;
      if (!activePlanId) throw new Error('No active plan to cancel.');
      const result = await client.customerPlans.cancelPlan(activePlanId, {
        scheduleAt: params.scheduleAt,
      });
      await invalidate();

      return {
        removed: result?.removed === true,
        status: result?.status ?? null,
        scheduledAt: result?.scheduled_at ?? null,
        raw: result,
      };
    },
    [client, customer, invalidate],
  );

  /**
   * Where the customer goes to replace the card this subscription bills.
   *
   * Returns the URL rather than navigating, for the same reason `activate`
   * does: a browser wants a redirect, a native app wants a system browser, and
   * the SDK is in no position to know which it is inside.
   *
   * The card never reaches your app or Honeystick - the page belongs to the
   * payment provider, which is the only arrangement they will bless. A plan
   * still waiting on its first payment has no card on file yet and answers
   * 400, which is a state a shopper reaches by backing out of the payment page
   * and then finding this button.
   */
  const updateCard = useCallback(
    async (params: { planId?: string | number } = {}) => {
      const activePlanId = params.planId ?? customer?.id;
      if (!activePlanId) throw new Error('No active plan to update a card on.');
      const result = await client.customerPlans.updateCard(activePlanId);
      const url = result?.url;
      if (!url) {
        throw new Error('The payment provider returned no card update page.');
      }
      return url;
    },
    [client, customer],
  );

  return {
    check,
    track,
    activate,
    cancel,
    updateCard,
    refetchCustomer: invalidate,
  };
}
