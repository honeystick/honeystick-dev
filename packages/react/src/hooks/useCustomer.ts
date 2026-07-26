'use client';

import { useQuery } from '@tanstack/react-query';

import type { HoneystickError } from '@honeystick/js';

import { useHoneystickClient } from '../HoneystickContext';
import {
  useCustomerActions,
  type CheckParams,
  type CheckResult,
} from './internal/useCustomerActions';
import type { HookParams, HookResultWithMethods } from './types';

export type UseCustomerParams = HookParams<Record<string, never>, any | null>;

export type UseCustomerResult = HookResultWithMethods<
  any | null,
  {
    /** The plan this customer holds, with its usage counters. */
    data?: any;

    /**
     * Whether a feature has anything left, answered from the plan already
     * loaded - no request, so it is free to call while rendering.
     */
    check: (params: CheckParams) => CheckResult;

    /**
     * Records consumption against the customer's live plan. A capped feature
     * answers 403 with nothing recorded; catch it and read `isLimitReached`.
     */
    track: (params: {
      featureId: string;
      value?: number;
      planId?: string | number;
    }) => Promise<unknown>;

    /** Starts payment for a plan awaiting one, returning a redirect URL. */
    activate: (params?: {
      planId?: string | number;
      returnUrl?: string;
    }) => Promise<unknown>;

    /** Stops future billing on the customer's subscription. */
    cancel: (params?: { planId?: string | number }) => Promise<unknown>;
  }
>;

/**
 * The customer this session belongs to, plus what they can do.
 *
 * Who that is comes from the `identify` you gave the mounted handler, never from
 * the page - so this can only ever resolve to the signed-in customer's own plan.
 */
export const useCustomer = (
  params: UseCustomerParams = {},
): UseCustomerResult => {
  const client = useHoneystickClient({ caller: 'useCustomer' });
  const { queryOptions } = params;

  const queryResult = useQuery<any | null, HoneystickError>({
    queryKey: ['honeystick', 'customer'],
    queryFn: async () => {
      const page = await client.customerPlans.list({ limit: 1 });
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
