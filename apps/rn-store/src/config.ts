/**
 * Where the backend is.
 *
 * A plain constant, and that is the one place bare React Native is genuinely
 * more awkward than Expo. Expo inlines `EXPO_PUBLIC_*` into the bundle at build
 * time; bare React Native has no equivalent without adding a config library and
 * a native build step for it. For a sample whose only setting is an address,
 * one editable constant is the honest trade - and the comment is here so nobody
 * goes looking for the .env file that does not exist.
 *
 * What must never live here is a secret key. An app bundle is readable by
 * anyone who has the app, so a key compiled into one is a published key - the
 * same argument as `NEXT_PUBLIC_` on the web, with the same answer. The reason
 * this app needs none is that the Express server holds it and this only ever
 * talks to /billing.
 *
 * localhost is a trap on a device. The Android emulator maps the host machine to
 * 10.0.2.2, and a physical phone cannot reach the laptop's loopback at all - so
 * the default below works in the iOS simulator and nowhere else. Put the
 * machine's LAN address here before running on hardware.
 */
export const API_URL = 'http://localhost:4000';

/**
 * The app's own URL scheme, and the only place it is written down in JS.
 *
 * It has to agree with three other things or the payment never comes back:
 * CFBundleURLSchemes in ios/DepotStore/Info.plist, the BROWSABLE intent filter
 * in android/app/src/main/AndroidManifest.xml, and the `scheme` this app sends
 * to POST /api/subscribe.
 */
export const APP_SCHEME = 'depotstore';
