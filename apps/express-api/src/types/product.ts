import { z } from "zod";

export const zProductSchema = z.object({
  id: z.number(),
  /**
   * The identifier the store chose and Honeystick preserves.
   *
   * `id` is Honeystick's own row id and would change if the catalogue were
   * rebuilt, so anything that has to survive - the cart, the order snapshot,
   * repricing at checkout - keys on this instead.
   */
  ext_id: z.string(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  /**
   * Artwork the store serves itself, as a path into /public.
   *
   * Not a URL: the shop window is the store's own, so every image is a file in
   * this repo. Saying so here is what keeps an off-site image out - next/image
   * refuses any host that is not listed in next.config, and the first thing it
   * is refused by is a crash on the page rather than a missing picture.
   */
  image: z.string().startsWith('/', 'Artwork must be served by the store'),
  /**
   * How many are left, as the catalogue last saw it.
   *
   * A starting figure rather than the truth. Stock is a metered Honeystick
   * feature - `stock:<ext_id>` - so what is actually left is whatever that
   * feature's balance says, and the client reads it with `check` rather than
   * from here. This is what a server render shows before the customer's plan
   * has loaded, and what a live organization that meters nothing falls back to.
   */
  stock: z.number(),
  /**
   * Reviews, and only reviews.
   *
   * `count` used to double as stock on hand, which made the shop floor read
   * from a field named after something else and put the number out of reach of
   * the metering that now owns it.
   */
  rating: z.object({
    rate: z.number(),
    count: z.number()
  })
})

export type zProductType = z.infer<typeof zProductSchema>