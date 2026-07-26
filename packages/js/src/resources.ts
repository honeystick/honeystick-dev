import type { Query, Transport } from './transport';

/**
 * The API surface, one method per endpoint in REST_API_SCHEMA.
 *
 * Types are deliberately loose for now - `types/schema/rest` on the server is
 * the source of truth and these should be generated from it rather than
 * hand-copied, which is the next job. Getting that wrong by hand is exactly
 * how an SDK drifts from the API it wraps.
 */
export type Paged<T> = { data: T[]; nextCursor?: number | null };

export type ListArgs = { limit?: number; nextCursor?: number };

const listQuery = (args?: ListArgs): Query => ({
  limit: args?.limit,
  nextCursor: args?.nextCursor,
});

/**
 * Every write is on behalf of one organization, and the API asks for it in the
 * body rather than inferring it. The client already knows which org it was
 * created for, so callers should not have to repeat it - but an explicit value
 * in the call still wins.
 */
const withOrg = <T extends Record<string, unknown>>(
  transport: Transport,
  input: T,
  field: 'org_id' | 'org_ids',
) => {
  if (input[field] !== undefined) return input;
  if (!transport.orgId) return input;
  return {
    ...input,
    [field]: field === 'org_ids' ? [transport.orgId] : transport.orgId,
  };
};

export function createResources(transport: Transport) {
  return {
    plans: {
      list: (args?: ListArgs) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/plans',
          query: listQuery(args),
        }),
      get: (planId: string | number) =>
        transport.request<any>({ method: 'GET', path: `/plans/${planId}` }),
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/plans',
          body: withOrg(transport, input, 'org_ids'),
        }),
      update: (planId: string | number, input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'PUT',
          path: `/plans/${planId}`,
          body: input,
        }),
      remove: (planId: string | number) =>
        transport.request<any>({ method: 'DELETE', path: `/plans/${planId}` }),
    },

    features: {
      list: (args?: ListArgs) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/features',
          query: listQuery(args),
        }),
      get: (featureId: string | number) =>
        transport.request<any>({
          method: 'GET',
          path: `/features/${featureId}`,
        }),
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/features',
          body: withOrg(transport, input, 'org_id'),
        }),
      update: (featureId: string | number, input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'PUT',
          path: `/features/${featureId}`,
          body: input,
        }),
      remove: (featureId: string | number) =>
        transport.request<any>({
          method: 'DELETE',
          path: `/features/${featureId}`,
        }),
    },

    rewards: {
      list: (args?: ListArgs) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/rewards',
          query: listQuery(args),
        }),
      get: (rewardId: string | number) =>
        transport.request<any>({
          method: 'GET',
          path: `/rewards/${rewardId}`,
        }),
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/rewards',
          body: withOrg(transport, input, 'org_id'),
        }),
      update: (rewardId: string | number, input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'PUT',
          path: `/rewards/${rewardId}`,
          body: input,
        }),
      remove: (rewardId: string | number) =>
        transport.request<any>({
          method: 'DELETE',
          path: `/rewards/${rewardId}`,
        }),
    },

    customers: {
      list: (args?: ListArgs) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/customers',
          query: listQuery(args),
        }),
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/customers',
          body: withOrg(transport, input, 'org_id'),
        }),
      update: (customerId: string | number, input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'PUT',
          path: `/customers/${customerId}`,
          body: input,
        }),
      remove: (customerIds: number[]) =>
        transport.request<any>({
          method: 'DELETE',
          path: '/customers',
          body: { customerIds },
        }),
    },

    /** a plan a customer actually holds, and everything done to it */
    customerPlans: {
      list: (args?: ListArgs & { filter?: string }) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/customer-plans',
          query: { ...listQuery(args), filter: args?.filter },
        }),
      get: (planId: string | number) =>
        transport.request<any>({
          method: 'GET',
          path: `/customer-plans/${planId}`,
        }),
      /** attach a plan to one or more customers */
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans',
          body: withOrg(transport, input, 'org_ids'),
        }),
      activate: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans/activate',
          body: withOrg(transport, input, 'org_id'),
        }),
      cancel: (planIds: number[]) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans/plans/cancel',
          body: { plan_ids: planIds },
        }),
      changePlan: (input: {
        plan_ids: number[];
        org_customer_plan_id: number;
      }) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans/plans/change-plan',
          body: input,
        }),

      /**
       * Record consumption against a live plan.
       *
       * A 403 here is the plan's own limit refusing the hit with the counter
       * untouched - `HoneystickError.isLimitReached` - so gate the feature on
       * that rather than treating it as a failure. What it costs is the plan's
       * business: usage inside a fixed plan's allowance is already paid for and
       * bills nothing, which is why the response reports `billable_units`
       * separately from `used`.
       */
      trackUsage: (
        planId: string | number,
        input: { feature_id: string; value?: number },
      ) =>
        transport.request<{
          plan_id: number;
          feature_id: string;
          used: number;
          limit: number | null;
          remaining: number | null;
          limit_reached: boolean;
          billable_units?: number;
          charge?: number;
          currency?: string;
        }>({
          method: 'POST',
          path: `/customer-plans/${planId}/track-usage`,
          body: { value: 1, ...input },
        }),
    },
  };
}

export type Resources = ReturnType<typeof createResources>;
