'use client';

import { useQuery } from '@tanstack/react-query';

import type { HoneystickError, ListArgs } from '@honeystick/js';

import { useHoneystickClient } from '../HoneystickContext';
import type { HookParams } from './types';

export type UseListFeaturesParams = HookParams<ListArgs, any[]>;

/** The features plans can meter, for a comparison table. */
export const useListFeatures = (params: UseListFeaturesParams = {}) => {
  const client = useHoneystickClient({ caller: 'useListFeatures' });
  const { queryOptions, ...listArgs } = params;

  return useQuery<any[], HoneystickError>({
    queryKey: ['honeystick', 'features', listArgs],
    queryFn: async () => {
      const page = await client.features.list(listArgs);
      return page.data ?? [];
    },
    ...queryOptions,
  });
};
