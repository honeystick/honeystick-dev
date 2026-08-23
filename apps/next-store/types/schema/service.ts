import { z } from "zod";

/**
 * A service is a subscription: something billed again on a cycle rather than
 * bought once.
 *
 * Kept apart from zProductSchema rather than bolted onto it, because the two
 * behave differently everywhere it matters. A product goes in the cart and is
 * priced by quantity; a service has no quantity, cannot be added to a basket
 * alongside goods, and carries a `frequency` that is the whole reason it is a
 * subscription at all.
 */
export const zServiceSchema = z.object({
  id: z.number(),
  /**
   * The identifier the store chose and Honeystick preserves. The subscribe
   * action takes this and nothing else about the price - see
   * lib/services/actions.ts.
   */
  ext_id: z.string(),
  title: z.string(),
  description: z.string(),
  /** what it costs per cycle */
  price: z.number(),
  /** Honeystick's own `plan_frequency` - 'month', 'year' */
  frequency: z.string(),
  /**
   * A path under /public. Deliberately not z.url(): the store's artwork is
   * served from its own origin, and a relative path is not a URL.
   */
  image: z.string(),
  category: z.string(),
  /** what the shopper is actually buying, itemised for the detail drawer */
  benefits: z.array(z.string()),
  /**
   * The features this subscription meters, and what it allows of each.
   *
   * The store's half of a usage plan. Honeystick owns the counter and the rule
   * that caps it; which of an organization's features a given subscription
   * includes, and how much of them, is the shop's own product decision - the
   * same argument that keeps the artwork here rather than in the billing
   * system.
   *
   * `ext_id` names a feature the organization has already created. One that
   * does not exist is skipped rather than invented, so an org that has not set
   * its features up yet sells a subscription with no meters instead of failing
   * to sell one at all.
   */
  metered: z.array(
    z.object({
      ext_id: z.string(),
      name: z.string(),
      /** how many units per interval; the account page reads this back as the limit */
      limit: z.number(),
      interval: z.enum(['day', 'week', 'month', 'year', 'none']),
    }),
  ),
  /**
   * Seats left on this subscription, metered as `seats:<ext_id>`.
   *
   * Same arrangement as a product's stock: a starting figure for the first
   * paint, with `check` owning what is actually left. Null when the service is
   * not seat-limited at all, which is not the same as being sold out.
   */
  seats: z.number().nullable(),
});

export type zServiceType = z.infer<typeof zServiceSchema>;
