/**
 * Where the backend is.
 *
 * Required, and there is no sensible default to fall back on: a browser can
 * resolve `/billing` against the origin it was served from, and an app was not
 * served from anywhere. That asymmetry is the whole reason
 * `@honeystick/expo`'s provider makes `backendUrl` mandatory where the web one
 * leaves it optional.
 *
 * `EXPO_PUBLIC_` is not decoration. Expo inlines those variables into the app
 * bundle at build time, which makes this readable by anyone who has the app -
 * exactly as `NEXT_PUBLIC_` is readable by anyone with the page. An API URL is
 * fine to publish. A secret key never is, and the reason this app needs none is
 * that the Express server holds it and this only ever talks to /billing.
 */
const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

/**
 * localhost is a trap on a device.
 *
 * The Android emulator maps the host machine to 10.0.2.2, and a physical phone
 * cannot reach the laptop's loopback at all - so a default of localhost works
 * only in the iOS simulator and on web, and fails everywhere else with a bare
 * "network request failed". Better to say so than to appear to work in one place.
 */
export const API_URL = configured ?? 'http://localhost:4000';

export const isApiUrlConfigured = !!configured;

/** artwork lives on the store's own server, as a path the catalogue hands back */
export const imageUrl = (imagePath: string) => `${API_URL}${imagePath}`;
