'use client';

import { useQuery } from '@tanstack/react-query';

import type { HoneystickError, PlanType } from 'honeystick';

import { useHoneystickClient } from '../HoneystickContext.js';
import {
  useCustomerActions,
  type CheckParams,
  type CheckResult,
} from './internal/useCustomerActions.js';
import type { HookParams, HookResultWithMethods } from './types.js';

export type { PlanType };

/** @deprecated the API calls this `planType`, and so does this hook now */
export type PlanTypeFilter = PlanType;

export type UseCustomerParams = HookParams<
  {
    /**
     * One specific plan, by the id checkout handed back.
     *
     * The precise way to ask, and the one an account page wants. Without it
     * this hook takes the newest plan on the whole organization, which is only
     * the right answer while there is one customer - on a shared demo org, or
     * anywhere two people are signed in at once, it hands each of them
     * whoever subscribed last.
     *
     * Reading by id also survives the plan leaving the list: cancelled plans
     * are excluded from `GET /customer-plans` but still resolve by id, so a
     * screen that has just cancelled can still show what it cancelled.
     */
    planId?: string | number;
    /**
     * Narrow to one kind of plan before taking the first. Ignored when
     * `planId` names one.
     *
     * Worth reaching for more often than it looks. The list comes back
     * newest-first, and a customer who bought something yesterday has that
     * one-time-payment at the top - so an unfiltered read hands you the
     * receipt for a T-shirt when what you wanted was their subscription and
     * its usage counters. `planType: 'subscription'` asks for the plan that
     * actually meters something.
     */
    planType?: PlanType;
  },
  any | null
>;

export type UseCustomerResult = HookResultWithMethods<
  any | null,
  {
    /**
     * The plan this customer holds, with its usage counters.
     *
     * Flat, as the API answers: `id` is the plan's own id and `usage` sits
     * directly on it, each entry keyed by `feature_ext_id`.
     */
    data?: any;

    /**
     * Whether a feature has anything left, answered from the plan already
     * loaded - no request, so it is free to call while rendering.
     *
     * `featureId` is the feature's `ext_id`, the same name `track` takes.
     */
    check: (params: CheckParams) => CheckResult;

    /**
     * Records consumption against the customer's live plan. A capped feature
     * answers 403 with nothing recorded; catch it and read `isLimitReached`.
     *
     * `value` may be negative to hand consumption back, but never zero.
     */
    track: (params: {
      featureId: string;
      value?: number;
      planId?: string | number;
    }) => Promise<unknown>;

    /**
     * Starts payment for a plan awaiting one, returning a redirect URL.
     *
     * The API requires somewhere to send the customer back to, so the current
     * page stands in when neither URL is given.
     */
    activate: (params?: {
      planId?: string | number;
      returnUrl?: string;
      cancelUrl?: string;
    }) => Promise<unknown>;

    /**
     * Stops future billing on the customer's subscription.
     *
     * `removed` in the answer means the plan never started and was deleted
     * rather than cancelled, so the id no longer resolves.
     */
    cancel: (params?: { planId?: string | number; scheduleAt?: string }) => Promise<{
      /** the plan never started and was deleted - the id no longer resolves */
      removed: boolean;
      status: string | null;
      /** set instead when `scheduleAt` booked it: nothing has ended yet */
      scheduledAt: string | null;
      raw: unknown;
    }>;

    /**
     * A page at the payment provider where the customer replaces their card.
     * Returns the URL rather than navigating, so the caller decides between a
     * redirect, a new tab and a system browser.
     */
    updateCard: (params?: { planId?: string | number }) => Promise<string>;
  }
>;

/**
 * The customer this session belongs to, plus what they can do.
 *
 * Who that is comes from the `identify` you gave the mounted handler, never from
 * the page - so this can only ever resolve to the signed-in customer's own plan.
 *
 * One plan at a time. Name it with `planId` where you know it; otherwise this
 * takes the most recent, which is a convenience for a demo and not an identity
 * model. A customer holding several - a subscription and a past one-off - is a
 * real case this does not cover; reach for `client.customerPlans.list()`
 * directly when you need all of them.
 */
export const useCustomer = (
  params: UseCustomerParams = {},
): UseCustomerResult => {
  const client = useHoneystickClient({ caller: 'useCustomer' });
  const { queryOptions, planId, ...listArgs } = params;

  const queryResult = useQuery<any | null, HoneystickError>({
    // The args are part of the key, so two components asking for different
    // plans do not read each other's answer out of the cache. The
    // ['honeystick', 'customer'] prefix still matches what the actions
    // invalidate, so a tracked unit refreshes every one of them.
    queryKey: ['honeystick', 'customer', planId ?? null, listArgs],
    queryFn: async () => {
      // A named plan is read directly. Going through the list to find it would
      // not only cost more, it would fail for exactly the plan an account page
      // most needs after a cancellation - the list leaves cancelled plans out.
      if (planId !== undefined && planId !== null && planId !== '') {
        return (await client.customerPlans.get(planId)) ?? null;
      }
      const page = await client.customerPlans.list({ limit: 1, ...listArgs });
      return page.data?.[0] ?? null;
    },
    ...queryOptions,
  });

  const actions = useCustomerActions({
    client,
    customer: queryResult.data ?? null,
  });

  return { ...queryResult, ...actions } as UseCustomerResult;
};
