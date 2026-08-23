import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResetDemo from '@/components/reset-demo';
import { useCart } from '@/hooks/use-cart';
import { imageUrl } from '@/lib/config';
import { money, theme } from '@/lib/theme';

export default function CartScreen() {
  const router = useRouter();
  const {
    cart,
    cartTotal,
    isLoaded,
    increaseProductQuantity,
    decreaseProductQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const insets = useSafeAreaInsets();

  const lines = Object.values(cart);

  if (isLoaded && !lines.length) {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          <ResetDemo />
          <Text style={styles.empty}>Your cart is empty.</Text>
          <Link href="/" style={styles.link}>
            Back to the store
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.padded}>
        <ResetDemo />

        {lines.map(({ product, quantity }) => {
          const stockLeft = product.stock - quantity;
          return (
            <View key={product.ext_id} style={styles.row}>
              <Image
                source={imageUrl(product.image)}
                style={styles.image}
                contentFit="contain"
                accessibilityLabel={product.title}
              />

              <View style={styles.rowBody}>
                <Text style={styles.title} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={styles.unit}>{money(product.price)} each</Text>
                <Pressable onPress={() => removeFromCart(product.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>

              <View style={styles.rowEnd}>
                <View style={styles.quantityRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease quantity of ${product.title}`}
                    onPress={() => decreaseProductQuantity(product)}
                    style={({ pressed }) => [
                      styles.step,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{quantity}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Increase quantity of ${product.title}`}
                    onPress={() => increaseProductQuantity(product)}
                    disabled={stockLeft <= 0}
                    style={({ pressed }) => [
                      styles.step,
                      (pressed || stockLeft <= 0) && styles.pressed,
                    ]}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.lineTotal}>
                  {money(product.price * quantity)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + theme.spacing },
        ]}
      >
        <View style={styles.totalRow}>
          <Pressable
            accessibilityRole="button"
            onPress={clearCart}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear cart</Text>
          </Pressable>
          <Text style={styles.total}>Total {money(cartTotal)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/checkout')}
          style={({ pressed }) => [styles.checkout, pressed && styles.pressed]}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bgPrimary },
  padded: { padding: theme.spacing, gap: theme.spacing * 0.5 },
  empty: { color: theme.colorSecondary, marginBottom: 8 },
  link: { color: theme.colorAlt, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    gap: theme.spacing * 0.75,
    backgroundColor: theme.bgSecondary,
    padding: theme.spacing * 0.75,
  },
  image: { width: 64, height: 64 },
  rowBody: { flex: 1, gap: 2 },
  title: { color: theme.colorPrimary, fontWeight: '600' },
  unit: { fontSize: 12, color: theme.colorSecondary },
  remove: { fontSize: 12, color: theme.danger, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    backgroundColor: theme.bgMuted,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.colorLight, fontSize: 16, lineHeight: 18 },
  quantity: {
    minWidth: 26,
    textAlign: 'center',
    color: theme.colorPrimary,
    fontWeight: '600',
  },
  lineTotal: { fontWeight: '700', color: theme.colorPrimary },
  footer: {
    padding: theme.spacing,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: theme.bgSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clear: {
    backgroundColor: theme.bgSecondary,
    paddingHorizontal: theme.spacing * 0.75,
    paddingVertical: 8,
  },
  clearText: { color: theme.colorSecondary, fontSize: 12 },
  total: { fontWeight: '700', color: theme.colorPrimary },
  checkout: {
    backgroundColor: theme.bgMuted,
    padding: theme.spacing * 0.9,
    alignItems: 'center',
  },
  checkoutText: { color: theme.colorLight, fontWeight: '700' },
  pressed: { opacity: 0.64 },
});
