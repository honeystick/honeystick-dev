import { honeystickHandler } from '@honeystick/next';

import { DUMMY_PLANS } from '@/lib/catalogue/plans';

/**
 * Honeystick, mounted on the store's own origin.
 *
 * Everything under /api/billing is forwarded to Honeystick with the secret
 * key attached, so the browser talks to this route and never to Honeystick
 * directly. In Next that matters more than usual: anything a client component
 * can import is bundled and served, so a key used in the browser is a
 * published key.
 *
 * `pathPrefix` has to name where the route actually lives. A Next route
 * handler is given the full pathname with nothing stripped, unlike Express,
 * so the default '/billing' would not match.
 */
const configured = !!process.env.HONEYSTICK_SECRET_KEY;

const live = configured
  ? honeystickHandler({
      // No orgId: the secret key is a token that already carries the claim of
      // which organization it belongs to, so naming one here would at best
      // restate what the token says and at worst contradict it.
      secretKey: process.env.HONEYSTICK_SECRET_KEY,
      pathPrefix: '/api/billing',
      // Whoever the store considers signed in. Honeystick Example App has no accounts yet,
      // so every visitor is the same guest customer - replace this with a real
      // session lookup and the rest of the integration is unchanged.
      identify: () => ({ customerId: 'guest' }),
    })
  : null;

/**
 * Without keys the store still has to work - someone who has just cloned it
 * has no organization yet. The fixtures are served in the same envelope the
 * handler uses, so client code cannot tell the difference and nothing has to
 * be rewritten when real keys arrive.
 */
const fallback = async (request: Request): Promise<Response> => {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith('/plans')) {
    return Response.json(
      { ok: true, status: 200, body: { data: DUMMY_PLANS } },
      { status: 200 },
    );
  }

  return Response.json(
    {
      ok: false,
      status: 501,
      error:
        'This store is running on sample data. Set HONEYSTICK_SECRET_KEY to reach Honeystick.',
    },
    { status: 501 },
  );
};

export const GET = live ? live.GET : fallback;
export const POST = live ? live.POST : fallback;
