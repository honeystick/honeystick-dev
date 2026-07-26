import type { ClientOptions } from './config';
import { createResources, type Resources } from './resources';
import {
  directTransport,
  proxyTransport,
  type ProxyOptions,
  type Transport,
} from './transport';

export {
  API_URLS,
  DEFAULT_PATH_PREFIX,
  ENVIRONMENTS,
  HoneystickConfigError,
  parseKey,
  type ClientOptions,
  type Environment,
  type KeyKind,
} from './config';
export { HoneystickError } from './errors';
export type { ListArgs, Paged, Resources } from './resources';
export type { ProxyOptions, Transport } from './transport';

export type Honeystick = Resources & {
  readonly environment: Transport['environment'];
  readonly orgId: Transport['orgId'];
};

/**
 * A server-side client. Holds the secret key, calls Honeystick directly.
 *
 * ```ts
 * const honeystick = createHoneystick({
 *   secretKey: process.env.HONEYSTICK_SECRET_KEY,
 *   orgId: process.env.HONEYSTICK_ORG_ID,
 * });
 * await honeystick.customerPlans.trackUsage(planId, { feature_id: 'usage' });
 * ```
 */
export function createHoneystick(options: ClientOptions = {}): Honeystick {
  const transport = directTransport(options);
  return Object.assign(createResources(transport), {
    environment: transport.environment,
    orgId: transport.orgId,
  });
}

/**
 * A browser or app client. Holds no secret: it calls the Honeystick handler
 * mounted on your own server, which is where the key lives.
 *
 * ```ts
 * const honeystick = createHoneystickClient({ pathPrefix: '/billing' });
 * const plans = await honeystick.plans.list();
 * ```
 */
export function createHoneystickClient(
  options: ProxyOptions = {},
): Honeystick {
  const transport = proxyTransport(options);
  return Object.assign(createResources(transport), {
    environment: transport.environment,
    orgId: transport.orgId,
  });
}
