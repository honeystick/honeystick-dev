import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { HoneystickProvider } from '@honeystick/expo';

import HoneystickFab from '@/components/honeystick-fab';
import { CartProvider } from '@/hooks/use-cart';
import { StoreEventsProvider } from '@/hooks/use-store-events';
import { API_URL } from '@/lib/config';
import { theme } from '@/lib/theme';

/**
 * Honeystick Example App, on native.
 *
 * `HoneystickProvider` here is the same provider the web store uses, re-exported
 * by `@honeystick/expo` with one difference: `backendUrl` is required. A page can
 * call `/billing` on the origin it was served from; an app was not served from
 * anywhere, so it has to be told where its server is. Leaving it out would
 * resolve every call against nothing and fail at runtime, so the package asks up
 * front.
 *
 * `pathPrefix` is absent because `/billing` is the SDK's default and the Express
 * server mounts there. The Next store has to name `/api/billing` in two places
 * for the opposite reason - it mounts alongside its other routes.
 *
 * The secret key is very much in use - it is what authenticates every call this
 * app's data comes from. What matters is *where* it lives: on the Express
 * server, which attaches it as requests pass through `/billing`. The client this
 * provider builds is the SDK's proxy client, which carries no credential of its
 * own and calls that route instead of calling Honeystick.
 *
 * On native that is not a nicety. An app bundle is readable by anyone who has
 * the app, so a secret key compiled into one is a published secret - the same
 * argument as `NEXT_PUBLIC_` on the web, with the same answer. It is also why
 * `EXPO_PUBLIC_API_URL` is allowed to hold an address and nothing else.
 *
 * `includeCredentials` because the handler's `identify` is expected to read a
 * session. Honeystick Example App has no accounts yet and treats every visitor as the same
 * guest, but the cookie has to be sent for the day it does - and cross-origin,
 * which a native app always is, fetch drops credentials unless asked.
 */
export default function RootLayout() {
  return (
    <HoneystickProvider backendUrl={API_URL} includeCredentials>
      <CartProvider>
        {/* Inside HoneystickProvider, because the stream's whole job is to
            invalidate the react-query cache that provider owns. Outside the
            navigator, because one app is one connection - see the note in
            use-store-events. */}
        <StoreEventsProvider>
          <StatusBar style="dark" />
          {/* The Stack is wrapped rather than the FAB being dropped into each
            screen. React Native has no `position: fixed` - an absolutely
            positioned view is positioned against its parent - so the only way
            to float something over every screen is to have a parent that
            contains every screen. */}
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.bgSecondary },
                headerTintColor: theme.colorPrimary,
                headerTitleStyle: { fontWeight: '600' },
                contentStyle: { backgroundColor: theme.bgPrimary },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Demo Store' }} />
              <Stack.Screen
                name="customer"
                options={{ title: 'Customer plan', presentation: 'modal' }}
              />
              <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
              {/* No back arrow. The screen's own back control cancels the
              subscription on the way out, and a header chevron beside it would
              be a second exit that quietly does not - which is the one thing
              this demo cannot afford, because that exit leaves a live plan
              billing on somebody's real account. */}
              <Stack.Screen
                name="account"
                options={{
                  title: 'Your subscription',
                  headerBackVisible: false,
                }}
              />
              <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
              <Stack.Screen
                name="complete"
                options={{ title: 'Order', headerBackVisible: false }}
              />
            </Stack>
            <HoneystickFab />
          </View>
        </StoreEventsProvider>
      </CartProvider>
    </HoneystickProvider>
  );
}
