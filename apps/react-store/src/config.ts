/**
 * Where the Express API is.
 *
 * `VITE_` because that is the prefix Vite inlines into the bundle, and the
 * inlining is the point to be careful about: anything here is served to every
 * visitor. An address is fine to publish. A secret key never is - and the
 * reason this app needs none is that the Express server holds it and this only
 * ever talks to `/billing`.
 *
 * The same rule as `NEXT_PUBLIC_` in the Next store and `EXPO_PUBLIC_` in the
 * Expo one. Three frameworks, three prefixes, one meaning.
 */
export const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
).replace(/\/+$/, '');

/**
 * Where the Honeystick badge points: the Honeystick **app**.
 *
 * honeystick.co.za in production, dev.honeystick.co.za on preview, and
 * localhost:8081 when it is running on this machine. Three similar names worth
 * keeping apart - this one is the app a person is sent to, `HONEYSTICK_URL` is
 * the API a server calls, and a demo store's own address is neither.
 *
 * Undefined is supported: the badge falls back to Honeystick's own site, which
 * is the right answer for anyone who cloned this and has no deployment.
 */
export const HONEYSTICK_APP_URL = import.meta.env.VITE_HS_APP_URL?.replace(
  /\/+$/,
  '',
);

/** artwork lives on the API's own origin, as a path the catalogue hands back */
export const imageUrl = (path: string) => `${API_URL}${path}`;
