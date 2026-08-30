/**
 * Two keys, kept apart on purpose.
 *
 * A secret key can do anything the organization can, so it never leaves a
 * server: it lives in `createHoneystick` and in the framework adapters. A
 * publishable key is safe in a browser or an app bundle, and on its own it can
 * only reach a Honeystick handler mounted on the caller's own server.
 *
 * The environment is not something a caller gets to assert per request - it
 * decides which Honeystick API answers, and therefore whether real money moves.
 * It is fixed when the client is created, from the key's own environment or an
 * explicit option, and the key is checked against it: a `live` key with
 * `environment: 'sandbox'` is a mistake worth refusing rather than resolving.
 *
 * Only a *server* client turns this into a URL. A browser or app client holds
 * no key and never reaches the Honeystick API at all - it calls a handler
 * mounted on its own server - so for that half the environment is a statement
 * of intent, and the server it talks to has the final say.
 */
export type Environment = 'sandbox' | 'live';

export const ENVIRONMENTS: Environment[] = ['sandbox', 'live'];

/**
 * Which estate of Honeystick answers - ours or the one customers use.
 *
 * The second axis, and orthogonal to `Environment`. Four API servers run at
 * once: `production` is what every customer talks to, `dev` is Honeystick's own
 * internal deployment, and each of the two runs a `sandbox` and a `live`.
 *
 * Nobody outside Honeystick should ever set this. It exists so that internal
 * work can point at dev-sandbox without editing a URL by hand, and it defaults
 * to `production` so that leaving it alone is always the customer's answer.
 */
export type Deployment = 'production' | 'dev';

export const DEPLOYMENTS: Deployment[] = ['production', 'dev'];

/**
 * Where each environment lives, on the deployment customers use.
 *
 * These are the two hostnames that matter to anyone integrating: `sandbox`
 * moves no money, `live` does. Override either with `baseUrl`, or with
 * HONEYSTICK_URL in the environment, to point at a local API.
 */
export const API_URLS: Record<Environment, string> = {
  sandbox: 'https://sandbox.honeystick.co.za',
  live: 'https://live.honeystick.co.za',
};

/**
 * The same two, on Honeystick's internal deployment.
 *
 * Reached with `deployment: 'dev'` or HONEYSTICK_DEPLOYMENT=dev, and of no use
 * to anyone who does not have keys minted against it.
 */
export const DEV_API_URLS: Record<Environment, string> = {
  sandbox: 'https://dev-sandbox.honeystick.co.za',
  live: 'https://dev-live.honeystick.co.za',
};

/**
 * The origin the two axes resolve to, with no key or options involved.
 *
 * Exported because "which API am I actually calling?" is the first question
 * asked when a deployed handler starts answering 530s, and computing it from
 * the two maps by hand is exactly how the wrong answer gets written down.
 */
export const apiOrigin = (
  environment: Environment,
  deployment: Deployment = 'production',
): string =>
  (deployment === 'dev' ? DEV_API_URLS : API_URLS)[environment];

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
  /**
   * Which Honeystick estate to call: `production` (the default, and the only
   * one customers have keys for) or `dev`, Honeystick's own.
   *
   * Server-side only in any meaningful sense - it decides a hostname, and only
   * a server client ever calls that hostname. Also settable as
   * HONEYSTICK_DEPLOYMENT.
   */
  deployment?: Deployment;
  /**
   * Full origin override, for local servers and self-hosting. Wins over both
   * `environment` and `deployment`, which are only a way of *choosing* one of
   * the four hosted origins - name one directly and neither is consulted.
   */
  baseUrl?: string;
  /**
   * Where a payment provider sends the customer when they are done, and where
   * it sends them if they back out.
   *
   * These belong to your app, not to a billing call: they are your pages, and
   * the same two every time. Set them once on the client - or as
   * HONEYSTICK_RETURN_URL and HONEYSTICK_CANCEL_URL - and `checkout` carries
   * them for you. A call that names its own still wins, which is what an
   * order-specific landing page needs.
   */
  returnUrl?: string;
  cancelUrl?: string;
  /**
   * Where Honeystick should tell you a payment settled.
   *
   * The third of the same family, and the one that arrives without anybody
   * asking. `returnUrl` and `cancelUrl` are where the *customer* is sent; this
   * is where your *server* is told - which matters because the two are not the
   * same event. A customer who closes the payment page never reaches the return
   * url, and one who reaches it may still be a payment that has not cleared.
   * Only the notification says a payment happened.
   *
   * Set it and the SDK carries it through checkout, exactly as it carries the
   * other two, and Honeystick posts to it once the provider confirms. Leave it
   * unset and nothing is sent - the flow is unchanged, you simply have to go
   * looking rather than being told.
   *
   * Your own origin, and reachable from the internet: this is a server-to-server
   * call, so localhost only works if something is tunnelling to it.
   */
  notifyUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type ResolvedConfig = {
  key: string | null;
  keyKind: KeyKind | null;
  orgId: string | null;
  environment: Environment;
  deployment: Deployment;
  /** origin + version, ready for a path to be appended */
  apiUrl: string;
  returnUrl: string | null;
  cancelUrl: string | null;
  notifyUrl: string | null;
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

  /**
   * Unrecognised values fall back rather than throw, which is the same
   * treatment `environment` gets above and is the safe direction here: the
   * fallback is `production`, so a typo can only ever send you somewhere a
   * customer key already works, never quietly onto Honeystick's internal
   * deployment.
   */
  const requestedDeployment =
    options.deployment ?? (readEnv('HONEYSTICK_DEPLOYMENT') as Deployment);
  const deployment: Deployment = DEPLOYMENTS.includes(requestedDeployment)
    ? requestedDeployment
    : 'production';

  const origin =
    options.baseUrl ??
    readEnv('HONEYSTICK_URL') ??
    apiOrigin(environment, deployment);

  return {
    key,
    keyKind,
    orgId: options.orgId ?? readEnv('HONEYSTICK_ORG_ID') ?? null,
    environment,
    deployment,
    apiUrl: `${origin.replace(/\/+$/, '')}/api/${API_VERSION}`,
    returnUrl: options.returnUrl ?? readEnv('HONEYSTICK_RETURN_URL') ?? null,
    cancelUrl: options.cancelUrl ?? readEnv('HONEYSTICK_CANCEL_URL') ?? null,
    notifyUrl: options.notifyUrl ?? readEnv('HONEYSTICK_NOTIFY_URL') ?? null,
    fetch: options.fetch ?? globalThis.fetch?.bind(globalThis),
  };
}
