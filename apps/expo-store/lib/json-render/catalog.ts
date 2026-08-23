import { defineCatalog } from '@json-render/core';
import {
  standardActionDefinitions,
  standardComponentDefinitions,
} from '@json-render/react-native/catalog';
import { schema } from '@json-render/react-native/schema';
import { z } from 'zod';

/**
 * What a spec is allowed to say.
 *
 * The customer-plan screen is rendered from JSON rather than from a hand-written
 * component tree, and this is the vocabulary that JSON draws on. The reason is
 * the shape of the thing being rendered: a customer plan carries its customer,
 * its rules, its rewards, its transactions, its scheduled changes and its usage,
 * and which of those matter changes with the plan. A screen built around the
 * fields we care about today goes blind the moment the API returns a new one.
 * A screen built from a spec grows a row instead.
 *
 * Only the standard components are registered. Every one of them is implemented
 * by @json-render/react-native already, so there is no custom renderer to keep
 * in step - and a Card with a Label and two Buttons is genuinely all this screen
 * needs.
 */
export const catalog = defineCatalog(schema, {
  components: standardComponentDefinitions,
  actions: {
    ...standardActionDefinitions,

    /**
     * Record consumption against the loaded plan.
     *
     * The handler is wired to `useCustomer().track` in the screen, so this is
     * the SDK doing real work: a POST to
     * /customer-plans/:id/track-usage through /billing, with the key attached on
     * the server. `featureId` is the feature's `ext_id` - the only name the API
     * knows a feature by.
     */
    trackUsage: {
      params: z.object({
        featureId: z.string(),
        /**
         * Units. Negative hands consumption back, which the API allows; zero it
         * refuses outright as a call that means nothing, so no button ever sends
         * one.
         */
        value: z.number(),
      }),
      description:
        'Record consumption of a metered feature against the customer plan. Negative gives it back; zero is refused.',
    },

    /** re-read the plan, for a pull-to-refresh equivalent inside the spec */
    refreshCustomer: {
      params: z.object({}),
      description: 'Re-read the customer plan from Honeystick.',
    },
  },
});

export type Catalog = typeof catalog;
