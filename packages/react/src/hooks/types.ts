import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

import type { HoneystickError } from '@honeystick/js';

/** Any hook's own params, plus a react-query escape hatch for the caller. */
export type HookParams<
  T extends object,
  TData = unknown,
  TError = HoneystickError,
> = T & {
  queryOptions?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>;
};

export type HookResult<TData, TError = HoneystickError> = Omit<
  UseQueryResult<TData, TError>,
  'data'
> & {
  data: TData | undefined;
};

export type HookResultWithMethods<
  TData,
  TMethods extends object,
  TError = HoneystickError,
> = HookResult<TData, TError> & TMethods;
