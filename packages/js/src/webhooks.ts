/**
 * Receiving webhooks from Honeystick.
 *
 * The other direction to everything else in this package. `directTransport`
 * calls Honeystick; this verifies a call Honeystick made to you, against an
 * endpoint you registered in the dashboard and the signing secret it gave you.
 *
 * Deliberately not part of the client. Verifying a delivery needs no key, no
 * org and no base URL - it needs the raw bytes and one shared secret - so
 * making it a method on `createHoneystick` would ask a caller to configure a
 * client they never use. It is also the one thing here that must run before
 * anything else has touched the request.
 *
 * ## The one way to get this wrong
 *
 * **Verify the raw body, never a re-serialised object.** The signature covers
 * the exact bytes that were sent, and `JSON.parse` followed by
 * `JSON.stringify` is not a round trip: key order survives, but whitespace does
 * not, unicode escaping does not, and neither does the precision of a number
 * that came in as `1.0`. Every framework adapter in this SDK exists to hand you
 * the bytes before its own JSON middleware eats them.
 */

/**
 * Everything an organization can subscribe an endpoint to.
 *
 * Mirrors ORG_WEBHOOK_EVENT_KEYS on the API. Kept as a literal rather than
 * imported, because this package is published to people who do not have the
 * API's source - but the two do have to be changed together, and a delivery
 * carrying an event that is not in this list is passed through rather than
 * rejected, so an SDK a version behind still works.
 */
export const HONEYSTICK_WEBHOOK_EVENTS = [
  'payment.succeeded',
  'payment.failed',
  'payment.pending',
  'payment.refunded',
  'payment.chargeback',
  'subscription.activated',
  'subscription.cancelled',
  'customer_plan.created',
  'customer_plan.changed',
  'customer_plan.deleted',
  'customer_plan.card_update_requested',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'usage.tracked',
  'usage.limit_reached',
] as const;

export type HoneystickWebhookEventName =
  (typeof HONEYSTICK_WEBHOOK_EVENTS)[number];

/** the headers Honeystick sends with every delivery */
export const HONEYSTICK_WEBHOOK_HEADERS = {
  EVENT: 'honeystick-event',
  DELIVERY: 'honeystick-delivery',
  TIMESTAMP: 'honeystick-timestamp',
  SIGNATURE: 'honeystick-signature',
} as const;

/**
 * A delivery, once it has been proved to have come from Honeystick.
 *
 * `event` is typed as the known names *or* any string. That union is not
 * laziness: the API can start sending an event this package has never heard
 * of, and the honest options are to reject it - dropping a real event because
 * the SDK is old - or to hand it over as-is. A `switch` on the known names
 * still narrows correctly, and the default branch is where the new one lands.
 */
export type HoneystickWebhookEvent = {
  /** stable across retries of the same delivery - use it to deduplicate */
  id: string;
  event: HoneystickWebhookEventName | (string & {});
  created_at: string;
  environment: 'sandbox' | 'live';
  org_id: string;
  data: Record<string, unknown>;
};

export class HoneystickWebhookError extends Error {
  /** what failed, for a handler that wants to answer 400 rather than 401 */
  readonly reason:
    | 'missing_headers'
    | 'bad_timestamp'
    | 'too_old'
    | 'bad_signature'
    | 'malformed_body';

  constructor(reason: HoneystickWebhookError['reason'], message: string) {
    super(message);
    this.name = 'HoneystickWebhookError';
    this.reason = reason;
  }
}

/**
 * Headers as any of the shapes a framework might hand over: a real `Headers`,
 * Node's `IncomingHttpHeaders` (where a repeated header is an array), or a
 * plain object someone built themselves.
 */
export type HeadersLike =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

const headerValue = (headers: HeadersLike, name: string): string | null => {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(n: string): string | null }).get(name);
  }
  const bag = headers as Record<string, string | string[] | undefined>;
  // Node lowercases incoming header names; a hand-built object might not
  const raw = bag[name] ?? bag[name.toLowerCase()] ?? bag[name.toUpperCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
};

/**
 * Web Crypto through globalThis, for the same reason `readEnv` reaches for
 * `process` that way: this package is built without the DOM lib, and it has to
 * run on Node, on Workers and in a browser without any of them being asserted
 * at the type level.
 */
const subtle = () => {
  const webcrypto = (globalThis as { crypto?: { subtle?: SubtleCryptoLike } })
    .crypto?.subtle;
  if (!webcrypto) {
    throw new Error(
      'No Web Crypto available. Honeystick webhook verification needs globalThis.crypto.subtle - Node 18+, a Worker, or a browser.',
    );
  }
  return webcrypto;
};

type SubtleCryptoLike = {
  importKey(
    format: 'raw',
    keyData: Uint8Array,
    algorithm: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: boolean,
    usages: 'sign'[],
  ): Promise<unknown>;
  sign(
    algorithm: 'HMAC',
    key: unknown,
    data: Uint8Array,
  ): Promise<ArrayBuffer>;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * The signature Honeystick would have sent for this timestamp and these bytes.
 *
 * HMAC-SHA256 over `<timestamp>.<body>` rather than over the body alone, which
 * is what stops a delivery being replayable for the life of the secret: with
 * the timestamp inside the signed string it cannot be moved onto a fresh one.
 */
export const signWebhookBody = async (
  secret: string,
  timestamp: number | string,
  body: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await subtle().importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle().sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return `sha256=${toHex(signature)}`;
};

/**
 * Compared byte by byte with no early exit.
 *
 * A `===` on two strings returns as soon as they differ, and the time it took
 * to do that leaks how much of the prefix was right - enough, over many
 * attempts, to build a valid signature one character at a time. The lengths are
 * checked first and separately, which is safe: the length of a SHA-256 hex
 * digest is not a secret.
 */
const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export type VerifyWebhookOptions = {
  /**
   * The **raw** request body, exactly as received. A parsed object is not
   * accepted here on purpose - by the time you have one, the bytes the
   * signature covers are gone.
   */
  body: string;
  headers: HeadersLike;
  /** the endpoint's signing secret, `whsec_...`, from the dashboard */
  secret: string;
  /**
   * How old a delivery may be, in seconds. Default five minutes.
   *
   * This is the half of the scheme that makes replay finite. A captured
   * delivery stays perfectly signed forever; refusing an old timestamp is what
   * stops it being replayed tomorrow. Raise it if your clock drifts, and know
   * that you are widening exactly that window.
   */
  toleranceSeconds?: number;
};

/**
 * Proves a delivery came from Honeystick, and returns it typed.
 *
 * Throws `HoneystickWebhookError` if it did not. Answer 400 to that and *do not
 * retry the sender* - a bad signature is not a transient fault, and Honeystick
 * treats a 4xx as final for exactly that reason.
 *
 * ```ts
 * const event = await verifyWebhook({
 *   body: await request.text(),
 *   headers: request.headers,
 *   secret: process.env.HONEYSTICK_WEBHOOK_SECRET!,
 * });
 * ```
 */
export async function verifyWebhook({
  body,
  headers,
  secret,
  toleranceSeconds = 300,
}: VerifyWebhookOptions): Promise<HoneystickWebhookEvent> {
  const timestamp = headerValue(headers, HONEYSTICK_WEBHOOK_HEADERS.TIMESTAMP);
  const signature = headerValue(headers, HONEYSTICK_WEBHOOK_HEADERS.SIGNATURE);

  if (!timestamp || !signature) {
    throw new HoneystickWebhookError(
      'missing_headers',
      `A Honeystick delivery carries ${HONEYSTICK_WEBHOOK_HEADERS.TIMESTAMP} and ${HONEYSTICK_WEBHOOK_HEADERS.SIGNATURE}; this request had neither or only one.`,
    );
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    throw new HoneystickWebhookError(
      'bad_timestamp',
      `${HONEYSTICK_WEBHOOK_HEADERS.TIMESTAMP} was '${timestamp}', which is not unix seconds.`,
    );
  }

  const age = Math.abs(Date.now() / 1000 - sentAt);
  if (age > toleranceSeconds) {
    throw new HoneystickWebhookError(
      'too_old',
      `This delivery is ${Math.round(age)}s old and the tolerance is ${toleranceSeconds}s. Either it is a replay, or this machine's clock disagrees with ours.`,
    );
  }

  const expected = await signWebhookBody(secret, timestamp, body);
  if (!timingSafeEqual(expected, signature)) {
    throw new HoneystickWebhookError(
      'bad_signature',
      'The signature does not match. Check the endpoint secret, and check that the body was not parsed and re-serialised before it reached here.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new HoneystickWebhookError(
      'malformed_body',
      'The signature verified but the body is not JSON.',
    );
  }

  return parsed as HoneystickWebhookEvent;
}

/** whether an event name is one this version of the SDK knows about */
export const isKnownWebhookEvent = (
  event: string,
): event is HoneystickWebhookEventName =>
  (HONEYSTICK_WEBHOOK_EVENTS as readonly string[]).includes(event);
