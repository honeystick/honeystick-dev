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
   * Seats left on this subscription, metered as `seats:<ext_id>`.
   *
   * Same arrangement as a product's stock: a starting figure for the first
   * paint, with `check` owning what is actually left. Null when the service is
   * not seat-limited at all, which is not the same as being sold out.
   */
  seats: z.number().nullable(),
});

export type zServiceType = z.infer<typeof zServiceSchema>;
