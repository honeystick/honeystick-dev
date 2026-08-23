import type { Query, Transport } from './transport.js';

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

/** the plan kinds Honeystick distinguishes, as `plan_type` reports them */
export type PlanType = 'subscription' | 'one-off' | 'one-time-payment';

/**
 * Who a checkout is for, named however the caller already knows them.
 *
 * The reason this type exists rather than a bare customer id: a store does not
 * hold Honeystick's row ids. It holds an email address and its own user id, so
 * every checkout used to need a `POST /customers` first to turn one into the
 * other - and that call writes unconditionally, which is how a returning
 * shopper becomes a second customer and their plans end up spread across both.
 *
 * Any one of the three identifies a person, tried in that order of confidence:
 * `id` is the row itself, `ext_id` is your own key for them, and `email` is the
 * address. Nobody matching an email is not an error - the customer is
 * registered from it, so a first-time shopper buys in a single call. An
 * `ext_id` that matches nobody *is* an error, because an id you invented says
 * nothing about a person worth opening a record from.
 *
 * `name` is read only when the customer is being written for the first time. It
 * never overwrites the name an existing customer already has, so a stale copy
 * in your checkout form cannot walk back over one they corrected themselves.
 */
export type CustomerRef = {
  id?: number;
  email?: string;
  /** your own key for this person - `external_id` on the customer record */
  ext_id?: string;
  name?: string;
};

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

/**
 * Where the payment provider sends the customer afterwards, and where
 * Honeystick reports back to.
 *
 * Configured on the client and carried from there, because they are the app's
 * own pages rather than anything about this purchase. A call that names any of
 * them wins - an order confirmation page usually has to.
 *
 * `notify_url` is the odd one out and worth separating in your head. The other
 * two are where the *customer* goes; this is where your *server* is told. They
 * are not the same event: a customer who closes the payment page never reaches
 * the return url, and one who does reach it may still be a payment that has not
 * cleared. Only the notification is evidence.
 *
 * Omitted entirely when unset, rather than sent empty - which is what lets the
 * far side treat its absence as "this caller does not want to be told" instead
 * of having to distinguish an empty string from a missing field.
 */
const withUrls = <T extends Record<string, unknown>>(
  transport: Transport,
  input: T,
) => ({
  ...(transport.returnUrl ? { return_url: transport.returnUrl } : {}),
  ...(transport.cancelUrl ? { cancel_url: transport.cancelUrl } : {}),
  ...(transport.notifyUrl ? { notify_url: transport.notifyUrl } : {}),
  ...input,
});

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
      /**
       * Registers a customer, or hands back the one these details already
       * describe.
       *
       * Matched on `external_id` first and then on email, so calling this twice
       * for the same person does not make two of them. A match is never
       * overwritten with what you sent - a store repeating its checkout payload
       * is not asserting anything new about the person - but blank columns are
       * filled, which is how a customer first written from an email alone picks
       * up your `external_id` and starts matching on the stronger key.
       *
       * Worth knowing that you may not need this at all: `customerPlans.checkout`
       * takes a `customers` list naming people by email, does this resolution
       * itself, and saves the round trip.
       */
      create: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/customers',
          body: withOrg(transport, input, 'org_id'),
        }),
      get: (customerId: string | number) =>
        transport.request<any>({
          method: 'GET',
          path: `/customers/${customerId}`,
        }),
      update: (customerId: string | number, input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'PUT',
          path: `/customers/${customerId}`,
          body: input,
        }),
      remove: (customerIds: number[]) =>
        transport.request<{ success: boolean }>({
          method: 'DELETE',
          path: '/customers',
          body: { org_customer_ids: customerIds },
        }),
    },

    /** a plan a customer actually holds, and everything done to it */
    customerPlans: {
      /**
       * The plans this organization holds, newest first.
       *
       * `planType` is the API's own name for the narrowing, and it is worth
       * getting right rather than approximately right: an unknown query
       * parameter is dropped silently, so a misspelling does not fail - it
       * quietly returns everything and hands a store the receipt for the last
       * T-shirt somebody bought when it asked for their subscription.
       *
       * `from` and `to` are YYYY-MM-DD on the day the plan was created, both
       * ends inclusive. Cancelled plans are left out of the list entirely; read
       * one by its id to see it.
       */
      list: (
        args?: ListArgs & {
          planType?: PlanType;
          /** YYYY-MM-DD, inclusive */
          from?: string;
          /** YYYY-MM-DD, inclusive */
          to?: string;
        },
      ) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: '/customer-plans',
          query: {
            ...listQuery(args),
            planType: args?.planType,
            from: args?.from,
            to: args?.to,
          },
        }),
      get: (planId: string | number) =>
        transport.request<any>({
          method: 'GET',
          path: `/customer-plans/${planId}`,
        }),
      /**
       * Attach a plan to one or more customers.
       *
       * Answers with the ids it created, not with the plans - `create` takes a
       * list of customers and makes one plan per customer, so there is no single
       * record to hand back. Typed rather than left loose because the shape is
       * the easy thing to guess wrong: reaching for `.id` compiles, returns
       * undefined at runtime, and surfaces as the plan silently failing to be
       * created.
       *
       * Read the id you want out of `org_customer_plan_ids`; for one customer
       * that is `[0]`.
       */
      create: (input: Record<string, unknown>) =>
        transport.request<{
          org_customer_plan_ids: number[];
          rules_created: number;
        }>({
          method: 'POST',
          path: '/customer-plans',
          body: withOrg(transport, input, 'org_ids'),
        }),
      activate: (input: Record<string, unknown>) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans/activate',
          body: withUrls(transport, input),
        }),
      /**
       * Create the plan and get the payment provider's checkout back, in one
       * call. The terms are `create`'s; `redirect_url` in the response is where
       * to send the customer now.
       *
       * Where they come back to is the client's `returnUrl` and `cancelUrl` -
       * they are your app's pages and the same two every time, so they are
       * configured once rather than repeated at every call. Passing either here
       * overrides it, for a landing page that is specific to this order.
       */
      checkout: (
        input: Record<string, unknown> & {
          /**
           * Who is buying, named by id, ext_id or email.
           *
           * The alternative is `org_customer_ids`, which needs Honeystick's own
           * row ids and therefore needs a `POST /customers` first. Naming an
           * email here collapses that into this one call and - unlike creating
           * a customer - matches an existing person instead of writing a second
           * copy of them.
           */
          customers?: CustomerRef[];
        },
      ) =>
        transport.request<{
          /**
           * Who the checkout resolved to, in the order they were named. A
           * caller who sent only an email learns the id here and can hold on to
           * it rather than resolving again.
           */
          org_customer_ids: number[];
          org_customer_plan_ids: number[];
          rules_created: number;
          redirect_url: string;
        }>({
          method: 'POST',
          path: '/customer-plans/checkout',
          body: withUrls(transport, input),
        }),
      /**
       * Ends these plans, in bulk. One intention, two outcomes decided per plan
       * rather than by the caller: a running subscription is cancelled at the
       * payment provider and keeps its row, its transactions and its usage
       * ledger, while a plan that never started is removed outright - there is
       * nothing at the provider to stop and no history to preserve.
       *
       * Which of the two happened is *not* in this answer - `succeeded` is a
       * list of ids and nothing more. When that matters, and for one plan it
       * usually does, use `cancelPlan` below: it reports `removed`, and a
       * caller holding an id that has stopped resolving needs to be told rather
       * than discovering it as a 404 on the next read.
       *
       * `scheduleAt` books it for a date instead of doing it now, and those
       * come back under `scheduled` rather than `succeeded` - a plan booked to
       * end on Friday has not ended.
       */
      cancel: (planIds: number[], args?: { scheduleAt?: string }) =>
        transport.request<{
          succeeded: number[];
          failed: { org_customer_plan_id: number; error: string }[];
          scheduled: {
            org_customer_plan_id: number;
            schedule_id: number;
            scheduled_at: string;
            executor: string;
          }[];
        }>({
          method: 'POST',
          path: '/customer-plans/plans/cancel',
          body: {
            org_customer_plan_ids: planIds,
            ...(args?.scheduleAt ? { schedule_at: args.scheduleAt } : {}),
          },
        }),
      /**
       * Ends one plan, and says which of the two things it did.
       *
       * The same operation as `cancel` for a single id, on the endpoint that
       * answers in detail. `removed: true` means the plan never started and was
       * deleted rather than cancelled - the id no longer resolves, so a screen
       * that re-reads it to confirm the cancellation lands on a 404 and looks
       * like the cancellation failed.
       *
       * `status` is what the plan ended up on, and `scheduled_at` is set
       * instead when `scheduleAt` booked it for later.
       */
      cancelPlan: (planId: string | number, args?: { scheduleAt?: string }) =>
        transport.request<{
          org_customer_plan_id: number | null;
          status: string;
          schedule_id: number | null;
          scheduled_at: string | null;
          /** the plan was deleted rather than cancelled - the id is now gone */
          removed?: boolean | null;
        }>({
          method: 'POST',
          path: `/customers/plans/${planId}/cancel`,
          body: args?.scheduleAt ? { schedule_at: args.scheduleAt } : {},
        }),
      /**
       * Moves these customer plans onto a different catalogue plan.
       *
       * `orgPlanId` is a plan template's id - the thing `plans.list()` returns -
       * not another customer plan. The two are easy to confuse and the API
       * cannot tell them apart for you: both are numbers.
       */
      changePlan: (input: {
        planIds: number[];
        orgPlanId: number;
        scheduleAt?: string;
      }) =>
        transport.request<any>({
          method: 'POST',
          path: '/customer-plans/plans/change-plan',
          body: {
            org_customer_plan_ids: input.planIds,
            org_plan_id: input.orgPlanId,
            ...(input.scheduleAt ? { schedule_at: input.scheduleAt } : {}),
          },
        }),
      /** calls off a cancellation or plan change that was booked for a date */
      cancelSchedule: (scheduleIds: number[]) =>
        transport.request<{
          succeeded: number[];
          failed: { schedule_id: number; error: string }[];
        }>({
          method: 'POST',
          path: '/customer-plans/plans/schedules/cancel',
          body: { schedule_ids: scheduleIds },
        }),
      /**
       * Deletes plans that never started - the narrowest possible delete, and
       * deliberately so.
       *
       * Cancelling is how a plan with a history ends; the row survives it. This
       * is for the other case: a plan attached by mistake, never paid, that
       * would otherwise sit in the list forever because there is nothing about
       * it to cancel. Each id is judged on its own and refusals come back per
       * plan, so a batch is never all-or-nothing.
       */
      remove: (planIds: number[]) =>
        transport.request<{
          deleted: number[];
          failed: { org_customer_plan_id: number; error: string }[];
        }>({
          method: 'DELETE',
          path: '/customer-plans',
          body: { org_customer_plan_ids: planIds },
        }),

      /**
       * A page at the payment provider where the customer replaces the card
       * this subscription bills.
       *
       * Answers with a URL to send them to, not a card form - the card is never
       * seen by your app or by Honeystick, which is the only arrangement a
       * payment provider will bless. Send them to it the same way you send them
       * to a checkout: a redirect on the web, a system browser on native.
       *
       * Only a subscription has a card to update, and only one that has
       * actually been paid for - the provider issues the token at the first
       * successful payment. A plan still waiting on its first payment answers
       * 400, which is a real state a shopper can be in: they subscribed, backed
       * out of the payment page, and are now looking at this button.
       */
      updateCard: (planId: string | number) =>
        transport.request<{ url: string }>({
          method: 'POST',
          path: `/customers/plans/${planId}/update-card`,
          body: {},
        }),

      /** what has actually been billed against one plan, newest first */
      transactions: (planId: string | number, args?: ListArgs) =>
        transport.request<Paged<any>>({
          method: 'GET',
          path: `/customers/plans/${planId}/transactions`,
          query: listQuery(args),
        }),

      /**
       * Record consumption against a live plan.
       *
       * The feature is named by the `ext_id` the organization gave it, not by a
       * row id - `feature_ext_id`, which is what the API asks for. Getting that
       * name wrong is not a soft failure: the request is rejected at the schema
       * before anything is counted, and the 400 says only that a string was
       * expected.
       *
       * A 403 here is the plan's own limit refusing the hit with the counter
       * untouched - `HoneystickError.isLimitReached` - so gate the feature on
       * that rather than treating it as a failure. What it costs is the plan's
       * business: usage inside a fixed plan's allowance is already paid for and
       * bills nothing, which is why the response reports `billable_units`
       * separately from `used`.
       *
       * `value` may be negative - that is how consumption is handed back - but
       * never zero, which the API refuses as a call that means nothing.
       */
      trackUsage: (
        planId: string | number,
        input: { feature_ext_id: string; value?: number },
      ) =>
        transport.request<{
          org_customer_plan_id: number;
          feature_ext_id: string;
          used: number;
          limit?: number | null;
          remaining?: number | null;
          limit_reached: boolean;
          /** units past the allowance - counted, never priced */
          billable_units?: number | null;
        }>({
          method: 'POST',
          path: `/customer-plans/${planId}/track-usage`,
          body: { value: 1, ...input },
        }),
    },
  };
}

export type Resources = ReturnType<typeof createResources>;
