import { resetDemo } from '@/lib/demo/actions';

/**
 * The reset, over HTTP.
 *
 * The button on each page calls the server action directly; this exists for
 * everything that cannot - the Playwright suite most of all. Stock is metered
 * and forward-only, so a spec that adds three daypacks leaves three fewer for
 * the next spec, and a suite whose fifth test fails because of what its second
 * test bought is a suite that fails differently every time it is reordered.
 *
 * Deliberately outside /api/billing. That route is the Honeystick handler and
 * everything under it is forwarded to the real API when a key is set; a reset
 * is the demo's own idea and has no business being proxied anywhere.
 */
export async function POST(): Promise<Response> {
  const result = await resetDemo();
  return Response.json(result, { status: 200 });
}
