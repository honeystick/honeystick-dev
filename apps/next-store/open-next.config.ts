import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * The Depot, as a Cloudflare Worker.
 *
 * A static export was never an option here and it is worth saying why, because
 * it is the first thing anyone reaches for: the shop floor is a server
 * component that reads the catalogue with the secret key, checkout and
 * subscribe are server actions, and /api/billing is a route handler. All three
 * need a server at request time. OpenNext gives them one on Workers.
 *
 * No incremental cache is configured. Every page here is already dynamic - the
 * shop floor reads `searchParams`, the completion page reads the provider's
 * redirect - so there is nothing that would be served from a cache, and adding
 * a KV binding would be config that never runs. The one consequence worth
 * knowing is that `revalidatePath` in the reset action has nothing to
 * invalidate; the reset works because the client calls `router.refresh()`
 * immediately after, which re-runs the render.
 */
export default defineCloudflareConfig({});
