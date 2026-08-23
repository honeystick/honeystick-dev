import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { useListPlans } from '@honeystick/expo';

import CustomerPlanBar from '@/components/customer-plan-bar';
import ProductCard from '@/components/product-card';
import ServiceCard from '@/components/service-card';
import ServiceSheet from '@/components/service-sheet';
import { useCart } from '@/hooks/use-cart';
import { getStorefront, type Storefront } from '@/lib/api';
import { API_URL, isApiUrlConfigured } from '@/lib/config';
import { theme } from '@/lib/theme';

import type { zServiceType } from '@/types/service';

/**
 * The shop floor.
 *
 * Two different reads, on purpose, because they demonstrate two different halves
 * of the integration:
 *
 *   - the storefront comes from the Express app's `/api/storefront`, which is the
 *     store's own shaped view of the catalogue - artwork, categories, stock. That
 *     is the equivalent of the Next store's server component, and it is the
 *     store's business rather than Honeystick's.
 *   - `useListPlans` comes from the SDK, over the proxy transport, through
 *     `/billing/plans` on that same server. No key is involved anywhere in this
 *     app, and that call working on a device is the thing `@honeystick/expo`
 *     exists to make true.
 *
 * The second is rendered as a small line of provenance rather than as the shop,
 * because a raw billing catalogue is not a shop window - but seeing the count
 * agree with the shelves is how you know the SDK reached Honeystick.
 */
export default function ShopFloor() {
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeService, setActiveService] = useState<zServiceType | null>(null);

  const { cartCount } = useCart();

  /**
   * The floating cart bar sits over the system navigation.
   *
   * Edge-to-edge is mandatory on current Android rather than opt-in, so the
   * gesture bar and the nav buttons are drawn on top of this screen instead of
   * beside it. A fixed offset happens to look right on the phone it was written
   * on and puts the button under the home indicator on the next one, so the
   * inset is measured rather than guessed. `SafeAreaProvider` is already at the
   * root - expo-router's own ExpoRoot mounts it - so this only has to ask.
   */
  const insets = useSafeAreaInsets();

  /**
   * Flattened to one object, not left as an array.
   *
   * `<Link asChild>` clones its child through a Slot and merges props into it,
   * and a Slot cannot merge a style array with whatever the parent is also
   * passing - it warns and picks one. Flattening here does the merge ourselves,
   * so the inset survives.
   */
  const cartBarStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.cartBar,
        // clear of the gesture bar, and clear of nothing on a phone that has
        // none - insets.bottom is 0 there
        { bottom: insets.bottom + theme.spacing * 0.75 },
      ]),
    [insets.bottom],
  );

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

  /** the reset changed the server's counters, so both reads are now stale */
  const onReset = useCallback(() => {
    void load();
    void plans.refetch();
  }, [load, plans]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorHeading}>Cannot reach the store</Text>
        <Text style={styles.errorBody}>{error}</Text>
        {!isApiUrlConfigured && (
          <Text style={styles.errorHint}>
            EXPO_PUBLIC_API_URL is not set, so this fell back to {API_URL}. On a
            device or the Android emulator that address is not the machine
            running the API — use its LAN IP.
          </Text>
        )}
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
        // The bar floats over the list, so the list has to end above it or the
        // last row of products can never be scrolled into view.
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
            <CustomerPlanBar />
            <Text style={styles.provenance}>
              {plans.isLoading
                ? 'Reading the catalogue from Honeystick…'
                : plans.error
                  ? `Honeystick: ${plans.error.message}`
                  : `${plans.data?.length ?? 0} plans, read with the SDK via /billing — the secret key stays on the API.`}
            </Text>
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
              <Text style={styles.sectionHeading}>Subscriptions available</Text>
              {storefront.services.map((service) => (
                <ServiceCard
                  key={service.ext_id}
                  service={service}
                  onOpen={() => setActiveService(service)}
                />
              ))}
            </View>
          ) : null
        }
      />

      {cartCount > 0 && (
        <Link href="/cart" asChild>
          <Pressable style={cartBarStyle}>
            <Text style={styles.cartBarText}>View cart ({cartCount})</Text>
          </Pressable>
        </Link>
      )}

      <ServiceSheet
        service={activeService}
        onClose={() => setActiveService(null)}
        onSubscribed={onReset}
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
  // paddingBottom is applied inline - it depends on the safe-area inset and on
  // whether the cart bar is showing
  list: { padding: theme.spacing },
  column: { gap: theme.spacing * 0.5, marginBottom: theme.spacing * 0.5 },
  header: { gap: 6 },
  provenance: {
    fontSize: 11,
    color: theme.colorSecondary,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colorPrimary,
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
  errorHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colorPrimary,
  },
  errorBody: { textAlign: 'center', color: theme.colorSecondary },
  errorHint: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colorAlt,
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
    // `bottom` is applied inline from the safe-area inset
    height: CART_BAR_HEIGHT,
    backgroundColor: theme.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarText: { color: theme.colorLight, fontWeight: '700' },
});
