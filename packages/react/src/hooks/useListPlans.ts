'use client';

import { useQuery } from '@tanstack/react-query';

import type { HoneystickError, ListArgs } from 'honeystick';

import { useHoneystickClient } from '../HoneystickContext.js';
import type { HookParams } from './types.js';

export type UseListPlansParams = HookParams<ListArgs, any[]>;

/** The plans on offer - what a pricing table renders from. */
export const useListPlans = (params: UseListPlansParams = {}) => {
  const client = useHoneystickClient({ caller: 'useListPlans' });
  const { queryOptions, ...listArgs } = params;

  return useQuery<any[], HoneystickError>({
    queryKey: ['honeystick', 'plans', listArgs],
    queryFn: async () => {
      const page = await client.plans.list(listArgs);
      return page.data ?? [];
    },
    ...queryOptions,
  });
};
