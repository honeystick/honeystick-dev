'use client';

/**
 * The client half, for client components.
 *
 * Kept in its own entry point with its own 'use client' so that importing the
 * handler or the server client from `@honeystick/next` never drags React
 * context into a server component - and so a page that only renders a price
 * does not pull in a query client it has no use for.
 *
 * These are re-exported from @honeystick/react unchanged. Next needs no
 * different provider; what it needs is the boundary to be drawn in the right
 * place, which is this file.
 */
export {
  HoneystickContext,
  HoneystickError,
  HoneystickBadge,
  HoneystickFab,
  HoneystickProvider,
  useCustomer,
  useHoneystickClient,
  useListFeatures,
  useListPlans,
  type CheckParams,
  type CheckResult,
  type HoneystickContextValue,
  type HoneystickBadgeProps,
  type HoneystickFabProps,
  type HoneystickProviderProps,
  type HookParams,
  type HookResult,
  type HookResultWithMethods,
  type PlanType,
  type UseCustomerParams,
  type UseCustomerResult,
  type UseListFeaturesParams,
  type UseListPlansParams,
} from '@honeystick/react';
