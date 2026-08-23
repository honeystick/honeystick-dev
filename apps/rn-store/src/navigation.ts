import type { LinkingOptions } from '@react-navigation/native';

import { APP_SCHEME } from './config';

/**
 * The screens, and the params each one takes.
 *
 * Written out by hand, which is the visible cost of not having expo-router:
 * there is no file-system convention generating this, so a screen that exists
 * and is not listed here is a screen nothing can navigate to. In exchange it is
 * one file that says what the whole app is.
 */
export type RootStackParamList = {
  Shop: undefined;
  Cart: undefined;
  Checkout: undefined;
  Account: { status?: string } | undefined;
};

/**
 * How a `depotstore://` link becomes a screen.
 *
 * This is the return leg of the payment. PayFast is handed an http(s) return
 * url and will not take a custom scheme, so the shopper lands on the store
 * API's /return page, which navigates to `depotstore://account?status=...` -
 * and this is what turns that into the account screen.
 *
 * It has to agree with the scheme registered natively in
 * ios/DepotStore/Info.plist and android/app/src/main/AndroidManifest.xml. A
 * mismatch is silent: the link opens nothing, and the shopper is left on a web
 * page telling them to return to an app that never comes forward.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [`${APP_SCHEME}://`],
  config: {
    screens: {
      Shop: 'shop',
      Cart: 'cart',
      Checkout: 'checkout',
      Account: 'account',
    },
  },
};
