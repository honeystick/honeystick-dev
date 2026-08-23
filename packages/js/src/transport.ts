import {
  DEFAULT_PATH_PREFIX,
  resolveConfig,
  type ClientOptions,
  type Environment,
  type ResolvedConfig,
} from './config.js';
import { toHoneystickError } from './errors.js';

export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * `fetch`'s credentials mode, spelled out rather than borrowed.
 *
 * The DOM lib calls this `RequestCredentials`, and using that name would make
 * this package need the DOM lib - which it must not, because it also runs on a
 * Node server, where a tsconfig has no business claiming `window` exists. The
 * symptom of getting it wrong is that the Express adapter will not typecheck at
 * all, in a file that mentions neither Express nor credentials.
 */
export type CredentialsMode = 'omit' | 'same-origin' | 'include';

export type RequestArgs = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Query;
  body?: unknown;
};

/**
 * How a call reaches Honeystick. There are two ways and the difference is
 * where the secret key is:
 *
 * - `directTransport` runs on a server and holds the key itself.
 * - `proxyTransport` runs in a browser or an app, holds nothing, and talks to
 *   a Honeystick handler mounted on the caller's own server (at /billing by
 *   default) which adds the key on the way through.
 *
 * Every resource method is written against this interface, so the same client
 * code works on both sides of that line.
 */
export type Transport = {
  request<T>(args: RequestArgs): Promise<T>;
  readonly environment: Environment;
  readonly orgId: string | null;
  /** the app's own pages, for the calls that hand a customer to a provider */
  readonly returnUrl: string | null;
  readonly cancelUrl: string | null;
  /** the app's own server, for the call that reports a payment settled */
  readonly notifyUrl: string | null;
};

const withQuery = (url: string, query?: Query) => {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
};

const joinPath = (base: string, path: string) =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

async function send<T>({
  fetchImpl,
  url,
  method,
  body,
  headers,
  credentials,
}: {
  fetchImpl: typeof globalThis.fetch;
  url: string;
  method: RequestArgs['method'];
  body?: unknown;
  headers: Record<string, string>;
  credentials?: CredentialsMode;
}): Promise<T> {
  if (!fetchImpl) {
    throw new Error(
      'No fetch implementation available. Pass one as `fetch` when creating the client.',
    );
  }

  const response = await fetchImpl(url, {
    method,
    credentials,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  // The envelope carries its own ok/status, and a body can arrive alongside an
  // error (track-usage returns the current counter with its 403). Trust the
  // envelope when it is there, the HTTP status when it is not.
  const envelope = payload as
    | { ok?: boolean; status?: number; body?: unknown; error?: unknown }
    | null;
  const failed = envelope?.ok === false || !response.ok;

  if (failed) {
    throw toHoneystickError({
      status: envelope?.status ?? response.status,
      payload,
    });
  }

  return (envelope && 'body' in envelope ? envelope.body : payload) as T;
}

const safeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Server side: holds the secret key and calls Honeystick directly. */
export function directTransport(options: ClientOptions = {}): Transport {
  const config: ResolvedConfig = resolveConfig(options);

  return {
    environment: config.environment,
    orgId: config.orgId,
    returnUrl: config.returnUrl,
    cancelUrl: config.cancelUrl,
    notifyUrl: config.notifyUrl,
    request: <T>({ method, path, query, body }: RequestArgs) =>
      send<T>({
        fetchImpl: config.fetch,
        url: withQuery(joinPath(config.apiUrl, path), query),
        method,
        body,
        headers: {
          // The key is the whole credential: it names its own environment and
          // carries the claim of which organization it belongs to, so there is
          // nothing for the caller to assert alongside it. Which deployment
          // answers is decided by the URL, not by a header.
          ...(config.key ? { authorization: `Bearer ${config.key}` } : {}),
        },
      }),
  };
}

export type ProxyOptions = {
  /** where the adapter is mounted on the caller's own server */
  pathPrefix?: string;
  /**
   * Origin of that server, e.g. https://api.yourapp.com. Omit in a browser to
   * use the origin the page came from; required on native, which was not served
   * from anywhere.
   */
  backendUrl?: string;
  publishableKey?: string;
  orgId?: string;
  environment?: Environment;
  /** as on the server client - your own pages, carried by `checkout` */
  returnUrl?: string;
  cancelUrl?: string;
  /**
   * Deliberately available here too, and deliberately rarely right.
   *
   * A browser or an app has no server for Honeystick to call back, so a
   * notify url set on a proxy client is almost always the caller confusing
   * "where I am" with "where my server is". It is accepted because the handler
   * this client talks to may legitimately want the browser to name a per-tenant
   * callback - but if you are reaching for it, check first that it should not
   * be set on the server client instead.
   */
  notifyUrl?: string;
  /**
   * Send cookies with the request. Needed whenever the handler's `identify`
   * reads a session - which is the normal case - and required explicitly once
   * the backend is on a different origin, since fetch drops credentials
   * cross-origin unless asked.
   */
  includeCredentials?: boolean;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

/**
 * Client side: no key, no Honeystick origin. Calls the caller's own server on
 * the path their adapter is mounted at, which is the only place the secret key
 * exists.
 */
export function proxyTransport(options: ProxyOptions = {}): Transport {
  const prefix = options.pathPrefix ?? DEFAULT_PATH_PREFIX;
  const origin = options.backendUrl?.replace(/\/+$/, '') ?? '';
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);

  return {
    environment: options.environment ?? 'sandbox',
    orgId: options.orgId ?? null,
    returnUrl: options.returnUrl ?? null,
    cancelUrl: options.cancelUrl ?? null,
    notifyUrl: options.notifyUrl ?? null,
    request: <T>({ method, path, query, body }: RequestArgs) =>
      send<T>({
        fetchImpl,
        url: withQuery(`${origin}${joinPath(prefix, path)}`, query),
        method,
        body,
        credentials: options.includeCredentials ? 'include' : undefined,
        headers: {
          ...options.headers,
          ...(options.publishableKey
            ? { 'x-honeystick-publishable-key': options.publishableKey }
            : {}),
        },
      }),
  };
}
