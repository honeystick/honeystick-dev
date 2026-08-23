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

/** artwork lives on the API's own origin, as a path the catalogue hands back */
export const imageUrl = (path: string) => `${API_URL}${path}`;
