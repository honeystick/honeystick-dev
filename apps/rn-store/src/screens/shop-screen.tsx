import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useListPlans } from '@honeystick/react-native';

import { getStorefront, resetDemo } from '../api';
import ProductCard from '../components/product-card';
import ServiceCard from '../components/service-card';
import ServiceSheet from '../components/service-sheet';
import { API_URL } from '../config';
import { useCart } from '../hooks/use-cart';
import { useSubscription } from '../hooks/use-subscription';
import { theme } from '../theme';
import type { RootStackParamList } from '../navigation';
import type { Service, Storefront } from '../types';

/**
 * The shop floor.
 *
 * Two different reads, on purpose, because they demonstrate two different
 * halves of the integration:
 *
 *   - the storefront comes from the Express app's `/api/storefront`, which is
 *     the store's own shaped view of the catalogue - categories, stock, copy.
 *     That is the store's business rather than Honeystick's.
 *   - `useListPlans` comes from the SDK, over the proxy transport, through
 *     `/billing/plans` on that same server. No key is involved anywhere in this
 *     app, and that call working on a device is the thing
 *     `@honeystick/react-native` exists to make true.
 *
 * The second is rendered as a small line of provenance rather than as the shop,
 * because a raw billing catalogue is not a shop window - but seeing the count
 * agree with the shelves is how you know the SDK reached Honeystick.
 */
export default function ShopScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { cartCount } = useCart();
  const { subscription } = useSubscription();

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeService, setActiveService] = useState<Service | null>(null);
  const [resetting, setResetting] = useState(false);

  // straight from Honeystick, through the handler on the store's own server
  const plans = useListPlans();

  const load = useCallback(async () => {
    try {
      setError(null);
      setStorefront(await getStorefront());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load the store.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), plans.refetch()]);
    setRefreshing(false);
  }, [load, plans]);

  /**
   * Three things move together, and missing any one of them looks like the
   * button not working: the server's counters, the copy of the catalogue this
   * screen is holding, and the SDK's cached plan list.
   */
  const onReset = useCallback(async () => {
    setResetting(true);
    try {
      await resetDemo();
      await Promise.all([load(), plans.refetch()]);
    } catch {
      // a reset that fails is not worth an error screen - the shelves simply
      // stay where they were, which the next pull-to-refresh will show
    } finally {
      setResetting(false);
    }
  }, [load, plans]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>Cannot reach the store</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Text style={styles.errorHint}>
          This app points at {API_URL}. On a device or the Android emulator that
          address is not the machine running the API — put its LAN address in
          src/config.ts.
        </Text>
        <Pressable onPress={load} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!storefront) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colorAlt} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={storefront.products}
        keyExtractor={(product) => product.ext_id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        // The cart bar floats over the list, so the list has to end above it or
        // the last row of products can never be scrolled into view.
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom +
              theme.spacing +
              (cartCount > 0 ? CART_BAR_HEIGHT + theme.spacing * 0.75 : 0),
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {/* The way back into a subscription that already exists. Without
                it the account screen is reachable only in the moments right
                after a checkout, which is exactly when it matters least. */}
            {subscription && (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Account')}
                style={({ pressed }) => [
                  styles.planBar,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.planBarText}>
                  <Text style={styles.planBarTitle}>Your subscription</Text>
                  <Text style={styles.planBarNote} numberOfLines={1}>
                    {subscription.planName} · {subscription.reference}
                  </Text>
                </View>
                <Text style={styles.planBarAction}>Manage</Text>
              </Pressable>
            )}

            <Text style={styles.provenance}>
              {plans.isLoading
                ? 'Reading the catalogue from Honeystick…'
                : plans.error
                  ? `Honeystick: ${plans.error.message}`
                  : `${plans.data?.length ?? 0} plans, read with the SDK via /billing — the secret key stays on the API.`}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void onReset()}
              disabled={resetting}
              style={({ pressed }) => [
                styles.reset,
                (pressed || resetting) && styles.pressed,
              ]}
            >
              <Text style={styles.resetText}>
                {resetting ? 'Resetting…' : 'Reset demo data'}
              </Text>
            </Pressable>

            <Text style={styles.sectionHeading}>Products</Text>
          </View>
        }
        renderItem={({ item }) => <ProductCard product={item} />}
        ListFooterComponent={
          storefront.services.length ? (
            <View style={styles.footer}>
              {/* Deliberately outside the product grid. The shop floor sells
                  goods bought once; the services counter sells subscriptions,
                  and a delivery plan is not a kind of jewellery. */}
              <Text style={styles.sectionHeading}>Subscriptions</Text>
              {storefront.services.map((service) => (
                <ServiceCard
                  key={service.ext_id}
                  service={service}
                  onOpen={() => setActiveService(service)}
                />
              ))}
            </View>
          ) : undefined
        }
      />

      {cartCount > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Cart')}
          style={[
            styles.cartBar,
            { bottom: insets.bottom + theme.spacing * 0.75 },
          ]}
        >
          <Text style={styles.cartBarText}>View cart ({cartCount})</Text>
        </Pressable>
      )}

      <ServiceSheet
        service={activeService}
        onClose={() => setActiveService(null)}
        onSubscribed={() => {
          void load();
          navigation.navigate('Account');
        }}
      />
    </View>
  );
}

/**
 * The cart bar's height, stated once.
 *
 * Two things need it and they must agree: the bar's own padding, and how far
 * short of the bottom the product list has to stop. Measuring it with onLayout
 * would be more honest but would also reflow the list on first paint, and this
 * is a button whose size is decided right here.
 */
const CART_BAR_HEIGHT = 48;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  list: { padding: theme.spacing },
  column: { gap: theme.spacing * 0.5, marginBottom: theme.spacing * 0.5 },
  header: { gap: 8 },

  planBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing * 0.75,
    backgroundColor: theme.bgSecondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.colorAlt,
    padding: theme.spacing * 0.75,
  },
  planBarText: { flex: 1, gap: 2 },
  planBarTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: theme.colorPrimary,
  },
  planBarNote: { fontSize: 11, color: theme.colorSecondary },
  planBarAction: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colorSecondary,
  },

  provenance: { fontSize: 11, color: theme.colorSecondary },
  reset: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colorAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetText: { fontSize: 11, color: theme.colorSecondary, fontWeight: '600' },

  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colorPrimary,
    marginTop: 4,
    marginBottom: theme.spacing * 0.5,
  },
  footer: { marginTop: theme.spacing },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing * 1.5,
    gap: 10,
    backgroundColor: theme.bgPrimary,
  },
  errorHeading: { fontSize: 18, fontWeight: '700', color: theme.colorPrimary },
  errorBody: { color: theme.colorSecondary, textAlign: 'center' },
  errorHint: {
    fontSize: 12,
    color: theme.colorSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  retry: {
    marginTop: 6,
    backgroundColor: theme.bgMuted,
    paddingHorizontal: theme.spacing,
    paddingVertical: 10,
  },
  retryText: { color: theme.colorLight },

  cartBar: {
    position: 'absolute',
    left: theme.spacing,
    right: theme.spacing,
    height: CART_BAR_HEIGHT,
    backgroundColor: theme.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarText: { color: theme.colorLight, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
