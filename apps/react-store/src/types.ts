import { z } from 'zod';

/**
 * What the store's own API answers with.
 *
 * Validated rather than asserted. A single-page app is long-lived in a way a
 * server render is not - a tab left open across a deploy is running yesterday's
 * bundle against today's API - and the failure without a schema here is a crash
 * inside a render rather than a message anyone can act on.
 *
 * The same shapes as the Expo and React Native stores, because it is the same
 * `/api/storefront`. Duplicated rather than shared because each sample is meant
 * to be readable on its own: a reader should be able to open one app and see
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
