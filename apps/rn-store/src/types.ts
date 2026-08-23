import { z } from 'zod';

/**
 * What the store's own API answers with.
 *
 * Validated rather than asserted, and for a sharper reason on native than on
 * the web: an app is installed, and the copy on someone's phone goes on running
 * against whatever the server has become. A response shape that changed last
 * Tuesday reaches a build from March, and the failure without a schema here is
 * a crash inside a render rather than a message anyone can act on.
 *
 * These mirror the Expo store's `types/product.ts` and `types/service.ts`
 * exactly. They are duplicated rather than shared because each sample is meant
 * to be readable on its own - a reader should be able to open one app and see
 * the whole integration, not follow it into a package.
 */

export const zProductSchema = z.object({
  id: z.number(),
  ext_id: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  image: z.string(),
  category: z.string(),
  rating: z.object({ rate: z.number(), count: z.number() }),
  stock: z.number(),
});

export type Product = z.infer<typeof zProductSchema>;

export const zServiceSchema = z.object({
  id: z.number(),
  ext_id: z.string(),
  title: z.string(),
  description: z.string(),
  /** what it costs per cycle */
  price: z.number(),
  /** Honeystick's own `plan_frequency` - 'month', 'year' */
  frequency: z.string(),
  image: z.string(),
  category: z.string(),
  benefits: z.array(z.string()),
  /** the features this subscription meters, and what it allows of each */
  metered: z.array(
    z.object({
      ext_id: z.string(),
      name: z.string(),
      limit: z.number(),
      interval: z.enum(['day', 'week', 'month', 'year', 'none']),
    }),
  ),
  /** null when the service is not seat-limited, which is not "sold out" */
  seats: z.number().nullable(),
});

export type Service = z.infer<typeof zServiceSchema>;

export const zStorefrontSchema = z.object({
  products: z.array(zProductSchema),
  services: z.array(zServiceSchema),
});

export type Storefront = z.infer<typeof zStorefrontSchema>;
