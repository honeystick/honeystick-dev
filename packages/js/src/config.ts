/**
 * Two keys, kept apart on purpose.
 *
 * A secret key can do anything the organization can, so it never leaves a
 * server: it lives in `createHoneystick` and in the framework adapters. A
 * publishable key is safe in a browser or an app bundle, and on its own it can
 * only reach a Honeystick handler mounted on the caller's own server.
 *
 * The environment is not something a caller gets to assert per request - it
 * decides which Honeystick deployment answers, and therefore whether real
 * money moves. It is fixed when the client is created, from the key's own
 * environment or an explicit option, and travels as a header so the server can
 * refuse a key that does not belong to it.
 */
export type Environment = 'sandbox' | 'live';

export const ENVIRONMENTS: Environment[] = ['sandbox', 'live'];

/** Where each environment lives. Override with `baseUrl` for local work. */
export const API_URLS: Record<Environment, string> = {
  sandbox: 'https://sandbox.api.honeystick.co.za',
  live: 'https://api.honeystick.co.za',
};

export const API_VERSION = 'v1';

/** the route an adapter mounts on by default, on the caller's own server */
export const DEFAULT_PATH_PREFIX = '/billing';

export type KeyKind = 'secret' | 'publishable';

const KEY_PREFIXES: Record<KeyKind, string> = {
  secret: 'hs_sk_',
  publishable: 'hs_pk_',
};

export type ParsedKey = {
  kind: KeyKind;
  /** null when the key carries no environment of its own */
  environment: Environment | null;
};

/**
 * Reads what a key says about itself: `hs_sk_live_…` is a live secret key,
 * `hs_pk_sandbox_…` a sandbox publishable one.
 *
 * Keys minted before this convention carry no environment, so this returns
 * null for it rather than guessing - the caller's explicit option decides, and
 * the server has the final say either way.
 */
export function parseKey(key: string): ParsedKey | null {
  for (const [kind, prefix] of Object.entries(KEY_PREFIXES) as [
    KeyKind,
    string,
  ][]) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const environment = ENVIRONMENTS.find((candidate) =>
      rest.startsWith(`${candidate}_`),
    );
    return { kind, environment: environment ?? null };
  }
  return null;
}

/**
 * Environment variables where there are any. Reached through globalThis rather
 * than `process` directly: this package runs in browsers and on native, where
 * `process` does not exist and @types/node has no business being a dependency.
 */
const readEnv = (name: string) =>
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];

export type ClientOptions = {
  /** server only - never ship this to a browser or an app bundle */
  secretKey?: string;
  /** safe to ship; only reaches a mounted Honeystick handler */
  publishableKey?: string;
  /** the organization every call is made on behalf of */
  orgId?: string;
  environment?: Environment;
  /** full origin override, for local servers and self-hosting */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type ResolvedConfig = {
  key: string | null;
  keyKind: KeyKind | null;
  orgId: string | null;
  environment: Environment;
  /** origin + version, ready for a path to be appended */
  apiUrl: string;
  fetch: typeof globalThis.fetch;
};

export class HoneystickConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HoneystickConfigError';
  }
}

export function resolveConfig(options: ClientOptions = {}): ResolvedConfig {
  const key =
    options.secretKey ??
    options.publishableKey ??
    readEnv('HONEYSTICK_SECRET_KEY') ??
    readEnv('HONEYSTICK_PUBLISHABLE_KEY') ??
    null;

  const parsed = key ? parseKey(key) : null;
  const keyKind =
    parsed?.kind ??
    (options.secretKey || readEnv('HONEYSTICK_SECRET_KEY')
      ? 'secret'
      : options.publishableKey || readEnv('HONEYSTICK_PUBLISHABLE_KEY')
        ? 'publishable'
        : null);

  const requested =
    options.environment ?? (readEnv('HONEYSTICK_ENVIRONMENT') as Environment);

  // A key that names its own environment wins over an option that disagrees
  // with it: the mismatch is a mistake either way, and honouring the key means
  // a test key can never be pointed at live data by a stray config value.
  if (
    parsed?.environment &&
    requested &&
    parsed.environment !== requested &&
    ENVIRONMENTS.includes(requested)
  ) {
    throw new HoneystickConfigError(
      `This is a ${parsed.environment} key but environment was set to '${requested}'. Use the key that belongs to the environment you mean.`,
    );
  }

  const environment: Environment =
    parsed?.environment ??
    (ENVIRONMENTS.includes(requested) ? requested : 'sandbox');

  const origin =
    options.baseUrl ?? readEnv('HONEYSTICK_BASE_URL') ?? API_URLS[environment];

  return {
    key,
    keyKind,
    orgId: options.orgId ?? readEnv('HONEYSTICK_ORG_ID') ?? null,
    environment,
    apiUrl: `${origin.replace(/\/+$/, '')}/api/${API_VERSION}`,
    fetch: options.fetch ?? globalThis.fetch?.bind(globalThis),
  };
}
