'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Honeystick } from '@honeystick/js';

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
  customer: any | null;
}) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: ['honeystick', 'customer'] }),
    [queryClient],
  );

  const check = useCallback(
    ({ featureId }: CheckParams): CheckResult => {
      const entry = (customer?.plan?.usage ?? []).find(
        (usage: { feature_id: string }) => usage.feature_id === featureId,
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
      const activePlanId = planId ?? customer?.plan?.plan?.id;
      if (!activePlanId) {
        throw new Error(
          'No active plan to track usage against. Pass planId, or wait for useCustomer to resolve.',
        );
      }
      const result = await client.customerPlans.trackUsage(activePlanId, {
        feature_id: featureId,
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
   */
  const activate = useCallback(
    async (params: { planId?: string | number; returnUrl?: string } = {}) => {
      const activePlanId = params.planId ?? customer?.plan?.plan?.id;
      if (!activePlanId) {
        throw new Error('No active plan to activate.');
      }
      const result = await client.customerPlans.activate({
        active_plan_id: activePlanId,
        return_url: params.returnUrl,
        cancel_url: params.returnUrl,
      });
      await invalidate();
      return result;
    },
    [client, customer, invalidate],
  );

  const cancel = useCallback(
    async (params: { planId?: string | number } = {}) => {
      const activePlanId = params.planId ?? customer?.plan?.plan?.id;
      if (!activePlanId) throw new Error('No active plan to cancel.');
      const result = await client.customerPlans.cancel([Number(activePlanId)]);
      await invalidate();
      return result;
    },
    [client, customer, invalidate],
  );

  return { check, track, activate, cancel, refetchCustomer: invalidate };
}
