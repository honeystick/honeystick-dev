import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HoneystickProvider } from '@honeystick/react-native';

import HoneystickFab from './components/honeystick-fab';
import { API_URL } from './config';
import { CartProvider } from './hooks/use-cart';
import { StoreEventsProvider } from './hooks/use-store-events';
import { linking, type RootStackParamList } from './navigation';
import AccountScreen from './screens/account-screen';
import CartScreen from './screens/cart-screen';
import CheckoutScreen from './screens/checkout-screen';
import ShopScreen from './screens/shop-screen';
import { theme } from './theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Honeystick Example App, on bare React Native.
 *
 * `HoneystickProvider` is `@honeystick/react-native`'s, and it is the same
 * provider the web store uses with one difference: `backendUrl` is required. A
 * page can call `/billing` on the origin it was served from; an app was not
 * served from anywhere, so it has to be told where its server is. Leaving it
 * out would resolve every call against nothing and fail at runtime, so the
 * package asks up front.
 *
 * `pathPrefix` is absent because `/billing` is the SDK's default and the
 * Express server mounts there. The Next store has to name `/api/billing` in two
 * places for the opposite reason - it mounts alongside its other routes.
 *
 * The secret key is very much in use - it is what authenticates every call this
 * app's data comes from. What matters is *where* it lives: on the Express
 * server, which attaches it as requests pass through `/billing`. The client
 * this provider builds is the SDK's proxy client, which carries no credential
 * of its own.
 *
 * On native that is not a nicety. An app bundle is readable by anyone who has
 * the app, so a secret key compiled into one is a published secret.
 *
 * `includeCredentials` because the handler's `identify` is expected to read a
 * session. Honeystick Example App has no accounts yet and treats every visitor as the same
 * guest, but the cookie has to be sent for the day it does - and cross-origin,
 * which a native app always is, fetch drops credentials unless asked.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <HoneystickProvider backendUrl={API_URL} includeCredentials>
        <CartProvider>
          {/* Inside HoneystickProvider, because the stream's whole job is to
              invalidate the react-query cache that provider owns. Outside the
              navigator, because one app is one connection - see the note in
              use-store-events. */}
          <StoreEventsProvider>
            <StatusBar barStyle="dark-content" />
            <NavigationContainer linking={linking}>
              {/* The navigator is wrapped rather than the FAB being dropped into
                each screen. React Native has no `position: fixed` - an
                absolutely positioned view is positioned against its parent - so
                the only way to float something over every screen is to have a
                parent that contains every screen. */}
              <View style={{ flex: 1 }}>
                <Stack.Navigator
                  screenOptions={{
                    headerStyle: { backgroundColor: theme.bgSecondary },
                    headerTintColor: theme.colorPrimary,
                    headerTitleStyle: { fontWeight: '600' },
                    contentStyle: { backgroundColor: theme.bgPrimary },
                  }}
                >
                  <Stack.Screen
                    name="Shop"
                    component={ShopScreen}
                    options={{ title: 'Honeystick Example App' }}
                  />
                  <Stack.Screen
                    name="Cart"
                    component={CartScreen}
                    options={{ title: 'Your cart' }}
                  />
                  <Stack.Screen
                    name="Checkout"
                    component={CheckoutScreen}
                    options={{ title: 'Checkout' }}
                  />
                  {/* No back arrow. The screen's own back control cancels the
                    subscription on the way out, and a header chevron beside it
                    would be a second exit that quietly does not - which is the
                    one thing this demo cannot afford, because that exit leaves
                    a live plan billing on somebody's real account. */}
                  <Stack.Screen
                    name="Account"
                    component={AccountScreen}
                    options={{
                      title: 'Your subscription',
                      headerBackVisible: false,
                      gestureEnabled: false,
                    }}
                  />
                </Stack.Navigator>
                <HoneystickFab />
              </View>
            </NavigationContainer>
          </StoreEventsProvider>
        </CartProvider>
      </HoneystickProvider>
    </SafeAreaProvider>
  );
}
